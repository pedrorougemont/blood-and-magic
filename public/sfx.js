// Web Audio API Sound Effects Manager for Blood & Magic (RES_DAC .WAV resources)

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.manifest = null;
    this.buffers = new Map();
    this.loading = new Map();
    this.ambientNodes = [];
  }

  setManifest(manifest) {
    if (Array.isArray(manifest)) {
      this.manifest = new Set(manifest.map((m) => (typeof m === 'object' && m !== null ? Number(m.id) : Number(m))));
    } else {
      this.manifest = null;
    }
  }

  unlock() {
    this.ensureContext();
  }

  ensureContext() {
    if (!this.ctx && typeof globalThis !== 'undefined') {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  async loadSound(resNum) {
    if (!resNum) return null;
    if (this.manifest && !this.manifest.has(Number(resNum)) && !this.manifest.has(String(resNum))) {
      return null;
    }
    if (this.buffers.has(resNum)) return this.buffers.get(resNum);
    if (this.loading.has(resNum)) return this.loading.get(resNum);

    const p = (async () => {
      try {
        const ctx = this.ensureContext();
        if (!ctx) return null;
        const resp = await fetch(`/assets/sounds/${resNum}.wav`);
        if (!resp.ok) return null;
        const arr = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arr);
        this.buffers.set(resNum, audioBuf);
        return audioBuf;
      } catch {
        return null;
      } finally {
        this.loading.delete(resNum);
      }
    })();

    this.loading.set(resNum, p);
    return p;
  }

  async play(resNum, volume = 0.8, pan = 0, loop = false) {
    if (!this.enabled || !resNum) return null;
    const ctx = this.ensureContext();
    if (!ctx) return null;

    const buf = await this.loadSound(resNum);
    if (!buf || !this.enabled) return null;

    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loop;

      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, volume));

      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        src.connect(panner);
        panner.connect(gain);
      } else {
        src.connect(gain);
      }

      gain.connect(ctx.destination);
      src.start(0);
      return { src, gain };
    } catch {
      return null;
    }
  }

  // Launch positional sound relative to current 12x8 viewport (ViewX+1 .. ViewX+12, ViewY+1 .. ViewY+8)
  launchPositional(resNum, tileX, tileY, viewX, viewY) {
    if (!this.enabled || !resNum) return;
    if (tileX == null || tileY == null || tileX < 0 || tileY < 0) {
      this.play(resNum, 0.75, 0);
      return;
    }
    const centerX = viewX + 6.5;
    const centerY = viewY + 4.5;
    const dx = tileX - centerX;
    const dy = tileY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > 18) return; // Too far from camera
    const vol = Math.max(0.12, 0.85 * (1 - dist / 20));
    const pan = Math.max(-0.85, Math.min(0.85, dx / 8));
    this.play(resNum, vol, pan);
  }
}
