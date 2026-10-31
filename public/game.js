// Main Browser Entry Point for Blood & Magic (1996) Prototype
// Coordinates asset loading, 320x400 (640x400 double-pixel) VGA software rendering, HUD, Minimap, Input, and 20Hz World Simulation.

import {
  SCREEN_W,
  SCREEN_H,
  TILE_W,
  TILE_H,
  VPORT_W,
  VPORT_H,
  VPORT_PIX_W,
  VPORT_PIX_H,
  CI_BLACK,
  CI_WHITE,
  UNIT_COLOR,
  IndexedRenderer,
} from './renderer.js';
import {
  WORLD_W,
  WORLD_H,
  TICKS_PER_SEC,
  SIDE0,
  SIDE1,
  SIDE2,
  FOG_ALL,
  FOG_CENTER,
  FOG_ANIM_TABLE,
  ANIM_RES,
  CURSOR_CEL,
  UNIT_TYPE,
  FUNC,
  BUILDING_UNITS,
  FOUNDATION_BLDG_OPTIONS,
  MANA,
  SND,
  VERB_BUTTONS,
  TRANSFORM_BUTTONS,
  MAIN_BUTTONS,
} from './constants.js';
import { SoundManager } from './sfx.js';
import { BamWorld } from './world-sim.js';

const VPORT_CLIP = { x1: 0, y1: 0, x2: VPORT_PIX_W - 1, y2: VPORT_PIX_H - 1 };
const MINIMAP_RECT = { x: 255, y: 44, w: 64, h: 120 };
const PORTRAIT_RECT = { x: 0, y: 320, w: 37, h: 48 };
const RESEARCH_RECT = { x: 261, y: 0, w: 59, h: 22 };

class BamGameApp {
  constructor() {
    this.canvas = document.getElementById('bamCanvas');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.loadingStatus = document.getElementById('loadingStatus');
    this.victoryOverlay = document.getElementById('victoryOverlay');
    this.victoryTitle = document.getElementById('victoryTitle');
    this.victoryDesc = document.getElementById('victoryDesc');

    this.sfx = new SoundManager();
    this.renderer = null;
    this.world = null;
    this.maps = {};

    this.mouseX = 160;
    this.mouseY = 200;
    this.mouseInside = false;
    this.pressedBtnId = null;

    // Drag-box fence selection state
    this.isDraggingViewport = false;
    this.dragStartPx = [0, 0];
    this.dragCurrPx = [0, 0];
    this.isDraggingMinimap = false;

    // Touch interaction state (mobile & tablet gestures)
    this.touchStartTime = 0;
    this.touchStartPx = [0, 0];
    this.touchStartClient = [0, 0];
    this.lastTouchTapTime = 0;
    this.lastTouchTapPos = [0, 0];
    this.longPressTimer = null;
    this.isLongPressTriggered = false;
    this.isTwoFinger = false;
    this.twoFingerStartClient = [0, 0];
    this.twoFingerTouchLogical = [0, 0];
    this.twoFingerStartTime = 0;
    this.initialCameraView = [0, 0];

    this.keysDown = new Set();
    this.lastScrollTime = 0;
    this.lastSimTime = performance.now();
  }

  async init() {
    try {
      this.setStatus('Loading palettes, squibs, fonts, and sound manifest...');
      const [palettes, squibs, fonts, soundManifest, tilesetMeta, animManifest, map9110, map9155] =
        await Promise.all([
          fetch('/assets/palettes.json').then((r) => r.json()),
          fetch('/assets/squibs.json').then((r) => r.json()),
          fetch('/assets/fonts.json').then((r) => r.json()),
          fetch('/assets/sounds.json').then((r) => r.json()),
          fetch('/assets/tileset-9100.json').then((r) => r.json()),
          fetch('/assets/anims.json').then((r) => r.json()),
          fetch('/assets/map-9110.json').then((r) => r.json()),
          fetch('/assets/map-9155.json').then((r) => r.json()),
        ]);

      this.maps[9110] = map9110;
      this.maps[9155] = map9155;
      this.sfx.setManifest(soundManifest);

      this.setStatus('Loading 9100.TLB tileset pixels & 747 sprite animation cels...');
      const [tilesetBin, animBin] = await Promise.all([
        fetch('/assets/tileset-9100.bin').then((r) => r.arrayBuffer()),
        fetch('/assets/anims.bin').then((r) => r.arrayBuffer()),
      ]);

      this.renderer = new IndexedRenderer(
        this.canvas,
        palettes,
        fonts,
        animManifest,
        animBin,
        tilesetMeta,
        tilesetBin
      );

      this.world = new BamWorld(tilesetMeta, squibs, this.sfx);
      this.startScenario(9110);

      this.bindEvents();
      this.loadingOverlay.classList.add('hidden');

      this.lastSimTime = performance.now();
      requestAnimationFrame((ts) => this.loop(ts));
    } catch (err) {
      console.error('Failed to initialize Blood & Magic:', err);
      this.setStatus(`Error loading assets: ${err.message}`);
    }
  }

  setStatus(msg) {
    if (this.loadingStatus) this.loadingStatus.textContent = msg;
  }

  startScenario(mapId) {
    const mapData = this.maps[mapId] || this.maps[9110];
    this.victoryOverlay.classList.add('hidden');

    // In Storyline 1: 9110 is Aeldric (Blue vs Red), 9155 is Horath (Red vs Blue)
    if (Number(mapId) === 9155) {
      this.renderer.initPalette(9100, UNIT_COLOR.RED, UNIT_COLOR.BLUE);
    } else {
      this.renderer.initPalette(9100, UNIT_COLOR.BLUE, UNIT_COLOR.RED);
    }
    this.renderer.setPalCycles(mapData.parsedConfig.palCycles || []);
    this.world.loadScenario(mapData);
    this.initCustomUnit();

    const sub = document.getElementById('stageSubtitle');
    if (sub) {
      sub.textContent =
        Number(mapId) === 9110
          ? 'Storyline 1 (Aeldric): Doegan Keep vs. Undead Crypt'
          : 'Storyline 1 (Horath): Old Stone Keep vs. Barracks';
    }
  }

  initCustomUnit() {
    try {
      const saved = localStorage.getItem('BAM_CUSTOM_UNIT');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (!data || !data.pixelsBase64) return;

      const binStr = atob(data.pixelsBase64);
      const rawBytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        rawBytes[i] = binStr.charCodeAt(i);
      }

      const customCel = {
        orgX: data.orgX ?? Math.floor(data.w / 2),
        orgY: data.orgY ?? Math.max(0, data.h - 2),
        w: data.w,
        h: data.h,
        pri: 2000,
        binOff: 0,
        pixels: rawBytes,
      };

      // Register custom animations (IDs 9500..9535: Walk, Attack, Guard, Dies)
      for (let offset = 0; offset <= 35; offset++) {
        this.renderer.registerCustomAnim(9500 + offset, [customCel]);
      }

      const customGroup = {
        typeId: UNIT_TYPE.CUSTOM,
        internalName: data.name || 'CUSTOM CREATURE',
        name: data.name || 'CUSTOM CREATURE',
        rawName: 'CUSTOM',
        baseMoveRate: Number(data.moveRate) || 3,
        movement: 'W',
        maxHP: Number(data.maxHP) || 80,
        baseAttack: Number(data.attack) || 8,
        baseDefense: Number(data.defense) || 4,
        baseAttackRange: Number(data.range) || 1,
        baseAnim: 9500,
        portAnim: 2580,
        skillRange: 1,
        skillCost: 5,
        transformCost: Number(data.cost) || 60,
        transformTime: 6,
        expRequired: 0,
        expGained: 25,
        researchTime: 6,
      };

      this.world.unitGroups.set(UNIT_TYPE.CUSTOM, customGroup);
      this.world.researched[SIDE1].add(UNIT_TYPE.CUSTOM);
      this.world.researched[SIDE2].add(UNIT_TYPE.CUSTOM);

      this.world.addMessage(`CUSTOM UNIT ONLINE: ${customGroup.name}!`);
    } catch (err) {
      console.warn('Failed to load custom unit from storage:', err);
    }
  }

  bindEvents() {
    // Convert client mouse event to logical 320x400 coordinates
    const toCanvasCoords = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(SCREEN_W - 1, Math.floor(((e.clientX - rect.left) / rect.width) * SCREEN_W)));
      const y = Math.max(0, Math.min(SCREEN_H - 1, Math.floor(((e.clientY - rect.top) / rect.height) * SCREEN_H)));
      return [x, y];
    };

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousemove', (e) => {
      const [mx, my] = toCanvasCoords(e);
      this.mouseX = mx;
      this.mouseY = my;
      this.mouseInside = true;

      if (this.isDraggingViewport) {
        this.dragCurrPx = [
          Math.min(VPORT_PIX_W - 1, Math.max(0, mx)),
          Math.min(VPORT_PIX_H - 1, Math.max(0, my)),
        ];
      } else if (this.isDraggingMinimap) {
        this.jumpCameraFromMinimap(mx, my);
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouseInside = false;
      this.isDraggingViewport = false;
      this.isDraggingMinimap = false;
      this.pressedBtnId = null;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.sfx.unlock();
      const [mx, my] = toCanvasCoords(e);
      this.mouseX = mx;
      this.mouseY = my;

      if (e.button === 2) {
        // Right-click: Obvious Verb or cancel pending verb
        this.handleRightClick(mx, my);
        return;
      }

      if (e.button !== 0) return;

      // Left-click inside 240x304 Viewport
      if (mx < VPORT_PIX_W && my < VPORT_PIX_H) {
        this.isDraggingViewport = true;
        this.dragStartPx = [mx, my];
        this.dragCurrPx = [mx, my];
        return;
      }

      // Left-click inside Minimap
      if (this.inRect(mx, my, MINIMAP_RECT)) {
        this.isDraggingMinimap = true;
        this.jumpCameraFromMinimap(mx, my);
        return;
      }

      // Left-click on HUD buttons
      this.handleHudMouseDown(mx, my);
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      const [mx, my] = toCanvasCoords(e);

      if (this.isDraggingViewport) {
        this.isDraggingViewport = false;
        const [sx, sy] = this.dragStartPx;
        const dist = Math.hypot(mx - sx, my - sy);
        if (dist >= 10) {
          this.handleViewportFenceSelect(sx, sy, Math.min(VPORT_PIX_W - 1, mx), Math.min(VPORT_PIX_H - 1, my));
        } else {
          this.handleViewportLeftClick(mx, my);
        }
      }

      this.isDraggingMinimap = false;
      this.pressedBtnId = null;
    });

    // Touch event listeners for mobile, tablets, and touchscreens:
    // - Long-Press (~350ms): Right-Click (Move/Attack/Obelisk/Cancel)
    // - Double-Tap: Right-Click (Fast Move/Attack)
    // - Two-Finger Tap: Right-Click
    // - Two-Finger Drag: Smooth map camera panning
    // - One-Finger Drag: Drag-box fence select
    // - Single-Tap: Normal selection / left-click
    const getTouchCoords = (touch) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(SCREEN_W - 1, Math.floor(((touch.clientX - rect.left) / rect.width) * SCREEN_W)));
      const y = Math.max(0, Math.min(SCREEN_H - 1, Math.floor(((touch.clientY - rect.top) / rect.height) * SCREEN_H)));
      return [x, y];
    };

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.sfx.unlock();

      if (e.touches.length === 2) {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
        this.isTwoFinger = true;
        this.isDraggingViewport = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        this.twoFingerStartClient = [(t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2];
        this.twoFingerStartTime = Date.now();
        this.initialCameraView = [this.world.viewX, this.world.viewY];
        this.twoFingerTouchLogical = getTouchCoords(t1);
        return;
      }

      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const [mx, my] = getTouchCoords(touch);
      this.mouseX = mx;
      this.mouseY = my;
      this.mouseInside = true;
      this.touchStartTime = Date.now();
      this.touchStartPx = [mx, my];
      this.touchStartClient = [touch.clientX, touch.clientY];
      this.isLongPressTriggered = false;

      // Start long-press timer (~350ms) -> Triggers RMB Click!
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(() => {
        this.isLongPressTriggered = true;
        this.longPressTimer = null;
        if (navigator.vibrate) {
          try { navigator.vibrate(35); } catch {}
        }
        this.handleRightClick(mx, my);
      }, 350);

      if (mx < VPORT_PIX_W && my < VPORT_PIX_H) {
        this.dragStartPx = [mx, my];
        this.dragCurrPx = [mx, my];
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();

      if (this.isTwoFinger && e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const curMidX = (t1.clientX + t2.clientX) / 2;
        const curMidY = (t1.clientY + t2.clientY) / 2;
        const rect = this.canvas.getBoundingClientRect();
        const deltaTileX = Math.round(((curMidX - this.twoFingerStartClient[0]) / rect.width) * (SCREEN_W / TILE_W));
        const deltaTileY = Math.round(((curMidY - this.twoFingerStartClient[1]) / rect.height) * (SCREEN_H / TILE_H));

        this.world.viewX = Math.max(-1, Math.min(WORLD_W - 11, this.initialCameraView[0] - deltaTileX));
        this.world.viewY = Math.max(-1, Math.min(WORLD_H - 7, this.initialCameraView[1] - deltaTileY));
        return;
      }

      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const [mx, my] = getTouchCoords(touch);
      this.mouseX = mx;
      this.mouseY = my;

      const distClient = Math.hypot(touch.clientX - this.touchStartClient[0], touch.clientY - this.touchStartClient[1]);
      if (distClient > 10) {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }

        if (!this.isLongPressTriggered) {
          if (this.inRect(mx, my, MINIMAP_RECT)) {
            this.jumpCameraFromMinimap(mx, my);
          } else if (this.touchStartPx[0] < VPORT_PIX_W && this.touchStartPx[1] < VPORT_PIX_H) {
            this.isDraggingViewport = true;
            this.dragCurrPx = [
              Math.min(VPORT_PIX_W - 1, Math.max(0, mx)),
              Math.min(VPORT_PIX_H - 1, Math.max(0, my)),
            ];
          }
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();

      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      if (this.isTwoFinger) {
        const touchDuration = Date.now() - (this.twoFingerStartTime || 0);
        if (touchDuration < 280) {
          if (navigator.vibrate) {
            try { navigator.vibrate(25); } catch {}
          }
          this.handleRightClick(this.twoFingerTouchLogical[0], this.twoFingerTouchLogical[1]);
        }
        this.isTwoFinger = false;
        return;
      }

      if (this.isLongPressTriggered) {
        this.isLongPressTriggered = false;
        this.isDraggingViewport = false;
        return;
      }

      const [sx, sy] = this.touchStartPx;
      const [mx, my] = [this.mouseX, this.mouseY];
      const dist = Math.hypot(mx - sx, my - sy);

      if (this.isDraggingViewport && dist >= 10) {
        this.isDraggingViewport = false;
        this.handleViewportFenceSelect(sx, sy, Math.min(VPORT_PIX_W - 1, mx), Math.min(VPORT_PIX_H - 1, my));
        return;
      }
      this.isDraggingViewport = false;

      // Handle Tap / Double-Tap (< 10px movement)
      if (dist < 10) {
        const now = Date.now();
        const tapDist = Math.hypot(mx - this.lastTouchTapPos[0], my - this.lastTouchTapPos[1]);

        // Double-Tap in Viewport -> RMB Click!
        if (
          now - this.lastTouchTapTime < 350 &&
          tapDist < 16 &&
          mx < VPORT_PIX_W &&
          my < VPORT_PIX_H
        ) {
          this.lastTouchTapTime = 0;
          if (navigator.vibrate) {
            try { navigator.vibrate(25); } catch {}
          }
          this.handleRightClick(mx, my);
          return;
        }

        this.lastTouchTapTime = now;
        this.lastTouchTapPos = [mx, my];

        // Single Tap
        if (mx < VPORT_PIX_W && my < VPORT_PIX_H) {
          this.handleViewportLeftClick(mx, my);
        } else if (this.inRect(mx, my, MINIMAP_RECT)) {
          this.jumpCameraFromMinimap(mx, my);
        } else {
          this.handleHudMouseDown(mx, my);
        }
      }
    }, { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const key = e.key.toUpperCase();
      this.keysDown.add(key);

      if (key === 'ESCAPE') {
        this.world.currentVerb = null;
        if (this.world.statBoxMode === 'UNIT' || this.world.statBoxMode === 'BUILDING') {
          this.world.statBoxMode = 'TERRAIN';
        }
      } else if (key === 'P') {
        this.world.isPaused = !this.world.isPaused;
      } else if (key === 'F') {
        this.toggleFog();
      } else if (key === ' ') {
        e.preventDefault();
        this.triggerMainButton('GOSEE');
      } else if (key === 'W') {
        this.triggerMainButton('WINLOSE');
      } else {
        for (const vb of VERB_BUTTONS) {
          if (vb.key === key && this.isVerbAvailable(vb.id)) {
            this.triggerVerbButton(vb.id);
            break;
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key.toUpperCase());
    });

    // Top bar controls
    const mapSelect = document.getElementById('mapSelect');
    if (mapSelect) {
      mapSelect.addEventListener('change', () => {
        this.startScenario(Number(mapSelect.value));
      });
    }

    document.getElementById('btnRestart')?.addEventListener('click', () => {
      this.startScenario(this.world.mapId);
    });

    document.getElementById('btnFog')?.addEventListener('click', () => {
      this.toggleFog();
    });

    document.getElementById('btnBoost')?.addEventListener('click', () => {
      this.sfx.unlock();
      const s = this.world.playerSide;
      this.world.mana[s] = Math.min(MANA.MAX, this.world.mana[s] + 100);
      this.world.xp[s] = Math.min(99999, this.world.xp[s] + 250);
      this.sfx.play(SND.GET_ITEM, 0.75);
      this.world.addMessage('+100 MANA AND +250 XP GRANTED!', this.world.cursorX, this.world.cursorY);
    });

    const btnAudio = document.getElementById('btnAudio');
    btnAudio?.addEventListener('click', () => {
      this.sfx.unlock();
      this.sfx.enabled = !this.sfx.enabled;
      btnAudio.textContent = `SFX: ${this.sfx.enabled ? 'ON' : 'OFF'}`;
      btnAudio.classList.toggle('active', this.sfx.enabled);
    });

    document.getElementById('btnPlayAgain')?.addEventListener('click', () => {
      this.startScenario(this.world.mapId);
    });

    document.getElementById('btnSwitchSide')?.addEventListener('click', () => {
      const nextMap = this.world.mapId === 9110 ? 9155 : 9110;
      if (mapSelect) mapSelect.value = String(nextMap);
      this.startScenario(nextMap);
    });
  }

  toggleFog() {
    this.world.useFog = !this.world.useFog;
    const btnFog = document.getElementById('btnFog');
    if (btnFog) {
      btnFog.textContent = `Fog: ${this.world.useFog ? 'ON' : 'OFF'}`;
      btnFog.classList.toggle('active', this.world.useFog);
    }
  }

  inRect(x, y, rect) {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
  }

  jumpCameraFromMinimap(mx, my) {
    const tx = Math.floor((mx - MINIMAP_RECT.x) / 2);
    const ty = Math.floor((my - MINIMAP_RECT.y) / 3);
    this.world.centerCameraOn(tx, ty);
  }

  handleViewportLeftClick(mx, my) {
    const tx = this.world.viewX + Math.floor(mx / TILE_W);
    const ty = this.world.viewY + Math.floor(my / TILE_H);
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return;

    const verb = this.world.currentVerb;
    const selUnit = this.world.selectedUnit;
    const group = this.world.selectedGroup.length > 0 ? this.world.selectedGroup : selUnit ? [selUnit] : [];

    if (verb === 'QUESTION') {
      this.world.currentVerb = null;
      this.world.moveCursor(tx, ty, false);
      const terr = this.world.getTerrain(tx, ty);
      this.world.addMessage(
        `TERRAIN: ${terr.name} (ATK:${terr.attackMod} DEF:${terr.defenseMod})`,
        tx,
        ty
      );
      return;
    }

    if (verb === 'MOVE' && group.length > 0) {
      this.world.currentVerb = null;
      this.issueGroupMove(group, tx, ty);
      return;
    }

    if (verb === 'ATTACK' && group.length > 0) {
      this.world.currentVerb = null;
      this.issueGroupAttack(group, tx, ty);
      return;
    }

    if (verb === 'SKILL' && selUnit && selUnit.side === this.world.playerSide) {
      this.world.currentVerb = null;
      this.world.orderSkill(selUnit, tx, ty);
      return;
    }

    // Normal tile / unit / structure selection
    this.world.selectedGroup = [];
    this.world.moveCursor(tx, ty, true);
  }

  handleViewportFenceSelect(x1, y1, x2, y2) {
    const minTx = this.world.viewX + Math.floor(Math.min(x1, x2) / TILE_W);
    const maxTx = this.world.viewX + Math.floor(Math.max(x1, x2) / TILE_W);
    const minTy = this.world.viewY + Math.floor(Math.min(y1, y2) / TILE_H);
    const maxTy = this.world.viewY + Math.floor(Math.max(y1, y2) / TILE_H);

    const found = this.world.units.filter(
      (u) =>
        u.side === this.world.playerSide &&
        u.currHP > 0 &&
        u.state !== 'DYING' &&
        u.tileX >= minTx &&
        u.tileX <= maxTx &&
        u.tileY >= minTy &&
        u.tileY <= maxTy
    );

    if (found.length > 0) {
      this.world.selectedGroup = found;
      this.world.moveCursor(found[0].tileX, found[0].tileY, true);
      if (found.length > 1) {
        this.world.addMessage(`${found.length} UNITS SELECTED.`, found[0].tileX, found[0].tileY);
      }
    }
  }

  handleRightClick(mx, my) {
    // Cancel active cursor verb or exit transform menu first
    if (this.world.currentVerb) {
      this.world.currentVerb = null;
      return;
    }
    if (this.world.statBoxMode === 'UNIT' || this.world.statBoxMode === 'BUILDING') {
      this.world.statBoxMode = 'TERRAIN';
      return;
    }

    if (mx >= VPORT_PIX_W || my >= VPORT_PIX_H) return;

    const tx = this.world.viewX + Math.floor(mx / TILE_W);
    const ty = this.world.viewY + Math.floor(my / TILE_H);
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return;

    const selUnit = this.world.selectedUnit;
    const selBldg = this.world.selectedBuilding;
    const group =
      this.world.selectedGroup.length > 0
        ? this.world.selectedGroup.filter((u) => u.currHP > 0)
        : selUnit && selUnit.side === this.world.playerSide
        ? [selUnit]
        : [];

    // Right-click on friendly Portal when Portal is selected -> Summon Basal Golem
    if (selBldg && selBldg.owner === this.world.playerSide && selBldg.func === FUNC.PORTAL) {
      this.world.summonAtPortal(this.world.playerSide);
      return;
    }

    if (group.length === 0) {
      this.world.moveCursor(tx, ty, true);
      return;
    }

    // Check if right-clicking on the selected unit itself -> toggle Guard / Obelisk mode!
    if (group.length === 1 && group[0].tileX === tx && group[0].tileY === ty) {
      this.world.orderGuard(group[0]);
      return;
    }

    const targetUnit = !this.world.isTileFogged(tx, ty) ? this.world.getUnitAt(tx, ty) : null;
    const targetBldg = !this.world.isTileFogged(tx, ty) ? this.world.getStructure(tx, ty) : null;

    if (targetUnit && targetUnit.side !== this.world.playerSide && targetUnit.side !== SIDE0) {
      this.issueGroupAttack(group, tx, ty);
      return;
    }

    if (
      targetBldg &&
      targetBldg.owner !== this.world.playerSide &&
      targetBldg.owner !== SIDE0 &&
      targetBldg.currHP > 0
    ) {
      this.issueGroupAttack(group, tx, ty);
      return;
    }

    this.issueGroupMove(group, tx, ty);
  }

  issueGroupMove(group, tx, ty) {
    this.world.spawnEffect(ANIM_RES.CONFIRM_MOVE, tx, ty, 2);
    group.forEach((u, idx) => {
      if (u.side !== this.world.playerSide) return;
      const offX = idx === 0 ? 0 : ((idx % 3) - 1);
      const offY = idx === 0 ? 0 : Math.floor(idx / 3);
      this.world.orderMove(u, tx + offX, ty + offY);
    });
  }

  issueGroupAttack(group, tx, ty) {
    const enemyUnit = this.world.getUnitAt(tx, ty);
    const enemyBldg = this.world.getStructure(tx, ty);
    this.world.spawnEffect(ANIM_RES.CONFIRM_MOVE, tx, ty, 2);

    for (const u of group) {
      if (u.side !== this.world.playerSide) continue;
      if (enemyUnit && enemyUnit.side !== this.world.playerSide) {
        this.world.orderAttackUnit(u, enemyUnit);
      } else if (enemyBldg && enemyBldg.currHP > 0 && enemyBldg.owner !== this.world.playerSide) {
        this.world.orderAttackBuilding(u, enemyBldg, tx, ty);
      } else {
        this.world.orderMove(u, tx, ty);
      }
    }
  }

  handleHudMouseDown(mx, my) {
    // Portrait click: exit Transform submenu or center camera on cursor
    if (this.inRect(mx, my, PORTRAIT_RECT)) {
      if (this.world.statBoxMode === 'UNIT' || this.world.statBoxMode === 'BUILDING') {
        this.world.statBoxMode = 'TERRAIN';
      } else {
        this.world.centerCameraOn(this.world.cursorX, this.world.cursorY);
      }
      return;
    }

    // Research button at top-right (261, 0)
    if (this.inRect(mx, my, RESEARCH_RECT)) {
      this.handleResearchButtonClick();
      return;
    }

    // Main buttons (Freeze, Settings, Question, Encyclo, WinLose, GoSee)
    for (const mb of MAIN_BUTTONS) {
      if (this.inRect(mx, my, mb)) {
        this.pressedBtnId = mb.id;
        this.triggerMainButton(mb.id);
        return;
      }
    }

    // Transform submenu slot buttons (when statBoxMode is UNIT or BUILDING)
    if (this.world.statBoxMode === 'UNIT' || this.world.statBoxMode === 'BUILDING') {
      const options = this.getTransformOptions();
      for (const tb of TRANSFORM_BUTTONS) {
        if (this.inRect(mx, my, tb) && options[tb.slot]) {
          this.triggerTransformSlot(options[tb.slot]);
          return;
        }
      }
      return;
    }

    // Verb buttons (Move, Attack, Guard, Disband, Skill, Transform, Drop)
    for (const vb of VERB_BUTTONS) {
      if (this.inRect(mx, my, vb) && this.isVerbAvailable(vb.id)) {
        this.pressedBtnId = vb.id;
        this.triggerVerbButton(vb.id);
        return;
      }
    }
  }

  handleResearchButtonClick() {
    if (this.world.researchState.subject) {
      const g = this.world.unitGroups.get(this.world.researchState.subject);
      this.world.addMessage(`CURRENTLY RESEARCHING ${g ? g.name : 'UNIT'}...`);
      return;
    }

    // Find next unresearched unit available in player's buildings
    const playerSide = this.world.playerSide;
    for (const sp of this.world.spaces) {
      if (sp && sp.owner === playerSide && sp.currHP > 0 && BUILDING_UNITS[sp.func]) {
        for (const uType of BUILDING_UNITS[sp.func]) {
          if (!this.world.researched[playerSide].has(uType)) {
            this.world.startResearch(uType, playerSide);
            return;
          }
        }
      }
    }
    this.world.addMessage('ALL AVAILABLE CREATURES RESEARCHED!');
  }

  triggerMainButton(id) {
    if (id === 'FREEZE') {
      this.world.isPaused = !this.world.isPaused;
      this.world.addMessage(this.world.isPaused ? 'GAME PAUSED.' : 'GAME RESUMED.');
    } else if (id === 'QUESTION') {
      this.world.currentVerb = this.world.currentVerb === 'QUESTION' ? null : 'QUESTION';
    } else if (id === 'WINLOSE') {
      const msg =
        this.world.mapId === 9110
          ? 'WIN: DESTROY ENEMY CRYPT | LOSE: KEEP DESTROYED'
          : 'WIN: DESTROY ENEMY BARRACKS | LOSE: KEEP DESTROYED';
      this.world.addMessage(msg);
    } else if (id === 'GOSEE') {
      if (this.world.lastEventCoords) {
        const [ex, ey] = this.world.lastEventCoords;
        this.world.centerCameraOn(ex, ey);
        this.world.moveCursor(ex, ey, false);
      }
    } else if (id === 'SETTINGS') {
      this.sfx.enabled = !this.sfx.enabled;
      const btnAudio = document.getElementById('btnAudio');
      if (btnAudio) {
        btnAudio.textContent = `SFX: ${this.sfx.enabled ? 'ON' : 'OFF'}`;
        btnAudio.classList.toggle('active', this.sfx.enabled);
      }
      this.world.addMessage(`SOUND EFFECTS: ${this.sfx.enabled ? 'ON' : 'OFF'}`);
    } else if (id === 'ENCYCLO') {
      const msg =
        this.world.mapId === 9110
          ? 'HOWL OF VENGEANCE: STAGE 1 — HORATH\'S CRYPT'
          : 'HOWL OF VENGEANCE: STAGE 1 — OLD STONE KEEP';
      this.world.addMessage(msg);
    }
  }

  isVerbAvailable(verbId) {
    const u = this.world.selectedUnit;
    const b = this.world.selectedBuilding;

    if (u && u.side === this.world.playerSide && u.currHP > 0 && u.state !== 'TRANSFORMING') {
      if (verbId === 'MOVE') return true;
      if (verbId === 'ATTACK') return u.currAttack > 0;
      if (verbId === 'GUARD') return true;
      if (verbId === 'DISBAND') return true;
      if (verbId === 'SKILL') {
        if (u.type === UNIT_TYPE.ACOLYTE) return u.currMana > 0;
        return u.type === UNIT_TYPE.CLERIC || u.type === UNIT_TYPE.PALADIN || u.type === UNIT_TYPE.GNOME;
      }
      if (verbId === 'TRANSFORM') {
        if (u.type !== UNIT_TYPE.ACOLYTE) return false;
        this.world.checkUnitTransformer(u);
        if (u.nearbyTransformer !== FUNC.MISC) return true;
        const sp = this.world.getStructure(u.tileX, u.tileY);
        if (sp && sp.func === FUNC.GEN_FOUND && this.world.checkFoundationFilled(sp)) return true;
        return false;
      }
      return false;
    }

    if (b && b.owner === this.world.playerSide && b.func === FUNC.PORTAL) {
      if (verbId === 'TRANSFORM') return true;
    }

    return false;
  }

  triggerVerbButton(verbId) {
    const u = this.world.selectedUnit;
    const b = this.world.selectedBuilding;

    if (verbId === 'MOVE') {
      this.world.currentVerb = 'MOVE';
    } else if (verbId === 'ATTACK') {
      this.world.currentVerb = 'ATTACK';
    } else if (verbId === 'GUARD' && u) {
      this.world.orderGuard(u);
    } else if (verbId === 'DISBAND' && u) {
      this.world.orderDisband(u);
    } else if (verbId === 'SKILL' && u) {
      if (u.type === UNIT_TYPE.ACOLYTE) {
        this.world.orderSkill(u);
      } else {
        this.world.currentVerb = 'SKILL';
      }
    } else if (verbId === 'TRANSFORM') {
      if (b && b.func === FUNC.PORTAL && b.owner === this.world.playerSide) {
        this.world.summonAtPortal(this.world.playerSide);
        return;
      }
      if (u && u.type === UNIT_TYPE.ACOLYTE) {
        const sp = this.world.getStructure(u.tileX, u.tileY);
        if (sp && sp.func === FUNC.GEN_FOUND && this.world.checkFoundationFilled(sp)) {
          this.world.statBoxMode = 'BUILDING';
          return;
        }
        this.world.checkUnitTransformer(u);
        if (u.nearbyTransformer !== FUNC.MISC) {
          this.world.statBoxMode = 'UNIT';
        }
      }
    }
  }

  getTransformOptions() {
    const u = this.world.selectedUnit;
    if (!u || u.side !== this.world.playerSide) return [];

    if (this.world.statBoxMode === 'BUILDING') {
      return FOUNDATION_BLDG_OPTIONS.map((opt) => ({
        kind: 'BLDG',
        ...opt,
      }));
    }

    if (this.world.statBoxMode === 'UNIT') {
      this.world.checkUnitTransformer(u);
      const unitTypes = BUILDING_UNITS[u.nearbyTransformer] || [];
      return unitTypes.map((typeId) => {
        const g = this.world.unitGroups.get(typeId);
        const researched = this.world.researched[this.world.playerSide].has(typeId);
        return {
          kind: 'UNIT',
          typeId,
          name: g ? g.name : 'UNIT',
          portAnim: g ? g.portAnim : 2580,
          cost: researched ? g.transformCost || MANA.TRANSFORM : g.expRequired || 50,
          researched,
        };
      });
    }

    return [];
  }

  triggerTransformSlot(opt) {
    const u = this.world.selectedUnit;
    if (!u || u.side !== this.world.playerSide) return;

    if (opt.kind === 'BLDG') {
      const sp = this.world.getStructure(u.tileX, u.tileY);
      if (sp && sp.func === FUNC.GEN_FOUND) {
        this.world.buildFromFoundation(sp, opt, this.world.playerSide);
      }
      return;
    }

    if (opt.kind === 'UNIT') {
      this.world.orderTransformUnit(u, opt.typeId);
    }
  }

  handleKeyboardCameraScroll(now) {
    if (now - this.lastScrollTime < 65) return;
    let dx = 0;
    let dy = 0;
    if (this.keysDown.has('ARROWLEFT') || this.keysDown.has('A')) dx -= 1;
    if (this.keysDown.has('ARROWRIGHT') || this.keysDown.has('D')) dx += 1;
    if (this.keysDown.has('ARROWUP') || this.keysDown.has('W')) dy -= 1;
    if (this.keysDown.has('ARROWDOWN') || this.keysDown.has('S')) dy += 1;

    if (dx !== 0 || dy !== 0) {
      this.world.viewX = Math.max(-1, Math.min(WORLD_W - 11, this.world.viewX + dx));
      this.world.viewY = Math.max(-1, Math.min(WORLD_H - 7, this.world.viewY + dy));
      this.lastScrollTime = now;
    }
  }

  loop(now) {
    this.handleKeyboardCameraScroll(now);

    const tickInterval = 1000 / TICKS_PER_SEC;
    let steps = 0;
    while (now - this.lastSimTime >= tickInterval && steps < 4) {
      this.world.step(this.renderer);
      this.lastSimTime += tickInterval;
      steps++;
    }
    if (now - this.lastSimTime > 500) {
      this.lastSimTime = now;
    }

    if (this.world.winnerSide && this.victoryOverlay.classList.contains('hidden')) {
      const won = this.world.winnerSide === this.world.playerSide;
      this.victoryTitle.textContent = won ? 'VICTORY!' : 'DEFEAT!';
      this.victoryDesc.textContent = won
        ? 'You have shattered the enemy stronghold and claimed mastery over the realm!'
        : 'Your Keep has fallen to the enemy forces!';
      this.victoryOverlay.classList.remove('hidden');
    }

    this.render();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  render() {
    const r = this.renderer;
    r.clear(CI_BLACK);

    // 1. Render 12x8 Tile Viewport (0,0 .. 239,303)
    this.renderViewport(r);

    // 2. Render HUD Frame (RES_ANIM 100 cel 1)
    r.drawCel(ANIM_RES.HUD_FRAME, 1, 0, 0, { skipTrans: true });

    // 3. Render Research Button, Progress Bar & XP
    this.renderResearchAndMana(r);

    // 4. Render 64x120 Minimap at (255, 44)
    this.renderMinimap(r);

    // 5. Render Main Control Buttons
    this.renderMainButtons(r);

    // 6. Render Bottom Status Box (Portrait, Gauges, Verbs / Transform Slots, Message Line)
    this.renderStatusBox(r);

    // 7. Render Custom Mouse Cursor (RES_ANIM 9000)
    if (this.mouseInside) {
      this.renderMouseCursor(r);
    }

    r.present();
  }

  renderViewport(r) {
    const w = this.world;

    // Pass 1: Terrain Tiles + Partial Fog Borders (SRC/VIEWPORT.CPP ViewPort::Draw lines 4725-4768)
    for (let vy = 0; vy < VPORT_H; vy++) {
      const ty = w.viewY + vy;
      const sy = vy * TILE_H;
      for (let vx = 0; vx < VPORT_W; vx++) {
        const tx = w.viewX + vx;
        const sx = vx * TILE_W;

        if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) {
          r.fillRect(sx, sy, TILE_W, TILE_H, CI_BLACK, VPORT_CLIP);
          continue;
        }

        const fogVal = w.useFog ? w.fog[tx + ty * WORLD_W] : 0;
        if (fogVal & FOG_CENTER) {
          r.fillRect(sx, sy, TILE_W, TILE_H, CI_BLACK, VPORT_CLIP);
          continue;
        }

        const tileNum = w.getTileNum(tx, ty);
        const sp = w.getStructure(tx, ty);
        // Only SIDE1 and SIDE2 structures remap tile colors 192..199 (neutral SIDE0 uses NULL CLUT)
        const clut = sp ? r.getTileClutForSide(sp.owner) : null;
        r.drawTile(tileNum, sx, sy, clut, VPORT_CLIP);

        const borderFog = fogVal & FOG_ALL;
        if (borderFog && FOG_ANIM_TABLE[borderFog]) {
          const [fAnim, fCel] = FOG_ANIM_TABLE[borderFog];
          r.drawCel(fAnim, fCel, sx + 9, sy + 18, {
            useOrigin: true,
            clip: VPORT_CLIP,
          });
        }
      }
    }

    // Pass 2: Background animations (Portal swirl 322, flags, fire, water)
    for (const bg of w.bgAnims) {
      if (w.isTileFogged(bg.x, bg.y)) continue;
      const sx = (bg.x - w.viewX) * TILE_W + 9;
      const sy = (bg.y - w.viewY) * TILE_H + 18;
      if (sx < -60 || sx > VPORT_PIX_W + 60 || sy < -60 || sy > VPORT_PIX_H + 60) continue;
      r.drawCel(bg.resNum, bg.cel, sx, sy, {
        useOrigin: true,
        clutStart: r.getClutStartForSide(bg.side),
        clip: VPORT_CLIP,
      });
    }

    // Pass 3: Units sorted by Y coordinate for painter's depth order
    const visibleUnits = w.units
      .filter((u) => !w.isTileFogged(u.tileX, u.tileY))
      .sort((a, b) => a.tileY * TILE_H + a.tileYOff - (b.tileY * TILE_H + b.tileYOff));

    for (const u of visibleUnits) {
      const sx = (u.tileX - w.viewX) * TILE_W + u.tileXOff;
      const sy = (u.tileY - w.viewY) * TILE_H + u.tileYOff;
      if (sx < -48 || sx > VPORT_PIX_W + 48 || sy < -48 || sy > VPORT_PIX_H + 48) continue;

      r.drawCel(u.animRes, u.animCel, sx, sy, {
        useOrigin: true,
        hFlip: u.animHFlip,
        clutStart: r.getClutStartForSide(u.side),
        clip: VPORT_CLIP,
      });
    }

    // Pass 4: Projectiles & One-shot Effects
    for (const p of w.projectiles) {
      const sx = p.x - w.viewX * TILE_W;
      const sy = p.y - w.viewY * TILE_H;
      r.drawCel(p.resNum, p.cel, sx, sy, {
        useOrigin: true,
        clutStart: p.owner ? r.getClutStartForSide(p.owner.side) : null,
        clip: VPORT_CLIP,
      });
    }

    for (const fx of w.effects) {
      if (w.isTileFogged(fx.tileX, fx.tileY)) continue;
      const sx = (fx.tileX - w.viewX) * TILE_W + fx.xOff;
      const sy = (fx.tileY - w.viewY) * TILE_H + fx.yOff;
      r.drawCel(fx.resNum, fx.cel, sx, sy, {
        useOrigin: true,
        clip: VPORT_CLIP,
      });
    }

    // Pass 5: Viewport Tile Cursor (RES_ANIM 9002 cel 1) and Group Selection Cursors (cel 2)
    for (const gu of w.selectedGroup) {
      if (gu.currHP <= 0) continue;
      const gsx = (gu.tileX - w.viewX) * TILE_W + 9;
      const gsy = (gu.tileY - w.viewY) * TILE_H + 18;
      r.drawCel(ANIM_RES.VP_CURSOR, 2, gsx, gsy, {
        useOrigin: true,
        clip: VPORT_CLIP,
      });
    }

    const csx = (w.cursorX - w.viewX) * TILE_W + 9;
    const csy = (w.cursorY - w.viewY) * TILE_H + 18;
    r.drawCel(ANIM_RES.VP_CURSOR, 1, csx, csy, {
      useOrigin: true,
      clip: VPORT_CLIP,
    });

    // Pass 6: Drag-box selection fence
    if (this.isDraggingViewport) {
      const [x1, y1] = this.dragStartPx;
      const [x2, y2] = this.dragCurrPx;
      if (Math.hypot(x2 - x1, y2 - y1) >= 6) {
        r.strokeRect(x1, y1, x2, y2, CI_WHITE, VPORT_CLIP);
      }
    }
  }

  renderResearchAndMana(r) {
    const w = this.world;
    const playerSide = w.playerSide;

    // Research button (101) & Progress bar (98) at (261, 0)
    if (w.researchState.subject) {
      const cel = Math.min(7, w.researchState.phase + 1);
      r.drawCel(ANIM_RES.RESEARCH_BAR, cel, 261, 0);
    } else {
      r.drawCel(ANIM_RES.RESEARCH_BTN, 1, 261, 0);
      r.drawText('RESEARCH', 261, 4, {
        fontId: 9050,
        colors: [93, 90, 93, 90, 93, 90],
        maxWidth: 59,
        align: 'center',
      });
    }

    // XP display at (244, 23) — WORLD.CPP AdjustXP (lines 2976-2988)
    const xpVal = w.xp[playerSide] || 0;
    r.drawText(`EXPRNC: ${xpVal}`, 244, 23, {
      fontId: 9050,
      colors: [65, 62, 155, 165, 65, 62],
    });

    // Mana display at (257, 170) — WORLD.CPP AdjustAllMana (lines 7275-7288)
    const manaVal = w.mana[playerSide] || 0;
    r.drawText(`MANA:${manaVal}`, 257, 170, {
      fontId: 9050,
      colors: [64, 74, 154, 151, 64, 74],
    });
  }

  renderMinimap(r) {
    const w = this.world;
    const mx0 = MINIMAP_RECT.x;
    const my0 = MINIMAP_RECT.y;

    // 32x40 tiles -> 2x3 pixels each (64x120)
    for (let ty = 0; ty < WORLD_H; ty++) {
      const py = my0 + ty * 3;
      for (let tx = 0; tx < WORLD_W; tx++) {
        const px = mx0 + tx * 2;
        if (w.isTileFogged(tx, ty)) {
          r.fillRect(px, py, 2, 3, CI_BLACK);
          continue;
        }
        const terr = w.getTerrain(tx, ty);
        const color = terr ? terr.color : 140;
        r.fillRect(px, py, 2, 3, color);
      }
    }

    // Draw units on minimap (RES_ANIM 102: cel 3 = friendly, cel 4 = enemy, cel 6 = obelisk)
    for (const u of w.units) {
      if (u.currHP <= 0 || w.isTileFogged(u.tileX, u.tileY)) continue;
      const ux = mx0 + u.tileX * 2;
      const uy = my0 + u.tileY * 3;
      const isOb = u.state === 'OBELISK' || u.state === 'OBELISKING_TO';
      const cel =
        u.side === w.playerSide
          ? isOb
            ? 6
            : 3
          : 4;
      r.drawCel(ANIM_RES.MINIMAP_ICONS, cel, ux, uy);
    }

    // Draw camera viewport box on minimap (RES_ANIM 102 cel 2)
    const camX = mx0 + Math.max(0, w.viewX) * 2;
    const camY = my0 + Math.max(0, w.viewY) * 3;
    r.drawCel(ANIM_RES.MINIMAP_ICONS, 2, camX, camY, {
      clip: {
        x1: mx0,
        y1: my0,
        x2: mx0 + MINIMAP_RECT.w - 1,
        y2: my0 + MINIMAP_RECT.h - 1,
      },
    });
  }

  renderMainButtons(r) {
    for (const mb of MAIN_BUTTONS) {
      const isDown =
        this.pressedBtnId === mb.id ||
        (mb.id === 'FREEZE' && this.world.isPaused) ||
        (mb.id === 'QUESTION' && this.world.currentVerb === 'QUESTION');
      r.drawCel(mb.anim, isDown ? 2 : 1, mb.x, mb.y);
    }

    // Cover unused Send button slot at (282, 274) with RES_ANIM 115 cel 3 (DG_DISABLED)
    r.drawCel(115, 3, 282, 274, { useOrigin: true });
  }

  /**
   * Mirrors World::DrawGuage (WORLD.CPP lines 6851-6898)
   */
  drawStatGauge(r, label, curr, max, animId, fShowSign, xPos, yPos) {
    // 1. Numeric value in the 9x11 black number box at (xPos, yPos + 2)
    let valStr;
    if (fShowSign && curr !== 0) {
      valStr = `${curr > 0 ? '+' : '-'}${Math.abs(curr)}`;
    } else {
      valStr = `${curr < 10 ? ' ' : ''}${Math.abs(curr)}`;
    }
    const gaugeColors = [155, 165, 65, 62, 155, 165];
    r.drawText(valStr, xPos, yPos + 2, {
      fontId: 9060,
      colors: gaugeColors,
    });

    // 2. 4-char stat label ("ATTK", "DFNS", "MOVE") at (xPos + 12, yPos + 2)
    r.drawText(label, xPos + 12, yPos + 2, {
      fontId: 9060,
      colors: gaugeColors,
    });

    // 3. Individual 5px pip markers starting at (xPos + 30, yPos)
    const markerCount1 = Math.min(9, Math.abs(Math.max(curr, max)));
    const markerCount2 = Math.abs(Math.min(curr, max));
    const bonusMarker = curr < max ? 5 : 4;

    let pixelX = xPos + 30;
    for (let loopX = 0; loopX < markerCount1; loopX++, pixelX += 5) {
      const cel = loopX < markerCount2 ? 1 : bonusMarker;
      r.drawCel(animId, cel, pixelX, yPos);
    }
  }

  renderStatusBox(r) {
    const w = this.world;
    const u = w.selectedUnit;
    const b = w.selectedBuilding;
    const cx = w.cursorX;
    const cy = w.cursorY;
    const fogged = w.isTileFogged(cx, cy);
    const isObelisk = u && (u.state === 'OBELISK' || u.state === 'OBELISKING_TO');

    // 1. Team Banner (RES_ANIM 9004) at (1, 307) — WORLD.CPP DrawBanner (lines 6996-7029)
    let bannerSide = SIDE0;
    if (!fogged) {
      if (u) bannerSide = u.side;
      else if (b) bannerSide = b.owner;
    }
    const bannerCel = bannerSide === SIDE1 ? 2 : bannerSide === SIDE2 ? 3 : 1;
    r.drawCel(ANIM_RES.BANNER, bannerCel, 1, 307, {
      clutStart: r.getClutStartForSide(bannerSide),
    });

    // 2. Target Name at (43, 307) — WORLD.CPP UpdateBoxTitle (lines 6799-6848)
    let title = 'DARKNESS';
    if (!fogged) {
      if (u) {
        title = isObelisk ? 'OBELISK' : u.state === 'TRANSFORMING' ? 'METAPOD' : u.name;
      } else if (b) {
        const terr = w.getTerrain(cx, cy);
        title = terr ? terr.name : 'STRUCTURE';
      } else {
        const terr = w.getTerrain(cx, cy);
        title = terr ? terr.name : 'OPEN LAND';
      }
    }
    r.drawText(title, 43, 307, {
      fontId: 9050,
      colors: [64, 74, 64, 74, 64, 74],
    });

    // 3. Portrait at (0, 320)
    if (w.statBoxMode === 'UNIT' || w.statBoxMode === 'BUILDING') {
      r.drawCel(ANIM_RES.BTN_EXIT_MENU, 1, 0, 320);
    } else if (fogged) {
      r.drawCel(ANIM_RES.PORTRAIT_BLANK, 1, 0, 320);
    } else if (u) {
      const portAnim = isObelisk ? 2652 : u.group.portAnim;
      r.drawCel(portAnim, 1, 0, 320, {
        clutStart: r.getClutStartForSide(u.side),
      });
    } else {
      const terr = w.getTerrain(cx, cy);
      const portAnim = terr && terr.portraitNum ? terr.portraitNum : ANIM_RES.PORTRAIT_BLANK;
      r.drawCel(portAnim, 1, 0, 320, {
        clutStart: b ? r.getTileClutForSide(b.owner) : null,
      });
    }

    // 4. HP Gauge (RES_ANIM 132 at (43, 321)) & Stat Gauges (133, 134, 135)
    // Mirrors World::DrawHPGuage (WORLD.CPP lines 6941-6992)
    if (!fogged && (u || (b && b.maxHP > 0))) {
      const curHP = u ? u.currHP : b.currHP;
      const maxHP = Math.max(1, u ? u.maxHP : b.maxHP);
      const hpSide = u ? u.side : b.owner;
      r.drawCel(ANIM_RES.GAUGE_HP, 1, 43, 321, {
        clutStart: r.getClutStartForSide(hpSide),
      });
      const hpBarLen = Math.min(74, Math.max(0, Math.ceil((curHP / maxHP) * 74)));
      if (hpBarLen < 74) {
        r.fillRect(43 + hpBarLen, 322, 74 - hpBarLen, 11, CI_BLACK);
      }
      r.drawText(`${curHP} HP`, 44, 323, {
        fontId: 9060,
        colors: [155, 165, 65, 62, 155, 165],
        maxWidth: 72,
        align: 'center',
      });
    } else {
      // ClearHPGuage: cover HP bar slot with stone plate (RES_ANIM 116 cel 2 at 40, 319)
      r.drawCel(ANIM_RES.HUD_COVERS, 2, 40, 319, { skipTrans: true });
    }

    if (fogged || (!u && b && b.maxHP > 0)) {
      // ClearAttDefMovGuages: cover stat gauges with stone plate (RES_ANIM 116 cel 3 at 40, 335)
      r.drawCel(ANIM_RES.HUD_COVERS, 3, 40, 335, { skipTrans: true });
    } else if (u) {
      this.drawStatGauge(r, 'ATTK', u.currAttack, u.baseAttack, ANIM_RES.GAUGE_ATT, false, 44, 338);
      this.drawStatGauge(r, 'DFNS', u.currDefense, u.baseDefense, ANIM_RES.GAUGE_DEF, false, 44, 354);
      this.drawStatGauge(r, 'MOVE', u.currMove, u.baseMove, ANIM_RES.GAUGE_MOV, false, 44, 370);
    } else {
      const terr = w.getTerrain(cx, cy);
      if (terr) {
        this.drawStatGauge(r, 'ATTK', terr.attackMod, terr.attackMod, ANIM_RES.GAUGE_ATT, true, 44, 338);
        this.drawStatGauge(r, 'DFNS', terr.defenseMod, terr.defenseMod, ANIM_RES.GAUGE_DEF, true, 44, 354);
        this.drawStatGauge(r, 'MOVE', terr.moveRate, terr.moveRate, ANIM_RES.GAUGE_MOV, false, 44, 370);
      }
    }

    // 5. Transform Submenu OR Verb Buttons
    if (w.statBoxMode === 'UNIT' || w.statBoxMode === 'BUILDING') {
      // Cover the background area of the submenu with RES_ANIM 116 cel 5 at (123, 319)
      r.drawCel(ANIM_RES.HUD_COVERS, 5, 123, 319, { skipTrans: true });
      const options = this.getTransformOptions();
      for (const tb of TRANSFORM_BUTTONS) {
        const opt = options[tb.slot];
        if (!opt) continue;
        if (opt.kind === 'BLDG') {
          r.drawCel(opt.anim, 1, tb.x, tb.y, {
            clutStart: r.getClutStartForSide(w.playerSide),
          });
          r.drawText(opt.name.slice(0, 7), tb.x, tb.y + 50, {
            fontId: 9064,
            colors: [154, 151, 93, 90, 93, 90],
            maxWidth: 37,
            align: 'center',
          });
        } else {
          r.drawCel(opt.portAnim, 1, tb.x, tb.y, {
            clutStart: opt.researched ? r.getClutStartForSide(w.playerSide) : 34,
          });
          const label = opt.researched ? `${opt.cost}` : `${opt.cost}XP`;
          r.drawText(label, tb.x + 1, tb.y + 49, {
            fontId: 9064,
            colors: opt.researched
              ? [154, 151, 93, 90, 93, 90]
              : [64, 74, 93, 90, 93, 90],
          });
        }
      }
    } else {
      // Default empty item slot at (282, 320)
      r.drawCel(ANIM_RES.BTN_ITEM_SLOT, 1, 282, 320);

      for (const vb of VERB_BUTTONS) {
        if (!this.isVerbAvailable(vb.id)) {
          // Every verb button's cel 3 is its exact disabled stone cover plate (DG_DISABLED)
          r.drawCel(vb.anim, 3, vb.x, vb.y, { useOrigin: true });
          continue;
        }

        const isDown =
          this.pressedBtnId === vb.id ||
          w.currentVerb === vb.id ||
          (vb.id === 'GUARD' && isObelisk);

        if (vb.id === 'SKILL' && u && u.type === UNIT_TYPE.ACOLYTE) {
          // Acolyte Transfer button (RES_ANIM 142 at 194, 322, org 2,2 -> 192, 320)
          // Mirrors WORLD.CPP lines 4766-4813
          r.drawCel(ANIM_RES.BTN_ACOLYTE_SKILL, isDown ? 2 : 1, vb.x, vb.y, {
            useOrigin: true,
            clutStart: r.getClutStartForSide(w.playerSide),
          });
          if (!isDown) {
            const acMana = Math.max(0, Math.min(10, u.currMana || 0));
            const fillW = Math.floor((acMana / 10) * 65);
            if (fillW < 65) {
              r.fillRect(197 + fillW, 336, 65 - fillW, 11, CI_BLACK);
            }
            r.drawText(`${acMana} mana`, 192, 339, {
              fontId: 9060,
              colors: [155, 165, 65, 62, 155, 165],
              maxWidth: 90,
              align: 'center',
            });
          }
          r.drawText('TRANSFER', 192, isDown ? 324 : 325, {
            fontId: 9050,
            colors: isDown
              ? [154, 151, 154, 151, 154, 151]
              : [93, 90, 154, 151, 154, 151],
            maxWidth: 90,
            align: 'center',
          });
        } else if (vb.id === 'SKILL') {
          // Regular Unit Skill button (RES_ANIM 108 at 194, 322)
          // Mirrors WORLD.CPP lines 4815-4850
          r.drawCel(vb.anim, isDown ? 2 : 1, vb.x, vb.y, { useOrigin: true });
          const skillName = u && u.type === UNIT_TYPE.GNOME ? 'REPAIR' : 'HEAL';
          const skillCost = u && u.group ? u.group.skillCost || 5 : 5;
          r.drawText(`${skillName}\n${skillCost} mana`, 197, isDown ? 325 : 326, {
            fontId: 9050,
            colors: isDown
              ? [154, 151, 154, 151, 154, 151]
              : [93, 90, 154, 151, 154, 151],
            maxWidth: 80,
            align: 'center',
            lineSpacing: -2,
          });
        } else if (vb.id === 'TRANSFORM') {
          // Transform / Summon button (RES_ANIM 107 at 194, 356)
          // Mirrors WORLD.CPP lines 4852-4913
          r.drawCel(vb.anim, isDown ? 2 : 1, vb.x, vb.y, { useOrigin: true });
          const btnColors = isDown
            ? [154, 151, 154, 151, 154, 151]
            : [93, 90, 154, 151, 154, 151];
          if (b && b.func === FUNC.PORTAL) {
            r.drawText('BASAL GOLEM\n40 mana', 196, isDown ? 359 : 360, {
              fontId: 9050,
              colors: btnColors,
              maxWidth: 81,
              align: 'center',
              lineSpacing: -2,
            });
          } else {
            r.drawText('TRANSFORM', 197, isDown ? 365 : 366, {
              fontId: 9050,
              colors: btnColors,
              maxWidth: 80,
              align: 'center',
            });
          }
        } else {
          r.drawCel(vb.anim, isDown ? 2 : 1, vb.x, vb.y, { useOrigin: true });
        }
      }
    }

    // 6. Bottom Message Line at (4, 389)
    const latestMsg = w.messages[0];
    const statusText = w.currentVerb
      ? `SELECT TARGET FOR ${w.currentVerb} (RIGHT-CLICK TO CANCEL)`
      : latestMsg
      ? latestMsg.text
      : 'READY.';
    r.drawText(statusText, 4, 389, {
      fontId: 9050,
      colors: [64, 74, 64, 74, 64, 74],
    });
  }

  renderMouseCursor(r) {
    let cel = CURSOR_CEL.HAND;
    if (this.world.currentVerb === 'MOVE') cel = CURSOR_CEL.MOVE;
    else if (this.world.currentVerb === 'ATTACK') cel = CURSOR_CEL.ATTACK;
    else if (this.world.currentVerb === 'SKILL') cel = CURSOR_CEL.SKILL;
    else if (this.world.currentVerb === 'QUESTION') cel = CURSOR_CEL.QUESTION;

    r.drawCel(ANIM_RES.CURSOR, cel, this.mouseX, this.mouseY, {
      useOrigin: cel !== CURSOR_CEL.HAND,
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new BamGameApp();
  app.init();
});

