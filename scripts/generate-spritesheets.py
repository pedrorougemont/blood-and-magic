#!/usr/bin/env python3
"""
Blood & Magic: Warrior & Ranger Spritesheet Generator
Extracts 8-bit VGA animation cels from anims.bin/anims.json using 9100.PAL/9101.PAL,
aligns them accurately to foot anchors, and outputs side-by-side spritesheets,
filmstrips, presentation sheets, and individual frame files.
"""

import json
import os
import shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = 'public/assets'
OUTPUT_DIR = os.path.join(ASSETS_DIR, 'spritesheets')
WARRIOR_FRAMES_DIR = os.path.join(OUTPUT_DIR, 'warrior')
RANGER_FRAMES_DIR = os.path.join(OUTPUT_DIR, 'ranger')

CELL_W = 80
CELL_H = 96
ANCHOR_X = 40
ANCHOR_Y = 58

DIRECTION_NAMES_5 = ['Down (S)', 'Down-Right (SE)', 'Right (E)', 'Up-Right (NE)', 'Up (N)']
DIRECTION_NAMES_8 = [
    'South (0)', 'South-East (1)', 'East (2)', 'North-East (3)',
    'North (4)', 'North-West (5)', 'West (6)', 'South-West (7)'
]

def load_resources():
    with open(os.path.join(ASSETS_DIR, 'palettes.json'), 'r') as f:
        pals = json.load(f)
    with open(os.path.join(ASSETS_DIR, 'anims.json'), 'r') as f:
        anims = json.load(f)
    with open(os.path.join(ASSETS_DIR, 'anims.bin'), 'rb') as f:
        anim_bin = f.read()

    # Build Side 1 (Blue) and Side 2 (Red) palettes
    pal_blue = [list(c) for c in pals['9100']]
    pal_red = [list(c) for c in pals['9100']]
    unit_pal = pals['9101']
    for i in range(8):
        pal_blue[192 + i] = unit_pal[200 + i] # Blue = color 2
        pal_red[192 + i] = unit_pal[192 + i]  # Red = color 1

    return pals, pal_blue, pal_red, anims, anim_bin

def render_cel(cel, anim_bin, palette, hflip=False):
    """Render a single cel into an RGBA PIL Image, cropped to its actual w*h."""
    w = cel['w']
    h = cel['h']
    offset = cel['binOff']
    raw = anim_bin[offset : offset + w * h]
    arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w))
    if hflip:
        arr = np.fliplr(arr)

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            idx = arr[y, x]
            if idx != 254: # CI_SKIP transparency
                rgba[y, x, 0:3] = palette[idx]
                rgba[y, x, 3] = 255
    return Image.fromarray(rgba)

def render_cel_into_cell(cel, anim_bin, palette, hflip=False, cell_w=CELL_W, cell_h=CELL_H, anchor_x=ANCHOR_X, anchor_y=ANCHOR_Y):
    """Place cel into a uniform canvas aligned to foot anchor."""
    cel_img = render_cel(cel, anim_bin, palette, hflip=hflip)
    w = cel['w']
    h = cel['h']
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

def make_strip(cels_info, anim_bin, palette, cell_w=CELL_W, cell_h=CELL_H, anchor_x=ANCHOR_X, anchor_y=ANCHOR_Y):
    """Create a single horizontal row of cels disposed side by side."""
    num_frames = len(cels_info)
    strip = Image.new('RGBA', (num_frames * cell_w, cell_h), (0, 0, 0, 0))
    for i, item in enumerate(cels_info):
        cel = item['cel']
        hflip = item.get('hflip', False)
        c_img = render_cel_into_cell(cel, anim_bin, palette, hflip=hflip, cell_w=cell_w, cell_h=cell_h, anchor_x=anchor_x, anchor_y=anchor_y)
        strip.paste(c_img, (i * cell_w, 0), c_img)
    return strip

def make_grid_sheet(rows_info, anim_bin, palette, cell_w=CELL_W, cell_h=CELL_H, anchor_x=ANCHOR_X, anchor_y=ANCHOR_Y):
    """Create a multi-row spritesheet where each row has cels side by side."""
    max_cols = max(len(row) for row in rows_info)
    num_rows = len(rows_info)
    sheet = Image.new('RGBA', (max_cols * cell_w, num_rows * cell_h), (0, 0, 0, 0))
    for r, row in enumerate(rows_info):
        for c, item in enumerate(row):
            cel = item['cel']
            hflip = item.get('hflip', False)
            c_img = render_cel_into_cell(cel, anim_bin, palette, hflip=hflip, cell_w=cell_w, cell_h=cell_h, anchor_x=anchor_x, anchor_y=anchor_y)
            sheet.paste(c_img, (c * cell_w, r * cell_h), c_img)
    return sheet

def make_presentation_sheet(title, unit_name, rows_meta, anim_bin, palette, scale=2, cell_w=CELL_W, cell_h=CELL_H, anchor_x=ANCHOR_X, anchor_y=ANCHOR_Y):
    """
    Generate an annotated, high-visibility presentation sheet (scale x2 or x3)
    with a dark slate background, row labels, direction headers, frame borders, and foot baseline.
    """
    max_cols = max(len(r['frames']) for r in rows_meta)
    num_rows = len(rows_meta)

    margin_left = 180
    margin_top = 80
    margin_right = 40
    margin_bottom = 40
    row_gap = 16
    col_gap = 4

    inner_w = max_cols * (cell_w + col_gap)
    inner_h = num_rows * (cell_h + row_gap)
    total_w = margin_left + inner_w + margin_right
    total_h = margin_top + inner_h + margin_bottom

    bg = Image.new('RGBA', (total_w, total_h), (16, 20, 28, 255))
    draw = ImageDraw.Draw(bg)
    font = ImageFont.load_default()

    # Header
    draw.text((margin_left, 20), f"{title} - {unit_name}", fill=(240, 244, 250, 255), font=font)
    draw.text((margin_left, 42), f"Native Cel Grid: {cell_w}x{cell_h}px | Anchor: ({anchor_x}, {anchor_y}) | Side 1 Palette", fill=(140, 160, 190, 255), font=font)

    for r_idx, r_data in enumerate(rows_meta):
        y_pos = margin_top + r_idx * (cell_h + row_gap)
        row_label = r_data['label']
        draw.text((20, y_pos + cell_h // 2 - 10), row_label, fill=(200, 215, 235, 255), font=font)
        draw.text((20, y_pos + cell_h // 2 + 6), f"{len(r_data['frames'])} frames", fill=(110, 130, 160, 255), font=font)

        for c_idx, item in enumerate(r_data['frames']):
            x_pos = margin_left + c_idx * (cell_w + col_gap)

            # Cell box background & border
            draw.rectangle([x_pos, y_pos, x_pos + cell_w - 1, y_pos + cell_h - 1], fill=(24, 30, 42, 255), outline=(42, 54, 76, 255))

            # Foot baseline guide
            baseline_y = y_pos + anchor_y
            draw.line([x_pos + 4, baseline_y, x_pos + cell_w - 5, baseline_y], fill=(40, 60, 80, 180), width=1)

            # Cel sprite
            cel = item['cel']
            hflip = item.get('hflip', False)
            c_img = render_cel_into_cell(cel, anim_bin, palette, hflip=hflip, cell_w=cell_w, cell_h=cell_h, anchor_x=anchor_x, anchor_y=anchor_y)
            bg.paste(c_img, (x_pos, y_pos), c_img)

            # Sub-label (cel index / tag)
            sub_lbl = item.get('tag', f"#{c_idx+1}")
            draw.text((x_pos + 4, y_pos + cell_h - 14), sub_lbl, fill=(100, 120, 150, 255), font=font)

    if scale > 1:
        bg = bg.resize((bg.width * scale, bg.height * scale), Image.NEAREST)
    return bg

def build_warrior_data(anims):
    # Walk: 5 directions (1600..1604), 4 cels each = 20 cels
    walk_frames = []
    for d in range(5):
        aid = str(1600 + d)
        for ci, c in enumerate(anims[aid]):
            walk_frames.append({'cel': c, 'tag': f"D{d}-F{ci+1}"})

    # Attack: 5 directions (1610..1614), 4 cels each = 20 cels
    attack_frames = []
    for d in range(5):
        aid = str(1610 + d)
        for ci, c in enumerate(anims[aid]):
            attack_frames.append({'cel': c, 'tag': f"D{d}-F{ci+1}"})

    # Actions: Guard(1620, 4), Hit1(1625, 4), Hit2(1626, 4), Death(1630, 8), Corpse(1631, 1) = 21 cels
    action_frames = []
    for ci, c in enumerate(anims['1620']):
        action_frames.append({'cel': c, 'tag': f"Grd-F{ci+1}"})
    for ci, c in enumerate(anims['1625']):
        action_frames.append({'cel': c, 'tag': f"Hit1-F{ci+1}"})
    for ci, c in enumerate(anims['1626']):
        action_frames.append({'cel': c, 'tag': f"Hit2-F{ci+1}"})
    for ci, c in enumerate(anims['1630']):
        action_frames.append({'cel': c, 'tag': f"Die-F{ci+1}"})
    for ci, c in enumerate(anims['1631']):
        action_frames.append({'cel': c, 'tag': "Dead"})

    # 8-Direction Walk (32 frames)
    # Dirs: 0=Down(1600), 1=DR(1601), 2=R(1602), 3=UR(1603), 4=U(1604), 5=UL(flip 1603), 6=L(flip 1602), 7=DL(flip 1601)
    dir_map_8 = [
        (1600, False), (1601, False), (1602, False), (1603, False),
        (1604, False), (1603, True),  (1602, True),  (1601, True)
    ]
    walk_8dir = []
    for d_idx, (aid_base, flip) in enumerate(dir_map_8):
        for ci, c in enumerate(anims[str(aid_base)]):
            walk_8dir.append({'cel': c, 'hflip': flip, 'tag': f"Dir{d_idx}-F{ci+1}"})

    attack_8dir = []
    attack_base = 1610
    dir_attack_map_8 = [
        (attack_base + 0, False), (attack_base + 1, False), (attack_base + 2, False), (attack_base + 3, False),
        (attack_base + 4, False), (attack_base + 3, True),  (attack_base + 2, True),  (attack_base + 1, True)
    ]
    for d_idx, (aid_base, flip) in enumerate(dir_attack_map_8):
        for ci, c in enumerate(anims[str(aid_base)]):
            attack_8dir.append({'cel': c, 'hflip': flip, 'tag': f"Dir{d_idx}-F{ci+1}"})

    all_frames = walk_frames + attack_frames + action_frames

    return {
        'walk': walk_frames,
        'attack': attack_frames,
        'actions': action_frames,
        'all': all_frames,
        'walk_8dir': walk_8dir,
        'attack_8dir': attack_8dir,
    }

def build_ranger_data(anims):
    # Walk: 5 directions (1350..1354), 4 cels each = 20 cels
    walk_frames = []
    for d in range(5):
        aid = str(1350 + d)
        for ci, c in enumerate(anims[aid]):
            walk_frames.append({'cel': c, 'tag': f"D{d}-F{ci+1}"})

    # Bow Attack: 5 directions (1360..1364), 4 cels each = 20 cels
    bow_frames = []
    for d in range(5):
        aid = str(1360 + d)
        for ci, c in enumerate(anims[aid]):
            bow_frames.append({'cel': c, 'tag': f"BowD{d}-F{ci+1}"})

    # Dagger Melee Attack: 5 directions (1390..1394), 4 cels each = 20 cels
    dagger_frames = []
    for d in range(5):
        aid = str(1390 + d)
        for ci, c in enumerate(anims[aid]):
            dagger_frames.append({'cel': c, 'tag': f"DaggD{d}-F{ci+1}"})

    # Actions: Guard(1370, 4), Hit1(1375, 4), Hit2(1376, 4), Death(1380, 8), Corpse(1381, 1), Arrows(1382,1383,1384) = 24 cels
    action_frames = []
    for ci, c in enumerate(anims['1370']):
        action_frames.append({'cel': c, 'tag': f"Grd-F{ci+1}"})
    for ci, c in enumerate(anims['1375']):
        action_frames.append({'cel': c, 'tag': f"Hit1-F{ci+1}"})
    for ci, c in enumerate(anims['1376']):
        action_frames.append({'cel': c, 'tag': f"Hit2-F{ci+1}"})
    for ci, c in enumerate(anims['1380']):
        action_frames.append({'cel': c, 'tag': f"Die-F{ci+1}"})
    for ci, c in enumerate(anims['1381']):
        action_frames.append({'cel': c, 'tag': "Dead"})
    action_frames.append({'cel': anims['1382'][0], 'tag': "Arr-V"})
    action_frames.append({'cel': anims['1383'][0], 'tag': "Arr-Diag"})
    action_frames.append({'cel': anims['1384'][0], 'tag': "Arr-H"})

    # 8-Direction Walk (32 frames)
    dir_walk_8 = [
        (1350, False), (1351, False), (1352, False), (1353, False),
        (1354, False), (1353, True),  (1352, True),  (1351, True)
    ]
    walk_8dir = []
    for d_idx, (aid_base, flip) in enumerate(dir_walk_8):
        for ci, c in enumerate(anims[str(aid_base)]):
            walk_8dir.append({'cel': c, 'hflip': flip, 'tag': f"Dir{d_idx}-F{ci+1}"})

    dir_bow_8 = [
        (1360, False), (1361, False), (1362, False), (1363, False),
        (1364, False), (1363, True),  (1362, True),  (1361, True)
    ]
    bow_8dir = []
    for d_idx, (aid_base, flip) in enumerate(dir_bow_8):
        for ci, c in enumerate(anims[str(aid_base)]):
            bow_8dir.append({'cel': c, 'hflip': flip, 'tag': f"Dir{d_idx}-F{ci+1}"})

    dir_dagger_8 = [
        (1390, False), (1391, False), (1392, False), (1393, False),
        (1394, False), (1393, True),  (1392, True),  (1391, True)
    ]
    dagger_8dir = []
    for d_idx, (aid_base, flip) in enumerate(dir_dagger_8):
        for ci, c in enumerate(anims[str(aid_base)]):
            dagger_8dir.append({'cel': c, 'hflip': flip, 'tag': f"Dir{d_idx}-F{ci+1}"})

    all_frames = walk_frames + bow_frames + dagger_frames + action_frames

    return {
        'walk': walk_frames,
        'bow': bow_frames,
        'dagger': dagger_frames,
        'actions': action_frames,
        'all': all_frames,
        'walk_8dir': walk_8dir,
        'bow_8dir': bow_8dir,
        'dagger_8dir': dagger_8dir,
    }

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(WARRIOR_FRAMES_DIR, exist_ok=True)
    os.makedirs(RANGER_FRAMES_DIR, exist_ok=True)

    print("Loading palettes and anims...")
    pals, pal_blue, pal_red, anims, anim_bin = load_resources()

    print("Building Warrior frame sequences...")
    w_data = build_warrior_data(anims)
    print(f"  Warrior: {len(w_data['all'])} total canonical frames (Walk 20, Attack 20, Actions 21)")

    print("Building Ranger frame sequences...")
    r_data = build_ranger_data(anims)
    print(f"  Ranger: {len(r_data['all'])} total canonical frames (Walk 20, Bow 20, Dagger 20, Actions 24)")

    # 1. PURE HORIZONTAL FILMSTRIPS (All frames in a single continuous row)
    print("\nGenerating pure horizontal filmstrips (all frames disposed side by side)...")
    w_strip = make_strip(w_data['all'], anim_bin, pal_blue)
    w_strip.save(os.path.join(OUTPUT_DIR, 'warrior_strip.png'))
    print(f"  Saved warrior_strip.png ({w_strip.width}x{w_strip.height} px, {len(w_data['all'])} frames)")

    r_strip = make_strip(r_data['all'], anim_bin, pal_blue)
    r_strip.save(os.path.join(OUTPUT_DIR, 'ranger_strip.png'))
    print(f"  Saved ranger_strip.png ({r_strip.width}x{r_strip.height} px, {len(r_data['all'])} frames)")

    # 2. ACTION-SPECIFIC HORIZONTAL STRIPS (Disposed side by side)
    print("\nGenerating action-specific side-by-side strips...")
    make_strip(w_data['walk'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'warrior_walk_strip.png'))
    make_strip(w_data['attack'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'warrior_attack_strip.png'))
    make_strip(w_data['actions'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'warrior_actions_strip.png'))

    make_strip(r_data['walk'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_walk_strip.png'))
    make_strip(r_data['bow'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_bow_strip.png'))
    make_strip(r_data['dagger'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_dagger_strip.png'))
    make_strip(r_data['actions'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_actions_strip.png'))
    print("  Saved individual action strips for Warrior and Ranger.")

    # 3. STRUCTURED MULTI-ROW SPRITESHEETS (Each category disposed side by side in rows)
    print("\nGenerating structured spritesheets...")
    w_sheet = make_grid_sheet([w_data['walk'], w_data['attack'], w_data['actions']], anim_bin, pal_blue)
    w_sheet.save(os.path.join(OUTPUT_DIR, 'spritesheet_warrior.png'))
    print(f"  Saved spritesheet_warrior.png ({w_sheet.width}x{w_sheet.height} px)")

    r_sheet = make_grid_sheet([r_data['walk'], r_data['bow'], r_data['dagger'], r_data['actions']], anim_bin, pal_blue)
    r_sheet.save(os.path.join(OUTPUT_DIR, 'spritesheet_ranger.png'))
    print(f"  Saved spritesheet_ranger.png ({r_sheet.width}x{r_sheet.height} px)")

    # Red team color variant sheets
    w_sheet_red = make_grid_sheet([w_data['walk'], w_data['attack'], w_data['actions']], anim_bin, pal_red)
    w_sheet_red.save(os.path.join(OUTPUT_DIR, 'spritesheet_warrior_red.png'))
    r_sheet_red = make_grid_sheet([r_data['walk'], r_data['bow'], r_data['dagger'], r_data['actions']], anim_bin, pal_red)
    r_sheet_red.save(os.path.join(OUTPUT_DIR, 'spritesheet_ranger_red.png'))
    print("  Saved Red team variants (spritesheet_warrior_red.png, spritesheet_ranger_red.png).")

    # 4. 8-DIRECTION COMPLETE ROTATION STRIPS (32 frames side by side)
    print("\nGenerating 8-direction full 360 rotation strips...")
    make_strip(w_data['walk_8dir'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'warrior_walk_8dir_strip.png'))
    make_strip(w_data['attack_8dir'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'warrior_attack_8dir_strip.png'))
    make_strip(r_data['walk_8dir'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_walk_8dir_strip.png'))
    make_strip(r_data['bow_8dir'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_bow_8dir_strip.png'))
    make_strip(r_data['dagger_8dir'], anim_bin, pal_blue).save(os.path.join(OUTPUT_DIR, 'ranger_dagger_8dir_strip.png'))

    # 5. HIGH-VISIBILITY PRESENTATION SHEETS (Scaled 2x with labels and guides)
    print("\nGenerating presentation sheets (with labels, cell boundaries, and baselines)...")
    w_pres = make_presentation_sheet(
        "Blood & Magic", "Warrior (Base 1600)",
        [
            {'label': 'Walk (5 Dirs)', 'frames': w_data['walk']},
            {'label': 'Sword Attack (5 Dirs)', 'frames': w_data['attack']},
            {'label': 'Guard / Hit / Death', 'frames': w_data['actions']},
        ],
        anim_bin, pal_blue, scale=2
    )
    w_pres.save(os.path.join(OUTPUT_DIR, 'warrior_presentation.png'))
    print(f"  Saved warrior_presentation.png ({w_pres.width}x{w_pres.height} px)")

    r_pres = make_presentation_sheet(
        "Blood & Magic", "Ranger (Base 1350)",
        [
            {'label': 'Walk (5 Dirs)', 'frames': r_data['walk']},
            {'label': 'Bow Attack (5 Dirs)', 'frames': r_data['bow']},
            {'label': 'Dagger Attack (5 Dirs)', 'frames': r_data['dagger']},
            {'label': 'Guard / Hit / Death', 'frames': r_data['actions']},
        ],
        anim_bin, pal_blue, scale=2
    )
    r_pres.save(os.path.join(OUTPUT_DIR, 'ranger_presentation.png'))
    print(f"  Saved ranger_presentation.png ({r_pres.width}x{r_pres.height} px)")

    # 6. SIDE-BY-SIDE COMBINED SHEET (Warrior & Ranger compared together side by side)
    print("\nGenerating combined Warrior & Ranger side-by-side presentation...")
    combo_pres = make_presentation_sheet(
        "Blood & Magic", "Warrior & Ranger Roster Comparison",
        [
            {'label': 'Warrior: Walk', 'frames': w_data['walk']},
            {'label': 'Warrior: Attack', 'frames': w_data['attack']},
            {'label': 'Warrior: Actions', 'frames': w_data['actions']},
            {'label': 'Ranger: Walk', 'frames': r_data['walk']},
            {'label': 'Ranger: Bow Attack', 'frames': r_data['bow']},
            {'label': 'Ranger: Dagger Attack', 'frames': r_data['dagger']},
            {'label': 'Ranger: Actions', 'frames': r_data['actions']},
        ],
        anim_bin, pal_blue, scale=2
    )
    combo_pres.save(os.path.join(OUTPUT_DIR, 'warrior_ranger_comparison.png'))
    print(f"  Saved warrior_ranger_comparison.png ({combo_pres.width}x{combo_pres.height} px)")

    # 7. EXPORT INDIVIDUAL FRAMES (for external animation tools, game engines, or web viewers)
    print("\nExporting individual frame PNGs...")
    for idx, item in enumerate(w_data['all']):
        cel = item['cel']
        tag = item.get('tag', f"frame_{idx:03d}")
        fname = f"warrior_{idx:02d}_{tag}.png".replace(' ', '_').replace('(', '').replace(')', '')
        c_img = render_cel_into_cell(cel, anim_bin, pal_blue)
        c_img.save(os.path.join(WARRIOR_FRAMES_DIR, fname))

    for idx, item in enumerate(r_data['all']):
        cel = item['cel']
        tag = item.get('tag', f"frame_{idx:03d}")
        fname = f"ranger_{idx:02d}_{tag}.png".replace(' ', '_').replace('(', '').replace(')', '')
        c_img = render_cel_into_cell(cel, anim_bin, pal_blue)
        c_img.save(os.path.join(RANGER_FRAMES_DIR, fname))

    print(f"  Exported {len(w_data['all'])} individual Warrior frame files to {WARRIOR_FRAMES_DIR}")
    print(f"  Exported {len(r_data['all'])} individual Ranger frame files to {RANGER_FRAMES_DIR}")

    # Write a JSON metadata file for easy programmatic consumption
    manifest = {
        'cellWidth': CELL_W,
        'cellHeight': CELL_H,
        'anchorX': ANCHOR_X,
        'anchorY': ANCHOR_Y,
        'warrior': {
            'baseAnim': 1600,
            'totalFrames': len(w_data['all']),
            'categories': {
                'walk': len(w_data['walk']),
                'attack': len(w_data['attack']),
                'actions': len(w_data['actions']),
            },
            'files': {
                'sheet': 'spritesheet_warrior.png',
                'strip': 'warrior_strip.png',
                'presentation': 'warrior_presentation.png',
            }
        },
        'ranger': {
            'baseAnim': 1350,
            'totalFrames': len(r_data['all']),
            'categories': {
                'walk': len(r_data['walk']),
                'bow': len(r_data['bow']),
                'dagger': len(r_data['dagger']),
                'actions': len(r_data['actions']),
            },
            'files': {
                'sheet': 'spritesheet_ranger.png',
                'strip': 'ranger_strip.png',
                'presentation': 'ranger_presentation.png',
            }
        }
    }
    with open(os.path.join(OUTPUT_DIR, 'spritesheets_manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    print("  Saved spritesheets_manifest.json")

    print("\nAll spritesheet generation complete successfully!")

if __name__ == '__main__':
    main()

