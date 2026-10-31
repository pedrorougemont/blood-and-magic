import fs from 'node:fs';
import path from 'node:path';

const BAM_DIR = 'C:\\pedro\\DOS\\GAMES\\BAM';
const OUT_DIR = path.resolve('public/assets');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'sounds'), { recursive: true });

const RES_ANIM = 1;
const RES_DAC = 4;
const RES_PAL = 5;
const RES_FONT = 7;
const RES_SQUIB = 8;
const RES_TILELIB = 18;
const RES_MAP_INFO = 19;

function loadArchiveIndex(mapPath, stfPath) {
  const mapBuf = fs.readFileSync(mapPath);
  const stfFd = fs.openSync(stfPath, 'r');
  const entries = new Map();
  const byType = new Map();

  const recordSize = 111;
  const count = Math.floor(mapBuf.length / recordSize);
  for (let i = 0; i < count; i++) {
    const off = i * recordSize;
    const rt = mapBuf.readUInt8(off);
    const rn = mapBuf.readUInt32LE(off + 1);
    const numOffs = mapBuf.readUInt16LE(off + 5);
    const stfOff = mapBuf.readUInt32LE(off + 7);
    if (rt === 0 || stfOff === 0xffffffff) continue;
    const rec = { rt, rn, numOffs, stfOff, stfFd };
    entries.set(`${rt}:${rn}`, rec);
    if (!byType.has(rt)) byType.set(rt, []);
    byType.get(rt).push(rec);
  }
  return { entries, byType, stfFd };
}

const mainArc = loadArchiveIndex(
  path.join(BAM_DIR, 'MAIN.MAP'),
  path.join(BAM_DIR, 'MAIN.STF')
);
const cinesArc = loadArchiveIndex(
  path.join(BAM_DIR, 'CINES.MAP'),
  path.join(BAM_DIR, 'CINES.STF')
);

function getResourceRecord(rt, rn) {
  return mainArc.entries.get(`${rt}:${rn}`) || cinesArc.entries.get(`${rt}:${rn}`) || null;
}

function readResource(rt, rn) {
  const rec = getResourceRecord(rt, rn);
  if (!rec) return null;
  const hdrBuf = Buffer.alloc(28);
  fs.readSync(rec.stfFd, hdrBuf, 0, 28, rec.stfOff);
  const resNum = hdrBuf.readUInt32LE(0);
  const compType = hdrBuf.readUInt16LE(4);
  const uSize = hdrBuf.readUInt32LE(6);
  const size = hdrBuf.readUInt32LE(10);
  const type = hdrBuf.readUInt16LE(14);
  const numHeaders = hdrBuf.readUInt16LE(16);
  const sizeOfHeaders = hdrBuf.readUInt16LE(18);
  const data0 = hdrBuf.readUInt16LE(20);
  const data1 = hdrBuf.readUInt16LE(22);
  const data2 = hdrBuf.readUInt16LE(24);
  const genID = hdrBuf.readUInt16LE(26);

  const totalPayload = sizeOfHeaders + uSize;
  const payload = Buffer.alloc(totalPayload);
  fs.readSync(rec.stfFd, payload, 0, totalPayload, rec.stfOff + 28);

  return {
    resNum,
    compType,
    uSize,
    size,
    type,
    numHeaders,
    sizeOfHeaders,
    data: [data0, data1, data2],
    genID,
    headersBuf: payload.subarray(0, sizeOfHeaders),
    dataBuf: payload.subarray(sizeOfHeaders, sizeOfHeaders + uSize),
    fullBuf: payload,
  };
}

// 1. Extract Palettes
console.log('1. Extracting palettes...');
const palettes = {};
for (const palId of [9100, 9101, 9000]) {
  const res = readResource(RES_PAL, palId);
  if (!res) continue;
  const colors = [];
  for (let i = 0; i < 256; i++) {
    colors.push([
      res.dataBuf[i * 3],
      res.dataBuf[i * 3 + 1],
      res.dataBuf[i * 3 + 2],
    ]);
  }
  palettes[palId] = colors;
}
fs.writeFileSync(path.join(OUT_DIR, 'palettes.json'), JSON.stringify(palettes));

// 2. Extract Squibs
console.log('2. Extracting squibs...');
function parseSquib(rn) {
  const res = readResource(RES_SQUIB, rn);
  if (!res) return null;
  const buf = res.fullBuf;
  const cSquibs = buf.readUInt32LE(0);
  const heads = [];
  for (let i = 0; i < cSquibs; i++) {
    const off = 4 + i * 8;
    const strOff = buf.readUInt32LE(off);
    const id = buf.readUInt32LE(off + 4);
    heads.push({ id, strOff });
  }
  const textBase = 4 + cSquibs * 8;
  const map = {};
  for (const h of heads) {
    let end = textBase + h.strOff;
    while (end < buf.length && buf[end] !== 0) end++;
    map[h.id] = buf.subarray(textBase + h.strOff, end).toString('latin1');
  }
  return map;
}

const squibs = {};
for (const rec of mainArc.byType.get(RES_SQUIB) || []) {
  if (rec.rn % 10 === 0) {
    squibs[rec.rn] = parseSquib(rec.rn);
  }
}
fs.writeFileSync(path.join(OUT_DIR, 'squibs.json'), JSON.stringify(squibs, null, 2));

// 3. Extract Fonts (9050, 9052, 9060, 9064)
console.log('3. Extracting bitmap fonts...');
const fonts = {};
for (const fontId of [9050, 9052, 9060, 9064]) {
  const res = readResource(RES_FONT, fontId);
  if (!res) continue;
  const buf = res.fullBuf;
  // FontHeader (16 bytes): widest, height, ascent, descent, leading, firstChar, lastChar, bufWidth
  const widest = buf.readUInt16LE(0);
  const height = buf.readUInt16LE(2);
  const ascent = buf.readUInt16LE(4);
  const descent = buf.readUInt16LE(6);
  const leading = buf.readUInt16LE(8);
  const firstChar = buf.readUInt16LE(10);
  const lastChar = buf.readUInt16LE(12);
  const bufWidth = buf.readUInt16LE(14);
  const numChars = lastChar - firstChar + 1;
  const fchSize = 6; // uint16 charWide, uint32 offset
  const pixelBase = 16 + numChars * fchSize;

  const chars = {};
  for (let c = 0; c < numChars; c++) {
    const chOff = 16 + c * fchSize;
    const charWide = buf.readUInt16LE(chOff);
    const dataOff = buf.readUInt32LE(chOff + 2);
    if (charWide > 0 && charWide <= 64 && pixelBase + dataOff + charWide * height <= buf.length) {
      const px = Array.from(buf.subarray(pixelBase + dataOff, pixelBase + dataOff + charWide * height));
      chars[firstChar + c] = { width: charWide, pixels: px };
    }
  }
  fonts[fontId] = { fontId, widest, height, ascent, descent, leading, firstChar, lastChar, chars };
}
fs.writeFileSync(path.join(OUT_DIR, 'fonts.json'), JSON.stringify(fonts));

// 4. Extract Tile Library 9100.TLB
console.log('4. Extracting tileset 9100.TLB...');
{
  const res = readResource(RES_TILELIB, 9100);
  const buf = res.fullBuf;
  const genID = buf.readUInt32LE(0);
  const totalTiles = buf.readUInt32LE(4);
  const totalTerrains = buf.readUInt32LE(8);

  const terrains = [];
  const terrainBase = 76;
  for (let i = 0; i < totalTerrains; i++) {
    const off = terrainBase + i * 52;
    let nameEnd = off;
    while (nameEnd < off + 20 && buf[nameEnd] !== 0) nameEnd++;
    const szName = buf.subarray(off, nameEnd).toString('ascii');
    const moveRate = buf.readInt32LE(off + 20);
    const attackMod = buf.readInt32LE(off + 24);
    const attackRangeMod = buf.readInt32LE(off + 28);
    const defenseMod = buf.readInt32LE(off + 32);
    const damageVal = buf.readInt32LE(off + 36);
    const color = buf.readUInt32LE(off + 40);
    const burnable = buf.readUInt32LE(off + 44);
    const portraitNum = buf.readUInt32LE(off + 48);
    terrains.push({
      index: i,
      name: (squibs[1040] && squibs[1040][i + 1]) || szName,
      rawName: szName,
      moveRate,
      attackMod,
      attackRangeMod,
      defenseMod,
      damageVal,
      color,
      burnable: burnable !== 0,
      portraitNum,
    });
  }

  const tileBase = 6732;
  const tiles = [];
  const tilePixels = Buffer.alloc(totalTiles * 760);
  for (let i = 0; i < totalTiles; i++) {
    const off = tileBase + i * 773;
    const terrain = buf.readUInt8(off);
    const swapTile = buf.readInt32LE(off + 1);
    const aniRes = buf.readUInt32LE(off + 5);
    const aniDelay = buf.readUInt32LE(off + 9);
    tiles.push({ index: i, terrain, swapTile, aniRes, aniDelay });
    buf.copy(tilePixels, i * 760, off + 13, off + 773);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'tileset-9100.json'),
    JSON.stringify({ genID, totalTiles, totalTerrains, terrains, tiles })
  );
  fs.writeFileSync(path.join(OUT_DIR, 'tileset-9100.bin'), tilePixels);
}

// 5. Extract Map Info 9110.MIF and 9155.MIF
console.log('5. Extracting maps 9110.MIF and 9155.MIF...');
function parseMapConfig(lines, squibs1120) {
  const unitLib = [];
  const units = [];
  const randUnits = [];
  const winConditions = [];
  const sounds = [];
  const anims = [];
  let ai = null;
  const aiUnitPrefs = [];
  const palCycles = [];
  const swapSeries = [];
  const items = [];

  let section = null;
  let skipUnitLibHeader = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith(';')) continue;
    const parts = line.split(/\s+/);
    const tag = parts[0].toUpperCase();

    if (tag === '#UNITLIB') {
      section = 'UNITLIB';
      skipUnitLibHeader = true;
      continue;
    } else if (tag === '#UNITS') {
      section = 'UNITS';
      continue;
    } else if (tag === '#RANDUNITS') {
      section = 'RANDUNITS';
      continue;
    } else if (tag.startsWith('#') && tag.length > 1) {
      section = null;
    }

    if (section === 'UNITLIB') {
      if (skipUnitLibHeader && !rawLine.startsWith('# ')) {
        skipUnitLibHeader = false;
        continue;
      }
      skipUnitLibHeader = false;
      if (parts[0] === '#') {
        if (parts[1].toLowerCase() === 'unused') continue;
        const typeId = unitLib.length + 1;
        const internalName = parts[1].replace(/_/g, ' ');
        const displayName = (squibs1120 && squibs1120[typeId]) || internalName;
        unitLib.push({
          typeId,
          internalName,
          rawName: parts[1],
          name: displayName,
          baseMoveRate: parseInt(parts[2], 10),
          movement: parts[3].toUpperCase(), // W, S, F, L
          maxHP: parseInt(parts[4], 10),
          baseAttack: parseInt(parts[5], 10),
          baseDefense: parseInt(parts[6], 10),
          baseAttackRange: parseInt(parts[7], 10),
          baseAnim: parseInt(parts[8], 10),
          portAnim: parseInt(parts[9], 10),
          skillRange: parseInt(parts[10], 10),
          skillCost: parseInt(parts[11], 10),
          transformCost: parseInt(parts[12] || '0', 10),
          transformTime: parseInt(parts[13] || '0', 10),
          expRequired: parseInt(parts[14] || '0', 10),
          expGained: parseInt(parts[15] || '0', 10),
          researchTime: parseInt(parts[16] || '0', 10),
        });
      }
      continue;
    }

    if (section === 'UNITS' && parts[0] === '#') {
      units.push({
        unitName: parts[1].replace(/_/g, ' '),
        rawName: parts[1],
        side: parseInt(parts[2], 10),
        loc: parts[3],
        count: parseInt(parts[4] || '1', 10),
        extra: parts[5] || null,
      });
      continue;
    }

    if (section === 'RANDUNITS' && parts[0] === '#') {
      randUnits.push({
        unitName: parts[1].replace(/_/g, ' '),
        rawName: parts[1],
        side: parseInt(parts[2], 10),
        loc: parts[3],
        count: parseInt(parts[4] || '1', 10),
        extra: parts[5] || null,
      });
      continue;
    }

    if (tag === '#WIN') {
      winConditions.push({
        ownerSide: parts[1],
        category: parts[2],
        spec: parts[3],
        targetSide: parts[4],
        targetCount: parseInt(parts[5], 10),
        satisfiedAni: parts[6] ? parseInt(parts[6], 10) : 0,
        aniX: parts[7] ? parseInt(parts[7], 10) : 0,
        aniY: parts[8] ? parseInt(parts[8], 10) : 0,
      });
    } else if (tag === '#SOUND') {
      sounds.push({
        resNum: parseInt(parts[1], 10),
        x: parseInt(parts[2], 10),
        y: parseInt(parts[3], 10),
      });
    } else if (tag === '#ANIM') {
      anims.push({
        resNum: parseInt(parts[1], 10),
        x: parseInt(parts[2], 10),
        y: parseInt(parts[3], 10),
        speed: parseInt(parts[4], 10),
        pri: parseInt(parts[5], 10),
        side: parts[6] || 'SIDE0',
      });
    } else if (tag === '#AI') {
      ai = {
        aggression: parseInt(parts[1], 10),
        wits: parseInt(parts[2], 10),
        caution: parseInt(parts[3], 10),
        terrainIQ: parseInt(parts[4], 10),
        itemIQ: parseInt(parts[5], 10),
        spellIQ: parseInt(parts[6], 10),
      };
    } else if (tag === '#AIUNITPREFS') {
      for (let i = 1; i + 1 < parts.length; i += 2) {
        aiUnitPrefs.push({
          unitName: parts[i].replace(/_/g, ' '),
          weight: parseInt(parts[i + 1], 10),
        });
      }
    } else if (tag === '#PALCYCLE') {
      palCycles.push({
        dir: parts[1],
        start: parseInt(parts[2], 10),
        end: parseInt(parts[3], 10),
        rate: parseInt(parts[4], 10),
      });
    } else if (tag === '#SWAPSERIES') {
      swapSeries.push(parts.slice(1).map((n) => parseInt(n, 10)));
    } else if (tag === '#ITEMS') {
      items.push({
        name: parts[1],
        x: parseInt(parts[2], 10),
        y: parseInt(parts[3], 10),
      });
    }
  }

  return {
    unitLib,
    units,
    randUnits,
    winConditions,
    sounds,
    anims,
    ai,
    aiUnitPrefs,
    palCycles,
    swapSeries,
    items,
  };
}

const mapsData = {};
for (const mapId of [9110, 9155]) {
  const res = readResource(RES_MAP_INFO, mapId);
  const buf = res.fullBuf;
  const genID = buf.readUInt32LE(0);
  const totalConfigLines = buf.readUInt32LE(10404);
  const configLines = [];
  for (let i = 0; i < totalConfigLines; i++) {
    const off = 4 + i * 80;
    let end = off;
    while (end < off + 80 && buf[end] !== 0) end++;
    configLines.push(buf.subarray(off, end).toString('ascii'));
  }

  const mapTiles = [];
  for (let i = 0; i < 1280; i++) {
    mapTiles.push(buf.readInt16LE(10536 + i * 2));
  }

  const mapSpaces = [];
  for (let i = 0; i < 1280; i++) {
    mapSpaces.push(buf.readInt16LE(13096 + i * 2));
  }

  const totalSpaces = buf.readUInt32LE(15656);
  const spaces = [];
  const spaceBase = 15660;
  for (let i = 0; i < totalSpaces; i++) {
    const off = spaceBase + i * 271;
    const func = buf.readUInt8(off);
    const xPos = buf.readInt32LE(off + 1);
    const yPos = buf.readInt32LE(off + 5);
    const destX = buf.readInt32LE(off + 9);
    const destY = buf.readInt32LE(off + 13);
    const owner = buf.readInt32LE(off + 17);
    const maxHP = buf.readInt32LE(off + 21);
    const presetItem = buf.readInt32LE(off + 25);
    const fHotSpot = buf.readUInt8(off + 29) !== 0;
    const fPickRandomItem = buf.readUInt8(off + 30) !== 0;
    const fSpecialItemDrop = buf.readUInt8(off + 31) !== 0;
    spaces.push({
      index: i,
      func,
      xPos,
      yPos,
      destX,
      destY,
      owner,
      maxHP,
      presetItem,
      fHotSpot,
      fPickRandomItem,
      fSpecialItemDrop,
    });
  }

  const parsedConfig = parseMapConfig(configLines, squibs[1120]);
  mapsData[mapId] = {
    mapId,
    genID,
    configLines,
    parsedConfig,
    mapTiles,
    mapSpaces,
    spaces,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, `map-${mapId}.json`),
    JSON.stringify(mapsData[mapId])
  );
}

console.log('Parsed', mapsData[9110].parsedConfig.unitLib.length, 'unit types in 9110.MIF');
console.log('Starter units in 9110:', mapsData[9110].parsedConfig.units);
console.log('Starter units in 9155:', mapsData[9155].parsedConfig.units);

// 6. Extract Animations (RES_ANIM)
// Collect all RES_ANIM needed for HUD, Cursors, Fog, Effects, Portraits, Structures, and Units!
console.log('6. Extracting animations (RES_ANIM)...');
const neededAnims = new Set();

// UI / HUD / Cursors / Fog / Effects / Portraits
const allMainAnims = mainArc.byType.get(RES_ANIM) || [];
for (const rec of allMainAnims) {
  const rn = rec.rn;
  // Include all world HUD, effects, units, portraits, cursors
  // Skip cinematics / encyclopedia / intermission screens (35..95, 2900..8999)
  if (
    rn <= 34 ||
    (rn >= 96 && rn <= 2800) ||
    (rn >= 9000 && rn <= 9010)
  ) {
    neededAnims.add(rn);
  }
}

const sortedAnimIds = Array.from(neededAnims).sort((a, b) => a - b);
const animManifest = {};
const animChunks = [];
let currentBinOffset = 0;

for (const rn of sortedAnimIds) {
  const res = readResource(RES_ANIM, rn);
  if (!res) continue;
  const cels = [];
  for (let i = 0; i < res.numHeaders; i++) {
    const hOff = i * 18;
    const orgX = res.headersBuf.readInt32LE(hOff);
    const orgY = res.headersBuf.readInt32LE(hOff + 4);
    const width = res.headersBuf.readUInt16LE(hOff + 8);
    const height = res.headersBuf.readUInt16LE(hOff + 10);
    const priority = res.headersBuf.readUInt16LE(hOff + 12);
    const offset = res.headersBuf.readUInt32LE(hOff + 14);
    const byteLen = width * height;
    const celSlice = res.dataBuf.subarray(offset, offset + byteLen);
    cels.push({
      orgX,
      orgY,
      w: width,
      h: height,
      pri: priority,
      binOff: currentBinOffset,
    });
    animChunks.push(celSlice);
    currentBinOffset += celSlice.length;
  }
  animManifest[rn] = cels;
}

const animBin = Buffer.concat(animChunks);
fs.writeFileSync(path.join(OUT_DIR, 'anims.json'), JSON.stringify(animManifest));
fs.writeFileSync(path.join(OUT_DIR, 'anims.bin'), animBin);
console.log(
  `Extracted ${sortedAnimIds.length} RES_ANIM resources (${(animBin.length / 1024 / 1024).toFixed(2)} MB in anims.bin)`
);

// 7. Extract Gameplay Sound Effects (RES_DAC)
console.log('7. Extracting sound effects (RES_DAC)...');
const allDacs = mainArc.byType.get(RES_DAC) || [];
const soundManifest = [];
let totalSoundBytes = 0;

for (const rec of allDacs) {
  const res = readResource(RES_DAC, rec.rn);
  if (!res) continue;
  // Gameplay SFX in MAIN.STF are all < 200KB WAV files
  if (res.dataBuf.length <= 220000) {
    const wavPath = path.join(OUT_DIR, 'sounds', `${rec.rn}.wav`);
    fs.writeFileSync(wavPath, res.dataBuf);
    soundManifest.push({ id: rec.rn, size: res.dataBuf.length });
    totalSoundBytes += res.dataBuf.length;
  }
}
fs.writeFileSync(path.join(OUT_DIR, 'sounds.json'), JSON.stringify(soundManifest));
console.log(
  `Extracted ${soundManifest.length} WAV sound effects (${(totalSoundBytes / 1024 / 1024).toFixed(2)} MB total)`
);
