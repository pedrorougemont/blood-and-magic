import os
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REF_IMG_PATH = r'C:/Users/Aline Santos/.gemini/antigravity/brain/545d3f9b-a8eb-4724-b8b8-9505375d2d74/.user_uploaded/media_1793456402931_a1a6f7f0.png'
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

# Render function
def arr_to_rgba(arr, pal):
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            idx = arr[y, x]
            if idx != 254:
                rgba[y, x, 0:3] = pal[idx]
                rgba[y, x, 3] = 255
    return Image.fromarray(rgba)

# Build Helmet Sprite (Variation A)
helm_arr = orig_arr.copy()
# Peaked top
helm_arr[0, 5] = 31; helm_arr[0, 6] = 40; helm_arr[0, 7] = 36; helm_arr[0, 8] = 31
# Upper dome
helm_arr[1, 4] = 31; helm_arr[1, 5] = 37; helm_arr[1, 6] = 40; helm_arr[1, 7] = 35; helm_arr[1, 8] = 33; helm_arr[1, 9] = 31
# Crown & brow
helm_arr[2, 3] = 31; helm_arr[2, 4] = 36; helm_arr[2, 5] = 38; helm_arr[2, 6] = 41; helm_arr[2, 7] = 36; helm_arr[2, 8] = 33; helm_arr[2, 9] = 31
# Brow band
helm_arr[3, 3] = 31; helm_arr[3, 4] = 37; helm_arr[3, 5] = 39; helm_arr[3, 6] = 41; helm_arr[3, 7] = 35; helm_arr[3, 8] = 33; helm_arr[3, 9] = 31
# Horizontal Visor Slit
helm_arr[4, 3] = 31; helm_arr[4, 4] = 32; helm_arr[4, 5] = 0;  helm_arr[4, 6] = 32; helm_arr[4, 7] = 0;  helm_arr[4, 8] = 32; helm_arr[4, 9] = 31
# Upper Faceplate
helm_arr[5, 4] = 31; helm_arr[5, 5] = 38; helm_arr[5, 6] = 40; helm_arr[5, 7] = 35; helm_arr[5, 8] = 0;  helm_arr[5, 9] = 31
# Mid Faceplate
helm_arr[6, 4] = 31; helm_arr[6, 5] = 0;  helm_arr[6, 6] = 40; helm_arr[6, 7] = 35; helm_arr[6, 8] = 33; helm_arr[6, 9] = 31
# Lower Faceplate
helm_arr[7, 4] = 31; helm_arr[7, 5] = 37; helm_arr[7, 6] = 39; helm_arr[7, 7] = 35; helm_arr[7, 8] = 33; helm_arr[7, 9] = 31
# Chin / lower snout
helm_arr[8, 4] = 31; helm_arr[8, 5] = 36; helm_arr[8, 6] = 38; helm_arr[8, 7] = 34; helm_arr[8, 8] = 31
# Brass / Gold Collar Rim
helm_arr[9, 4] = 150; helm_arr[9, 5] = 152; helm_arr[9, 6] = 154; helm_arr[9, 7] = 152; helm_arr[9, 8] = 150
# Neck shadow
helm_arr[10, 4] = 31; helm_arr[10, 5] = 31; helm_arr[10, 6] = 31; helm_arr[10, 7] = 31

img_orig = arr_to_rgba(orig_arr, base_pal)
img_helm = arr_to_rgba(helm_arr, base_pal)

# Crop head regions (x: 2..11, y: 0..11) -> 10 x 12 px
head_crop_box = (2, 0, 12, 12)
head_orig = img_orig.crop(head_crop_box)
head_helm = img_helm.crop(head_crop_box)

# Create high-res presentation graphic
# Canvas layout:
# -------------------------------------------------------------
# [ Title: Archer Facing Down - Great Helm Integration ]
# -------------------------------------------------------------
# [ Reference Image ]  [ BEFORE (Full Body) ]  [ AFTER (Full Body) ]
# [ User's Helmet   ]  [ 8x Scale           ]  [ 8x Scale          ]
# -------------------------------------------------------------
# [ HEAD CLOSE-UP: BEFORE (18x) ]  [ HEAD CLOSE-UP: AFTER (18x) ]
# [ With Pixel Grid & Coordinates]  [ With Pixel Grid & Coordinates]
# -------------------------------------------------------------

SCALE_BODY = 8
SCALE_HEAD = 18

ref_img = Image.open(REF_IMG_PATH)
ref_scaled = ref_img.resize((SCALE_BODY * 14 * 2, SCALE_BODY * 32), Image.BILINEAR)

body_orig_scaled = img_orig.resize((w * SCALE_BODY, h * SCALE_BODY), Image.NEAREST)
body_helm_scaled = img_helm.resize((w * SCALE_BODY, h * SCALE_BODY), Image.NEAREST)

def make_grid_image(cropped_img, scale, grid_color=(45, 55, 75, 120)):
    cw, ch = cropped_img.size
    sw = cw * scale
    sh = ch * scale
    scaled = cropped_img.resize((sw, sh), Image.NEAREST)
    draw = ImageDraw.Draw(scaled)
    for x in range(scale, sw, scale):
        draw.line([(x, 0), (x, sh)], fill=grid_color, width=1)
    for y in range(scale, sh, scale):
        draw.line([(0, y), (sw, y)], fill=grid_color, width=1)
    return scaled

head_orig_grid = make_grid_image(head_orig, SCALE_HEAD)
head_helm_grid = make_grid_image(head_helm, SCALE_HEAD)

# Compose final master comparison image
CANVAS_W = 1000
CANVAS_H = 750

comp = Image.new('RGBA', (CANVAS_W, CANVAS_H), (15, 18, 26, 255))
draw = ImageDraw.Draw(comp)
font = ImageFont.load_default()

# Header
draw.rectangle([0, 0, CANVAS_W, 60], fill=(22, 28, 40, 255))
draw.line([(0, 60), (CANVAS_W, 60)], fill=(200, 163, 86, 255), width=2)
draw.text((24, 16), "BLOOD & MAGIC - ARCHER HELMET INTEGRATION", fill=(200, 163, 86, 255), font=font)
draw.text((24, 34), "Walking Down (Anim 1350 Cel 0) &bull; Native 14x32 Sprite &bull; Great Helm Pixel Translation", fill=(140, 160, 190, 255), font=font)

# Section 1: Full Body Row
y_row1 = 80
# Card 1: Reference
card_ref_x = 24
draw.rectangle([card_ref_x, y_row1, card_ref_x + 220, y_row1 + 300], fill=(22, 27, 38, 255), outline=(40, 50, 70, 255))
draw.text((card_ref_x + 12, y_row1 + 10), "REFERENCE HELMET", fill=(200, 215, 235, 255), font=font)
draw.text((card_ref_x + 12, y_row1 + 24), "User Uploaded Art", fill=(120, 140, 170, 255), font=font)
ref_thumb = ref_img.resize((196, 204), Image.BILINEAR)
comp.paste(ref_thumb, (card_ref_x + 12, y_row1 + 45), ref_thumb.convert('RGBA'))

# Card 2: BEFORE Full Body
card_before_x = 264
draw.rectangle([card_before_x, y_row1, card_before_x + 160, y_row1 + 300], fill=(22, 27, 38, 255), outline=(40, 50, 70, 255))
draw.text((card_before_x + 12, y_row1 + 10), "BEFORE: ORIGINAL", fill=(200, 215, 235, 255), font=font)
draw.text((card_before_x + 12, y_row1 + 24), "Blonde Hair & Headband", fill=(120, 140, 170, 255), font=font)
comp.paste(body_orig_scaled, (card_before_x + 24, y_row1 + 42), body_orig_scaled)
draw.text((card_before_x + 12, y_row1 + 276), "8x Zoom (14x32 native)", fill=(100, 120, 150, 255), font=font)

# Card 3: AFTER Full Body
card_after_x = 444
draw.rectangle([card_after_x, y_row1, card_after_x + 160, y_row1 + 300], fill=(22, 27, 38, 255), outline=(50, 80, 120, 255))
draw.text((card_after_x + 12, y_row1 + 10), "AFTER: GREAT HELM", fill=(100, 180, 255, 255), font=font)
draw.text((card_after_x + 12, y_row1 + 24), "Steel Plate + Brass Rim", fill=(140, 160, 200, 255), font=font)
comp.paste(body_helm_scaled, (card_after_x + 24, y_row1 + 42), body_helm_scaled)
draw.text((card_after_x + 12, y_row1 + 276), "8x Zoom (14x32 native)", fill=(100, 120, 150, 255), font=font)

# Card 4: Native 1x & 2x Real-Size comparison
card_native_x = 624
draw.rectangle([card_native_x, y_row1, card_native_x + 352, y_row1 + 300], fill=(22, 27, 38, 255), outline=(40, 50, 70, 255))
draw.text((card_native_x + 14, y_row1 + 10), "IN-GAME SCALE (1X & 2X / 4X)", fill=(200, 215, 235, 255), font=font)
draw.text((card_native_x + 14, y_row1 + 24), "Actual DOS VGA Screen Dimensions", fill=(120, 140, 170, 255), font=font)

# 1x
draw.text((card_native_x + 20, y_row1 + 55), "1x (DOS):", fill=(150, 170, 200, 255), font=font)
comp.paste(img_orig, (card_native_x + 90, y_row1 + 55), img_orig)
comp.paste(img_helm, (card_native_x + 120, y_row1 + 55), img_helm)

# 2x
draw.text((card_native_x + 20, y_row1 + 105), "2x Scale:", fill=(150, 170, 200, 255), font=font)
comp.paste(img_orig.resize((w*2, h*2), Image.NEAREST), (card_native_x + 90, y_row1 + 105), img_orig.resize((w*2, h*2), Image.NEAREST))
comp.paste(img_helm.resize((w*2, h*2), Image.NEAREST), (card_native_x + 130, y_row1 + 105), img_helm.resize((w*2, h*2), Image.NEAREST))

# 4x
draw.text((card_native_x + 20, y_row1 + 185), "4x Scale:", fill=(150, 170, 200, 255), font=font)
comp.paste(img_orig.resize((w*4, h*4), Image.NEAREST), (card_native_x + 90, y_row1 + 180), img_orig.resize((w*4, h*4), Image.NEAREST))
comp.paste(img_helm.resize((w*4, h*4), Image.NEAREST), (card_native_x + 160, y_row1 + 180), img_helm.resize((w*4, h*4), Image.NEAREST))

# Section 2: Detailed Head Pixel Close-Up (18x)
y_row2 = 400
# Head Before
card_hb_x = 24
draw.rectangle([card_hb_x, y_row2, card_hb_x + 460, y_row2 + 320], fill=(20, 25, 36, 255), outline=(40, 50, 70, 255))
draw.text((card_hb_x + 14, y_row2 + 10), "HEAD CLOSE-UP: BEFORE (ORIGINAL)", fill=(200, 215, 235, 255), font=font)
draw.text((card_hb_x + 14, y_row2 + 24), "10x12 pixels cropped & magnified 18x with pixel grid", fill=(120, 140, 170, 255), font=font)
comp.paste(head_orig_grid, (card_hb_x + 14, y_row2 + 45))
# Annotations for before
draw.text((card_hb_x + 210, y_row2 + 60), "&bull; Rows 0-1: Blonde hair crest", fill=(140, 160, 190, 255), font=font)
draw.text((card_hb_x + 210, y_row2 + 85), "&bull; Rows 2-3: Blue team headband", fill=(140, 160, 190, 255), font=font)
draw.text((card_hb_x + 210, y_row2 + 110), "&bull; Row 6: Blue eyes (Index 88)", fill=(140, 160, 190, 255), font=font)
draw.text((card_hb_x + 210, y_row2 + 135), "&bull; Rows 7-9: Peach skin & jaw", fill=(140, 160, 190, 255), font=font)
draw.text((card_hb_x + 210, y_row2 + 160), "&bull; Row 10: Neck & tunic line", fill=(140, 160, 190, 255), font=font)

# Head After
card_ha_x = 516
draw.rectangle([card_ha_x, y_row2, card_ha_x + 460, y_row2 + 320], fill=(20, 25, 36, 255), outline=(50, 80, 130, 255))
draw.text((card_ha_x + 14, y_row2 + 10), "HEAD CLOSE-UP: AFTER (GREAT HELM)", fill=(100, 180, 255, 255), font=font)
draw.text((card_ha_x + 14, y_row2 + 24), "10x12 pixels cropped & magnified 18x with pixel grid", fill=(140, 160, 200, 255), font=font)
comp.paste(head_helm_grid, (card_ha_x + 14, y_row2 + 45))
# Annotations for after
draw.text((card_ha_x + 210, y_row2 + 60), "&bull; Rows 0-2: Peaked steel dome", fill=(200, 220, 245, 255), font=font)
draw.text((card_ha_x + 210, y_row2 + 85), "&bull; Row 4: Black vision slit (Visor)", fill=(200, 220, 245, 255), font=font)
draw.text((card_ha_x + 210, y_row2 + 110), "&bull; Rows 5-7: Faceplate + breath holes", fill=(200, 220, 245, 255), font=font)
draw.text((card_ha_x + 210, y_row2 + 135), "&bull; Row 9: Brass / gold collar trim", fill=(240, 200, 100, 255), font=font)
draw.text((card_ha_x + 210, y_row2 + 160), "&bull; Col 6: Vertical center specular ridge", fill=(200, 220, 245, 255), font=font)

# Save presentation
comp_out_path = os.path.join(OUT_DIR, 'archer_helmet_before_after.png')
comp.save(comp_out_path)
print(f"Saved {comp_out_path} ({CANVAS_W}x{CANVAS_H} px)")

# Also copy to artifact dir so it can be viewed and embedded
artifact_comp_path = os.path.join(ARTIFACT_DIR, 'archer_helmet_before_after.png')
comp.save(artifact_comp_path)
print(f"Saved {artifact_comp_path}")

