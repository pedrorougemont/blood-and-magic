#!/usr/bin/env python3
"""
Bakes the Crusader Ranger unit permanently into Blood & Magic:
1. Transforms and appends all 84 Crusader Ranger animation cels into anims.bin
2. Registers animation IDs 9350..9394 in anims.json
3. Registers portrait ID 9389 in anims.json
4. Adds UNIT_TYPE.CRUSADER_RANGER (typeId: 35) to map-9110.json and map-9155.json unitLib
5. Updates Side 1 starter units so one of the 2 initial units is the Crusader Ranger
"""

import json
import os
import numpy as np

ASSETS_DIR = 'public/assets'
ANIMS_BIN_PATH = os.path.join(ASSETS_DIR, 'anims.bin')
ANIMS_JSON_PATH = os.path.join(ASSETS_DIR, 'anims.json')
MAP_9110_PATH = os.path.join(ASSETS_DIR, 'map-9110.json')
MAP_9155_PATH = os.path.join(ASSETS_DIR, 'map-9155.json')

# Universal palette remapping
pixel_map = {
    # 1. Armor: Green tunic -> Polished Steel Gray Armor
    57: 32, 58: 33, 59: 34, 60: 35, 61: 36, 62: 37, 63: 39, 64: 41, 65: 41, 66: 32,
    # 2. Pants: Olive green pants -> Classic Blue Denim Jeans
    44: 83, 45: 84, 46: 85, 47: 86, 48: 87, 49: 88, 50: 89, 51: 90, 52: 91, 53: 92, 54: 92,
    # 3. Skin: Pale caucasian skin -> Rich Black Man Brown Skin Tone
    181: 172, 180: 172, 179: 171, 178: 170, 177: 169, 176: 121, 175: 120, 174: 120, 173: 119
}

# 5 Directional Crusader Great Helms
helm_S = [
    (0, -1, 31), (0, 0, 40), (0, 1, 36), (0, 2, 31),
    (1, -2, 31), (1, -1, 37), (1, 0, 40), (1, 1, 35), (1, 2, 33), (1, 3, 31),
    (2, -3, 31), (2, -2, 36), (2, -1, 38), (2, 0, 41), (2, 1, 36), (2, 2, 33), (2, 3, 31),
    (3, -3, 31), (3, -2, 37), (3, -1, 39), (3, 0, 41), (3, 1, 35), (3, 2, 33), (3, 3, 31),
    (4, -3, 31), (4, -2, 32), (4, -1, 0),  (4, 0, 32), (4, 1, 0),  (4, 2, 32), (4, 3, 31),
    (5, -2, 31), (5, -1, 38), (5, 0, 40), (5, 1, 35), (5, 2, 0),  (5, 3, 31),
    (6, -2, 31), (6, -1, 0),  (6, 0, 40), (6, 1, 35), (6, 2, 33), (6, 3, 31),
    (7, -2, 31), (7, -1, 37), (7, 0, 39), (7, 1, 35), (7, 2, 33), (7, 3, 31),
    (8, -2, 31), (8, -1, 36), (8, 0, 38), (8, 1, 34), (8, 2, 31),
    (9, -2, 150), (9, -1, 152), (9, 0, 154), (9, 1, 152), (9, 2, 150),
    (10, -2, 31), (10, -1, 31), (10, 0, 31), (10, 1, 31)
]

helm_SE = [
    (0, -1, 31), (0, 0, 40), (0, 1, 36), (0, 2, 31),
    (1, -2, 31), (1, -1, 37), (1, 0, 40), (1, 1, 36), (1, 2, 33), (1, 3, 31),
    (2, -2, 31), (2, -1, 38), (2, 0, 41), (2, 1, 37), (2, 2, 34), (2, 3, 31),
    (3, -2, 31), (3, -1, 37), (3, 0, 39), (3, 1, 36), (3, 2, 32), (3, 3, 31),
    (4, -2, 31), (4, -1, 35), (4, 0, 32), (4, 1, 0),  (4, 2, 0),  (4, 3, 31),
    (5, -2, 31), (5, -1, 36), (5, 0, 38), (5, 1, 35), (5, 2, 0),  (5, 3, 31),
    (6, -2, 31), (6, -1, 35), (6, 0, 37), (6, 1, 34), (6, 2, 0),  (6, 3, 31),
    (7, -2, 31), (7, -1, 34), (7, 0, 36), (7, 1, 33), (7, 2, 31),
    (8, -2, 150), (8, -1, 152), (8, 0, 154), (8, 1, 152), (8, 2, 150),
    (9, -2, 31), (9, -1, 31), (9, 0, 31), (9, 1, 31)
]

helm_E = [
    (0, -1, 31), (0, 0, 38), (0, 1, 36), (0, 2, 31),
    (1, -2, 31), (1, -1, 36), (1, 0, 39), (1, 1, 37), (1, 2, 31),
    (2, -2, 31), (2, -1, 35), (2, 0, 38), (2, 1, 40), (2, 2, 31),
    (3, -2, 31), (3, -1, 34), (3, 0, 37), (3, 1, 0),  (3, 2, 31),
    (4, -2, 31), (4, -1, 35), (4, 0, 36), (4, 1, 32), (4, 2, 31),
    (5, -2, 31), (5, -1, 34), (5, 0, 0),  (5, 1, 35), (5, 2, 31),
    (6, -2, 31), (6, -1, 33), (6, 0, 35), (6, 1, 34), (6, 2, 31),
    (7, -2, 150), (7, -1, 152), (7, 0, 154), (7, 1, 150),
    (8, -2, 31), (8, -1, 31), (8, 0, 31), (8, 1, 31)
]

helm_NE = [
    (0, -1, 31), (0, 0, 38), (0, 1, 35), (0, 2, 31),
    (1, -2, 31), (1, -1, 36), (1, 0, 39), (1, 1, 36), (1, 2, 31),
    (2, -2, 31), (2, -1, 35), (2, 0, 38), (2, 1, 35), (2, 2, 31),
    (3, -2, 31), (3, -1, 34), (3, 0, 37), (3, 1, 34), (3, 2, 31),
    (4, -2, 31), (4, -1, 33), (4, 0, 36), (4, 1, 33), (4, 2, 31),
    (5, -2, 31), (5, -1, 33), (5, 0, 35), (5, 1, 32), (5, 2, 31),
    (6, -2, 31), (6, -1, 32), (6, 0, 34), (6, 1, 31),
    (7, -2, 150), (7, -1, 152), (7, 0, 154), (7, 1, 150),
    (8, -2, 31), (8, -1, 31), (8, 0, 31), (8, 1, 31)
]

helm_N = [
    (0, -1, 31), (0, 0, 39), (0, 1, 36), (0, 2, 31),
    (1, -2, 31), (1, -1, 36), (1, 0, 40), (1, 1, 35), (1, 2, 33), (1, 3, 31),
    (2, -2, 31), (2, -1, 35), (2, 0, 39), (2, 1, 35), (2, 2, 33), (2, 3, 31),
    (3, -2, 31), (3, -1, 34), (3, 0, 38), (3, 1, 34), (3, 2, 32), (3, 3, 31),
    (4, -2, 31), (4, -1, 34), (4, 0, 37), (4, 1, 34), (4, 2, 32), (4, 3, 31),
    (5, -2, 31), (5, -1, 33), (5, 0, 36), (5, 1, 33), (5, 2, 31),
    (6, -2, 31), (6, -1, 33), (6, 0, 35), (6, 1, 33), (6, 2, 31),
    (7, -2, 31), (7, -1, 32), (7, 0, 34), (7, 1, 32), (7, 2, 31),
    (8, -2, 150), (8, -1, 152), (8, 0, 154), (8, 1, 152), (8, 2, 150),
    (9, -2, 31), (9, -1, 31), (9, 0, 31), (9, 1, 31)
]

dir_helms = {0: helm_S, 1: helm_SE, 2: helm_E, 3: helm_NE, 4: helm_N}

def get_aid_dir(aid):
    if 1350 <= aid <= 1354: return aid - 1350
    if 1360 <= aid <= 1364: return aid - 1360
    if 1390 <= aid <= 1394: return aid - 1390
    if aid == 1370: return 0
    if aid in (1375, 1376): return 1
    if aid == 1380: return 0
    return 0

def transform_cel_data(raw, w, h, aid, cel_idx):
    arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w)).copy()

    # Projectile arrows - unmodified
    if aid in (1382, 1383, 1384):
        return arr.tobytes()

    # Corpse - palette remapping only
    if aid == 1381:
        for y in range(h):
            for x in range(w):
                if arr[y, x] in pixel_map:
                    arr[y, x] = pixel_map[arr[y, x]]
        return arr.tobytes()

    # Master frame (1350 cel 0)
    if aid == 1350 and cel_idx == 0:
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
        for y in range(h):
            for x in range(w):
                if arr[y, x] in pixel_map:
                    arr[y, x] = pixel_map[arr[y, x]]
        # Leather belt
        arr[14, 3] = 17;   arr[14, 9] = 17
        arr[15, 4] = 18;   arr[15, 6] = 152;  arr[15, 8] = 18
        arr[16, 3] = 17;   arr[16, 5] = 18;   arr[16, 7] = 18
        arr[17, 4] = 18;   arr[17, 6] = 152
        # Jeans
        arr[17, 3] = 83; arr[17, 8] = 84; arr[17, 9] = 85
        arr[18, 3] = 83; arr[18, 4] = 84; arr[18, 5] = 85; arr[18, 6] = 83; arr[18, 7] = 85; arr[18, 8] = 152; arr[18, 9] = 87
        arr[19, 3] = 83; arr[19, 4] = 84; arr[19, 5] = 85; arr[19, 6] = 83; arr[19, 7] = 86; arr[19, 8] = 87; arr[19, 9] = 88
        arr[20, 3] = 84; arr[20, 4] = 85; arr[20, 5] = 84; arr[20, 6] = 83; arr[20, 7] = 86; arr[20, 8] = 89; arr[20, 9] = 88
        arr[21, 3] = 84; arr[21, 4] = 86; arr[21, 5] = 85; arr[21, 7] = 87; arr[21, 8] = 90; arr[21, 9] = 89
        arr[22, 3] = 85; arr[22, 4] = 87; arr[22, 5] = 85; arr[22, 7] = 88; arr[22, 8] = 91; arr[22, 9] = 90
        arr[23, 3] = 86; arr[23, 4] = 88; arr[23, 5] = 86; arr[23, 6] = 83; arr[23, 7] = 88; arr[23, 8] = 92; arr[23, 9] = 91
        arr[24, 3] = 86; arr[24, 4] = 88; arr[24, 5] = 86; arr[24, 6] = 83; arr[24, 7] = 87; arr[24, 8] = 90; arr[24, 9] = 89
        arr[25, 4] = 87; arr[25, 8] = 88; arr[25, 9] = 87
        return arr.tobytes()

    d_idx = get_aid_dir(aid)
    helm = dir_helms.get(d_idx, helm_S)

    # 1. Palette mapping
    for y in range(h):
        for x in range(w):
            v = arr[y, x]
            if v in pixel_map:
                arr[y, x] = pixel_map[v]

    # 2. Great Helm placement
    raw_arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w))
    hair_mask = (raw_arr >= 150) & (raw_arr <= 156)
    pts = np.argwhere(hair_mask)
    if len(pts) > 0:
        min_y = pts[:, 0].min()
        head_pts = pts[pts[:, 0] <= min_y + 10]
        if len(head_pts) > 0:
            top_y = head_pts[:, 0].min()
            center_x = int(round(head_pts[:, 1].mean()))
            for dy, dx, col in helm:
                py = top_y + dy
                px = center_x + dx
                if 0 <= py < h and 0 <= px < w:
                    arr[py, px] = col
            for hy in range(top_y, min(h, top_y + 11)):
                for hx in range(max(0, center_x - 4), min(w, center_x + 5)):
                    if 150 <= arr[hy, hx] <= 156:
                        arr[hy, hx] = 31
                    elif 194 <= arr[hy, hx] <= 199 and hy < top_y + 8:
                        arr[hy, hx] = 32

    return arr.tobytes()

def main():
    print("Reading anims.bin and anims.json...")
    with open(ANIMS_BIN_PATH, 'rb') as f:
        anims_bin = bytearray(f.read())
    with open(ANIMS_JSON_PATH, 'r') as f:
        anims_json = json.load(f)

    # Base animation ID for Crusader Ranger: 9350
    BASE_ANIM = 9350
    ORIG_BASE = 1350

    ranger_aids = [
        1350, 1351, 1352, 1353, 1354, # Walk (5 dirs)
        1360, 1361, 1362, 1363, 1364, # Bow Attack (5 dirs)
        1370,                         # Guard
        1375, 1376,                   # Hit 1, Hit 2
        1380,                         # Death
        1381,                         # Corpse
        1382, 1383, 1384,             # Arrow Projectiles
        1388,                         # Arrow Impact
        1390, 1391, 1392, 1393, 1394  # Dagger Attack (5 dirs)
    ]

    total_injected_cels = 0
    bytes_appended = 0

    for aid in ranger_aids:
        if str(aid) not in anims_json:
            continue
        cels = anims_json[str(aid)]
        target_aid = BASE_ANIM + (aid - ORIG_BASE)
        new_cels = []

        # Arrow projectiles & impact don't need modified pixel buffers
        if aid in (1382, 1383, 1384, 1388):
            anims_json[str(target_aid)] = cels
            continue

        for ci, cel in enumerate(cels):
            w = cel['w']
            h = cel['h']
            raw = anims_bin[cel['binOff'] : cel['binOff'] + w * h]
            new_raw = transform_cel_data(raw, w, h, aid, ci)

            new_bin_off = len(anims_bin)
            anims_bin.extend(new_raw)
            bytes_appended += len(new_raw)

            new_cel = {
                'orgX': cel['orgX'],
                'orgY': cel['orgY'],
                'w': w,
                'h': h,
                'pri': cel.get('pri', 2000),
                'binOff': new_bin_off
            }
            new_cels.append(new_cel)
            total_injected_cels += 1

        anims_json[str(target_aid)] = new_cels

    # Create portrait 9389 from Ranger portrait 2588
    if '2588' in anims_json:
        p_cels = anims_json['2588']
        new_p_cels = []
        for cel in p_cels:
            w = cel['w']
            h = cel['h']
            raw = anims_bin[cel['binOff'] : cel['binOff'] + w * h]
            arr = np.frombuffer(raw, dtype=np.uint8).reshape((h, w)).copy()
            # Remap green armor -> gray, skin -> brown
            for y in range(h):
                for x in range(w):
                    v = arr[y, x]
                    if v in pixel_map:
                        arr[y, x] = pixel_map[v]
            new_raw = arr.tobytes()
            new_bin_off = len(anims_bin)
            anims_bin.extend(new_raw)
            new_p_cels.append({
                'orgX': cel['orgX'],
                'orgY': cel['orgY'],
                'w': w,
                'h': h,
                'pri': cel.get('pri', 0),
                'binOff': new_bin_off
            })
        anims_json['9389'] = new_p_cels
        print("Created Crusader Ranger portrait at anim ID 9389.")

    print(f"Appended {bytes_appended} bytes across {total_injected_cels} cels to anims.bin.")
    print("Writing updated anims.bin...")
    with open(ANIMS_BIN_PATH, 'wb') as f:
        f.write(anims_bin)

    print("Writing updated anims.json...")
    with open(ANIMS_JSON_PATH, 'w') as f:
        json.dump(anims_json, f)

    # -------------------------------------------------------------
    # UPDATE MAP CONFIGURATIONS (map-9110.json & map-9155.json)
    # -------------------------------------------------------------
    crusader_unitlib_entry = {
        "typeId": 35,
        "internalName": "CRUSADER RANGER",
        "rawName": "CRUSADER_RANGER",
        "name": "CRUSADER RANGER",
        "baseMoveRate": 3,
        "movement": "W",
        "maxHP": 25,
        "baseAttack": 4,
        "baseDefense": 2,
        "baseAttackRange": 3,
        "baseAnim": 9350,
        "portAnim": 9389 if '9389' in anims_json else 2588,
        "skillRange": 0,
        "skillCost": 0,
        "transformCost": 25,
        "transformTime": 25,
        "expRequired": 0,
        "expGained": 20,
        "researchTime": 45
    }

    for map_path in [MAP_9110_PATH, MAP_9155_PATH]:
        if not os.path.exists(map_path):
            continue
        with open(map_path, 'r') as f:
            map_data = json.load(f)

        parsed = map_data.setdefault('parsedConfig', {})
        unitlib = parsed.setdefault('unitLib', [])

        # Add or update CRUSADER RANGER in unitLib
        found_idx = next((i for i, u in enumerate(unitlib) if u.get('typeId') == 35), None)
        if found_idx is not None:
            unitlib[found_idx] = crusader_unitlib_entry
        else:
            unitlib.append(crusader_unitlib_entry)

        # Update starter units: Side 1 starts with 1 Basal Golem and 1 Crusader Ranger
        units = parsed.setdefault('units', [])
        # Find side 1 starting entry
        side1_entry = next((u for u in units if u.get('side') == 1 and u.get('rawName') == 'BASAL_GOLEM'), None)
        if side1_entry:
            side1_entry['count'] = 1

        # Check if CRUSADER_RANGER starting entry already exists
        crusader_starter = next((u for u in units if u.get('side') == 1 and u.get('rawName') == 'CRUSADER_RANGER'), None)
        if not crusader_starter:
            units.insert(1, {
                "unitName": "CRUSADER RANGER",
                "rawName": "CRUSADER_RANGER",
                "side": 1,
                "loc": "DEFAULT",
                "count": 1,
                "extra": None
            })

        with open(map_path, 'w') as f:
            json.dump(map_data, f, indent=2)

        print(f"Updated {map_path}: CRUSADER RANGER added to unitLib & set as initial unit for Side 1.")

    print("\nBaking complete! Crusader Ranger is now fully playable in Blood & Magic.")

if __name__ == '__main__':
    main()

