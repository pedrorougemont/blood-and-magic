import os
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = 'public/assets/spritesheets'
ARTIFACT_DIR = r'C:/Users/Aline Santos/.gemini/antigravity/brain/545d3f9b-a8eb-4724-b8b8-9505375d2d74'

# Load palettes and anims
with open('public/assets/palettes.json') as f:
    pals = json.load(f)
base_pal = [list(c) for c in pals['9100']]
unit_pal = pals['9101']
for i in range(8):
    base_pal[192 + i] = unit_pal[200 + i] # Blue team

with open('public/assets/anims.json') as f:
    anims = json.load(f)

cel0 = anims['1350'][0]
with open('public/assets/anims.bin', 'rb') as f:
    f.seek(cel0['binOff'])
    raw = f.read(cel0['w'] * cel0['h'])

w, h = cel0['w'], cel0['h']
orig_arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w)).copy()

def arr_to_rgba(arr, pal):
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            idx = arr[y, x]
            if idx != 254:
                rgba[y, x, 0:3] = pal[idx]
                rgba[y, x, 3] = 255
    return Image.fromarray(rgba)

# -------------------------------------------------------------
# ADDITIVE STAGES
# -------------------------------------------------------------
skin_map = {
    180: 172, # caramel highlight
    179: 171, # warm brown
    178: 170, # mahogany midtone
    177: 169, # deep umber
    176: 121, # dark umber shadow
    175: 120, # deep espresso
    174: 120,
    173: 119,
}

hair_map = {
    154: 119,
    155: 120,
    156: 121,
}

def apply_brown_skin(arr):
    for y in range(h):
        for x in range(w):
            val = arr[y, x]
            if val in skin_map:
                arr[y, x] = skin_map[val]
    for y in range(10):
        for x in range(w):
            val = arr[y, x]
            if val in hair_map:
                arr[y, x] = hair_map[val]
    if arr[6, 5] == 88: arr[6, 5] = 170
    if arr[6, 7] == 88: arr[6, 7] = 170

def apply_helmet(arr):
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

def apply_jeans(arr):
    # Row 17: Waistline seam under belt
    arr[17, 3] = 83; arr[17, 8] = 84; arr[17, 9] = 85
    # Row 18: Waistband, pocket line & copper rivet
    arr[18, 3] = 83; arr[18, 4] = 84; arr[18, 5] = 85; arr[18, 6] = 83; arr[18, 7] = 85; arr[18, 8] = 152; arr[18, 9] = 87
    # Row 19: Upper hips & fly
    arr[19, 3] = 83; arr[19, 4] = 84; arr[19, 5] = 85; arr[19, 6] = 83; arr[19, 7] = 86; arr[19, 8] = 87; arr[19, 9] = 88
    # Row 20: Thighs & crotch
    arr[20, 3] = 84; arr[20, 4] = 85; arr[20, 5] = 84; arr[20, 6] = 83; arr[20, 7] = 86; arr[20, 8] = 89; arr[20, 9] = 88
    # Row 21: Upper legs
    arr[21, 3] = 84; arr[21, 4] = 86; arr[21, 5] = 85; arr[21, 7] = 87; arr[21, 8] = 90; arr[21, 9] = 89
    # Row 22: Mid legs
    arr[22, 3] = 85; arr[22, 4] = 87; arr[22, 5] = 85; arr[22, 7] = 88; arr[22, 8] = 91; arr[22, 9] = 90
    # Row 23: Knees
    arr[23, 3] = 86; arr[23, 4] = 88; arr[23, 5] = 86; arr[23, 6] = 83; arr[23, 7] = 88; arr[23, 8] = 92; arr[23, 9] = 91
    # Row 24: Lower shins
    arr[24, 3] = 86; arr[24, 4] = 88; arr[24, 5] = 86; arr[24, 6] = 83; arr[24, 7] = 87; arr[24, 8] = 90; arr[24, 9] = 89
    # Row 25: Cuffs into boots
    arr[25, 4] = 87; arr[25, 8] = 88; arr[25, 9] = 87

# Build the 4 sequential stages:
# Stage 1: Original
arr_s1 = orig_arr.copy()

# Stage 2: + Brown Skin
arr_s2 = orig_arr.copy()
apply_brown_skin(arr_s2)

# Stage 3: + Brown Skin + Helmet
arr_s3 = orig_arr.copy()
apply_brown_skin(arr_s3)
apply_helmet(arr_s3)

# Stage 4: + Brown Skin + Helmet + JEANS (Full Additive Master!)
arr_s4 = orig_arr.copy()
apply_brown_skin(arr_s4)
apply_helmet(arr_s4)
apply_jeans(arr_s4)

# Also: Brown Skin + Jeans (without helmet)
arr_s4_nohelm = orig_arr.copy()
apply_brown_skin(arr_s4_nohelm)
apply_jeans(arr_s4_nohelm)

# Render PIL Images
img_s1 = arr_to_rgba(arr_s1, base_pal)
img_s2 = arr_to_rgba(arr_s2, base_pal)
img_s3 = arr_to_rgba(arr_s3, base_pal)
img_s4 = arr_to_rgba(arr_s4, base_pal)
img_s4_nohelm = arr_to_rgba(arr_s4_nohelm, base_pal)

# Save native 1x PNGs
img_s4.save(os.path.join(OUT_DIR, 'archer_walk_down_additive_final.png'))
img_s4_nohelm.save(os.path.join(OUT_DIR, 'archer_walk_down_jeans_brown.png'))
print("Saved native 1x PNGs.")

# -------------------------------------------------------------
# BUILD MASTER PROGRESSIVE ADDITIVE INFOGRAPHIC (1200 x 820 px)
# -------------------------------------------------------------
CANVAS_W = 1200
CANVAS_H = 820
comp = Image.new('RGBA', (CANVAS_W, CANVAS_H), (15, 18, 26, 255))
draw = ImageDraw.Draw(comp)
font = ImageFont.load_default()

# Header
draw.rectangle([0, 0, CANVAS_W, 60], fill=(22, 28, 40, 255))
draw.line([(0, 60), (CANVAS_W, 60)], fill=(200, 163, 86, 255), width=2)
draw.text((24, 16), "BLOOD & MAGIC - ADDITIVE ARCHER CUSTOMIZATION", fill=(200, 163, 86, 255), font=font)
draw.text((24, 34), "Progressive Build: 1. Base &bull; 2. + Brown Skin &bull; 3. + Great Helm &bull; 4. + Blue Jeans (Denim) | 14x32 DOS VGA Sprite", fill=(140, 160, 190, 255), font=font)

SCALE_BODY = 7

y_row1 = 80
card_w = 200
card_h = 320
gap = 14

cards = [
    {
        'step': 'STAGE 0',
        'title': 'Original Base',
        'sub': 'Caucasian & Green Pants',
        'img': img_s1,
        'tag': 'Peach skin (176..180)\nBlonde hair (154..156)\nGreen trousers (44..53)',
        'target': False
    },
    {
        'step': 'STAGE 1',
        'title': '+ Brown Skin',
        'sub': 'Black Man Tones',
        'img': img_s2,
        'tag': 'Mahogany/umber skin (169..172)\nDark espresso hair (119..121)\nBrown eyes (170)',
        'target': False
    },
    {
        'step': 'STAGE 2',
        'title': '+ Great Helm',
        'sub': 'Steel Plate & Brass Rim',
        'img': img_s3,
        'tag': 'Peaked Crusader dome (36..41)\nVisor slit (0, 32)\nBrass collar rim (150..154)',
        'target': False
    },
    {
        'step': 'STAGE 3 (FINAL)',
        'title': '+ Blue Jeans',
        'sub': 'Full Additive Master',
        'img': img_s4,
        'tag': 'Denim blue indigo (83..88)\nStone-wash knee fade (89..92)\nCopper pocket rivet (152)',
        'target': True
    }
]

for idx, c in enumerate(cards):
    cx = 24 + idx * (card_w + gap)
    is_target = c['target']
    outline_col = (100, 180, 255, 255) if is_target else (40, 50, 70, 255)
    bg_col = (25, 36, 54, 255) if is_target else (22, 27, 38, 255)
    draw.rectangle([cx, y_row1, cx + card_w, y_row1 + card_h], fill=bg_col, outline=outline_col)

    badge_col = (200, 163, 86, 255) if is_target else (110, 130, 160, 255)
    draw.text((cx + 10, y_row1 + 10), c['step'], fill=badge_col, font=font)
    title_col = (255, 255, 255, 255) if is_target else (200, 215, 235, 255)
    draw.text((cx + 10, y_row1 + 24), c['title'], fill=title_col, font=font)
    draw.text((cx + 10, y_row1 + 38), c['sub'], fill=(130, 150, 180, 255), font=font)

    # Paste scaled sprite
    scaled = c['img'].resize((w * SCALE_BODY, h * SCALE_BODY), Image.NEAREST)
    draw_x = cx + (card_w - w * SCALE_BODY) // 2
    comp.paste(scaled, (draw_x, y_row1 + 58), scaled)

    # Sub-tag
    lines = c['tag'].split('\n')
    for li, line in enumerate(lines):
        draw.text((cx + 10, y_row1 + 284 + li * 11 - 14), line, fill=(120, 140, 175, 255), font=font)

# Rightmost column: In-Game Native Scaling
cx_right = 24 + 4 * (card_w + gap)
right_w = CANVAS_W - cx_right - 24
draw.rectangle([cx_right, y_row1, cx_right + right_w, y_row1 + card_h], fill=(20, 25, 36, 255), outline=(40, 50, 70, 255))
draw.text((cx_right + 12, y_row1 + 10), "NATIVE VGA SCALING", fill=(200, 163, 86, 255), font=font)
draw.text((cx_right + 12, y_row1 + 24), "Actual Game Scale", fill=(120, 140, 170, 255), font=font)

draw.text((cx_right + 12, y_row1 + 55), "1x (DOS):", fill=(140, 160, 190, 255), font=font)
comp.paste(img_s1, (cx_right + 85, y_row1 + 50), img_s1)
comp.paste(img_s4, (cx_right + 115, y_row1 + 50), img_s4)

draw.text((cx_right + 12, y_row1 + 105), "2x Scale:", fill=(140, 160, 190, 255), font=font)
comp.paste(img_s1.resize((w*2, h*2), Image.NEAREST), (cx_right + 85, y_row1 + 95), img_s1.resize((w*2, h*2), Image.NEAREST))
comp.paste(img_s4.resize((w*2, h*2), Image.NEAREST), (cx_right + 125, y_row1 + 95), img_s4.resize((w*2, h*2), Image.NEAREST))

draw.text((cx_right + 12, y_row1 + 190), "4x Scale:", fill=(140, 160, 190, 255), font=font)
comp.paste(img_s1.resize((w*4, h*4), Image.NEAREST), (cx_right + 85, y_row1 + 175), img_s1.resize((w*4, h*4), Image.NEAREST))
comp.paste(img_s4.resize((w*4, h*4), Image.NEAREST), (cx_right + 160, y_row1 + 175), img_s4.resize((w*4, h*4), Image.NEAREST))

# -------------------------------------------------------------
# Section 2: Close-Ups with Pixel Grid (Row 2, y=420)
# -------------------------------------------------------------
y_row2 = 420

def make_grid(img_crop, scale, grid_color=(45, 55, 75, 120)):
    cw, ch = img_crop.size
    sw = cw * scale
    sh = ch * scale
    scaled = img_crop.resize((sw, sh), Image.NEAREST)
    d = ImageDraw.Draw(scaled)
    for x in range(scale, sw, scale):
        d.line([(x, 0), (x, sh)], fill=grid_color, width=1)
    for y in range(scale, sh, scale):
        d.line([(0, y), (sw, y)], fill=grid_color, width=1)
    return scaled

# Jeans Crop (x: 2..11, y: 17..26) -> 9 x 9 px
jeans_crop_box = (2, 17, 11, 26)
jeans_orig_grid = make_grid(img_s1.crop(jeans_crop_box), 24)
jeans_new_grid = make_grid(img_s4.crop(jeans_crop_box), 24)

# Card A: Jeans Close-Up (Before vs After)
cx_a = 24
w_a = 640
draw.rectangle([cx_a, y_row2, cx_a + w_a, y_row2 + 370], fill=(20, 25, 36, 255), outline=(50, 80, 130, 255))
draw.text((cx_a + 14, y_row2 + 10), "BLUE JEANS (DENIM) CLOSE-UP (24X PIXEL GRID)", fill=(100, 180, 255, 255), font=font)
draw.text((cx_a + 14, y_row2 + 24), "Before (Olive Drab Pants) vs After (Authentic Stone-Washed Blue Jeans)", fill=(130, 150, 180, 255), font=font)

draw.text((cx_a + 14, y_row2 + 45), "Before: Green Pants", fill=(140, 160, 190, 255), font=font)
comp.paste(jeans_orig_grid, (cx_a + 14, y_row2 + 65))

draw.text((cx_a + 250, y_row2 + 45), "After: Blue Denim Jeans", fill=(100, 190, 255, 255), font=font)
comp.paste(jeans_new_grid, (cx_a + 250, y_row2 + 65))

# Detailed callouts for the Jeans
draw.text((cx_a + 480, y_row2 + 65), "&bull; Denim Base:", fill=(200, 215, 235, 255), font=font)
draw.text((cx_a + 480, y_row2 + 82), "  Raw indigo seams (83, 84)", fill=(140, 160, 190, 255), font=font)
draw.text((cx_a + 480, y_row2 + 99), "  Classic denim (86, 87)", fill=(140, 160, 190, 255), font=font)
draw.text((cx_a + 480, y_row2 + 125), "&bull; Stone-Wash Fade:", fill=(200, 215, 235, 255), font=font)
draw.text((cx_a + 480, y_row2 + 142), "  Thigh wear (89, 90)", fill=(140, 160, 190, 255), font=font)
draw.text((cx_a + 480, y_row2 + 159), "  Knee highlight (91, 92)", fill=(140, 160, 190, 255), font=font)
draw.text((cx_a + 480, y_row2 + 185), "&bull; Copper Rivet:", fill=(200, 163, 86, 255), font=font)
draw.text((cx_a + 480, y_row2 + 202), "  Index 152 at pocket seam", fill=(150, 170, 200, 255), font=font)
draw.text((cx_a + 480, y_row2 + 228), "&bull; Inseam & Crotch:", fill=(200, 215, 235, 255), font=font)
draw.text((cx_a + 480, y_row2 + 245), "  Deep indigo shadow (83)", fill=(140, 160, 190, 255), font=font)

# Card B: Full Character Summary Specs
cx_b = cx_a + w_a + 16
w_b = CANVAS_W - cx_b - 24
draw.rectangle([cx_b, y_row2, cx_b + w_b, y_row2 + 370], fill=(20, 25, 36, 255), outline=(40, 50, 70, 255))
draw.text((cx_b + 14, y_row2 + 10), "COMPLETE ADDITIVE SPECS", fill=(200, 163, 86, 255), font=font)
draw.text((cx_b + 14, y_row2 + 24), "All 3 Layers Integrated into 14x32 Sprite", fill=(120, 140, 170, 255), font=font)

draw.text((cx_b + 14, y_row2 + 55), "1. Black Man Skin Tone:", fill=(200, 215, 235, 255), font=font)
draw.text((cx_b + 14, y_row2 + 72), "   &bull; Warm caramel highlight: 172", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 14, y_row2 + 89), "   &bull; Mahogany midtone: 170", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 14, y_row2 + 106), "   &bull; Deep umber & espresso: 169, 120, 121", fill=(140, 160, 190, 255), font=font)

draw.text((cx_b + 14, y_row2 + 135), "2. Crusader Great Helm:", fill=(200, 215, 235, 255), font=font)
draw.text((cx_b + 14, y_row2 + 152), "   &bull; Peaked steel dome: 36..41", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 14, y_row2 + 169), "   &bull; Visor eye slit & breath holes: 0, 32", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 14, y_row2 + 186), "   &bull; Brass / gold bottom trim: 150..154", fill=(140, 160, 190, 255), font=font)

draw.text((cx_b + 14, y_row2 + 215), "3. Blue Denim Jeans:", fill=(200, 215, 235, 255), font=font)
draw.text((cx_b + 14, y_row2 + 232), "   &bull; Indigo base & shadows: 83, 84, 85", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 14, y_row2 + 249), "   &bull; Classic denim midtones: 86, 87, 88", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 14, y_row2 + 266), "   &bull; Stone-wash wear & fade: 89, 90, 91, 92", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 14, y_row2 + 283), "   &bull; Copper coin pocket rivet: 152", fill=(140, 160, 190, 255), font=font)

# Save Master Infographic
comp_path = os.path.join(OUT_DIR, 'archer_jeans_additive_comparison.png')
comp.save(comp_path)
comp.save(os.path.join(ARTIFACT_DIR, 'archer_jeans_additive_comparison.png'))
print(f"Saved {comp_path} ({CANVAS_W}x{CANVAS_H} px)")

# -------------------------------------------------------------
# Animated Progressive Toggle GIFs
# -------------------------------------------------------------
# 1. 4-Stage Progressive Toggle (Original -> Brown Skin -> Helm -> Jeans)
s1_8x = img_s1.resize((w * 8, h * 8), Image.NEAREST)
s2_8x = img_s2.resize((w * 8, h * 8), Image.NEAREST)
s3_8x = img_s3.resize((w * 8, h * 8), Image.NEAREST)
s4_8x = img_s4.resize((w * 8, h * 8), Image.NEAREST)

gif_body = os.path.join(OUT_DIR, 'archer_additive_progression_toggle.gif')
s1_8x.save(
    gif_body,
    save_all=True,
    append_images=[s2_8x, s3_8x, s4_8x],
    duration=900,
    loop=0
)
s1_8x.save(os.path.join(ARTIFACT_DIR, 'archer_additive_progression_toggle.gif'), save_all=True, append_images=[s2_8x, s3_8x, s4_8x], duration=900, loop=0)

# 2. Jeans Close-up Toggle (Green Pants vs Blue Jeans)
j_orig_18x = img_s1.crop(jeans_crop_box).resize((9 * 18, 9 * 18), Image.NEAREST)
j_new_18x = img_s4.crop(jeans_crop_box).resize((9 * 18, 9 * 18), Image.NEAREST)

gif_jeans = os.path.join(OUT_DIR, 'archer_jeans_close_toggle.gif')
j_orig_18x.save(
    gif_jeans,
    save_all=True,
    append_images=[j_new_18x],
    duration=800,
    loop=0
)
j_orig_18x.save(os.path.join(ARTIFACT_DIR, 'archer_jeans_close_toggle.gif'), save_all=True, append_images=[j_new_18x], duration=800, loop=0)

print("Saved animated comparison GIFs for Jeans.")
