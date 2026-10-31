// 320x400 8-bit Indexed VGA Software Renderer for Blood & Magic
// Reproduces exact DOS VGA palette lookup, CI_SKIP (254) transparency,
// CLUT team-color shifting (192..199), horizontal sprite flips, and Tachyon bitmap fonts.

export const SCREEN_W = 320;
export const SCREEN_H = 400;
export const TILE_W = 20;
export const TILE_H = 38;
export const VPORT_W = 12; // visible tiles wide (240px)
export const VPORT_H = 8;  // visible tiles high (304px)
export const VPORT_PIX_W = 240;
export const VPORT_PIX_H = 304;

export const CI_BLACK = 0;
export const CI_WHITE = 255;
export const CI_SKIP = 254;

export const CLUT_TEAM_COLORS = 192;
export const CLUT_SIZE = 8;
export const CLUT0_START = 34;  // Neutral / Side 0 / Side 3
export const CLUT1_START = 192; // Side 1 (Blue in Storyline 1)
export const CLUT2_START = 200; // Side 2 (Red in Storyline 1)

// Color enum from BAM.HPP: RED=1, BLUE=2, PURPLE=3, GOLD=4, GREEN=5
export const UNIT_COLOR = {
  RED: 1,
  BLUE: 2,
  PURPLE: 3,
  GOLD: 4,
  GREEN: 5,
};

export class IndexedRenderer {
  constructor(canvas, palettes, fonts, animManifest, animBinBuffer, tilesetMeta, tilesetBinBuffer) {
    this.canvas = canvas;
    this.canvas.width = SCREEN_W * 2;
    this.canvas.height = SCREEN_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.imageData = this.ctx.createImageData(SCREEN_W * 2, SCREEN_H);
    this.rgba32 = new Uint32Array(this.imageData.data.buffer);
    this.fb = new Uint8Array(SCREEN_W * SCREEN_H);

    this.palettes = palettes;
    this.fonts = fonts;
    this.animManifest = animManifest;
    this.animBytes = new Uint8Array(animBinBuffer);
    this.tilesetMeta = tilesetMeta;
    this.tileBytes = new Uint8Array(tilesetBinBuffer);

    // Active 256-color RGB table & packed ABGR Uint32 table
    this.activeRgb = new Uint8Array(256 * 3);
    this.pal32 = new Uint32Array(256);
    this.palCycles = [];

    this.initPalette(9100, UNIT_COLOR.BLUE, UNIT_COLOR.RED);
  }

  initPalette(basePalId = 9100, side1Color = UNIT_COLOR.BLUE, side2Color = UNIT_COLOR.RED) {
    const base = this.palettes[basePalId] || this.palettes[9100];
    const unitPal = this.palettes[9101];

    for (let i = 0; i < 256; i++) {
      this.activeRgb[i * 3] = base[i][0];
      this.activeRgb[i * 3 + 1] = base[i][1];
      this.activeRgb[i * 3 + 2] = base[i][2];
    }

    // LoadUnitColors from SRC/BAMFUNCS.CPP:
    // Copy 8 colors from 9101.PAL at 192 + 8*(color-1) into 192..199 (SIDE1) and 200..207 (SIDE2)
    if (unitPal) {
      const s1Src = 192 + 8 * (side1Color - 1);
      const s2Src = 192 + 8 * (side2Color - 1);
      for (let i = 0; i < 8; i++) {
        this.activeRgb[(CLUT1_START + i) * 3] = unitPal[s1Src + i][0];
        this.activeRgb[(CLUT1_START + i) * 3 + 1] = unitPal[s1Src + i][1];
        this.activeRgb[(CLUT1_START + i) * 3 + 2] = unitPal[s1Src + i][2];

        this.activeRgb[(CLUT2_START + i) * 3] = unitPal[s2Src + i][0];
        this.activeRgb[(CLUT2_START + i) * 3 + 1] = unitPal[s2Src + i][1];
        this.activeRgb[(CLUT2_START + i) * 3 + 2] = unitPal[s2Src + i][2];
      }
    }

    this.rebuildPal32();
  }

  rebuildPal32() {
    for (let i = 0; i < 256; i++) {
      const r = this.activeRgb[i * 3];
      const g = this.activeRgb[i * 3 + 1];
      const b = this.activeRgb[i * 3 + 2];
      this.pal32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
  }

  setPalCycles(cycles) {
    this.palCycles = [
      // Cursor flash cycle (220..223) from World::Setup line 2859
      { dir: 'FOR', start: 220, end: 223, rate: 2, nextTick: 0 },
      ...cycles.map((c) => ({ ...c, nextTick: 0 })),
    ];
  }

  cyclePalettes(ticks) {
    let changed = false;
    for (const c of this.palCycles) {
      if (ticks >= c.nextTick) {
        c.nextTick = ticks + Math.max(1, c.rate);
        const start = c.start;
        const end = c.end;
        if (end <= start) continue;
        if (c.dir === 'FOR') {
          const tr = this.activeRgb[end * 3];
          const tg = this.activeRgb[end * 3 + 1];
          const tb = this.activeRgb[end * 3 + 2];
          for (let i = end; i > start; i--) {
            this.activeRgb[i * 3] = this.activeRgb[(i - 1) * 3];
            this.activeRgb[i * 3 + 1] = this.activeRgb[(i - 1) * 3 + 1];
            this.activeRgb[i * 3 + 2] = this.activeRgb[(i - 1) * 3 + 2];
          }
          this.activeRgb[start * 3] = tr;
          this.activeRgb[start * 3 + 1] = tg;
          this.activeRgb[start * 3 + 2] = tb;
        } else {
          const tr = this.activeRgb[start * 3];
          const tg = this.activeRgb[start * 3 + 1];
          const tb = this.activeRgb[start * 3 + 2];
          for (let i = start; i < end; i++) {
            this.activeRgb[i * 3] = this.activeRgb[(i + 1) * 3];
            this.activeRgb[i * 3 + 1] = this.activeRgb[(i + 1) * 3 + 1];
            this.activeRgb[i * 3 + 2] = this.activeRgb[(i + 1) * 3 + 2];
          }
          this.activeRgb[end * 3] = tr;
          this.activeRgb[end * 3 + 1] = tg;
          this.activeRgb[end * 3 + 2] = tb;
        }
        changed = true;
      }
    }
    if (changed) this.rebuildPal32();
  }

  getClutStartForSide(side) {
    if (side === 2) return CLUT1_START; // SIDE1 = 0x02
    if (side === 4) return CLUT2_START; // SIDE2 = 0x04
    if (side === 1 || side === 0) return CLUT0_START; // SIDE0 / SIDE3 (for units)
    return null;
  }

  // Exact tile CLUT lookup from ViewPort::Draw in SRC/VIEWPORT.CPP lines 4737-4750:
  // Only SIDE1 and SIDE2 structures color-shift map tiles; SIDE0/default uses NULL.
  getTileClutForSide(side) {
    if (side === 2) return CLUT1_START; // SIDE1 = 0x02
    if (side === 4) return CLUT2_START; // SIDE2 = 0x04
    return null;
  }

  clear(colorIdx = CI_BLACK) {
    this.fb.fill(colorIdx);
  }

  fillRect(x, y, w, h, colorIdx, clip = null) {
    let x1 = Math.max(0, x | 0);
    let y1 = Math.max(0, y | 0);
    let x2 = Math.min(SCREEN_W - 1, (x + w - 1) | 0);
    let y2 = Math.min(SCREEN_H - 1, (y + h - 1) | 0);
    if (clip) {
      x1 = Math.max(x1, clip.x1);
      y1 = Math.max(y1, clip.y1);
      x2 = Math.min(x2, clip.x2);
      y2 = Math.min(y2, clip.y2);
    }
    if (x1 > x2 || y1 > y2) return;
    for (let py = y1; py <= y2; py++) {
      this.fb.fill(colorIdx, py * SCREEN_W + x1, py * SCREEN_W + x2 + 1);
    }
  }

  strokeRect(x1, y1, x2, y2, colorIdx, clip = null) {
    const L = Math.min(x1, x2) | 0;
    const R = Math.max(x1, x2) | 0;
    const T = Math.min(y1, y2) | 0;
    const B = Math.max(y1, y2) | 0;
    this.fillRect(L, T, R - L + 1, 1, colorIdx, clip);
    this.fillRect(L, B, R - L + 1, 1, colorIdx, clip);
    this.fillRect(L, T, 1, B - T + 1, colorIdx, clip);
    this.fillRect(R, T, 1, B - T + 1, colorIdx, clip);
  }

  // Draw a 20x38 tile from 9100.TLB at screen (dx, dy)
  drawTile(tileNum, dx, dy, clutStart = null, clip = null) {
    if (tileNum < 0 || tileNum >= this.tilesetMeta.totalTiles) return;
    const srcBase = tileNum * 760;

    const minX = clip ? clip.x1 : 0;
    const minY = clip ? clip.y1 : 0;
    const maxX = clip ? clip.x2 : SCREEN_W - 1;
    const maxY = clip ? clip.y2 : SCREEN_H - 1;

    const sxStart = dx < minX ? minX - dx : 0;
    const syStart = dy < minY ? minY - dy : 0;
    const sxEnd = dx + TILE_W - 1 > maxX ? maxX - dx : TILE_W - 1;
    const syEnd = dy + TILE_H - 1 > maxY ? maxY - dy : TILE_H - 1;

    if (sxStart > sxEnd || syStart > syEnd) return;

    for (let sy = syStart; sy <= syEnd; sy++) {
      let dstIdx = (dy + sy) * SCREEN_W + (dx + sxStart);
      let srcIdx = srcBase + sy * TILE_W + sxStart;
      for (let sx = sxStart; sx <= sxEnd; sx++, dstIdx++, srcIdx++) {
        let px = this.tileBytes[srcIdx];
        if (clutStart !== null && px >= CLUT_TEAM_COLORS && px < CLUT_TEAM_COLORS + CLUT_SIZE) {
          px = clutStart + (px - CLUT_TEAM_COLORS);
        }
        this.fb[dstIdx] = px;
      }
    }
  }

  getCelCount(animId) {
    const cels = this.animManifest[animId];
    return cels ? cels.length : 0;
  }

  getCelHeader(animId, celNum = 1) {
    const cels = this.animManifest[animId];
    if (!cels || cels.length === 0) return null;
    const idx = Math.max(0, Math.min(cels.length - 1, (celNum | 0) - 1));
    return cels[idx];
  }

  // Draw a RES_ANIM cel (1-indexed celNum)
  drawCel(animId, celNum, x, y, options = {}) {
    const cels = this.animManifest[animId];
    if (!cels || cels.length === 0) return null;
    const idx = Math.max(0, Math.min(cels.length - 1, (celNum | 0) - 1));
    const cel = cels[idx];

    const {
      useOrigin = false,
      hFlip = false,
      skipTrans = true,
      clutStart = null,
      clip = null,
    } = options;

    let drawX = x | 0;
    let drawY = y | 0;
    if (useOrigin) {
      drawX = hFlip ? drawX - (cel.w - cel.orgX - 1) : drawX - cel.orgX;
      drawY = drawY - cel.orgY;
    }

    const w = cel.w;
    const h = cel.h;
    const srcBase = cel.binOff;

    const minX = clip ? clip.x1 : 0;
    const minY = clip ? clip.y1 : 0;
    const maxX = clip ? clip.x2 : SCREEN_W - 1;
    const maxY = clip ? clip.y2 : SCREEN_H - 1;

    const sxStart = drawX < minX ? minX - drawX : 0;
    const syStart = drawY < minY ? minY - drawY : 0;
    const sxEnd = drawX + w - 1 > maxX ? maxX - drawX : w - 1;
    const syEnd = drawY + h - 1 > maxY ? maxY - drawY : h - 1;

    if (sxStart <= sxEnd && syStart <= syEnd) {
      for (let sy = syStart; sy <= syEnd; sy++) {
        let dstIdx = (drawY + sy) * SCREEN_W + (drawX + sxStart);
        const rowBase = srcBase + sy * w;
        for (let sx = sxStart; sx <= sxEnd; sx++, dstIdx++) {
          const srcX = hFlip ? w - 1 - sx : sx;
          let px = this.animBytes[rowBase + srcX];
          if (skipTrans && px === CI_SKIP) continue;
          if (clutStart !== null && px >= CLUT_TEAM_COLORS && px < CLUT_TEAM_COLORS + CLUT_SIZE) {
            px = clutStart + (px - CLUT_TEAM_COLORS);
          }
          this.fb[dstIdx] = px;
        }
      }
    }

    return {
      x1: drawX,
      y1: drawY,
      x2: drawX + w - 1,
      y2: drawY + h - 1,
      w,
      h,
    };
  }

  // Measure string width in pixels using bitmap font
  measureText(text, fontId = 9050) {
    const font = this.fonts[fontId] || this.fonts[9050];
    if (!font || !text) return 0;
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const ch = font.chars[code];
      w += ch ? ch.width : 4;
    }
    return w;
  }

  // Render string using Tachyon bitmap font (9050, 9060, 9064)
  // Supports multi-color font pens 1..6 (SetFontColors in SRC/BAMFUNC2.CPP) and pen 9 = CI_BLACK.
  drawText(text, x, y, options = {}) {
    const {
      fontId = 9050,
      foreColor = 64,
      shadowColor = 74,
      colors = null, // Optional [fore1, fore2, fore3, fore4, fore5, fore6]
      maxWidth = 0,
      align = 'left', // 'left', 'center', 'right'
      lineSpacing = 0,
    } = options;

    const font = this.fonts[fontId] || this.fonts[9050];
    if (!font || text == null) return;

    const penColors = colors || [
      foreColor,
      shadowColor,
      foreColor,
      shadowColor,
      foreColor,
      shadowColor,
    ];

    const lines = String(text).split('\n');
    let curY = y | 0;

    for (const line of lines) {
      let curX = x | 0;
      if (maxWidth > 0 && align !== 'left') {
        const lw = this.measureText(line, fontId);
        if (align === 'center') {
          curX += Math.max(0, ((maxWidth - lw) / 2) | 0);
        } else if (align === 'right') {
          curX += Math.max(0, (maxWidth - lw) | 0);
        }
      }

      for (let i = 0; i < line.length; i++) {
        const code = line.charCodeAt(i);
        const ch = font.chars[code];
        if (!ch) {
          curX += 4;
          continue;
        }
        const cw = ch.width;
        const chH = font.height;
        const pxArr = ch.pixels;

        for (let py = 0; py < chH; py++) {
          const sy = curY + py;
          if (sy < 0 || sy >= SCREEN_H) continue;
          const rowOff = py * cw;
          const dstRow = sy * SCREEN_W;
          for (let px = 0; px < cw; px++) {
            const sx = curX + px;
            if (sx < 0 || sx >= SCREEN_W) continue;
            const fontPen = pxArr[rowOff + px];
            if (fontPen === 0 || fontPen === CI_SKIP) continue;
            if (fontPen >= 1 && fontPen <= 6) {
              const c = penColors[fontPen - 1];
              if (c !== CI_SKIP) this.fb[dstRow + sx] = c;
            } else if (fontPen === 9) {
              this.fb[dstRow + sx] = CI_BLACK;
            }
          }
        }
        curX += cw;
      }
      curY += font.height + lineSpacing;
    }
  }

  // Convert 8-bit 320x400 logical framebuffer to 640x400 (DOUBLE_PIX Mode X) 32-bit RGBA ImageData
  present() {
    const fb = this.fb;
    const pal32 = this.pal32;
    const out = this.rgba32;
    const len = SCREEN_W * SCREEN_H;
    for (let i = 0, dst = 0; i < len; i++, dst += 2) {
      const c = pal32[fb[i]];
      out[dst] = c;
      out[dst + 1] = c;
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }
}
