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

skin_indices = [173, 174, 175, 176, 177, 178, 179, 180]

print("Locations of skin pixels in Ranger cel 0:")
for y in range(h):
    row_pixels = []
    for x in range(w):
        val = arr[y, x]
        if val in skin_indices:
            row_pixels.append((x, val))
    if row_pixels:
        print(f"y={y:2d}: {row_pixels}")
