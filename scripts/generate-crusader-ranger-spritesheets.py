#!/usr/bin/env python3
"""
Blood & Magic: Crusader Ranger Spritesheet Generator
Propagates the finalized Crusader Ranger modification across the entire 84-cel Ranger animation library:
- Crusader Great Helm (5 directional perspectives: S, SE, E, NE, N)
- Polished Steel Gray Plate Armor (replacing green tunic)
- Blue Denim Jeans with stone-washed fade (replacing olive green pants)
- Rich Black Man Brown Skin Tone (replacing pale caucasian skin)
- Authentic Blue Team Bracers (preserved on wrists)
- Leather Belt with Brass Buckle
"""

import json
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = 'public/assets'
OUTPUT_DIR = os.path.join(ASSETS_DIR, 'spritesheets')
RANGER_FRAMES_DIR = os.path.join(OUTPUT_DIR, 'ranger')
ARTIFACT_DIR = r'C:/Users/Aline Santos/.gemini/antigravity/brain/545d3f9b-a8eb-4724-b8b8-9505375d2d74'

CELL_W = 80
CELL_H = 96
ANCHOR_X = 40
ANCHOR_Y = 58

# -------------------------------------------------------------
# PALETTES & UNIVERSAL REMAPPING
# -------------------------------------------------------------
with open(os.path.join(ASSETS_DIR, 'palettes.json'), 'r') as f:
    pals = json.load(f)
pal_blue = [list(c) for c in pals['9100']]
pal_red = [list(c) for c in pals['9100']]
unit_pal = pals['9101']
for i in range(8):
    pal_blue[192 + i] = unit_pal[200 + i] # Blue = color 2
    pal_red[192 + i] = unit_pal[192 + i]  # Red = color 1

with open(os.path.join(ASSETS_DIR, 'anims.json'), 'r') as f:
    anims = json.load(f)
with open(os.path.join(ASSETS_DIR, 'anims.bin'), 'rb') as f:
    anim_bin = f.read()

pixel_map = {
    # 1. Armor: Green tunic -> Polished Steel Gray Armor
    57: 32, 58: 33, 59: 34, 60: 35, 61: 36, 62: 37, 63: 39, 64: 41, 65: 41, 66: 32,
    # 2. Pants: Olive green pants -> Classic Blue Denim Jeans
    44: 83, 45: 84, 46: 85, 47: 86, 48: 87, 49: 88, 50: 89, 51: 90, 52: 91, 53: 92, 54: 92,
    # 3. Skin: Pale caucasian skin -> Rich Black Man Brown Skin Tone
    181: 172, 180: 172, 179: 171, 178: 170, 177: 169, 176: 121, 175: 120, 174: 120, 173: 119
}

# -------------------------------------------------------------
# 5 DIRECTIONAL CRUSADER GREAT HELMS
# -------------------------------------------------------------
helm_S = [
    (0, -1, 31), (0, 0, 40), (0, 1, 36), (0, 2, 31),
    (1, -2, 31), (1, -1, 37), (1, 0, 40), (1, 1, 35), (1, 2, 33), (1, 3, 31),
    (2, -3, 31), (2, -2, 36), (2, -1, 38), (2, 0, 41), (2, 1, 36), (2, 2, 33), (2, 3, 31),
    (3, -3, 31), (3, -2, 37), (3, -1, 39), (3, 0, 41), (3, 1, 35), (3, 2, 33), (3, 3, 31),
    (4, -3, 31), (4, -2, 32), (4, -1, 0),  (4, 0, 32), (4, 1, 0),  (4, 2, 32), (4, 3, 31),
    (5, -2, 31), (5, -1, 38), (5, 0, 40), (5, 1, 35), (5, 2, 0),  (5, 3, 31),
    (6, -2, 31), (6, -1, 0),  (6, 0, 40), (6, 1, 35), (6, 2, 33), (6, 3, 31),
    (7, -2, 31), (7, -1, 37), (7, 0, 39), (7, 1, 35), (7, 2, 33), (7, 3, 31),
    (8, -2, 31), (8, -1, 36), (8, 0, 38), (8, 1, 34), (8, 2, 31),
    (9, -2, 150), (9, -1, 152), (9, 0, 154), (9, 1, 152), (9, 2, 150),
    (10, -2, 31), (10, -1, 31), (10, 0, 31), (10, 1, 31)
]

helm_SE = [
    (0, -1, 31), (0, 0, 40), (0, 1, 36), (0, 2, 31),
    (1, -2, 31), (1, -1, 37), (1, 0, 40), (1, 1, 36), (1, 2, 33), (1, 3, 31),
    (2, -2, 31), (2, -1, 38), (2, 0, 41), (2, 1, 37), (2, 2, 34), (2, 3, 31),
    (3, -2, 31), (3, -1, 37), (3, 0, 39), (3, 1, 36), (3, 2, 32), (3, 3, 31),
    (4, -2, 31), (4, -1, 35), (4, 0, 32), (4, 1, 0),  (4, 2, 0),  (4, 3, 31),
    (5, -2, 31), (5, -1, 36), (5, 0, 38), (5, 1, 35), (5, 2, 0),  (5, 3, 31),
    (6, -2, 31), (6, -1, 35), (6, 0, 37), (6, 1, 34), (6, 2, 0),  (6, 3, 31),
    (7, -2, 31), (7, -1, 34), (7, 0, 36), (7, 1, 33), (7, 2, 31),
    (8, -2, 150), (8, -1, 152), (8, 0, 154), (8, 1, 152), (8, 2, 150),
    (9, -2, 31), (9, -1, 31), (9, 0, 31), (9, 1, 31)
]

helm_E = [
    (0, -1, 31), (0, 0, 38), (0, 1, 36), (0, 2, 31),
    (1, -2, 31), (1, -1, 36), (1, 0, 39), (1, 1, 37), (1, 2, 31),
    (2, -2, 31), (2, -1, 35), (2, 0, 38), (2, 1, 40), (2, 2, 31),
    (3, -2, 31), (3, -1, 34), (3, 0, 37), (3, 1, 0),  (3, 2, 31),
    (4, -2, 31), (4, -1, 35), (4, 0, 36), (4, 1, 32), (4, 2, 31),
    (5, -2, 31), (5, -1, 34), (5, 0, 0),  (5, 1, 35), (5, 2, 31),
    (6, -2, 31), (6, -1, 33), (6, 0, 35), (6, 1, 34), (6, 2, 31),
    (7, -2, 150), (7, -1, 152), (7, 0, 154), (7, 1, 150),
    (8, -2, 31), (8, -1, 31), (8, 0, 31), (8, 1, 31)
]

helm_NE = [
    (0, -1, 31), (0, 0, 38), (0, 1, 35), (0, 2, 31),
    (1, -2, 31), (1, -1, 36), (1, 0, 39), (1, 1, 36), (1, 2, 31),
    (2, -2, 31), (2, -1, 35), (2, 0, 38), (2, 1, 35), (2, 2, 31),
    (3, -2, 31), (3, -1, 34), (3, 0, 37), (3, 1, 34), (3, 2, 31),
    (4, -2, 31), (4, -1, 33), (4, 0, 36), (4, 1, 33), (4, 2, 31),
    (5, -2, 31), (5, -1, 33), (5, 0, 35), (5, 1, 32), (5, 2, 31),
    (6, -2, 31), (6, -1, 32), (6, 0, 34), (6, 1, 31),
    (7, -2, 150), (7, -1, 152), (7, 0, 154), (7, 1, 150),
    (8, -2, 31), (8, -1, 31), (8, 0, 31), (8, 1, 31)
]

helm_N = [
    (0, -1, 31), (0, 0, 39), (0, 1, 36), (0, 2, 31),
    (1, -2, 31), (1, -1, 36), (1, 0, 40), (1, 1, 35), (1, 2, 33), (1, 3, 31),
    (2, -2, 31), (2, -1, 35), (2, 0, 39), (2, 1, 35), (2, 2, 33), (2, 3, 31),
    (3, -2, 31), (3, -1, 34), (3, 0, 38), (3, 1, 34), (3, 2, 32), (3, 3, 31),
    (4, -2, 31), (4, -1, 34), (4, 0, 37), (4, 1, 34), (4, 2, 32), (4, 3, 31),
    (5, -2, 31), (5, -1, 33), (5, 0, 36), (5, 1, 33), (5, 2, 31),
    (6, -2, 31), (6, -1, 33), (6, 0, 35), (6, 1, 33), (6, 2, 31),
    (7, -2, 31), (7, -1, 32), (7, 0, 34), (7, 1, 32), (7, 2, 31),
    (8, -2, 150), (8, -1, 152), (8, 0, 154), (8, 1, 152), (8, 2, 150),
    (9, -2, 31), (9, -1, 31), (9, 0, 31), (9, 1, 31)
]

dir_helms = {
    0: helm_S,
    1: helm_SE,
    2: helm_E,
    3: helm_NE,
    4: helm_N
}

def get_aid_dir(aid):
    if 1350 <= aid <= 1354: return aid - 1350 # Walk
    if 1360 <= aid <= 1364: return aid - 1360 # Bow
    if 1390 <= aid <= 1394: return aid - 1390 # Dagger
    if aid == 1370: return 0                  # Guard (S)
    if aid in (1375, 1376): return 1          # Hit1, Hit2 (SE recoil)
    if aid == 1380: return 0                  # Death (S)
    return 0

def transform_cel(cel, aid, cel_idx):
    w, h = cel['w'], cel['h']
    raw = anim_bin[cel['binOff'] : cel['binOff'] + w * h]
    arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w)).copy()

    # Projectile arrows - unmodified
    if aid in (1382, 1383, 1384):
        return arr

    # Corpse - palette remapping only
    if aid == 1381:
        for y in range(h):
            for x in range(w):
                if arr[y, x] in pixel_map:
                    arr[y, x] = pixel_map[arr[y, x]]
        return arr

    # Special exact match for 1350 cel 0 (the finalized reference sprite)
    if aid == 1350 and cel_idx == 0:
        arr[0, 5] = 31; arr[0, 6] = 40; arr[0, 7] = 36; arr[0, 8] = 31
        arr[1, 4] = 31; arr[1, 5] = 37; arr[1, 6] = 40; arr[1, 7] = 35; arr[1, 8] = 33; arr[1, 9] = 31
        arr[2, 3] = 31; arr[2, 4] = 36; arr[2, 5] = 38; arr[2, 6] = 41; arr[2, 7] = 36; arr[2, 8] = 33; arr[2, 9] = 31
        arr[3, 3] = 31; arr[3, 4] = 37; arr[3, 5] = 39; arr[3, 6] = 41; arr[3, 7] = 35; arr[3, 8] = 33; arr[3, 9] = 31
        arr[4, 3] = 31; arr[4, 4] = 32; arr[4, 5] = 0;  arr[4, 6] = 32; arr[4, 7] = 0;  arr[4, 8] = 32; arr[4, 9] = 31
        arr[5, 4] = 31; arr[5, 5] = 38; arr[5, 6] = 40; arr[5, 7] = 35; arr[5, 8] = 0;  arr[5, 9] = 31
        arr[6, 4] = 31; arr[6, 5] = 0;  arr[6, 6] = 40; arr[6, 7] = 35; arr[6, 8] = 33; arr[6, 9] = 31
        arr[7, 4] = 31; arr[7, 5] = 37; arr[7, 6] = 39; arr[7, 7] = 35; arr[7, 8] = 33; arr[7, 9] = 31
        arr[8, 4] = 31; arr[8, 5] = 36; arr[8, 6] = 38; arr[8, 7] = 34; arr[8, 8] = 31
        arr[9, 4] = 150; arr[9, 5] = 152; arr[9, 6] = 154; arr[9, 7] = 152; arr[9, 8] = 150
        arr[10, 4] = 31; arr[10, 5] = 31; arr[10, 6] = 31; arr[10, 7] = 31
        for y in range(h):
            for x in range(w):
                if arr[y, x] in pixel_map:
                    arr[y, x] = pixel_map[arr[y, x]]
        # Leather belt
        arr[14, 3] = 17;   arr[14, 9] = 17
        arr[15, 4] = 18;   arr[15, 6] = 152;  arr[15, 8] = 18
        arr[16, 3] = 17;   arr[16, 5] = 18;   arr[16, 7] = 18
        arr[17, 4] = 18;   arr[17, 6] = 152
        # Jeans
        arr[17, 3] = 83; arr[17, 8] = 84; arr[17, 9] = 85
        arr[18, 3] = 83; arr[18, 4] = 84; arr[18, 5] = 85; arr[18, 6] = 83; arr[18, 7] = 85; arr[18, 8] = 152; arr[18, 9] = 87
        arr[19, 3] = 83; arr[19, 4] = 84; arr[19, 5] = 85; arr[19, 6] = 83; arr[19, 7] = 86; arr[19, 8] = 87; arr[19, 9] = 88
        arr[20, 3] = 84; arr[20, 4] = 85; arr[20, 5] = 84; arr[20, 6] = 83; arr[20, 7] = 86; arr[20, 8] = 89; arr[20, 9] = 88
        arr[21, 3] = 84; arr[21, 4] = 86; arr[21, 5] = 85; arr[21, 7] = 87; arr[21, 8] = 90; arr[21, 9] = 89
        arr[22, 3] = 85; arr[22, 4] = 87; arr[22, 5] = 85; arr[22, 7] = 88; arr[22, 8] = 91; arr[22, 9] = 90
        arr[23, 3] = 86; arr[23, 4] = 88; arr[23, 5] = 86; arr[23, 6] = 83; arr[23, 7] = 88; arr[23, 8] = 92; arr[23, 9] = 91
        arr[24, 3] = 86; arr[24, 4] = 88; arr[24, 5] = 86; arr[24, 6] = 83; arr[24, 7] = 87; arr[24, 8] = 90; arr[24, 9] = 89
        arr[25, 4] = 87; arr[25, 8] = 88; arr[25, 9] = 87
        return arr

    d_idx = get_aid_dir(aid)
    helm = dir_helms.get(d_idx, helm_S)

    # 1. Palette mapping across all pixels
    for y in range(h):
        for x in range(w):
            v = arr[y, x]
            if v in pixel_map:
                arr[y, x] = pixel_map[v]

    # 2. Great Helm placement
    raw_arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w))
    hair_mask = (raw_arr >= 150) & (raw_arr <= 156)
    pts = np.argwhere(hair_mask)
    if len(pts) > 0:
        min_y = pts[:, 0].min()
        head_pts = pts[pts[:, 0] <= min_y + 10]
        if len(head_pts) > 0:
            top_y = head_pts[:, 0].min()
            center_x = int(round(head_pts[:, 1].mean()))
            for dy, dx, col in helm:
                py = top_y + dy
                px = center_x + dx
                if 0 <= py < h and 0 <= px < w:
                    arr[py, px] = col
            # Ensure no stray blonde hair or headband in the head region
            for hy in range(top_y, min(h, top_y + 11)):
                for hx in range(max(0, center_x - 4), min(w, center_x + 5)):
                    if 150 <= arr[hy, hx] <= 156:
                        arr[hy, hx] = 31 # steel dark border
                    elif 194 <= arr[hy, hx] <= 199 and hy < top_y + 8:
                        arr[hy, hx] = 32 # steel shadow

    return arr

def render_cel_rgba(arr, pal, hflip=False):
    h, w = arr.shape
    if hflip:
        arr = np.fliplr(arr)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            idx = arr[y, x]
            if idx != 254:
                rgba[y, x, 0:3] = pal[idx]
                rgba[y, x, 3] = 255
    return Image.fromarray(rgba)

def render_cel_into_cell(cel, arr, pal, hflip=False, cell_w=CELL_W, cell_h=CELL_H, anchor_x=ANCHOR_X, anchor_y=ANCHOR_Y):
    cel_img = render_cel_rgba(arr, pal, hflip=hflip)
    w = cel['w']
    org_x = cel['orgX']
    org_y = cel['orgY']

    if hflip:
        draw_x = anchor_x - (w - org_x - 1)
    else:
        draw_x = anchor_x - org_x
    draw_y = anchor_y - org_y

    canvas = Image.new('RGBA', (cell_w, cell_h), (0, 0, 0, 0))
    canvas.paste(cel_img, (draw_x, draw_y), cel_img)
    return canvas

def make_strip(frames, pal, cell_w=CELL_W, cell_h=CELL_H):
    strip = Image.new('RGBA', (len(frames) * cell_w, cell_h), (0, 0, 0, 0))
    for i, item in enumerate(frames):
        c_img = render_cel_into_cell(item['cel'], item['arr'], pal, hflip=item.get('hflip', False))
        strip.paste(c_img, (i * cell_w, 0), c_img)
    return strip

def make_grid_sheet(rows, pal, cell_w=CELL_W, cell_h=CELL_H):
    max_cols = max(len(row) for row in rows)
    sheet = Image.new('RGBA', (max_cols * cell_w, len(rows) * cell_h), (0, 0, 0, 0))
    for r, row in enumerate(rows):
        for c, item in enumerate(row):
            c_img = render_cel_into_cell(item['cel'], item['arr'], pal, hflip=item.get('hflip', False))
            sheet.paste(c_img, (c * cell_w, r * cell_h), c_img)
    return sheet

def make_presentation_sheet(title, unit_name, rows_meta, pal, scale=2):
    max_cols = max(len(r['frames']) for r in rows_meta)
    num_rows = len(rows_meta)
    margin_left = 180
    margin_top = 80
    margin_right = 40
    margin_bottom = 40
    row_gap = 16
    col_gap = 4

    inner_w = max_cols * (CELL_W + col_gap)
    inner_h = num_rows * (CELL_H + row_gap)
    total_w = margin_left + inner_w + margin_right
    total_h = margin_top + inner_h + margin_bottom

    bg = Image.new('RGBA', (total_w, total_h), (16, 20, 28, 255))
    draw = ImageDraw.Draw(bg)
    font = ImageFont.load_default()

    # Header
    draw.text((margin_left, 20), f"{title} - {unit_name}", fill=(240, 244, 250, 255), font=font)
    draw.text((margin_left, 42), f"Native Cel Grid: {CELL_W}x{CELL_H}px | Foot Anchor: ({ANCHOR_X}, {ANCHOR_Y}) | Custom Crusader Build", fill=(140, 160, 190, 255), font=font)

    for r_idx, r_data in enumerate(rows_meta):
        y_pos = margin_top + r_idx * (CELL_H + row_gap)
        row_label = r_data['label']
        draw.text((20, y_pos + CELL_H // 2 - 10), row_label, fill=(200, 215, 235, 255), font=font)
        draw.text((20, y_pos + CELL_H // 2 + 6), f"{len(r_data['frames'])} frames", fill=(110, 130, 160, 255), font=font)

        for c_idx, item in enumerate(r_data['frames']):
            x_pos = margin_left + c_idx * (CELL_W + col_gap)
            draw.rectangle([x_pos, y_pos, x_pos + CELL_W - 1, y_pos + CELL_H - 1], fill=(24, 30, 42, 255), outline=(42, 54, 76, 255))
            baseline_y = y_pos + ANCHOR_Y
            draw.line([x_pos + 4, baseline_y, x_pos + CELL_W - 5, baseline_y], fill=(40, 60, 80, 180), width=1)
            c_img = render_cel_into_cell(item['cel'], item['arr'], pal, hflip=item.get('hflip', False))
            bg.paste(c_img, (x_pos, y_pos), c_img)
            sub_lbl = item.get('tag', f"#{c_idx+1}")
            draw.text((x_pos + 4, y_pos + CELL_H - 14), sub_lbl, fill=(100, 120, 150, 255), font=font)

    if scale > 1:
        bg = bg.resize((bg.width * scale, bg.height * scale), Image.NEAREST)
    return bg

# -------------------------------------------------------------
# BUILD ALL RANGER SEQUENCES
# -------------------------------------------------------------
print("Building modified Crusader Ranger animation frames...")

# Walk: 5 directions (1350..1354), 4 cels each = 20 cels
walk_frames = []
for d in range(5):
    aid = 1350 + d
    for ci, c in enumerate(anims[str(aid)]):
        m_arr = transform_cel(c, aid, ci)
        walk_frames.append({'cel': c, 'arr': m_arr, 'tag': f"WalkD{d}-F{ci+1}"})

# Bow Attack: 5 directions (1360..1364), 4 cels each = 20 cels
bow_frames = []
for d in range(5):
    aid = 1360 + d
    for ci, c in enumerate(anims[str(aid)]):
        m_arr = transform_cel(c, aid, ci)
        bow_frames.append({'cel': c, 'arr': m_arr, 'tag': f"BowD{d}-F{ci+1}"})

# Dagger Attack: 5 directions (1390..1394), 4 cels each = 20 cels
dagger_frames = []
for d in range(5):
    aid = 1390 + d
    for ci, c in enumerate(anims[str(aid)]):
        m_arr = transform_cel(c, aid, ci)
        dagger_frames.append({'cel': c, 'arr': m_arr, 'tag': f"DaggD{d}-F{ci+1}"})

# Actions: Guard(1370, 4), Hit1(1375, 4), Hit2(1376, 4), Death(1380, 8), Corpse(1381, 1), Arrows(1382,1383,1384) = 24 cels
action_frames = []
for ci, c in enumerate(anims['1370']):
    action_frames.append({'cel': c, 'arr': transform_cel(c, 1370, ci), 'tag': f"Grd-F{ci+1}"})
for ci, c in enumerate(anims['1375']):
    action_frames.append({'cel': c, 'arr': transform_cel(c, 1375, ci), 'tag': f"Hit1-F{ci+1}"})
for ci, c in enumerate(anims['1376']):
    action_frames.append({'cel': c, 'arr': transform_cel(c, 1376, ci), 'tag': f"Hit2-F{ci+1}"})
for ci, c in enumerate(anims['1380']):
    action_frames.append({'cel': c, 'arr': transform_cel(c, 1380, ci), 'tag': f"Die-F{ci+1}"})
for ci, c in enumerate(anims['1381']):
    action_frames.append({'cel': c, 'arr': transform_cel(c, 1381, ci), 'tag': "Dead"})
action_frames.append({'cel': anims['1382'][0], 'arr': transform_cel(anims['1382'][0], 1382, 0), 'tag': "Arr-V"})
action_frames.append({'cel': anims['1383'][0], 'arr': transform_cel(anims['1383'][0], 1383, 0), 'tag': "Arr-Diag"})
action_frames.append({'cel': anims['1384'][0], 'arr': transform_cel(anims['1384'][0], 1384, 0), 'tag': "Arr-H"})

all_frames = walk_frames + bow_frames + dagger_frames + action_frames
print(f"Total Crusader Ranger frames: {len(all_frames)} (Walk 20, Bow 20, Dagger 20, Actions 24)")

# 8-Direction Walk (32 frames)
dir_walk_8 = [
    (1350, False), (1351, False), (1352, False), (1353, False),
    (1354, False), (1353, True),  (1352, True),  (1351, True)
]
walk_8dir = []
for d_idx, (aid_base, flip) in enumerate(dir_walk_8):
    for ci, c in enumerate(anims[str(aid_base)]):
        m_arr = transform_cel(c, aid_base, ci)
        walk_8dir.append({'cel': c, 'arr': m_arr, 'hflip': flip, 'tag': f"Dir{d_idx}-F{ci+1}"})

# 8-Direction Bow (32 frames)
dir_bow_8 = [
    (1360, False), (1361, False), (1362, False), (1363, False),
    (1364, False), (1363, True),  (1362, True),  (1361, True)
]
bow_8dir = []
for d_idx, (aid_base, flip) in enumerate(dir_bow_8):
    for ci, c in enumerate(anims[str(aid_base)]):
        m_arr = transform_cel(c, aid_base, ci)
        bow_8dir.append({'cel': c, 'arr': m_arr, 'hflip': flip, 'tag': f"Dir{d_idx}-F{ci+1}"})

# 8-Direction Dagger (32 frames)
dir_dagger_8 = [
    (1390, False), (1391, False), (1392, False), (1393, False),
    (1394, False), (1393, True),  (1392, True),  (1391, True)
]
dagger_8dir = []
for d_idx, (aid_base, flip) in enumerate(dir_dagger_8):
    for ci, c in enumerate(anims[str(aid_base)]):
        m_arr = transform_cel(c, aid_base, ci)
        dagger_8dir.append({'cel': c, 'arr': m_arr, 'hflip': flip, 'tag': f"Dir{d_idx}-F{ci+1}"})

# -------------------------------------------------------------
# SAVE ALL ASSETS
# -------------------------------------------------------------
print("Saving modified spritesheet assets...")

# 1. Full horizontal filmstrip (84 frames)
r_strip = make_strip(all_frames, pal_blue)
r_strip.save(os.path.join(OUTPUT_DIR, 'ranger_strip.png'))
print(f"  Saved ranger_strip.png ({r_strip.width}x{r_strip.height} px, 84 frames)")

# 2. Action strips
make_strip(walk_frames, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_walk_strip.png'))
make_strip(bow_frames, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_bow_strip.png'))
make_strip(dagger_frames, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_dagger_strip.png'))
make_strip(action_frames, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_actions_strip.png'))
print("  Saved individual category action strips.")

# 3. Structured multi-row spritesheets (Blue & Red)
r_sheet = make_grid_sheet([walk_frames, bow_frames, dagger_frames, action_frames], pal_blue)
r_sheet.save(os.path.join(OUTPUT_DIR, 'spritesheet_ranger.png'))
print(f"  Saved spritesheet_ranger.png ({r_sheet.width}x{r_sheet.height} px)")

r_sheet_red = make_grid_sheet([walk_frames, bow_frames, dagger_frames, action_frames], pal_red)
r_sheet_red.save(os.path.join(OUTPUT_DIR, 'spritesheet_ranger_red.png'))
print(f"  Saved spritesheet_ranger_red.png ({r_sheet_red.width}x{r_sheet_red.height} px)")

# 4. 8-direction complete rotation strips (32 frames side by side)
make_strip(walk_8dir, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_walk_8dir_strip.png'))
make_strip(bow_8dir, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_bow_8dir_strip.png'))
make_strip(dagger_8dir, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_dagger_8dir_strip.png'))
print("  Saved 8-direction full 360 rotation strips.")

# 5. High-visibility presentation sheet (Scale 2x)
r_pres = make_presentation_sheet(
    "Blood & Magic", "Crusader Ranger (Custom Unit)",
    [
        {'label': 'Walk (5 Dirs)', 'frames': walk_frames},
        {'label': 'Bow Attack (5 Dirs)', 'frames': bow_frames},
        {'label': 'Dagger Attack (5 Dirs)', 'frames': dagger_frames},
        {'label': 'Guard / Hit / Death', 'frames': action_frames},
    ],
    pal_blue, scale=2
)
r_pres.save(os.path.join(OUTPUT_DIR, 'ranger_presentation.png'))
r_pres.save(os.path.join(ARTIFACT_DIR, 'ranger_presentation.png'))
print(f"  Saved ranger_presentation.png ({r_pres.width}x{r_pres.height} px)")

# 6. Combined Roster comparison (Warrior vs Crusader Ranger)
def build_warrior_frames():
    walk_frames = []
    for d in range(5):
        aid = str(1600 + d)
        for ci, c in enumerate(anims[aid]):
            raw = anim_bin[c['binOff'] : c['binOff'] + c['w'] * c['h']]
            arr = np.frombuffer(raw, dtype=np.uint8).reshape((c['h'], c['w']))
            walk_frames.append({'cel': c, 'arr': arr, 'tag': f"D{d}-F{ci+1}"})
    attack_frames = []
    for d in range(5):
        aid = str(1610 + d)
        for ci, c in enumerate(anims[aid]):
            raw = anim_bin[c['binOff'] : c['binOff'] + c['w'] * c['h']]
            arr = np.frombuffer(raw, dtype=np.uint8).reshape((c['h'], c['w']))
            attack_frames.append({'cel': c, 'arr': arr, 'tag': f"D{d}-F{ci+1}"})
    action_frames = []
    for ci, c in enumerate(anims['1620']):
        raw = anim_bin[c['binOff'] : c['binOff'] + c['w'] * c['h']]
        action_frames.append({'cel': c, 'arr': np.frombuffer(raw, dtype=np.uint8).reshape((c['h'], c['w'])), 'tag': f"Grd-F{ci+1}"})
    for ci, c in enumerate(anims['1625']):
        raw = anim_bin[c['binOff'] : c['binOff'] + c['w'] * c['h']]
        action_frames.append({'cel': c, 'arr': np.frombuffer(raw, dtype=np.uint8).reshape((c['h'], c['w'])), 'tag': f"Hit1-F{ci+1}"})
    for ci, c in enumerate(anims['1626']):
        raw = anim_bin[c['binOff'] : c['binOff'] + c['w'] * c['h']]
        action_frames.append({'cel': c, 'arr': np.frombuffer(raw, dtype=np.uint8).reshape((c['h'], c['w'])), 'tag': f"Hit2-F{ci+1}"})
    for ci, c in enumerate(anims['1630']):
        raw = anim_bin[c['binOff'] : c['binOff'] + c['w'] * c['h']]
        action_frames.append({'cel': c, 'arr': np.frombuffer(raw, dtype=np.uint8).reshape((c['h'], c['w'])), 'tag': f"Die-F{ci+1}"})
    for ci, c in enumerate(anims['1631']):
        raw = anim_bin[c['binOff'] : c['binOff'] + c['w'] * c['h']]
        action_frames.append({'cel': c, 'arr': np.frombuffer(raw, dtype=np.uint8).reshape((c['h'], c['w'])), 'tag': "Dead"})
    return walk_frames, attack_frames, action_frames

w_walk, w_atk, w_act = build_warrior_frames()

combo_pres = make_presentation_sheet(
    "Blood & Magic", "Warrior & Crusader Ranger Roster Comparison",
    [
        {'label': 'Warrior: Walk', 'frames': w_walk},
        {'label': 'Warrior: Attack', 'frames': w_atk},
        {'label': 'Warrior: Actions', 'frames': w_act},
        {'label': 'Crusader Ranger: Walk', 'frames': walk_frames},
        {'label': 'Crusader Ranger: Bow', 'frames': bow_frames},
        {'label': 'Crusader Ranger: Dagger', 'frames': dagger_frames},
        {'label': 'Crusader Ranger: Actions', 'frames': action_frames},
    ],
    pal_blue, scale=2
)
combo_pres.save(os.path.join(OUTPUT_DIR, 'warrior_ranger_comparison.png'))
print(f"  Saved warrior_ranger_comparison.png ({combo_pres.width}x{combo_pres.height} px)")

# 7. Export individual frame files
for idx, item in enumerate(all_frames):
    cel = item['cel']
    tag = item.get('tag', f"frame_{idx:03d}")
    fname = f"ranger_{idx:02d}_{tag}.png".replace(' ', '_').replace('(', '').replace(')', '')
    c_img = render_cel_into_cell(cel, item['arr'], pal_blue)
    c_img.save(os.path.join(RANGER_FRAMES_DIR, fname))

print(f"  Exported {len(all_frames)} individual Crusader Ranger frame files to {RANGER_FRAMES_DIR}")

# 8. High-impact Before & After Comparison: Original Green Archer vs. Crusader Ranger!
# Compare the 5 walk directions (South, South-East, East, North-East, North) side by side
print("\nGenerating High-Impact Spritesheet Before & After Graphic...")
orig_walk_frames = []
for d in range(5):
    aid = 1350 + d
    for ci, c in enumerate(anims[str(aid)]):
        raw = anim_bin[c['binOff'] : c['binOff'] + c['w'] * c['h']]
        arr = np.frombuffer(raw, dtype=np.uint8).reshape((c['h'], c['w']))
        orig_walk_frames.append({'cel': c, 'arr': arr, 'tag': f"D{d}-F{ci+1}"})

orig_walk_sheet = make_grid_sheet(
    [[orig_walk_frames[d*4 + i] for i in range(4)] for d in range(5)],
    pal_blue, cell_w=CELL_W, cell_h=CELL_H
)
custom_walk_sheet = make_grid_sheet(
    [[walk_frames[d*4 + i] for i in range(4)] for d in range(5)],
    pal_blue, cell_w=CELL_W, cell_h=CELL_H
)

COMP_W = 1280
COMP_H = 720
comp_img = Image.new('RGBA', (COMP_W, COMP_H), (14, 18, 26, 255))
c_draw = ImageDraw.Draw(comp_img)
font = ImageFont.load_default()

# Header
c_draw.rectangle([0, 0, COMP_W, 60], fill=(20, 26, 38, 255))
c_draw.line([(0, 60), (COMP_W, 60)], fill=(200, 163, 86, 255), width=2)
c_draw.text((32, 16), "BLOOD & MAGIC &bull; RANGER SPRITESHEET: BEFORE & AFTER", fill=(200, 163, 86, 255), font=font)
c_draw.text((32, 36), "Full Unit Transformation Propagated Across All 84 Frames (Walk, Bow Attack, Dagger Attack, Actions)", fill=(140, 165, 195, 255), font=font)

# Panel 1: Original Green Archer
panel_w = 580
panel_h = 600
y_p = 80
x1 = 40
c_draw.rectangle([x1, y_p, x1 + panel_w, y_p + panel_h], fill=(20, 25, 36, 255), outline=(50, 65, 90, 255))
c_draw.text((x1 + 16, y_p + 14), "ORIGINAL GREEN ARCHER (5 DIRS WALK)", fill=(160, 180, 210, 255), font=font)
c_draw.text((x1 + 16, y_p + 30), "Blonde Hair &bull; Green Tunic &bull; Olive Pants &bull; Blue Headband & Bracers", fill=(110, 130, 160, 255), font=font)

# Scale walk sheet to fit panel
scaled_orig = orig_walk_sheet.resize((panel_w - 32, int(orig_walk_sheet.height * (panel_w - 32) / orig_walk_sheet.width)), Image.NEAREST)
comp_img.paste(scaled_orig, (x1 + 16, y_p + 60), scaled_orig)

# Panel 2: Crusader Ranger (New Custom Unit)
x2 = x1 + panel_w + 40
c_draw.rectangle([x2, y_p, x2 + panel_w, y_p + panel_h], fill=(24, 32, 48, 255), outline=(70, 140, 220, 255))
c_draw.text((x2 + 16, y_p + 14), "CUSTOM CRUSADER RANGER (5 DIRS WALK)", fill=(100, 190, 255, 255), font=font)
c_draw.text((x2 + 16, y_p + 30), "Crusader Great Helm &bull; Steel Gray Armor &bull; Blue Jeans &bull; Brown Skin &bull; Blue Bracers", fill=(200, 220, 245, 255), font=font)

scaled_custom = custom_walk_sheet.resize((panel_w - 32, int(custom_walk_sheet.height * (panel_w - 32) / custom_walk_sheet.width)), Image.NEAREST)
comp_img.paste(scaled_custom, (x2 + 16, y_p + 60), scaled_custom)

comp_out_path = os.path.join(OUTPUT_DIR, 'ranger_original_vs_crusader_sheet.png')
comp_img.save(comp_out_path)
comp_img.save(os.path.join(ARTIFACT_DIR, 'ranger_original_vs_crusader_sheet.png'))
print(f"  Saved {comp_out_path} ({COMP_W}x{COMP_H} px)")

# Also create animated toggle GIF comparing Original vs Custom Walk Sheet
gif_comp_path = os.path.join(OUTPUT_DIR, 'ranger_spritesheet_toggle.gif')
scaled_orig.save(
    gif_comp_path,
    save_all=True,
    append_images=[scaled_custom],
    duration=900,
    loop=0
)
scaled_orig.save(os.path.join(ARTIFACT_DIR, 'ranger_spritesheet_toggle.gif'), save_all=True, append_images=[scaled_custom], duration=900, loop=0)
print(f"  Saved animated {gif_comp_path}")

print("\nDone! Full Crusader Ranger spritesheet generation complete.")
