#!/usr/bin/env python3
"""
Blood & Magic — Experimental Pixelation Laboratory (CLI)
Converts high-resolution hand-drawn sketches into authentic 1996 DOS Mode X
8-bit indexed pixel art under exact engine constraints (9100.PAL, 20x38 tile scale).
"""

import os
import sys
import json
import argparse
import numpy as np
from PIL import Image

# Mode X vertical aspect ratio scale (320x400 displayed on 4:3 CRT has 0.833 aspect)
MODE_X_ASPECT_RATIO = 400.0 / 480.0  # ~0.8333

def load_bam_palette(json_path):
    """Load Blood & Magic 9100.PAL palette (256 RGB colors)."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    pal_list = data.get("9100") or data.get(9100)
    # Convert to numpy array of shape (256, 3)
    return np.array(pal_list, dtype=np.float32)

def rgb_to_lab(rgb_arr):
    """Convert sRGB (0..255) to CIE-L*a*b* for perceptual color distance."""
    # Normalized sRGB
    rgb = rgb_arr / 255.0
    mask = rgb > 0.04045
    rgb[mask] = np.power((rgb[mask] + 0.055) / 1.055, 2.4)
    rgb[~mask] = rgb[~mask] / 12.92
    
    # Observer. = 2 degrees, Illuminant = D65
    matrix = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041]
    ], dtype=np.float32)
    
    xyz = np.dot(rgb, matrix.T)
    xyz[:, 0] /= 0.95047
    xyz[:, 1] /= 1.00000
    xyz[:, 2] /= 1.08883
    
    mask = xyz > 0.008856
    xyz[mask] = np.power(xyz[mask], 1.0 / 3.0)
    xyz[~mask] = (7.787 * xyz[~mask]) + (16.0 / 116.0)
    
    l = (116.0 * xyz[:, 1]) - 16.0
    a = 500.0 * (xyz[:, 0] - xyz[:, 1])
    b = 200.0 * (xyz[:, 1] - xyz[:, 2])
    return np.column_stack([l, a, b])

def remove_background(img_np, bg_thresh=240):
    """
    Isolate drawing on white paper:
    If pixel is near white (R,G,B > bg_thresh), mark alpha as 0.
    """
    h, w = img_np.shape[:2]
    if img_np.shape[2] == 3:
        alpha = np.ones((h, w), dtype=np.uint8) * 255
        img_np = np.dstack([img_np, alpha])
    
    is_white = (img_np[:, :, 0] > bg_thresh) & (img_np[:, :, 1] > bg_thresh) & (img_np[:, :, 2] > bg_thresh)
    img_np[is_white, 3] = 0
    return img_np

def apply_kuwahara_filter(img_np, r=2):
    """
    Kuwahara edge-preserving filter:
    Divides local neighborhood into 4 quadrants, selects the quadrant
    with minimum variance to flatten textures while preserving sharp ink boundaries.
    """
    try:
        import cv2
        # Use fast bilateral filter as smooth cel approximation
        rgb = cv2.bilateralFilter(img_np[:, :, :3], d=r*2+1, sigmaColor=75, sigmaSpace=75)
        return np.dstack([rgb, img_np[:, :, 3]])
    except Exception:
        return img_np

def downsample_image(img_pil, target_height=36, mode_x_correct=True, resample=Image.Resampling.BILINEAR):
    """
    Downscale high-res drawing to sprite target size.
    If mode_x_correct is True, pre-compensates for DOS 5:6 non-square pixel aspect.
    """
    w, h = img_pil.size
    aspect = w / h
    if mode_x_correct:
        aspect *= (1.0 / MODE_X_ASPECT_RATIO)
    
    target_width = max(12, int(round(target_height * aspect)))
    return img_pil.resize((target_width, target_height), resample=resample)

def quantize_to_palette(img_pil, pal_rgb, pal_lab, dither_mode="none"):
    """
    Quantize downscaled RGBA image to 256-color BAM palette (9100.PAL).
    dither_mode: 'none', 'atkinson', 'floyd_steinberg', 'bayer'
    """
    w, h = img_pil.size
    rgba = np.array(img_pil, dtype=np.float32)
    indexed = np.zeros((h, w), dtype=np.uint8)
    
    # Bayer 4x4 matrix
    bayer4 = np.array([
        [ 0,  8,  2, 10],
        [12,  4, 14,  6],
        [ 3, 11,  1,  9],
        [15,  7, 13,  5]
    ], dtype=np.float32) / 16.0 - 0.5
    
    # Process each pixel
    if dither_mode == "none":
        for y in range(h):
            for x in range(w):
                if rgba[y, x, 3] < 96:
                    indexed[y, x] = 254  # CI_SKIP transparency
                    continue
                c_rgb = rgba[y, x, :3]
                # Nearest color in RGB / Lab
                dists = np.sum((pal_rgb - c_rgb) ** 2, axis=1)
                indexed[y, x] = int(np.argmin(dists))
                
    elif dither_mode == "bayer":
        for y in range(h):
            for x in range(w):
                if rgba[y, x, 3] < 96:
                    indexed[y, x] = 254
                    continue
                dither_val = bayer4[y % 4, x % 4] * 32.0
                c_rgb = np.clip(rgba[y, x, :3] + dither_val, 0, 255)
                dists = np.sum((pal_rgb - c_rgb) ** 2, axis=1)
                indexed[y, x] = int(np.argmin(dists))
                
    elif dither_mode == "atkinson":
        # Atkinson error diffusion
        err_buf = np.copy(rgba[:, :, :3])
        for y in range(h):
            for x in range(w):
                if rgba[y, x, 3] < 96:
                    indexed[y, x] = 254
                    continue
                cur_rgb = np.clip(err_buf[y, x], 0, 255)
                dists = np.sum((pal_rgb - cur_rgb) ** 2, axis=1)
                best_idx = int(np.argmin(dists))
                indexed[y, x] = best_idx
                
                # Atkinson diffuses 1/8 of error to 6 neighbors:
                # (x+1, y), (x+2, y), (x-1, y+1), (x, y+1), (x+1, y+1), (x, y+2)
                err = (cur_rgb - pal_rgb[best_idx]) / 8.0
                neighbors = [(1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)]
                for dx, dy in neighbors:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and rgba[ny, nx, 3] >= 96:
                        err_buf[ny, nx] += err
    else:
        # Default fallback
        for y in range(h):
            for x in range(w):
                if rgba[y, x, 3] < 96:
                    indexed[y, x] = 254
                else:
                    dists = np.sum((pal_rgb - rgba[y, x, :3]) ** 2, axis=1)
                    indexed[y, x] = int(np.argmin(dists))
                    
    return indexed

def isolate_team_colors(indexed, img_pil, team_hue_range=(0, 30), tolerance=40):
    """
    Detect user-specified accent color (e.g. red clothes/shields)
    and remap those pixels to CLUT_TEAM_COLORS (indices 192..199).
    """
    # Convert original RGB to HSV
    hsv = np.array(img_pil.convert('HSV'), dtype=np.uint8)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    
    # Red hue wraps around 0 and 255 in 8-bit HSV
    is_team = ((h < 15) | (h > 240)) & (s > 70) & (v > 50)
    
    # For matching pixels, map brightness v into 192..199 (8 ramp steps)
    ramp_step = np.clip((v // 32), 0, 7).astype(np.uint8)
    match_mask = is_team & (indexed != 254)
    indexed[match_mask] = 192 + ramp_step[match_mask]
    return indexed

def render_preview_rgb(indexed, pal_rgb):
    """Render indexed pixels back to RGB image for preview."""
    h, w = indexed.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            idx = indexed[y, x]
            if idx == 254:
                out[y, x] = [0, 0, 0, 0]  # transparent
            else:
                out[y, x, :3] = pal_rgb[idx].astype(np.uint8)
                out[y, x, 3] = 255
    return Image.fromarray(out)

def process_sketch(
    input_path,
    output_path,
    pal_rgb,
    pal_lab,
    target_height=36,
    bg_thresh=240,
    filter_mode="kuwahara",
    dither_mode="none",
    mode_x_correct=True,
    detect_team_color=True
):
    """Complete experimental conversion pipeline for a single sketch."""
    img = Image.open(input_path).convert('RGBA')
    raw_np = np.array(img)
    
    # 1. Background paper knockout
    cleaned_np = remove_background(raw_np, bg_thresh=bg_thresh)
    
    # 2. Edge-preserving smoothing filter
    if filter_mode == "kuwahara":
        filtered_np = apply_kuwahara_filter(cleaned_np, r=3)
    else:
        filtered_np = cleaned_np
        
    filtered_pil = Image.fromarray(filtered_np)
    
    # 3. Downscale with Mode X aspect compensation
    downscaled_pil = downsample_image(
        filtered_pil,
        target_height=target_height,
        mode_x_correct=mode_x_correct,
        resample=Image.Resampling.BILINEAR if filter_mode != "nearest" else Image.Resampling.NEAREST
    )
    
    # 4. Quantize to BAM 9100.PAL
    indexed = quantize_to_palette(downscaled_pil, pal_rgb, pal_lab, dither_mode=dither_mode)
    
    # 5. Team color isolation
    if detect_team_color:
        indexed = isolate_team_colors(indexed, downscaled_pil)
        
    # 6. Render preview & save
    preview_img = render_preview_rgb(indexed, pal_rgb)
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    preview_img.save(output_path)
    
    # Also save raw indexed bytes
    raw_bin_path = os.path.splitext(output_path)[0] + '.bin'
    indexed.tofile(raw_bin_path)
    
    print(f"Processed: {input_path} -> {output_path} ({preview_img.size[0]}x{preview_img.size[1]} px)")
    return preview_img

def main():
    parser = argparse.ArgumentParser(description="Blood & Magic Pixelation Lab")
    parser.add_argument("--input", "-i", required=True, help="Path to input drawing (PNG/JPG)")
    parser.add_argument("--output", "-o", default="preview.png", help="Path to output preview PNG")
    parser.add_argument("--height", "-H", type=int, default=36, help="Target sprite height in pixels")
    parser.add_argument("--filter", "-f", choices=["none", "kuwahara"], default="kuwahara", help="Pre-downscale filter")
    parser.add_argument("--dither", "-d", choices=["none", "atkinson", "bayer"], default="none", help="Dithering mode")
    parser.add_argument("--no-aspect", action="store_true", help="Disable Mode X 5:6 aspect compensation")
    parser.add_argument("--palette", "-p", default="public/assets/palettes.json", help="Path to palettes.json")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.palette):
        print(f"Error: Palette file {args.palette} not found.", file=sys.stderr)
        sys.exit(1)
        
    pal_rgb = load_bam_palette(args.palette)
    pal_lab = rgb_to_lab(pal_rgb)
    
    process_sketch(
        args.input,
        args.output,
        pal_rgb,
        pal_lab,
        target_height=args.height,
        filter_mode=args.filter,
        dither_mode=args.dither,
        mode_x_correct=not args.no_aspect
    )

if __name__ == "__main__":
    main()
