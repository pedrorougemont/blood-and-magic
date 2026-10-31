import json
import numpy as np
from PIL import Image

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

# Skin remapping dictionary (Option 1: Warm rich brown)
skin_map_warm = {
    180: 172, # [135, 79, 47] warm caramel highlight
    179: 171, # [119, 63, 39] warm brown
    178: 170, # [103, 51, 31] rich mahogany
    177: 169, # [83, 47, 19] deep umber
    176: 121, # [79, 39, 31] dark shadow
    175: 120, # [63, 31, 23] deep shadow
    174: 120, # [63, 31, 23]
    173: 119, # [51, 27, 19] espresso
}

# Apply to unhelmeted archer
archer_brown = orig_arr.copy()
# 1. Remap all hands / arms / face skin pixels
for y in range(h):
    for x in range(w):
        val = archer_brown[y, x]
        if val in skin_map_warm:
            archer_brown[y, x] = skin_map_warm[val]

# 2. On the head (rows 0..9), update hair from blonde (154..156) to dark textured brown/black hair
# Indices: 17 (dark charcoal/umber), 18 (dark brown), 119 (espresso), 120 (dark brown), 121 (umber)
hair_map = {
    154: 119, # dark espresso
    155: 120, # dark brown
    156: 121, # mid-dark brown curl highlight
}
for y in range(10):
    for x in range(w):
        val = archer_brown[y, x]
        if val in hair_map:
            archer_brown[y, x] = hair_map[val]

# 3. Change blue eyes (88) on row 6 to warm dark brown eyes (170 / 17) with white specular highlight
archer_brown[6, 5] = 170 # brown iris
archer_brown[6, 7] = 170 # brown iris

# Now create Helmeted Archer with Brown Skin
# Start from helmet layout from previous step, but remap hands and exposed skin
helm_brown = orig_arr.copy()

# Add Great Helm
helm_brown[0, 5] = 31; helm_brown[0, 6] = 40; helm_brown[0, 7] = 36; helm_brown[0, 8] = 31
helm_brown[1, 4] = 31; helm_brown[1, 5] = 37; helm_brown[1, 6] = 40; helm_brown[1, 7] = 35; helm_brown[1, 8] = 33; helm_brown[1, 9] = 31
helm_brown[2, 3] = 31; helm_brown[2, 4] = 36; helm_brown[2, 5] = 38; helm_brown[2, 6] = 41; helm_brown[2, 7] = 36; helm_brown[2, 8] = 33; helm_brown[2, 9] = 31
helm_brown[3, 3] = 31; helm_brown[3, 4] = 37; helm_brown[3, 5] = 39; helm_brown[3, 6] = 41; helm_brown[3, 7] = 35; helm_brown[3, 8] = 33; helm_brown[3, 9] = 31
helm_brown[4, 3] = 31; helm_brown[4, 4] = 32; helm_brown[4, 5] = 0;  helm_brown[4, 6] = 32; helm_brown[4, 7] = 0;  helm_brown[4, 8] = 32; helm_brown[4, 9] = 31
helm_brown[5, 4] = 31; helm_brown[5, 5] = 38; helm_brown[5, 6] = 40; helm_brown[5, 7] = 35; helm_brown[5, 8] = 0;  helm_brown[5, 9] = 31
helm_brown[6, 4] = 31; helm_brown[6, 5] = 0;  helm_brown[6, 6] = 40; helm_brown[6, 7] = 35; helm_brown[6, 8] = 33; helm_brown[6, 9] = 31
helm_brown[7, 4] = 31; helm_brown[7, 5] = 37; helm_brown[7, 6] = 39; helm_brown[7, 7] = 35; helm_brown[7, 8] = 33; helm_brown[7, 9] = 31
helm_brown[8, 4] = 31; helm_brown[8, 5] = 36; helm_brown[8, 6] = 38; helm_brown[8, 7] = 34; helm_brown[8, 8] = 31
helm_brown[9, 4] = 150; helm_brown[9, 5] = 152; helm_brown[9, 6] = 154; helm_brown[9, 7] = 152; helm_brown[9, 8] = 150
helm_brown[10, 4] = 31; helm_brown[10, 5] = 31; helm_brown[10, 6] = 31; helm_brown[10, 7] = 31

# Inside visor slit (row 4, x=5 and x=7): behind the shadow slit, warm dark brown eyes/skin
# Row 4 x=5,7 is pitch black 0, which looks great for deep visor shadow!

# Remap hands and arms on rows 10..20 to brown skin
for y in range(10, h):
    for x in range(w):
        val = helm_brown[y, x]
        if val in skin_map_warm:
            helm_brown[y, x] = skin_map_warm[val]

print("Remapped both unhelmeted and helmeted sprites.")

