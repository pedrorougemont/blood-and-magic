import os
import json
import numpy as np
from PIL import Image

OUT_DIR = 'public/assets/spritesheets'
ARTIFACT_DIR = r'C:/Users/Aline Santos/.gemini/antigravity/brain/545d3f9b-a8eb-4724-b8b8-9505375d2d74'

# Load generated PNGs
orig = Image.open(os.path.join(OUT_DIR, 'archer_walk_down_original.png'))
helm = Image.open(os.path.join(OUT_DIR, 'archer_walk_down_helmet.png'))

w, h = orig.size

# 1. Full Body 8x animated toggle
orig_8x = orig.resize((w * 8, h * 8), Image.NEAREST)
helm_8x = helm.resize((w * 8, h * 8), Image.NEAREST)

gif_body_path = os.path.join(OUT_DIR, 'archer_helmet_toggle.gif')
orig_8x.save(
    gif_body_path,
    save_all=True,
    append_images=[helm_8x],
    duration=800,
    loop=0
)
orig_8x.save(os.path.join(ARTIFACT_DIR, 'archer_helmet_toggle.gif'), save_all=True, append_images=[helm_8x], duration=800, loop=0)

# 2. Head 18x animated toggle
head_orig = orig.crop((2, 0, 12, 12)).resize((10 * 18, 12 * 18), Image.NEAREST)
head_helm = helm.crop((2, 0, 12, 12)).resize((10 * 18, 12 * 18), Image.NEAREST)

gif_head_path = os.path.join(OUT_DIR, 'archer_head_helmet_toggle.gif')
head_orig.save(
    gif_head_path,
    save_all=True,
    append_images=[head_helm],
    duration=800,
    loop=0
)
head_orig.save(os.path.join(ARTIFACT_DIR, 'archer_head_helmet_toggle.gif'), save_all=True, append_images=[head_helm], duration=800, loop=0)

print("Saved animated comparison GIFs (full body and head close-up).")
