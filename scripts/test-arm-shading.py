import json
import numpy as np
from PIL import Image

with open('public/assets/palettes.json') as f:
    pals = json.load(f)
base_pal = [list(c) for c in pals['9100']]
unit_pal = pals['9101']
for i in range(8):
    base_pal[192 + i] = unit_pal[200 + i]

with open('public/assets/anims.json') as f:
    anims = json.load(f)

cel0 = anims['1350'][0]
with open('public/assets/anims.bin', 'rb') as f:
    f.seek(cel0['binOff'])
    raw = f.read(cel0['w'] * cel0['h'])

w, h = cel0['w'], cel0['h']
orig_arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w)).copy()

# Load our previous last_arr
from generate_minimal_before_after import last_arr as prev_last
print("Loaded previous last_arr")
