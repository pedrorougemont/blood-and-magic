import json
import numpy as np

with open('public/assets/anims.json') as f:
    anims = json.load(f)

cel0 = anims['1350'][0]
with open('public/assets/anims.bin', 'rb') as f:
    f.seek(cel0['binOff'])
    raw = f.read(cel0['w'] * cel0['h'])

w, h = cel0['w'], cel0['h']
arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w)).copy()

# Apply all our final modifications:
# 1. Great Helm
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

# 2. Gray Armor (replace green)
g_to_g = {57: 32, 58: 33, 59: 34, 60: 35, 61: 36, 62: 37, 63: 39, 64: 41}
for y in range(h):
    for x in range(w):
        if arr[y, x] in g_to_g:
            arr[y, x] = g_to_g[arr[y, x]]

# 3. Brown skin (hands/arms)
s_map = {180: 172, 179: 171, 178: 170, 177: 169, 176: 121, 175: 120, 174: 120, 173: 119}
for y in range(10, h):
    for x in range(w):
        if arr[y, x] in s_map:
            arr[y, x] = s_map[arr[y, x]]

# 4. Belt (Leather belt with brass buckle)
arr[14, 3] = 17;  arr[14, 9] = 17
arr[15, 4] = 18;  arr[15, 6] = 152; arr[15, 8] = 18
arr[16, 3] = 17;  arr[16, 5] = 18;  arr[16, 7] = 18
arr[17, 4] = 18;  arr[17, 6] = 152

# Note: Bracers (193..198) and arm silhouette remain authentic and intact.

# 5. Blue Jeans
arr[17, 3] = 83; arr[17, 8] = 84; arr[17, 9] = 85
arr[18, 3] = 83; arr[18, 4] = 84; arr[18, 5] = 85; arr[18, 6] = 83; arr[18, 7] = 85; arr[18, 8] = 152; arr[18, 9] = 87
arr[19, 3] = 83; arr[19, 4] = 84; arr[19, 5] = 85; arr[19, 6] = 83; arr[19, 7] = 86; arr[19, 8] = 87; arr[19, 9] = 88
arr[20, 3] = 84; arr[20, 4] = 85; arr[20, 5] = 84; arr[20, 6] = 83; arr[20, 7] = 86; arr[20, 8] = 89; arr[20, 9] = 88
arr[21, 3] = 84; arr[21, 4] = 86; arr[21, 5] = 85; arr[21, 7] = 87; arr[21, 8] = 90; arr[21, 9] = 89
arr[22, 3] = 85; arr[22, 4] = 87; arr[22, 5] = 85; arr[22, 7] = 88; arr[22, 8] = 91; arr[22, 9] = 90
arr[23, 3] = 86; arr[23, 4] = 88; arr[23, 5] = 86; arr[23, 6] = 83; arr[23, 7] = 88; arr[23, 8] = 92; arr[23, 9] = 91
arr[24, 3] = 86; arr[24, 4] = 88; arr[24, 5] = 86; arr[24, 6] = 83; arr[24, 7] = 87; arr[24, 8] = 90; arr[24, 9] = 89
arr[25, 4] = 87; arr[25, 8] = 88; arr[25, 9] = 87

# Save binary raw pixels (14x32 = 448 bytes)
raw_bytes = arr.tobytes()
with open('raw_art/crusader_archer.bin', 'wb') as f:
    f.write(raw_bytes)

meta = {
    'name': 'CRUSADER ARCHER',
    'w': w,
    'h': h,
    'orgX': cel0['orgX'],
    'orgY': cel0['orgY'],
    'bytes': len(raw_bytes)
}
with open('raw_art/crusader_archer.json', 'w') as f:
    json.dump(meta, f, indent=2)

print(f"Saved raw_art/crusader_archer.bin ({len(raw_bytes)} bytes)")

