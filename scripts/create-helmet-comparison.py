import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

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

def render_sprite(arr, pal):
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            idx = arr[y, x]
            if idx != 254:
                rgba[y, x, 0:3] = pal[idx]
                rgba[y, x, 3] = 255
    return Image.fromarray(rgba)

# Palette color references:
# Dark outline / deep shadow: 31 (23,23,23), 0 (0,0,0)
# Dark steel: 33 (51,51,51), 34 (67,67,67)
# Mid steel: 35 (83,83,83), 36 (99,99,99)
# Light steel: 37 (119,119,119), 38 (135,135,135)
# Highlight / ridge: 39 (151,151,151), 40 (167,167,167), 41 (183,183,183)
# Black slit / perforation: 0 (0,0,0)
# Gold / brass rim: 150 (dark gold/brass), 152 (warm gold), 154 (bright gold), 155 (highlight gold)

# VARIATION A: Direct translation of the uploaded Great Helm
# Peaked dome, horizontal vision slit with dark shadow, center ridge highlight, breathing holes, brass collar rim.
helm_a = orig_arr.copy()

# Row 0: peaked top
helm_a[0, 5] = 31 # outline
helm_a[0, 6] = 40 # highlight peak
helm_a[0, 7] = 36 # mid
helm_a[0, 8] = 31 # outline

# Row 1: upper dome
helm_a[1, 4] = 31 # outline
helm_a[1, 5] = 37 # left dome
helm_a[1, 6] = 40 # center highlight
helm_a[1, 7] = 35 # right dome
helm_a[1, 8] = 33 # right shadow
helm_a[1, 9] = 31 # outline

# Row 2: crown plate & brow
helm_a[2, 3] = 31 # outline
helm_a[2, 4] = 36 # left steel
helm_a[2, 5] = 38 # left light steel
helm_a[2, 6] = 41 # center ridge highlight
helm_a[2, 7] = 36 # right steel
helm_a[2, 8] = 33 # shadow
helm_a[2, 9] = 31 # outline

# Row 3: brow band above visor
helm_a[3, 3] = 31 # outline
helm_a[3, 4] = 37 # left
helm_a[3, 5] = 39 # highlight left
helm_a[3, 6] = 41 # ridge highlight
helm_a[3, 7] = 35 # right
helm_a[3, 8] = 33 # shadow
helm_a[3, 9] = 31 # outline

# Row 4: Visor (Eye Slit)
helm_a[4, 3] = 31 # outline
helm_a[4, 4] = 32 # dark steel frame
helm_a[4, 5] = 0  # eye slit black
helm_a[4, 6] = 32 # central divider / nose bridge
helm_a[4, 7] = 0  # eye slit black
helm_a[4, 8] = 32 # dark steel frame
helm_a[4, 9] = 31 # outline

# Row 5: Upper faceplate with breathing perforations
helm_a[5, 4] = 31 # outline
helm_a[5, 5] = 38 # light steel
helm_a[5, 6] = 40 # center ridge highlight
helm_a[5, 7] = 35 # mid steel
helm_a[5, 8] = 0  # breathing hole dot
helm_a[5, 9] = 31 # outline

# Row 6: Mid faceplate with breathing perforations
helm_a[6, 4] = 31 # outline
helm_a[6, 5] = 0  # breathing hole dot
helm_a[6, 6] = 40 # center ridge highlight
helm_a[6, 7] = 35 # mid steel
helm_a[6, 8] = 33 # shadow
helm_a[6, 9] = 31 # outline

# Row 7: Lower faceplate
helm_a[7, 4] = 31 # outline
helm_a[7, 5] = 37 # light steel
helm_a[7, 6] = 39 # center ridge highlight
helm_a[7, 7] = 35 # mid steel
helm_a[7, 8] = 33 # shadow
helm_a[7, 9] = 31 # outline

# Row 8: Chin / lower snout
helm_a[8, 4] = 31  # outline
helm_a[8, 5] = 36  # left plate
helm_a[8, 6] = 38  # center ridge
helm_a[8, 7] = 34  # right plate
helm_a[8, 8] = 31  # outline

# Row 9: Brass / Gold Collar Trim (from uploaded reference image)
helm_a[9, 4] = 150 # dark bronze/brass
helm_a[9, 5] = 152 # warm gold
helm_a[9, 6] = 154 # bright gold highlight
helm_a[9, 7] = 152 # warm gold
helm_a[9, 8] = 150 # dark bronze/brass

# Row 10: Neck shadow
helm_a[10, 4] = 31 # shadow
helm_a[10, 5] = 31 # shadow
helm_a[10, 6] = 31 # shadow
helm_a[10, 7] = 31 # shadow

print("Created Variation A.")

# VARIATION B: Slightly wider / reinforced Crusader Helm
# Has prominent cross visor (vertical + horizontal black slit) and double brass trim
helm_b = orig_arr.copy()
# Peaked top
helm_b[0, 5] = 31
helm_b[0, 6] = 41
helm_b[0, 7] = 37
helm_b[0, 8] = 31

# Crown
helm_b[1, 4] = 31
helm_b[1, 5] = 38
helm_b[1, 6] = 41
helm_b[1, 7] = 36
helm_b[1, 8] = 33
helm_b[1, 9] = 31

# Forehead
helm_b[2, 3] = 31
helm_b[2, 4] = 37
helm_b[2, 5] = 39
helm_b[2, 6] = 42
helm_b[2, 7] = 36
helm_b[2, 8] = 34
helm_b[2, 9] = 31

# Brow
helm_b[3, 3] = 31
helm_b[3, 4] = 38
helm_b[3, 5] = 40
helm_b[3, 6] = 42
helm_b[3, 7] = 36
helm_b[3, 8] = 33
helm_b[3, 9] = 31

# Visor eye slit
helm_b[4, 3] = 31
helm_b[4, 4] = 0
helm_b[4, 5] = 0
helm_b[4, 6] = 33 # cross center
helm_b[4, 7] = 0
helm_b[4, 8] = 0
helm_b[4, 9] = 31

# Faceplate with vertical slit extension
helm_b[5, 4] = 31
helm_b[5, 5] = 38
helm_b[5, 6] = 0  # vertical slit
helm_b[5, 7] = 35
helm_b[5, 8] = 33
helm_b[5, 9] = 31

helm_b[6, 4] = 31
helm_b[6, 5] = 0  # breathing dot
helm_b[6, 6] = 40 # ridge
helm_b[6, 7] = 0  # breathing dot
helm_b[6, 8] = 33
helm_b[6, 9] = 31

helm_b[7, 4] = 31
helm_b[7, 5] = 37
helm_b[7, 6] = 39
helm_b[7, 7] = 35
helm_b[7, 8] = 33
helm_b[7, 9] = 31

helm_b[8, 4] = 31
helm_b[8, 5] = 36
helm_b[8, 6] = 38
helm_b[8, 7] = 34
helm_b[8, 8] = 31

# Brass rim
helm_b[9, 4] = 150
helm_b[9, 5] = 153
helm_b[9, 6] = 155
helm_b[9, 7] = 153
helm_b[9, 8] = 150

helm_b[10, 4] = 31
helm_b[10, 5] = 31
helm_b[10, 6] = 31
helm_b[10, 7] = 31

print("Created Variation B.")

# Render sprites
img_orig = render_sprite(orig_arr, base_pal)
img_helm_a = render_sprite(helm_a, base_pal)
img_helm_b = render_sprite(helm_b, base_pal)

# Save native 1x
img_orig.save('public/assets/spritesheets/archer_walk_down_original.png')
img_helm_a.save('public/assets/spritesheets/archer_walk_down_helmet.png')
img_helm_b.save('public/assets/spritesheets/archer_walk_down_helmet_variant.png')

print("Saved native 1x sprites.")

