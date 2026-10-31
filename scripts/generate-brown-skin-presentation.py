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

# 1. Skin Remap Table:
# Warm rich mahogany/umber skin ramp
# Original peach: 180 (cream highlight), 179 (peach), 178 (light peach), 177 (midtone), 176 (shadow-mid), 175-173 (dark shadow)
skin_map = {
    180: 172, # [135, 79, 47] - warm caramel skin highlight
    179: 171, # [119, 63, 39] - rich warm brown
    178: 170, # [103, 51, 31] - warm mahogany midtone
    177: 169, # [83, 47, 19]  - deep warm umber
    176: 121, # [79, 39, 31]  - dark umber core shadow
    175: 120, # [63, 31, 23]  - deep espresso shadow
    174: 120, # [63, 31, 23]
    173: 119, # [51, 27, 19]  - dark shadow / crease
}

hair_map = {
    154: 119, # [51, 27, 19] - dark espresso / black hair shadow
    155: 120, # [63, 31, 23] - dark brown hair midtone
    156: 121, # [79, 39, 31] - rich brown textured hair curl highlight
}

# 2. Build Unhelmeted Black Man Archer
archer_brown = orig_arr.copy()
for y in range(h):
    for x in range(w):
        val = archer_brown[y, x]
        if val in skin_map:
            archer_brown[y, x] = skin_map[val]

# Hair remapping on head (y=0..9)
for y in range(10):
    for x in range(w):
        val = archer_brown[y, x]
        if val in hair_map:
            archer_brown[y, x] = hair_map[val]

# Eyes: change blue iris (88) to warm brown iris (170)
archer_brown[6, 5] = 170
archer_brown[6, 7] = 170

# 3. Build Helmeted Black Man Archer (Great Helm + Brown Hands/Skin)
archer_helm_brown = orig_arr.copy()

# Great Helm on Head
archer_helm_brown[0, 5] = 31; archer_helm_brown[0, 6] = 40; archer_helm_brown[0, 7] = 36; archer_helm_brown[0, 8] = 31
archer_helm_brown[1, 4] = 31; archer_helm_brown[1, 5] = 37; archer_helm_brown[1, 6] = 40; archer_helm_brown[1, 7] = 35; archer_helm_brown[1, 8] = 33; archer_helm_brown[1, 9] = 31
archer_helm_brown[2, 3] = 31; archer_helm_brown[2, 4] = 36; archer_helm_brown[2, 5] = 38; archer_helm_brown[2, 6] = 41; archer_helm_brown[2, 7] = 36; archer_helm_brown[2, 8] = 33; archer_helm_brown[2, 9] = 31
archer_helm_brown[3, 3] = 31; archer_helm_brown[3, 4] = 37; archer_helm_brown[3, 5] = 39; archer_helm_brown[3, 6] = 41; archer_helm_brown[3, 7] = 35; archer_helm_brown[3, 8] = 33; archer_helm_brown[3, 9] = 31
archer_helm_brown[4, 3] = 31; archer_helm_brown[4, 4] = 32; archer_helm_brown[4, 5] = 0;  archer_helm_brown[4, 6] = 32; archer_helm_brown[4, 7] = 0;  archer_helm_brown[4, 8] = 32; archer_helm_brown[4, 9] = 31
archer_helm_brown[5, 4] = 31; archer_helm_brown[5, 5] = 38; archer_helm_brown[5, 6] = 40; archer_helm_brown[5, 7] = 35; archer_helm_brown[5, 8] = 0;  archer_helm_brown[5, 9] = 31
archer_helm_brown[6, 4] = 31; archer_helm_brown[6, 5] = 0;  archer_helm_brown[6, 6] = 40; archer_helm_brown[6, 7] = 35; archer_helm_brown[6, 8] = 33; archer_helm_brown[6, 9] = 31
archer_helm_brown[7, 4] = 31; archer_helm_brown[7, 5] = 37; archer_helm_brown[7, 6] = 39; archer_helm_brown[7, 7] = 35; archer_helm_brown[7, 8] = 33; archer_helm_brown[7, 9] = 31
archer_helm_brown[8, 4] = 31; archer_helm_brown[8, 5] = 36; archer_helm_brown[8, 6] = 38; archer_helm_brown[8, 7] = 34; archer_helm_brown[8, 8] = 31
archer_helm_brown[9, 4] = 150; archer_helm_brown[9, 5] = 152; archer_helm_brown[9, 6] = 154; archer_helm_brown[9, 7] = 152; archer_helm_brown[9, 8] = 150
archer_helm_brown[10, 4] = 31; archer_helm_brown[10, 5] = 31; archer_helm_brown[10, 6] = 31; archer_helm_brown[10, 7] = 31

# Exposed skin (hands and arms on rows 10..20)
for y in range(10, h):
    for x in range(w):
        val = archer_helm_brown[y, x]
        if val in skin_map:
            archer_helm_brown[y, x] = skin_map[val]

# 4. Also keep the Caucasian with helmet for comparison
archer_helm_white = orig_arr.copy()
archer_helm_white[0, 5] = 31; archer_helm_white[0, 6] = 40; archer_helm_white[0, 7] = 36; archer_helm_white[0, 8] = 31
archer_helm_white[1, 4] = 31; archer_helm_white[1, 5] = 37; archer_helm_white[1, 6] = 40; archer_helm_white[1, 7] = 35; archer_helm_white[1, 8] = 33; archer_helm_white[1, 9] = 31
archer_helm_white[2, 3] = 31; archer_helm_white[2, 4] = 36; archer_helm_white[2, 5] = 38; archer_helm_white[2, 6] = 41; archer_helm_white[2, 7] = 36; archer_helm_white[2, 8] = 33; archer_helm_white[2, 9] = 31
archer_helm_white[3, 3] = 31; archer_helm_white[3, 4] = 37; archer_helm_white[3, 5] = 39; archer_helm_white[3, 6] = 41; archer_helm_white[3, 7] = 35; archer_helm_white[3, 8] = 33; archer_helm_white[3, 9] = 31
archer_helm_white[4, 3] = 31; archer_helm_white[4, 4] = 32; archer_helm_white[4, 5] = 0;  archer_helm_white[4, 6] = 32; archer_helm_white[4, 7] = 0;  archer_helm_white[4, 8] = 32; archer_helm_white[4, 9] = 31
archer_helm_white[5, 4] = 31; archer_helm_white[5, 5] = 38; archer_helm_white[5, 6] = 40; archer_helm_white[5, 7] = 35; archer_helm_white[5, 8] = 0;  archer_helm_white[5, 9] = 31
archer_helm_white[6, 4] = 31; archer_helm_white[6, 5] = 0;  archer_helm_white[6, 6] = 40; archer_helm_white[6, 7] = 35; archer_helm_white[6, 8] = 33; archer_helm_white[6, 9] = 31
archer_helm_white[7, 4] = 31; archer_helm_white[7, 5] = 37; archer_helm_white[7, 6] = 39; archer_helm_white[7, 7] = 35; archer_helm_white[7, 8] = 33; archer_helm_white[7, 9] = 31
archer_helm_white[8, 4] = 31; archer_helm_white[8, 5] = 36; archer_helm_white[8, 6] = 38; archer_helm_white[8, 7] = 34; archer_helm_white[8, 8] = 31
archer_helm_white[9, 4] = 150; archer_helm_white[9, 5] = 152; archer_helm_white[9, 6] = 154; archer_helm_white[9, 7] = 152; archer_helm_white[9, 8] = 150
archer_helm_white[10, 4] = 31; archer_helm_white[10, 5] = 31; archer_helm_white[10, 6] = 31; archer_helm_white[10, 7] = 31

# Render native images
img_orig = arr_to_rgba(orig_arr, base_pal)
img_brown = arr_to_rgba(archer_brown, base_pal)
img_helm_white = arr_to_rgba(archer_helm_white, base_pal)
img_helm_brown = arr_to_rgba(archer_helm_brown, base_pal)

# Save native 1x PNGs
img_brown.save(os.path.join(OUT_DIR, 'archer_walk_down_brown.png'))
img_helm_brown.save(os.path.join(OUT_DIR, 'archer_walk_down_helmet_brown.png'))
print("Saved native 1x PNGs.")

# -------------------------------------------------------------
# BUILD MASTER COMPARISON GRAPHIC (1100 x 780 px)
# -------------------------------------------------------------
CANVAS_W = 1100
CANVAS_H = 780
comp = Image.new('RGBA', (CANVAS_W, CANVAS_H), (15, 18, 26, 255))
draw = ImageDraw.Draw(comp)
font = ImageFont.load_default()

# Header
draw.rectangle([0, 0, CANVAS_W, 60], fill=(22, 28, 40, 255))
draw.line([(0, 60), (CANVAS_W, 60)], fill=(200, 163, 86, 255), width=2)
draw.text((24, 16), "BLOOD & MAGIC - ARCHER SKIN TONE MODIFICATION", fill=(200, 163, 86, 255), font=font)
draw.text((24, 34), "Walking Down (Anim 1350 Cel 0) &bull; Rich Mahogany & Umber Palette Integration &bull; 14x32 DOS VGA Sprite", fill=(140, 160, 190, 255), font=font)

SCALE_BODY = 7
SCALE_ZOOM = 16

y_row1 = 80
card_w = 175
card_h = 300
gap = 14

cards = [
    {
        'title': '1. ORIGINAL',
        'sub': 'Caucasian / Blonde',
        'img': img_orig,
        'tag': 'Pale Peach skin (176..180)\nBlonde hair (154..156)\nBlue eyes (88)'
    },
    {
        'title': '2. BLACK MAN',
        'sub': 'Unhelmeted Base',
        'img': img_brown,
        'tag': 'Rich Brown skin (169..172)\nDark espresso hair (119..121)\nWarm brown eyes (170)'
    },
    {
        'title': '3. HELMET (ORIG)',
        'sub': 'Pale Skin + Helm',
        'img': img_helm_white,
        'tag': 'Great Helm steel plate\nBrass/gold bottom rim\nPale hands & arms'
    },
    {
        'title': '4. HELMET + BROWN',
        'sub': 'Black Man in Helm',
        'img': img_helm_brown,
        'tag': 'Great Helm steel plate\nBrass/gold collar rim\nRich Brown hands & arms'
    }
]

for idx, c in enumerate(cards):
    cx = 24 + idx * (card_w + gap)
    is_target = (idx == 1 or idx == 3)
    outline_col = (70, 130, 200, 255) if is_target else (40, 50, 70, 255)
    bg_col = (25, 33, 48, 255) if is_target else (22, 27, 38, 255)
    draw.rectangle([cx, y_row1, cx + card_w, y_row1 + card_h], fill=bg_col, outline=outline_col)

    title_col = (100, 190, 255, 255) if is_target else (200, 215, 235, 255)
    draw.text((cx + 10, y_row1 + 10), c['title'], fill=title_col, font=font)
    draw.text((cx + 10, y_row1 + 24), c['sub'], fill=(130, 150, 180, 255), font=font)

    # Paste scaled sprite
    scaled = c['img'].resize((w * SCALE_BODY, h * SCALE_BODY), Image.NEAREST)
    draw_x = cx + (card_w - w * SCALE_BODY) // 2
    comp.paste(scaled, (draw_x, y_row1 + 45), scaled)

    # Sub-tag
    lines = c['tag'].split('\n')
    for li, line in enumerate(lines):
        draw.text((cx + 10, y_row1 + 272 + li * 12 - 20), line, fill=(110, 130, 160, 255), font=font)

# Rightmost column: In-Game Native 1x, 2x, 4x Display
cx_right = 24 + 4 * (card_w + gap)
right_w = CANVAS_W - cx_right - 24
draw.rectangle([cx_right, y_row1, cx_right + right_w, y_row1 + card_h], fill=(20, 25, 36, 255), outline=(40, 50, 70, 255))
draw.text((cx_right + 12, y_row1 + 10), "IN-GAME SCALING", fill=(200, 163, 86, 255), font=font)
draw.text((cx_right + 12, y_row1 + 24), "1x, 2x, 4x Native DOS Look", fill=(120, 140, 170, 255), font=font)

draw.text((cx_right + 12, y_row1 + 55), "1x (DOS):", fill=(140, 160, 190, 255), font=font)
comp.paste(img_brown, (cx_right + 85, y_row1 + 50), img_brown)
comp.paste(img_helm_brown, (cx_right + 115, y_row1 + 50), img_helm_brown)

draw.text((cx_right + 12, y_row1 + 105), "2x Scale:", fill=(140, 160, 190, 255), font=font)
comp.paste(img_brown.resize((w*2, h*2), Image.NEAREST), (cx_right + 85, y_row1 + 95), img_brown.resize((w*2, h*2), Image.NEAREST))
comp.paste(img_helm_brown.resize((w*2, h*2), Image.NEAREST), (cx_right + 125, y_row1 + 95), img_helm_brown.resize((w*2, h*2), Image.NEAREST))

draw.text((cx_right + 12, y_row1 + 185), "4x Scale:", fill=(140, 160, 190, 255), font=font)
comp.paste(img_brown.resize((w*4, h*4), Image.NEAREST), (cx_right + 85, y_row1 + 170), img_brown.resize((w*4, h*4), Image.NEAREST))
comp.paste(img_helm_brown.resize((w*4, h*4), Image.NEAREST), (cx_right + 160, y_row1 + 170), img_helm_brown.resize((w*4, h*4), Image.NEAREST))

# -------------------------------------------------------------
# Section 2: Close-Ups with Pixel Grid (Row 2, y=400)
# -------------------------------------------------------------
y_row2 = 400
col_w = (CANVAS_W - 48 - 24) // 3 # ~336 px each

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

# Head Crop (x: 2..12, y: 0..12) -> 10 x 12 px
head_crop_box = (2, 0, 12, 12)
head_orig_grid = make_grid(img_orig.crop(head_crop_box), 16)
head_brown_grid = make_grid(img_brown.crop(head_crop_box), 16)

# Hands Crop (x: 9..14, y: 10..21) -> 5 x 11 px (Right hand & wrist holding bow string)
hand_crop_box = (9, 10, 14, 21)
hand_orig_grid = make_grid(img_orig.crop(hand_crop_box), 20)
hand_brown_grid = make_grid(img_helm_brown.crop(hand_crop_box), 20)

# Card A: Head Before & After
cx_a = 24
draw.rectangle([cx_a, y_row2, cx_a + 520, y_row2 + 350], fill=(20, 25, 36, 255), outline=(40, 50, 70, 255))
draw.text((cx_a + 14, y_row2 + 10), "FACE & HEAD CLOSE-UP (16X PIXEL GRID)", fill=(200, 215, 235, 255), font=font)
draw.text((cx_a + 14, y_row2 + 24), "Before (Caucasian) vs After (Black Man)", fill=(120, 140, 170, 255), font=font)

draw.text((cx_a + 14, y_row2 + 45), "Before (Peach & Blonde):", fill=(140, 160, 190, 255), font=font)
comp.paste(head_orig_grid, (cx_a + 14, y_row2 + 65))

draw.text((cx_a + 195, y_row2 + 45), "After (Brown Skin & Hair):", fill=(100, 190, 255, 255), font=font)
comp.paste(head_brown_grid, (cx_a + 195, y_row2 + 65))

# Annotations
draw.text((cx_a + 375, y_row2 + 65), "&bull; Skin: Warm Mahogany", fill=(200, 215, 235, 255), font=font)
draw.text((cx_a + 375, y_row2 + 82), "  Index 172: Caramel", fill=(150, 170, 200, 255), font=font)
draw.text((cx_a + 375, y_row2 + 99), "  Index 170: Midtone", fill=(150, 170, 200, 255), font=font)
draw.text((cx_a + 375, y_row2 + 116), "  Index 169: Umber", fill=(150, 170, 200, 255), font=font)
draw.text((cx_a + 375, y_row2 + 140), "&bull; Hair: Dark Espresso", fill=(200, 215, 235, 255), font=font)
draw.text((cx_a + 375, y_row2 + 157), "  Index 119/120: Dark", fill=(150, 170, 200, 255), font=font)
draw.text((cx_a + 375, y_row2 + 174), "  Index 121: Curl shine", fill=(150, 170, 200, 255), font=font)
draw.text((cx_a + 375, y_row2 + 198), "&bull; Eyes: Deep Brown", fill=(200, 215, 235, 255), font=font)
draw.text((cx_a + 375, y_row2 + 215), "  Index 170 iris", fill=(150, 170, 200, 255), font=font)

# Card B: Hands & Wrist Close-Up
cx_b = cx_a + 535
w_b = CANVAS_W - cx_b - 24
draw.rectangle([cx_b, y_row2, cx_b + w_b, y_row2 + 350], fill=(20, 25, 36, 255), outline=(50, 80, 130, 255))
draw.text((cx_b + 14, y_row2 + 10), "EXPOSED HANDS / WRIST CLOSE-UP (20X)", fill=(100, 190, 255, 255), font=font)
draw.text((cx_b + 14, y_row2 + 24), "Archer Right Hand Holding Bow String (Rows 10..20)", fill=(140, 160, 200, 255), font=font)

draw.text((cx_b + 14, y_row2 + 45), "Before (Pale):", fill=(140, 160, 190, 255), font=font)
comp.paste(hand_orig_grid, (cx_b + 14, y_row2 + 65))

draw.text((cx_b + 130, y_row2 + 45), "After (Brown):", fill=(100, 190, 255, 255), font=font)
comp.paste(hand_brown_grid, (cx_b + 130, y_row2 + 65))

# Hands description
draw.text((cx_b + 250, y_row2 + 70), "&bull; Fingers & Knuckles:", fill=(200, 215, 235, 255), font=font)
draw.text((cx_b + 250, y_row2 + 87), "  Remapped from peach", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 250, y_row2 + 104), "  176..180 to rich", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 250, y_row2 + 121), "  umber 169..172", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 250, y_row2 + 145), "&bull; Wrist & Forearm:", fill=(200, 215, 235, 255), font=font)
draw.text((cx_b + 250, y_row2 + 162), "  Natural edge shadow", fill=(140, 160, 190, 255), font=font)
draw.text((cx_b + 250, y_row2 + 179), "  using 120/121", fill=(140, 160, 190, 255), font=font)

# Save Master Infographic
comp_path = os.path.join(OUT_DIR, 'archer_brown_skin_comparison.png')
comp.save(comp_path)
comp.save(os.path.join(ARTIFACT_DIR, 'archer_brown_skin_comparison.png'))
print(f"Saved {comp_path} ({CANVAS_W}x{CANVAS_H} px)")

# -------------------------------------------------------------
# Animated Toggle GIFs
# -------------------------------------------------------------
# 1. 3-Way Full Body Toggle (Orig -> Brown -> Helmet Brown)
orig_8x = img_orig.resize((w * 8, h * 8), Image.NEAREST)
brown_8x = img_brown.resize((w * 8, h * 8), Image.NEAREST)
helm_brown_8x = img_helm_brown.resize((w * 8, h * 8), Image.NEAREST)

gif_body = os.path.join(OUT_DIR, 'archer_brown_skin_toggle.gif')
orig_8x.save(
    gif_body,
    save_all=True,
    append_images=[brown_8x, helm_brown_8x],
    duration=900,
    loop=0
)
orig_8x.save(os.path.join(ARTIFACT_DIR, 'archer_brown_skin_toggle.gif'), save_all=True, append_images=[brown_8x, helm_brown_8x], duration=900, loop=0)

# 2. Head Close-up Toggle (Orig -> Brown -> Helmet)
h_orig_16x = img_orig.crop(head_crop_box).resize((10 * 16, 12 * 16), Image.NEAREST)
h_brown_16x = img_brown.crop(head_crop_box).resize((10 * 16, 12 * 16), Image.NEAREST)
h_helm_16x = img_helm_brown.crop(head_crop_box).resize((10 * 16, 12 * 16), Image.NEAREST)

gif_head = os.path.join(OUT_DIR, 'archer_brown_head_toggle.gif')
h_orig_16x.save(
    gif_head,
    save_all=True,
    append_images=[h_brown_16x, h_helm_16x],
    duration=900,
    loop=0
)
h_orig_16x.save(os.path.join(ARTIFACT_DIR, 'archer_brown_head_toggle.gif'), save_all=True, append_images=[h_brown_16x, h_helm_16x], duration=900, loop=0)

print("Saved animated comparison GIFs for skin tone.")
