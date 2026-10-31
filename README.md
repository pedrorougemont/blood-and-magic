# Blood & Magic (Web Prototype)

A browser-native HTML5 Canvas / Web Audio RTS engine faithful to the 1996 Interplay / Tachyon DOS classic *Blood & Magic*.

## Features

- **Pixel-Accurate 640×400 (Mode X double-pixel) Canvas**: 320×400 logical resolution scaled horizontally 2× to render authentic 4:3 DOS aspect ratio with palette cycling water, fire, and magical portals.
- **Authentic Font & Gauge Rendering**: TIGRE multi-pen font rendering (`9050`, `9060`, `9064`), authentic HP gauge, black stat box number displays, and pip markers matching `WORLD.CPP`.
- **Complete Acolyte / Basal Golem Lifecycle**:
  - Golems move to target locations when ordered.
  - When standing still, Basal Golems automatically transform back into Obelisk towers (`RES_ANIM 534`) to meditate and harvest mana.
  - Manual mana transfer (`TRANSFER` button `142` with acolyte mana bar).
- **Fog of War & Minimap**: Real-time tile defogging with authentic 12-cel partial border transitions (`308`/`309`).
- **Tactical Real-Time Combat**: Melee and ranged projectiles, unit animations, and structural destruction.
- **Foundation Construction & Research**: Transform Basal Golems into military structures and research advanced units.

## Quick Start

```bash
# Start local development server
node scripts/dev-server.mjs
```

Open `http://localhost:8787` in any modern web browser.

## Cloudflare Deployment

Designed for seamless deployment to Cloudflare Workers / Cloudflare Pages:

```bash
npx wrangler pages deploy public
```
