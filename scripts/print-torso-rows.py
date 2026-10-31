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

print("Rows 5 to 17 in Ranger cel 0:")
for y in range(5, 18):
    row_str = ' '.join(f"{arr[y, x]:3d}" if arr[y, x] != 254 else "  ." for x in range(w))
    print(f"y={y:2d}: {row_str}")
