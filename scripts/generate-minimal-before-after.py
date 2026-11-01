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
# BUILD FINAL "LAST" SPRITE
# -------------------------------------------------------------
last_arr = orig_arr.copy()

# 1. Great Helm
last_arr[0, 5] = 31; last_arr[0, 6] = 40; last_arr[0, 7] = 36; last_arr[0, 8] = 31
last_arr[1, 4] = 31; last_arr[1, 5] = 37; last_arr[1, 6] = 40; last_arr[1, 7] = 35; last_arr[1, 8] = 33; last_arr[1, 9] = 31
last_arr[2, 3] = 31; last_arr[2, 4] = 36; last_arr[2, 5] = 38; last_arr[2, 6] = 41; last_arr[2, 7] = 36; last_arr[2, 8] = 33; last_arr[2, 9] = 31
last_arr[3, 3] = 31; last_arr[3, 4] = 37; last_arr[3, 5] = 39; last_arr[3, 6] = 41; last_arr[3, 7] = 35; last_arr[3, 8] = 33; last_arr[3, 9] = 31
last_arr[4, 3] = 31; last_arr[4, 4] = 32; last_arr[4, 5] = 0;  last_arr[4, 6] = 32; last_arr[4, 7] = 0;  last_arr[4, 8] = 32; last_arr[4, 9] = 31
last_arr[5, 4] = 31; last_arr[5, 5] = 38; last_arr[5, 6] = 40; last_arr[5, 7] = 35; last_arr[5, 8] = 0;  last_arr[5, 9] = 31
last_arr[6, 4] = 31; last_arr[6, 5] = 0;  last_arr[6, 6] = 40; last_arr[6, 7] = 35; last_arr[6, 8] = 33; last_arr[6, 9] = 31
last_arr[7, 4] = 31; last_arr[7, 5] = 37; last_arr[7, 6] = 39; last_arr[7, 7] = 35; last_arr[7, 8] = 33; last_arr[7, 9] = 31
last_arr[8, 4] = 31; last_arr[8, 5] = 36; last_arr[8, 6] = 38; last_arr[8, 7] = 34; last_arr[8, 8] = 31
last_arr[9, 4] = 150; last_arr[9, 5] = 152; last_arr[9, 6] = 154; last_arr[9, 7] = 152; last_arr[9, 8] = 150
last_arr[10, 4] = 31; last_arr[10, 5] = 31; last_arr[10, 6] = 31; last_arr[10, 7] = 31

# 2. Gray Armor (replace green 57..64)
green_to_gray = {
    57: 32, 58: 33, 59: 34, 60: 35, 61: 36, 62: 37, 63: 39, 64: 41
}
for y in range(h):
    for x in range(w):
        val = last_arr[y, x]
        if val in green_to_gray:
            last_arr[y, x] = green_to_gray[val]

# 3. Brown Skin (Hands, wrists, arms)
skin_map = {
    180: 172, 179: 171, 178: 170, 177: 169, 176: 121, 175: 120, 174: 120, 173: 119
}
for y in range(10, h):
    for x in range(w):
        val = last_arr[y, x]
        if val in skin_map:
            last_arr[y, x] = skin_map[val]

# 4. Neutral leather belt with brass buckle
last_arr[14, 3] = 17;   last_arr[14, 9] = 17
last_arr[15, 4] = 18;   last_arr[15, 6] = 152;  last_arr[15, 8] = 18
last_arr[16, 3] = 17;   last_arr[16, 5] = 18;   last_arr[16, 7] = 18
last_arr[17, 4] = 18;   last_arr[17, 6] = 152

# Note: The arms and bracers retain their authentic original silhouette and blue bracer pixels (193..198)
# with the exposed skin naturally mapped to the brown skin ramp (169..172, 119..121).

# 5. Blue Jeans
last_arr[17, 3] = 83; last_arr[17, 8] = 84; last_arr[17, 9] = 85
last_arr[18, 3] = 83; last_arr[18, 4] = 84; last_arr[18, 5] = 85; last_arr[18, 6] = 83; last_arr[18, 7] = 85; last_arr[18, 8] = 152; last_arr[18, 9] = 87
last_arr[19, 3] = 83; last_arr[19, 4] = 84; last_arr[19, 5] = 85; last_arr[19, 6] = 83; last_arr[19, 7] = 86; last_arr[19, 8] = 87; last_arr[19, 9] = 88
last_arr[20, 3] = 84; last_arr[20, 4] = 85; last_arr[20, 5] = 84; last_arr[20, 6] = 83; last_arr[20, 7] = 86; last_arr[20, 8] = 89; last_arr[20, 9] = 88
last_arr[21, 3] = 84; last_arr[21, 4] = 86; last_arr[21, 5] = 85; last_arr[21, 7] = 87; last_arr[21, 8] = 90; last_arr[21, 9] = 89
last_arr[22, 3] = 85; last_arr[22, 4] = 87; last_arr[22, 5] = 85; last_arr[22, 7] = 88; last_arr[22, 8] = 91; last_arr[22, 9] = 90
last_arr[23, 3] = 86; last_arr[23, 4] = 88; last_arr[23, 5] = 86; last_arr[23, 6] = 83; last_arr[23, 7] = 88; last_arr[23, 8] = 92; last_arr[23, 9] = 91
last_arr[24, 3] = 86; last_arr[24, 4] = 88; last_arr[24, 5] = 86; last_arr[24, 6] = 83; last_arr[24, 7] = 87; last_arr[24, 8] = 90; last_arr[24, 9] = 89
last_arr[25, 4] = 87; last_arr[25, 8] = 88; last_arr[25, 9] = 87

# Render PIL Images
img_orig = arr_to_rgba(orig_arr, base_pal)
img_last = arr_to_rgba(last_arr, base_pal)

# Save native 1x PNG
img_last.save(os.path.join(OUT_DIR, 'archer_walk_down_custom_final.png'))
print("Saved archer_walk_down_custom_final.png (14x32).")

# -------------------------------------------------------------
# CLEAN MINIMAL BEFORE & AFTER GRAPHIC (720 x 500 px)
# -------------------------------------------------------------
CW = 720
CH = 500
comp = Image.new('RGBA', (CW, CH), (14, 17, 24, 255))
draw = ImageDraw.Draw(comp)
font = ImageFont.load_default()

# Header
draw.rectangle([0, 0, CW, 50], fill=(20, 24, 34, 255))
draw.line([(0, 50), (CW, 50)], fill=(200, 163, 86, 255), width=2)
draw.text((24, 18), "ARCHER WALKING DOWN - BEFORE & AFTER", fill=(200, 163, 86, 255), font=font)

SCALE = 8 # 14x32 -> 112x256 px

card_w = 320
card_h = 410
y_top = 70

# Column 1: ORIGINAL
cx1 = 24
draw.rectangle([cx1, y_top, cx1 + card_w, y_top + card_h], fill=(20, 24, 34, 255), outline=(40, 50, 70, 255))
draw.text((cx1 + 16, y_top + 14), "ORIGINAL", fill=(180, 195, 215, 255), font=font)

orig_scaled = img_orig.resize((w * SCALE, h * SCALE), Image.NEAREST)
draw_x1 = cx1 + (card_w - w * SCALE) // 2
comp.paste(orig_scaled, (draw_x1, y_top + 45), orig_scaled)

# 1x mini inset
comp.paste(img_orig, (cx1 + 20, y_top + 315), img_orig)
draw.text((cx1 + 42, y_top + 325), "1x Native DOS Scale", fill=(110, 130, 160, 255), font=font)

# Key points
draw.text((cx1 + 16, y_top + 355), "&bull; Blonde Hair & Blue Headband", fill=(130, 150, 180, 255), font=font)
draw.text((cx1 + 16, y_top + 372), "&bull; Pale Skin, Green Armor, Blue Bracers, Olive Pants", fill=(130, 150, 180, 255), font=font)

# Column 2: LAST (FINAL CUSTOM)
cx2 = cx1 + card_w + 32
draw.rectangle([cx2, y_top, cx2 + card_w, y_top + card_h], fill=(24, 32, 46, 255), outline=(70, 140, 220, 255))
draw.text((cx2 + 16, y_top + 14), "LAST (FINAL CUSTOM)", fill=(100, 190, 255, 255), font=font)

last_scaled = img_last.resize((w * SCALE, h * SCALE), Image.NEAREST)
draw_x2 = cx2 + (card_w - w * SCALE) // 2
comp.paste(last_scaled, (draw_x2, y_top + 45), last_scaled)

# 1x mini inset
comp.paste(img_last, (cx2 + 20, y_top + 315), img_last)
draw.text((cx2 + 42, y_top + 325), "1x Native DOS Scale", fill=(110, 130, 160, 255), font=font)

# Key points
draw.text((cx2 + 16, y_top + 355), "&bull; Crusader Great Helm (Steel & Brass Trim)", fill=(200, 220, 245, 255), font=font)
draw.text((cx2 + 16, y_top + 372), "&bull; Brown Skin, Gray Armor, Jeans & Bracers", fill=(200, 220, 245, 255), font=font)

# Save Minimal Graphic
comp_path = os.path.join(OUT_DIR, 'archer_before_after_minimal.png')
comp.save(comp_path)
comp.save(os.path.join(ARTIFACT_DIR, 'archer_before_after_minimal.png'))
print(f"Saved {comp_path} ({CW}x{CH} px)")

# -------------------------------------------------------------
# Smooth Animated Toggle GIF (Original <-> Last)
# -------------------------------------------------------------
gif_path = os.path.join(OUT_DIR, 'archer_original_vs_last_toggle.gif')
orig_scaled.save(
    gif_path,
    save_all=True,
    append_images=[last_scaled],
    duration=900,
    loop=0
)
orig_scaled.save(
    os.path.join(ARTIFACT_DIR, 'archer_original_vs_last_toggle.gif'),
    save_all=True,
    append_images=[last_scaled],
    duration=900,
    loop=0
)
print("Saved archer_original_vs_last_toggle.gif.")

