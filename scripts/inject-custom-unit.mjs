#!/usr/bin/env node
/**
 * Blood & Magic — Permanent Custom Unit Injector (CLI)
 * Bakes custom pixelated unit sprites permanently into anims.bin and anims.json
 * so custom units are part of the core game files and deployable to Cloudflare.
 */

import fs from 'node:fs';
import path from 'node:path';

const ASSETS_DIR = path.resolve('public/assets');
const ANIMS_BIN_PATH = path.join(ASSETS_DIR, 'anims.bin');
const ANIMS_JSON_PATH = path.join(ASSETS_DIR, 'anims.json');

function main() {
  const args = process.argv.slice(2);
  const inputBin = args[0] || 'raw_art/test_output.bin';
  const unitName = (args[1] || 'BLOOD KNIGHT').toUpperCase();

  if (!fs.existsSync(inputBin)) {
    console.error(`Error: Input file ${inputBin} not found.`);
    console.error('Usage: node scripts/inject-custom-unit.mjs <path-to-bin> [unit-name]');
    process.exit(1);
  }

  const rawPixels = fs.readFileSync(inputBin);
  const animsBin = fs.readFileSync(ANIMS_BIN_PATH);
  const animsJson = JSON.parse(fs.readFileSync(ANIMS_JSON_PATH, 'utf-8'));

  // Assume square or standard bounding box
  const totalPixels = rawPixels.length;
  // Try to find reasonable dimensions
  let w = 36;
  let h = 36;
  for (let candidateH = 20; candidateH <= 50; candidateH++) {
    if (totalPixels % candidateH === 0) {
      w = totalPixels / candidateH;
      h = candidateH;
      break;
    }
  }

  const binOffset = animsBin.length;
  // Append pixels to anims.bin
  const newAnimsBin = Buffer.concat([animsBin, rawPixels]);
  fs.writeFileSync(ANIMS_BIN_PATH, newAnimsBin);

  // Cel header
  const customCel = {
    orgX: Math.floor(w / 2),
    orgY: h - 2,
    w,
    h,
    pri: 2000,
    binOff: binOffset,
  };

  // Register anim IDs 9500..9535 (Walk, Attack, Guard, Dies)
  const baseAnim = 9500;
  for (let offset = 0; offset <= 35; offset++) {
    animsJson[baseAnim + offset] = [customCel];
  }

  fs.writeFileSync(ANIMS_JSON_PATH, JSON.stringify(animsJson));

  console.log(`Successfully injected "${unitName}" (${w}x${h}px) into anims.bin at offset ${binOffset}`);
  console.log(`Registered anim IDs 9500..9535 in anims.json`);
}

main();
