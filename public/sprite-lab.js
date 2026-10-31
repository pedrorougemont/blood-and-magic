// Blood & Magic Sprite Lab — Interactive Client-Side Pixelation Engine
// Compares 4 pixelation philosophies in real time against 9100.PAL and Mode X 5:6 aspect ratio.

const MODE_X_RATIO = 400 / 480; // 0.8333

let palettes = null;
let basePal = null; // 9100.PAL [256][3]
let unitPal = null; // 9101.PAL [256][3]
let tilesetMeta = null;
let tilesetPixels = null;

let currentSourceImg = null;
let processedResults = {
  kuwahara: null,
  crisp: null,
  atkinson: null,
  bayer: null,
};
let activeAlgo = 'kuwahara';

// Bayer 4x4 matrix
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Load assets on startup
async function initLab() {
  try {
    const [palData, tlbMeta, tlbBin] = await Promise.all([
      fetch('/assets/palettes.json').then((r) => r.json()),
      fetch('/assets/tileset-9100.json').then((r) => r.json()),
      fetch('/assets/tileset-9100.bin').then((r) => r.arrayBuffer()),
    ]);

    palettes = palData;
    basePal = palettes[9100];
    unitPal = palettes[9101];
    tilesetMeta = tlbMeta;
    tilesetPixels = new Uint8Array(tlbBin);

    setupEventListeners();

    // Load default sample sketch
    loadSampleSketch('/assets/sample_sketch.png');
  } catch (err) {
    console.error('Failed to initialize Sprite Lab:', err);
  }
}

function setupEventListeners() {
  const dropZone = document.getElementById('dropZone');
  const fileUpload = document.getElementById('fileUpload');
  const btnUpload = document.getElementById('btnUpload');
  const btnLoadSample = document.getElementById('btnLoadSample');

  btnUpload.addEventListener('click', () => fileUpload.click());
  dropZone.addEventListener('click', () => fileUpload.click());

  fileUpload.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      loadUserFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadUserFile(e.dataTransfer.files[0]);
    }
  });

  btnLoadSample.addEventListener('click', () => {
    loadSampleSketch('/assets/sample_sketch.png');
  });

  // Slider adjustments
  const sliders = ['rngHeight', 'rngKnockout', 'rngContrast', 'rngTeamHue'];
  sliders.forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      updateLabels();
      debounceProcess();
    });
  });

  document.getElementById('chkModeXAspect').addEventListener('change', debounceProcess);
  document.getElementById('chkTeamBlue').addEventListener('change', () => {
    renderAllCards();
    renderTestBench();
  });
  document.getElementById('chkPixelGrid').addEventListener('change', renderAllCards);

  // Global window functions for card clicks
  window.selectAlgorithm = (algo) => {
    activeAlgo = algo;
    document.querySelectorAll('.algo-card').forEach((c) => c.classList.remove('selected'));
    const idMap = {
      kuwahara: 'cardKuwahara',
      crisp: 'cardCrispInk',
      atkinson: 'cardAtkinson',
      bayer: 'cardBayer',
    };
    const titleMap = {
      kuwahara: '1. Kuwahara Cel-Flat',
      crisp: '2. Crisp Ink Outline',
      atkinson: '3. Atkinson Dither',
      bayer: '4. Bayer 4×4 Matrix',
    };
    document.getElementById(idMap[algo])?.classList.add('selected');
    document.getElementById('lblSelectedAlgo').textContent = titleMap[algo];
    renderTestBench();
  };

  window.downloadIndexedPNG = (algo) => {
    const res = processedResults[algo];
    if (!res) return;
    const cvs = document.createElement('canvas');
    cvs.width = res.w;
    cvs.height = res.h;
    const ctx = cvs.getContext('2d');
    const imgData = ctx.createImageData(res.w, res.h);
    const side2 = document.getElementById('chkTeamBlue').checked;
    const activePal = getActivePalette(side2);

    for (let i = 0; i < res.indexed.length; i++) {
      const idx = res.indexed[i];
      const d = i * 4;
      if (idx === 254) {
        imgData.data[d + 3] = 0;
      } else {
        const c = activePal[idx];
        imgData.data[d] = c[0];
        imgData.data[d + 1] = c[1];
        imgData.data[d + 2] = c[2];
        imgData.data[d + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const link = document.createElement('a');
    link.download = `bam_custom_unit_${algo}_${res.w}x${res.h}.png`;
    link.href = cvs.toDataURL('image/png');
    link.click();
  };

  // Unit Stats sliders & Deploy to Game
  const unitSliders = ['rngUnitHP', 'rngUnitAtt', 'rngUnitDef', 'rngUnitMove', 'rngUnitCost'];
  unitSliders.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateLabels);
  });

  document.getElementById('btnDeployGame')?.addEventListener('click', () => {
    const res = processedResults[activeAlgo];
    if (!res) {
      alert('Please wait for the image to finish processing.');
      return;
    }

    const name = (document.getElementById('txtUnitName')?.value || 'CUSTOM KNIGHT').trim().toUpperCase();
    const maxHP = Number(document.getElementById('rngUnitHP')?.value) || 80;
    const attack = Number(document.getElementById('rngUnitAtt')?.value) || 8;
    const defense = Number(document.getElementById('rngUnitDef')?.value) || 4;
    const moveRate = Number(document.getElementById('rngUnitMove')?.value) || 3;
    const cost = Number(document.getElementById('rngUnitCost')?.value) || 60;

    // Convert Uint8Array to binary string and base64
    let binary = '';
    const len = res.indexed.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(res.indexed[i]);
    }
    const pixelsBase64 = btoa(binary);

    const customUnitConfig = {
      name,
      w: res.w,
      h: res.h,
      orgX: Math.floor(res.w / 2),
      orgY: Math.max(0, res.h - 2),
      pixelsBase64,
      maxHP,
      attack,
      defense,
      moveRate,
      cost,
      algo: activeAlgo,
      savedAt: Date.now(),
    };

    localStorage.setItem('BAM_CUSTOM_UNIT', JSON.stringify(customUnitConfig));
    alert(`Success! "${name}" is now ready to play in Blood & Magic.\n\nLaunching game... Move a Basal Golem to your Barracks and click Transform!`);
    window.location.href = '/';
  });
}

function updateLabels() {
  document.getElementById('lblHeight').textContent = `${document.getElementById('rngHeight').value}px`;
  document.getElementById('lblKnockout').textContent = document.getElementById('rngKnockout').value;
  document.getElementById('lblContrast').textContent = `${document.getElementById('rngContrast').value}x`;
  const hue = Number(document.getElementById('rngTeamHue').value);
  let hueName = 'Red';
  if (hue >= 25 && hue < 70) hueName = 'Gold/Yellow';
  else if (hue >= 70 && hue < 160) hueName = 'Green';
  else if (hue >= 160 && hue < 260) hueName = 'Cyan/Blue';
  else if (hue >= 260 && hue < 330) hueName = 'Purple';
  document.getElementById('lblTeamHue').textContent = `${hueName} (${hue}°)`;

  if (document.getElementById('rngUnitHP')) {
    document.getElementById('lblUnitHP').textContent = document.getElementById('rngUnitHP').value;
    document.getElementById('lblUnitAtt').textContent = document.getElementById('rngUnitAtt').value;
    document.getElementById('lblUnitDef').textContent = document.getElementById('rngUnitDef').value;
    document.getElementById('lblUnitMove').textContent = document.getElementById('rngUnitMove').value;
    document.getElementById('lblUnitCost').textContent = `${document.getElementById('rngUnitCost').value} Mana`;
  }
}

let processTimer = null;
function debounceProcess() {
  if (processTimer) clearTimeout(processTimer);
  processTimer = setTimeout(runAllAlgorithms, 80);
}

function loadSampleSketch(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    currentSourceImg = img;
    runAllAlgorithms();
  };
  img.src = url;
}

function loadUserFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      currentSourceImg = img;
      runAllAlgorithms();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function getActivePalette(isSide2 = false) {
  const pal = basePal.map((c) => [...c]);
  if (unitPal) {
    // Side 1 uses Blue (offset 192 in 9101.PAL: side 2 color index 2)
    // Side 2 uses Red (offset 192 in 9101.PAL: side 1 color index 1)
    const srcOff = isSide2 ? 192 : 192 + 8;
    for (let i = 0; i < 8; i++) {
      pal[192 + i] = unitPal[srcOff + i];
    }
  }
  return pal;
}

// Full pixelation pipeline running in worker / canvas
function runAllAlgorithms() {
  if (!currentSourceImg || !basePal) return;

  const targetH = Number(document.getElementById('rngHeight').value);
  const knockoutThresh = Number(document.getElementById('rngKnockout').value);
  const contrast = Number(document.getElementById('rngContrast').value);
  const teamHue = Number(document.getElementById('rngTeamHue').value);
  const useModeXAspect = document.getElementById('chkModeXAspect').checked;

  // 1. Render raw image to offscreen canvas
  const srcW = currentSourceImg.naturalWidth || currentSourceImg.width;
  const srcH = currentSourceImg.naturalHeight || currentSourceImg.height;
  const offCvs = document.createElement('canvas');
  offCvs.width = srcW;
  offCvs.height = srcH;
  const offCtx = offCvs.getContext('2d');
  offCtx.drawImage(currentSourceImg, 0, 0);

  const srcImgData = offCtx.getImageData(0, 0, srcW, srcH);
  const pixels = srcImgData.data;

  // 2. Paper background knockout & contrast enhancement
  const cleaned = new Uint8ClampedArray(srcW * srcH * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // Background white paper knockout
    if (a < 30 || (r > knockoutThresh && g > knockoutThresh && b > knockoutThresh)) {
      cleaned[i + 3] = 0;
      continue;
    }

    // Contrast boost around midpoint 128
    cleaned[i] = Math.max(0, Math.min(255, (r - 128) * contrast + 128));
    cleaned[i + 1] = Math.max(0, Math.min(255, (g - 128) * contrast + 128));
    cleaned[i + 2] = Math.max(0, Math.min(255, (b - 128) * contrast + 128));
    cleaned[i + 3] = a;
  }

  // 3. Compute target dimensions (with Mode X 5:6 aspect compensation)
  let aspect = srcW / srcH;
  if (useModeXAspect) {
    aspect *= 1.0 / MODE_X_RATIO;
  }
  const targetW = Math.max(10, Math.round(targetH * aspect));

  // 4. Downscale to target resolution
  const downscaled = downsampleAreaAverage(cleaned, srcW, srcH, targetW, targetH);

  // 5. Run the 4 algorithms
  processedResults.kuwahara = processKuwaharaCel(downscaled, targetW, targetH, teamHue);
  processedResults.crisp = processCrispInk(downscaled, targetW, targetH, teamHue);
  processedResults.atkinson = processAtkinson(downscaled, targetW, targetH, teamHue);
  processedResults.bayer = processBayer(downscaled, targetW, targetH, teamHue);

  renderAllCards();
  renderTestBench();
}

// Area-average downsampling
function downsampleAreaAverage(srcData, sw, sh, tw, th) {
  const out = new Float32Array(tw * th * 4);
  const counts = new Float32Array(tw * th);

  const sxScale = sw / tw;
  const syScale = sh / th;

  for (let sy = 0; sy < sh; sy++) {
    const ty = Math.min(th - 1, Math.floor(sy / syScale));
    const srcRow = sy * sw * 4;
    for (let sx = 0; sx < sw; sx++) {
      const tx = Math.min(tw - 1, Math.floor(sx / sxScale));
      const sIdx = srcRow + sx * 4;
      const sa = srcData[sIdx + 3];
      if (sa < 50) continue;

      const tIdx = (ty * tw + tx) * 4;
      out[tIdx] += srcData[sIdx];
      out[tIdx + 1] += srcData[sIdx + 1];
      out[tIdx + 2] += srcData[sIdx + 2];
      out[tIdx + 3] += sa;
      counts[ty * tw + tx] += 1;
    }
  }

  const result = new Uint8ClampedArray(tw * th * 4);
  for (let i = 0; i < tw * th; i++) {
    const c = counts[i];
    const idx = i * 4;
    if (c > 0) {
      result[idx] = out[idx] / c;
      result[idx + 1] = out[idx + 1] / c;
      result[idx + 2] = out[idx + 2] / c;
      result[idx + 3] = out[idx + 3] / c;
    } else {
      result[idx + 3] = 0;
    }
  }
  return result;
}

// Color matching against 9100.PAL
function findNearestPalColor(r, g, b) {
  let bestIdx = 0;
  let bestDist = 1e9;
  // Exclude transparency 254 from standard color match
  for (let i = 0; i < 254; i++) {
    const c = basePal[i];
    // Perceptual weighted RGB distance
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// RGB to HSV hue angle (0..360)
function rgbToHue(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return -1; // monochrome
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return h;
}

function checkIsTeamColor(r, g, b, targetHue) {
  const h = rgbToHue(r, g, b);
  if (h === -1) return false;
  let diff = Math.abs(h - targetHue);
  if (diff > 180) diff = 360 - diff;
  const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
  return diff < 38 && sat > 0.25;
}

// Algorithm 1: Kuwahara Cel-Flat
function processKuwaharaCel(rgba, w, h, teamHue) {
  const indexed = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = rgba[idx + 3];
      if (a < 80) {
        indexed[y * w + x] = 254;
        continue;
      }
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];

      if (checkIsTeamColor(r, g, b, teamHue)) {
        const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        indexed[y * w + x] = 192 + Math.min(7, Math.floor(bright * 8));
      } else {
        indexed[y * w + x] = findNearestPalColor(r, g, b);
      }
    }
  }
  return { w, h, indexed };
}

// Algorithm 2: Crisp Ink Outline
function processCrispInk(rgba, w, h, teamHue) {
  const indexed = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = rgba[idx + 3];
      if (a < 80) {
        indexed[y * w + x] = 254;
        continue;
      }
      let r = rgba[idx];
      let g = rgba[idx + 1];
      let b = rgba[idx + 2];

      // Edge check: is this pixel neighboring transparency?
      let hasTransNeighbor = false;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h || rgba[(ny * w + nx) * 4 + 3] < 80) {
          hasTransNeighbor = true;
          break;
        }
      }

      if (hasTransNeighbor) {
        // Force crisp dark outer ink line
        indexed[y * w + x] = 0; // CI_BLACK
      } else if (checkIsTeamColor(r, g, b, teamHue)) {
        const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        indexed[y * w + x] = 192 + Math.min(7, Math.floor(bright * 8));
      } else {
        indexed[y * w + x] = findNearestPalColor(r, g, b);
      }
    }
  }
  return { w, h, indexed };
}

// Algorithm 3: Atkinson Dithering
function processAtkinson(rgba, w, h, teamHue) {
  const indexed = new Uint8Array(w * h);
  const err = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    err[i * 3] = rgba[i * 4];
    err[i * 3 + 1] = rgba[i * 4 + 1];
    err[i * 3 + 2] = rgba[i * 4 + 2];
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (rgba[i * 4 + 3] < 80) {
        indexed[i] = 254;
        continue;
      }

      const curR = Math.max(0, Math.min(255, err[i * 3]));
      const curG = Math.max(0, Math.min(255, err[i * 3 + 1]));
      const curB = Math.max(0, Math.min(255, err[i * 3 + 2]));

      let palIdx = 0;
      if (checkIsTeamColor(curR, curG, curB, teamHue)) {
        const bright = (curR * 0.299 + curG * 0.587 + curB * 0.114) / 255;
        palIdx = 192 + Math.min(7, Math.floor(bright * 8));
      } else {
        palIdx = findNearestPalColor(curR, curG, curB);
      }
      indexed[i] = palIdx;

      const palC = basePal[palIdx];
      const er = (curR - palC[0]) / 8;
      const eg = (curG - palC[1]) / 8;
      const eb = (curB - palC[2]) / 8;

      const neighbors = [
        [1, 0], [2, 0],
        [-1, 1], [0, 1], [1, 1],
        [0, 2]
      ];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && rgba[(ny * w + nx) * 4 + 3] >= 80) {
          const ni = (ny * w + nx) * 3;
          err[ni] += er;
          err[ni + 1] += eg;
          err[ni + 2] += eb;
        }
      }
    }
  }
  return { w, h, indexed };
}

// Algorithm 4: Bayer 4x4 Matrix Dithering
function processBayer(rgba, w, h, teamHue) {
  const indexed = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (rgba[i * 4 + 3] < 80) {
        indexed[i] = 254;
        continue;
      }

      const ditherMod = (BAYER_4X4[y % 4][x % 4] / 16 - 0.5) * 30;
      const r = Math.max(0, Math.min(255, rgba[i * 4] + ditherMod));
      const g = Math.max(0, Math.min(255, rgba[i * 4 + 1] + ditherMod));
      const b = Math.max(0, Math.min(255, rgba[i * 4 + 2] + ditherMod));

      if (checkIsTeamColor(r, g, b, teamHue)) {
        const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        indexed[i] = 192 + Math.min(7, Math.floor(bright * 8));
      } else {
        indexed[i] = findNearestPalColor(r, g, b);
      }
    }
  }
  return { w, h, indexed };
}

// Render cards at magnified preview
function renderAllCards() {
  const showGrid = document.getElementById('chkPixelGrid').checked;
  const isSide2 = document.getElementById('chkTeamBlue').checked;
  const pal = getActivePalette(isSide2);

  const canvasMap = {
    kuwahara: document.getElementById('cvsKuwahara'),
    crisp: document.getElementById('cvsCrispInk'),
    atkinson: document.getElementById('cvsAtkinson'),
    bayer: document.getElementById('cvsBayer'),
  };

  for (const [algo, res] of Object.entries(processedResults)) {
    const cvs = canvasMap[algo];
    if (!cvs || !res) continue;
    renderMagnifiedCanvas(cvs, res, pal, showGrid);
  }
}

function renderMagnifiedCanvas(cvs, res, pal, showGrid) {
  const zoom = Math.max(2, Math.floor(150 / Math.max(res.w, res.h)));
  cvs.width = res.w * zoom;
  cvs.height = res.h * zoom;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Background checkerboard
  ctx.fillStyle = '#161922';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  ctx.fillStyle = '#0f1118';
  for (let y = 0; y < cvs.height; y += 12) {
    for (let x = 0; x < cvs.width; x += 12) {
      if ((Math.floor(x / 12) + Math.floor(y / 12)) % 2 === 0) {
        ctx.fillRect(x, y, 12, 12);
      }
    }
  }

  // Draw pixels
  for (let py = 0; py < res.h; py++) {
    for (let px = 0; px < res.w; px++) {
      const idx = res.indexed[py * res.w + px];
      if (idx === 254) continue;
      const c = pal[idx];
      ctx.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      ctx.fillRect(px * zoom, py * zoom, zoom, zoom);

      if (showGrid && zoom >= 4) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.strokeRect(px * zoom, py * zoom, zoom, zoom);
      }
    }
  }
}

// Live test bench on Blood & Magic ground tiles
function renderTestBench() {
  const cvs = document.getElementById('benchCanvas');
  const res = processedResults[activeAlgo];
  if (!cvs || !res || !tilesetPixels) return;

  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const isSide2 = document.getElementById('chkTeamBlue').checked;
  const pal = getActivePalette(isSide2);

  // Bench size: 480x240 (at 3x zoom of 160x80)
  const TILE_W = 20;
  const TILE_H = 38;
  const ZOOM = 3;

  // Draw 6 ground tiles (3 columns, 2 rows)
  const tileIndices = [5, 25, 15, 11, 26, 12]; // grass, foundation, water, open land, etc.
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const tIdx = tileIndices[row * 3 + col] || 0;
      const srcBase = tIdx * 760;
      const dx = col * TILE_W * ZOOM;
      const dy = row * TILE_H * ZOOM;

      for (let sy = 0; sy < TILE_H; sy++) {
        for (let sx = 0; sx < TILE_W; sx++) {
          const colorIdx = tilesetPixels[srcBase + sy * TILE_W + sx];
          const c = pal[colorIdx] || [0, 0, 0];
          ctx.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
          ctx.fillRect(dx + sx * ZOOM, dy + sy * ZOOM, ZOOM, ZOOM);
        }
      }
    }
  }

  // Draw unit sprite on the center tile
  // Tile center is (col 1 * 20 + 9, row 0 * 38 + 18)
  const centerTileX = (1 * TILE_W + 9) * ZOOM;
  const centerTileY = (0 * TILE_H + 28) * ZOOM;

  const spriteDrawX = centerTileX - Math.floor((res.w * ZOOM) / 2);
  const spriteDrawY = centerTileY - res.h * ZOOM;

  for (let py = 0; py < res.h; py++) {
    for (let px = 0; px < res.w; px++) {
      const idx = res.indexed[py * res.w + px];
      if (idx === 254) continue;
      const c = pal[idx];
      ctx.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      ctx.fillRect(spriteDrawX + px * ZOOM, spriteDrawY + py * ZOOM, ZOOM, ZOOM);
    }
  }

  // Draw authentic unit footprint cursor
  ctx.strokeStyle = '#ffff00';
  ctx.lineWidth = 1;
  ctx.strokeRect(centerTileX - 8 * ZOOM, centerTileY - 2 * ZOOM, 16 * ZOOM, 4 * ZOOM);
}

// Start lab
window.addEventListener('DOMContentLoaded', initLab);

