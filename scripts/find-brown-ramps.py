import json
import numpy as np

with open('public/assets/palettes.json') as f:
    pals = json.load(f)
pal = pals['9100']

# Inspect all brown / earth / terracotta ramps in 9100.PAL
print("--- Rich Brown / Umber / Dark Skin Ramps in 9100.PAL ---")
for i, (r, g, b) in enumerate(pal):
    # Brown tone: r > g > b, warm, luminance from dark to warm caramel
    # Typically r in 40..170, g ~ 0.55..0.75 * r, b ~ 0.35..0.55 * r
    if r > 30 and g > 15 and b >= 5 and r > g and g > b:
        # Check if it's brown/earth rather than saturated red or yellow
        rg_ratio = g / r
        gb_ratio = b / g
        if 0.45 <= rg_ratio <= 0.82 and 0.35 <= gb_ratio <= 0.85:
            lum = int(0.299 * r + 0.587 * g + 0.114 * b)
            print(f"  Index {i:3d}: RGB ({r:3d}, {g:3d}, {b:3d}) | Lum={lum:3d}")
