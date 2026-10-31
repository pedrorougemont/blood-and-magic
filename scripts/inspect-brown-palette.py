import json

with open('public/assets/palettes.json') as f:
    pals = json.load(f)
pal = pals['9100']

print("Indices 115 to 130:")
for i in range(115, 131):
    print(f"  {i:3d}: RGB {pal[i]}")

print("\nIndices 158 to 175:")
for i in range(158, 176):
    print(f"  {i:3d}: RGB {pal[i]}")

print("\nIndices 16 to 24 (Outlines & dark leather):")
for i in range(16, 25):
    print(f"  {i:3d}: RGB {pal[i]}")
