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

print("All Blue team indices (192..199) in Ranger cel 0:")
for y in range(h):
    for x in range(w):
        val = arr[y, x]
        if 192 <= val <= 199:
            print(f"  y={y:2d}, x={x:2d}: index={val}")

