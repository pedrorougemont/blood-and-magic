// Core World Simulation: Map, Clusters, Fog of War, Pathfinding, Units, Combat, Research, and AI
import {
  WORLD_W,
  WORLD_H,
  TICKS_PER_SEC,
  SIDE0,
  SIDE1,
  SIDE2,
  SIDE3,
  FOG_SOUTH,
  FOG_EAST,
  FOG_NORTH,
  FOG_WEST,
  FOG_CENTER,
  DIR,
  DIR_DELTAS,
  ANIM_OFF,
  ANIM_RES,
  UNIT_TYPE,
  FUNC,
  HP_PER_TILE,
  TERRAIN,
  BUILDING_UNITS,
  FOUNDATION_BLDG_OPTIONS,
  MANA,
  SND,
  UNIT_SELECT_SND,
} from './constants.js';
import { TILE_W, TILE_H } from './renderer.js';

// Exact movement tables from SRC/UNITS.CPP lines 6432-6436:
// move2ticks[currMove] = ticks between motion steps & walk animation cels
// move2steps[currMove] = horizontal pixels advanced per motion step (out of 20)
const MOVE_2_TICKS = [0, 4, 3, 3, 2, 1, 1, 1, 1, 1, 1];
const MOVE_2_STEPS = [0, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4];

export class BamWorld {
  constructor(tilesetMeta, squibs, sfx) {
    this.tileset = tilesetMeta;
    this.squibs = squibs;
    this.sfx = sfx;

    this.mapId = 9110;
    this.playerSide = SIDE1;
    this.enemySide = SIDE2;

    this.ticks = 1;
    this.isPaused = false;
    this.useFog = true;
    this.winnerSide = null;

    this.viewX = 0;
    this.viewY = 0;
    this.cursorX = 0;
    this.cursorY = 0;

    this.mapTiles = new Int16Array(WORLD_W * WORLD_H);
    this.mapSpaces = new Int16Array(WORLD_W * WORLD_H);
    this.spaces = [];
    this.fog = new Uint8Array(WORLD_W * WORLD_H);
    this.fogTile = 475;

    this.unitGroups = new Map();
    this.units = [];
    this.unitGrid = new Array(WORLD_W * WORLD_H).fill(null);
    this.projectiles = [];
    this.effects = [];
    this.bgAnims = [];
    this.items = new Map(); // key `${x},${y}` -> { type, name, anim }

    this.mana = { [SIDE1]: MANA.SUMMON, [SIDE2]: MANA.SUMMON };
    this.xp = { [SIDE1]: 50, [SIDE2]: 50 };
    this.researched = { [SIDE1]: new Set(), [SIDE2]: new Set() };
    this.researchState = {
      subject: 0,
      phase: 0,
      nextTick: 0,
      phaseTicks: 30,
    };

    this.portalCoords = { [SIDE1]: [5, 32], [SIDE2]: [26, 6] };
    this.winConditions = [];
    this.swapSeries = [];

    this.nextSerial = 1;
    this.selectedUnit = null;
    this.selectedBuilding = null;
    this.selectedGroup = [];
    this.statBoxMode = 'TERRAIN'; // 'TERRAIN' | 'UNIT' | 'BUILDING' | 'TRANSFORMING'
    this.currentVerb = null; // null | 'MOVE' | 'ATTACK' | 'SKILL' | 'QUESTION'

    this.messages = [];
    this.lastEventCoords = null;
    this.aiNextTick = 40;
  }

  loadScenario(mapData) {
    this.mapId = mapData.mapId;
    this.ticks = 1;
    this.isPaused = false;
    this.winnerSide = null;
    this.nextSerial = 1;
    this.units = [];
    this.unitGrid.fill(null);
    this.projectiles = [];
    this.effects = [];
    this.bgAnims = [];
    this.items.clear();
    this.selectedUnit = null;
    this.selectedBuilding = null;
    this.selectedGroup = [];
    this.statBoxMode = 'TERRAIN';
    this.currentVerb = null;
    this.messages = [];

    this.mana = { [SIDE1]: MANA.SUMMON, [SIDE2]: MANA.SUMMON };
    this.xp = { [SIDE1]: 50, [SIDE2]: 50 };
    this.researched = { [SIDE1]: new Set(), [SIDE2]: new Set() };
    this.researchState = { subject: 0, phase: 0, nextTick: 0, phaseTicks: 30 };

    // Copy tiles & space indices
    for (let i = 0; i < 1280; i++) {
      this.mapTiles[i] = mapData.mapTiles[i];
      this.mapSpaces[i] = mapData.mapSpaces[i];
    }

    // Find fogTile
    for (let i = 0; i < this.tileset.tiles.length; i++) {
      if (this.tileset.tiles[i].terrain === TERRAIN.FOG_TERR) {
        this.fogTile = i;
        break;
      }
    }

    // Load Unit Groups from #UNITLIB
    this.unitGroups.clear();
    for (const u of mapData.parsedConfig.unitLib) {
      this.unitGroups.set(u.typeId, u);
      if (u.expRequired === 0) {
        this.researched[SIDE1].add(u.typeId);
        this.researched[SIDE2].add(u.typeId);
      }
    }

    this.swapSeries = mapData.parsedConfig.swapSeries || [];
    this.winConditions = mapData.parsedConfig.winConditions || [];

    // Initialize MapSpaces & FixupClusters (SRC/MAPS.CPP lines 122-385)
    this.spaces = mapData.spaces.map((s) => ({
      ...s,
      serialNum: this.nextSerial++,
      currHP: 0,
      tiles: [],
      fFoundationFilled: false,
    }));

    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const spIdx = this.mapSpaces[x + y * WORLD_W];
        if (spIdx > 0 && this.spaces[spIdx]) {
          const sp = this.spaces[spIdx];
          sp.tiles.push([x, y]);
        }
      }
    }

    for (let i = 1; i < this.spaces.length; i++) {
      const sp = this.spaces[i];
      if (!sp || sp.tiles.length === 0) continue;
      sp.xPos = sp.tiles[0][0];
      sp.yPos = sp.tiles[0][1];

      if (sp.func >= FUNC.ARBOR_FOUND && sp.func <= FUNC.TEMPLE_FOUND) {
        sp.func = FUNC.GEN_FOUND;
      }

      if (sp.func === FUNC.MISC) {
        for (const [tx, ty] of sp.tiles) {
          const terr = this.getTerrainNum(tx, ty);
          if (terr === TERRAIN.WELL_OF_IMMORTALS) sp.func = FUNC.IMM_WELL;
          else if (
            terr >= TERRAIN.FOUND_ARBORLODGE &&
            terr <= TERRAIN.FOUND_TEMPLE
          )
            sp.func = FUNC.GEN_FOUND;
          else if (terr === TERRAIN.FOUND_GENERIC) sp.func = FUNC.GEN_FOUND;
          else if (terr === TERRAIN.KEEP) sp.func = FUNC.KEEP;
          else if (terr === TERRAIN.GATE) sp.func = FUNC.GATE;
          else if (terr === TERRAIN.AQUEDUCT) sp.func = FUNC.AQUEDUCT;
          else if (terr === TERRAIN.CAULDRON) sp.func = FUNC.CAULDRON;
          else if (terr === TERRAIN.CAMP) sp.func = FUNC.CAMP;
          if (sp.func !== FUNC.MISC) break;
        }
      }

      if (sp.func === FUNC.GEN_FOUND) {
        sp.owner = SIDE0;
        sp.maxHP = 0;
        sp.currHP = 0;
      } else if (sp.maxHP > 0) {
        sp.currHP = sp.maxHP;
      }

      if (sp.func === FUNC.PORTAL) {
        this.portalCoords[sp.owner] = [sp.xPos, sp.yPos];
      }
    }

    // Background cosmetic animations from #ANIM (SRC/WORLD.CPP line 3371)
    for (const a of mapData.parsedConfig.anims || []) {
      const side = a.side === 'SIDE1' ? SIDE1 : a.side === 'SIDE2' ? SIDE2 : SIDE0;
      this.bgAnims.push({
        resNum: a.resNum,
        cel: 1,
        x: a.x,
        y: a.y,
        speed: Math.max(1, a.speed || 3),
        nextTick: 1,
        side,
        pri: a.pri || 10,
      });
    }

    // Portal animations on PORTAL terrain tiles (SRC/WORLD.CPP lines 3115-3137)
    // Note: pTile->aniRes loop is commented out in SRC/WORLD.CPP lines 3096-3113
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const t = this.getTile(x, y);
        const sp = this.getStructure(x, y);
        if (t && t.terrain === TERRAIN.PORTAL) {
          const owner = sp ? sp.owner : SIDE0;
          if (owner === SIDE1 || owner === SIDE2) {
            this.portalCoords[owner] = [x, y];
          }
          this.bgAnims.push({
            resNum: ANIM_RES.PORTAL,
            cel: 1,
            x,
            y,
            speed: 2,
            nextTick: 1,
            side: owner,
            pri: -50,
          });
        }
      }
    }

    // Initialize Fog of War
    this.fog.fill(this.useFog ? FOG_CENTER : 0);
    this.defogAll(this.playerSide);

    // Spawn starter units from #UNITS
    this.spawnStarterUnits(mapData.parsedConfig.units || []);

    // Center camera on Player Portal (SRC/WORLD.CPP lines 3132-3146)
    const [px, py] = this.portalCoords[this.playerSide] || [29, 37];
    this.centerCameraOn(px, py);
    this.moveCursor(px, py);

    this.addMessage(
      this.mapId === 9110
        ? 'STAGE 1: DESTROY THE ENEMY UNDEAD CRYPT!'
        : 'STAGE 1: DESTROY THE ENEMY BARRACKS!',
      px,
      py
    );
  }

  getTileNum(x, y) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return 0;
    return this.mapTiles[x + y * WORLD_W];
  }

  setTileNum(x, y, tileNum) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
    this.mapTiles[x + y * WORLD_W] = tileNum;
  }

  getTile(x, y) {
    const tn = this.getTileNum(x, y);
    return this.tileset.tiles[tn] || this.tileset.tiles[0];
  }

  getTerrainNum(x, y) {
    const tile = this.getTile(x, y);
    return tile ? tile.terrain : 0;
  }

  getTerrain(x, y) {
    const tIdx = this.getTerrainNum(x, y);
    return this.tileset.terrains[tIdx] || this.tileset.terrains[0];
  }

  getStructure(x, y) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return null;
    const idx = this.mapSpaces[x + y * WORLD_W];
    if (!idx) return null;
    return this.spaces[idx] || null;
  }

  getUnitAt(x, y) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return null;
    return this.unitGrid[x + y * WORLD_W];
  }

  // Fog of War Defogger (SRC/VIEWPORT.CPP lines 4384-4488)
  defogAll(side) {
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const sp = this.getStructure(x, y);
        if (sp && sp.owner === side) {
          this.defogRect(x - 2, y - 2, x + 2, y + 2);
        }
      }
    }
    for (const u of this.units) {
      if (u.side === side && u.currHP > 0) {
        this.defogRect(u.tileX - 3, u.tileY - 3, u.tileX + 3, u.tileY + 3);
      }
    }
  }

  defogRect(x1, y1, x2, y2) {
    const minX = Math.max(0, x1);
    const maxX = Math.min(WORLD_W - 1, x2);
    const minY = Math.max(0, y1);
    const maxY = Math.min(WORLD_H - 1, y2);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.fog[x + y * WORLD_W] &= ~FOG_CENTER;
      }
    }

    // Recompute 4-neighbor partial fog flags around revealed area
    const rx1 = Math.max(0, minX - 1);
    const rx2 = Math.min(WORLD_W - 1, maxX + 1);
    const ry1 = Math.max(0, minY - 1);
    const ry2 = Math.min(WORLD_H - 1, maxY + 1);

    for (let y = ry1; y <= ry2; y++) {
      for (let x = rx1; x <= rx2; x++) {
        const idx = x + y * WORLD_W;
        if (this.fog[idx] & FOG_CENTER) continue;
        let bits = 0;
        if (x > 0 && (this.fog[x - 1 + y * WORLD_W] & FOG_CENTER)) bits |= FOG_WEST;
        if (x < WORLD_W - 1 && (this.fog[x + 1 + y * WORLD_W] & FOG_CENTER)) bits |= FOG_EAST;
        if (y > 0 && (this.fog[x + (y - 1) * WORLD_W] & FOG_CENTER)) bits |= FOG_NORTH;
        if (y < WORLD_H - 1 && (this.fog[x + (y + 1) * WORLD_W] & FOG_CENTER)) bits |= FOG_SOUTH;
        this.fog[idx] = bits;
      }
    }
  }

  isTileFogged(x, y) {
    if (!this.useFog) return false;
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return true;
    return (this.fog[x + y * WORLD_W] & FOG_CENTER) !== 0;
  }

  findUnitTypeByName(name) {
    const clean = name.replace(/_/g, ' ').toUpperCase();
    for (const [id, g] of this.unitGroups.entries()) {
      if (g.internalName.toUpperCase() === clean || g.name.toUpperCase() === clean) {
        return id;
      }
    }
    return UNIT_TYPE.ACOLYTE;
  }

  getBldgTypeForUnit(typeId) {
    switch (typeId) {
      case UNIT_TYPE.ACOLYTE:
        return FUNC.PORTAL;
      case UNIT_TYPE.ZOMBIE:
      case UNIT_TYPE.GARGOYLE:
      case UNIT_TYPE.GHOUL:
      case UNIT_TYPE.WRAITH:
        return FUNC.CRYPT;
      case UNIT_TYPE.WARRIOR:
      case UNIT_TYPE.RANGER:
      case UNIT_TYPE.CRUSADER_RANGER:
      case UNIT_TYPE.PALADIN:
        return FUNC.BARRACKS;
      case UNIT_TYPE.DRUID:
      case UNIT_TYPE.GRIFFIN:
      case UNIT_TYPE.NYMPH:
        return FUNC.ARBORLODGE;
      case UNIT_TYPE.CLERIC:
      case UNIT_TYPE.FURY:
        return FUNC.TEMPLE;
      case UNIT_TYPE.WIZARD:
      case UNIT_TYPE.GNOME:
      case UNIT_TYPE.GOLEM:
      case UNIT_TYPE.WYRM:
        return FUNC.RUNESTONE;
      default:
        return FUNC.PORTAL;
    }
  }

  spawnStarterUnits(unitLines) {
    for (const uDef of unitLines) {
      const typeId = this.findUnitTypeByName(uDef.unitName);
      const side = uDef.side === 1 ? SIDE1 : uDef.side === 2 ? SIDE2 : SIDE0;
      const isSleep = uDef.extra === 'SLEEP';

      let baseX = 5;
      let baseY = 5;
      if (uDef.loc && uDef.loc !== 'DEFAULT' && uDef.loc.includes(',')) {
        const [lx, ly] = uDef.loc.split(',').map((n) => parseInt(n, 10));
        baseX = lx;
        baseY = ly;
      } else {
        const bldgFunc = this.getBldgTypeForUnit(typeId);
        let found = null;
        for (const sp of this.spaces) {
          if (sp && sp.owner === side && sp.func === bldgFunc && sp.tiles.length > 0) {
            found = sp;
            break;
          }
        }
        if (!found && this.portalCoords[side]) {
          baseX = this.portalCoords[side][0];
          baseY = this.portalCoords[side][1];
        } else if (found) {
          baseX = found.xPos;
          baseY = found.yPos;
        }
      }

      for (let c = 0; c < uDef.count; c++) {
        const spot = this.findOpenSpotNear(baseX, baseY, typeId);
        if (spot) {
          const unit = this.createUnit(typeId, side, spot[0], spot[1]);
          if (isSleep) unit.standGuard = true;
          // In SRC/WORLD.CPP line 4180, all starter units receive an initial GUARD order
          this.orderGuard(unit, true);
        }
      }
    }
  }

  findOpenSpotNear(cx, cy, typeId) {
    const group = this.unitGroups.get(typeId);
    for (let r = 0; r <= 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (this.canUnitEnterTile(group, x, y, true)) {
            return [x, y];
          }
        }
      }
    }
    return null;
  }

  canUnitEnterTile(group, x, y, checkUnits = true) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return false;
    if (checkUnits && this.getUnitAt(x, y)) return false;

    const sp = this.getStructure(x, y);
    if (sp && sp.currHP > 0 && sp.func !== FUNC.PORTAL) {
      return false;
    }

    const terrIdx = this.getTerrainNum(x, y);
    const terr = this.tileset.terrains[terrIdx];
    if (!terr) return false;

    if (group && group.movement === 'F') {
      return terrIdx !== TERRAIN.OBSTRUCTION;
    }
    if (
      terrIdx === TERRAIN.CHASM ||
      terrIdx === TERRAIN.WATER ||
      terrIdx === TERRAIN.OBSTRUCTION ||
      terrIdx === TERRAIN.WALL ||
      terrIdx === TERRAIN.GREAT_WALL ||
      terrIdx === TERRAIN.KEEP ||
      terrIdx === TERRAIN.BARRACKS ||
      terrIdx === TERRAIN.CRYPT ||
      terrIdx === TERRAIN.ARBOR_LODGE ||
      terrIdx === TERRAIN.RUNESTONE ||
      terrIdx === TERRAIN.TEMPLE
    ) {
      return false;
    }
    const moveRate = (group ? group.baseMoveRate : 3) - terr.moveRate;
    return moveRate > 0;
  }

  createUnit(typeId, side, x, y) {
    const group = this.unitGroups.get(typeId);
    const unit = {
      serialNum: this.nextSerial++,
      type: typeId,
      group,
      name: group.name,
      side,
      tileX: x,
      tileY: y,
      tileXOff: 9,
      tileYOff: 18,
      dir: DIR.DOWN,
      currHP: group.maxHP,
      maxHP: group.maxHP,
      currMana: typeId === UNIT_TYPE.ACOLYTE ? 10 : 0,
      baseAttack: group.baseAttack,
      baseDefense: group.baseDefense,
      baseRange: group.baseAttackRange,
      baseMove: group.baseMoveRate,
      currAttack: group.baseAttack,
      currDefense: group.baseDefense,
      currRange: group.baseAttackRange,
      currMove: group.baseMoveRate,
      state: 'IDLE', // 'IDLE' | 'MOVING' | 'OBELISKING_TO' | 'OBELISK' | 'OBELISKING_FROM' | 'ATTACKING' | 'TRANSFORMING' | 'DYING'
      primaryAction: 'NONE', // 'NONE' | 'MOVE' | 'ATTACK' | 'GUARD' | 'TRANSFORM'
      targetX: x,
      targetY: y,
      targetUnit: null,
      targetBldg: null,
      stepIndex: 0,
      nextMoveStepTick: 0,
      nextStepX: x,
      nextStepY: y,
      path: [],
      animRes: group.baseAnim + ANIM_OFF.WALK,
      animCel: 1,
      animFwd: true,
      animHFlip: false,
      animDelay: 0,
      animLoop: false,
      nextAnimTick: this.ticks + 3,
      nextActionTick: this.ticks + 5,
      nextManaTick: this.ticks + TICKS_PER_SEC * 6,
      transformTargetType: 0,
      transformEndTick: 0,
      nearbyTransformer: FUNC.MISC,
      standGuard: false,
    };

    this.units.push(unit);
    this.unitGrid[x + y * WORLD_W] = unit;
    this.updateUnitTerrainStats(unit);
    this.checkUnitTransformer(unit);
    if (side === this.playerSide) {
      this.defogRect(x - 3, y - 3, x + 3, y + 3);
    }
    return unit;
  }

  updateUnitTerrainStats(unit) {
    const terr = this.getTerrain(unit.tileX, unit.tileY);
    const g = unit.group;
    if (g.movement === 'W' && terr) {
      unit.currAttack = Math.max(1, g.baseAttack - terr.attackMod);
      unit.currDefense = Math.max(0, g.baseDefense + terr.defenseMod);
      unit.currMove = Math.max(1, g.baseMoveRate - terr.moveRate);
    } else {
      unit.currAttack = g.baseAttack;
      unit.currDefense = g.baseDefense;
      unit.currMove = Math.max(1, g.baseMoveRate);
    }
  }

  checkUnitTransformer(unit) {
    unit.nearbyTransformer = FUNC.MISC;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const sp = this.getStructure(unit.tileX + dx, unit.tileY + dy);
        if (
          sp &&
          sp.owner === unit.side &&
          sp.currHP > 0 &&
          BUILDING_UNITS[sp.func] &&
          sp.func !== FUNC.PORTAL
        ) {
          unit.nearbyTransformer = sp.func;
          return sp;
        }
      }
    }
    return null;
  }

  checkFoundationFilled(sp) {
    if (!sp || sp.func !== FUNC.GEN_FOUND || sp.tiles.length === 0) return false;
    let side = null;
    for (const [tx, ty] of sp.tiles) {
      const u = this.getUnitAt(tx, ty);
      if (!u || u.type !== UNIT_TYPE.ACOLYTE || u.state !== 'OBELISK' || u.currHP <= 0) {
        sp.fFoundationFilled = false;
        return false;
      }
      if (side === null) side = u.side;
      else if (u.side !== side) {
        sp.fFoundationFilled = false;
        return false;
      }
    }
    sp.fFoundationFilled = true;
    return true;
  }

  buildFromFoundation(sp, bldgOption, side) {
    if (!this.checkFoundationFilled(sp)) return false;

    // Remove the 4 Obelisk Basal Golems on the foundation
    for (const [tx, ty] of sp.tiles) {
      const u = this.getUnitAt(tx, ty);
      if (u) {
        this.removeUnit(u);
        this.spawnEffect(ANIM_RES.TRANSFORM_POOF, tx, ty, 3);
      }
    }

    // Find matching swapSeries row
    const firstTile = this.getTileNum(sp.tiles[0][0], sp.tiles[0][1]);
    let targetStartTile = 0;
    for (const row of this.swapSeries) {
      if (row[0] === firstTile && row[bldgOption.swapIdx]) {
        targetStartTile = row[bldgOption.swapIdx];
        break;
      }
    }
    if (!targetStartTile && this.swapSeries.length > 0) {
      targetStartTile = this.swapSeries[0][bldgOption.swapIdx] || firstTile;
    }

    for (let i = 0; i < sp.tiles.length; i++) {
      const [tx, ty] = sp.tiles[i];
      if (targetStartTile) {
        this.setTileNum(tx, ty, targetStartTile + i);
      }
    }

    sp.owner = side;
    sp.func = bldgOption.func;
    sp.maxHP = (HP_PER_TILE[bldgOption.func] || 75) * sp.tiles.length;
    sp.currHP = sp.maxHP;
    sp.fFoundationFilled = false;

    this.xp[side] = Math.min(99999, (this.xp[side] || 0) + 250);
    this.sfx.launchPositional(SND.BELL_TOLL, sp.xPos, sp.yPos, this.viewX, this.viewY);

    // Update nearby units' transformer state
    for (const u of this.units) {
      if (u.side === side) this.checkUnitTransformer(u);
    }

    this.statBoxMode = 'TERRAIN';
    this.selectedUnit = null;
    this.selectedBuilding = sp;
    this.addMessage(`${bldgOption.name} CONSTRUCTED! (+250 XP)`, sp.xPos, sp.yPos);
    return true;
  }

  setUnitAnim(unit, animType, dir = unit.dir) {
    unit.dir = dir;
    const base = unit.group.baseAnim;
    let hFlip = false;
    let dOff = dir;
    if (dir === DIR.UP_LEFT) {
      dOff = DIR.UP_RIGHT;
      hFlip = true;
    } else if (dir === DIR.LEFT) {
      dOff = DIR.RIGHT;
      hFlip = true;
    } else if (dir === DIR.DOWN_LEFT) {
      dOff = DIR.DOWN_RIGHT;
      hFlip = true;
    }

    unit.animFwd = true;

    if (animType === 'IDLE') {
      unit.animRes = base + ANIM_OFF.WALK + dOff;
      unit.animHFlip = hFlip;
      unit.animLoop = false;
      unit.animDelay = 0; // Hold still on cel 1 (SRC/WORLD.CPP line 4156)
      unit.animCel = 1;
    } else if (animType === 'WALK') {
      unit.animRes = base + ANIM_OFF.WALK + dOff;
      unit.animHFlip = hFlip;
      unit.animLoop = true;
      const cm = Math.max(1, Math.min(10, unit.currMove));
      unit.animDelay = MOVE_2_TICKS[cm]; // Exact walk cycle speed (SRC/UNITS.CPP line 12555)
      unit.animCel = 1;
    } else if (animType === 'ATTACK') {
      unit.animRes = base + ANIM_OFF.ATTACK + dOff;
      unit.animHFlip = hFlip;
      unit.animLoop = false;
      unit.animDelay = 3;
      unit.animCel = 1;
    } else if (animType === 'TO_OBELISK') {
      // Forward 8-cel Basal Golem -> Obelisk transformation (RES_ANIM 534)
      const startCel =
        unit.animRes === base + ANIM_OFF.TO_OBELISK && unit.animCel > 1 ? unit.animCel : 1;
      unit.animRes = base + ANIM_OFF.TO_OBELISK;
      unit.animHFlip = false;
      unit.animFwd = true;
      unit.animLoop = false;
      unit.animDelay = 3;
      unit.animCel = startCel;
    } else if (animType === 'FROM_OBELISK') {
      // Reverse 8-cel Obelisk -> Basal Golem transformation (SRC/UNITS.CPP line 5611)
      const startCel =
        unit.animRes === base + ANIM_OFF.TO_OBELISK && unit.animCel >= 1 ? unit.animCel : 8;
      unit.animRes = base + ANIM_OFF.TO_OBELISK;
      unit.animHFlip = false;
      unit.animFwd = false;
      unit.animLoop = false;
      unit.animDelay = 3;
      unit.animCel = startCel;
    } else if (animType === 'GUARD') {
      unit.animRes = base + ANIM_OFF.GUARD;
      unit.animHFlip = false;
      unit.animLoop = false;
      unit.animDelay = 4;
      unit.animCel = 1;
    } else if (animType === 'METAPOD') {
      unit.animRes = ANIM_RES.METAPOD;
      unit.animHFlip = false;
      unit.animLoop = true;
      unit.animDelay = 3;
      unit.animCel = 1;
    } else if (animType === 'DIE') {
      if (unit.state === 'TRANSFORMING') {
        unit.animRes = ANIM_RES.METAPOD_DIES;
      } else if (
        unit.type === UNIT_TYPE.ACOLYTE &&
        (unit.state === 'OBELISK' || unit.state === 'OBELISKING_TO')
      ) {
        unit.animRes = ANIM_RES.OBELISK_DIES;
      } else {
        unit.animRes = base + ANIM_OFF.DIES;
      }
      unit.animHFlip = false;
      unit.animLoop = false;
      unit.animDelay = 3;
      unit.animCel = 1;
    }
    unit.nextAnimTick = this.ticks + Math.max(1, unit.animDelay);
  }

  getDirection(dx, dy) {
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    if (sx === 0 && sy > 0) return DIR.DOWN;
    if (sx > 0 && sy > 0) return DIR.DOWN_RIGHT;
    if (sx > 0 && sy === 0) return DIR.RIGHT;
    if (sx > 0 && sy < 0) return DIR.UP_RIGHT;
    if (sx === 0 && sy < 0) return DIR.UP;
    if (sx < 0 && sy < 0) return DIR.UP_LEFT;
    if (sx < 0 && sy === 0) return DIR.LEFT;
    if (sx < 0 && sy > 0) return DIR.DOWN_LEFT;
    return DIR.DOWN;
  }

  // A* Pathfinding on 32x40 grid
  findPath(unit, destX, destY, stopAdjacent = false) {
    const sx = unit.tileX;
    const sy = unit.tileY;
    if (sx === destX && sy === destY) return [];

    const maxNodes = 650;
    const open = [{ x: sx, y: sy, g: 0, f: Math.hypot(destX - sx, destY - sy), parent: null }];
    const visited = new Uint8Array(WORLD_W * WORLD_H);
    visited[sx + sy * WORLD_W] = 1;

    let bestNode = open[0];
    let bestDist = Math.hypot(destX - sx, destY - sy);
    let iterations = 0;

    while (open.length > 0 && iterations++ < maxNodes) {
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const cur = open.splice(bestIdx, 1)[0];

      const distToGoal = Math.max(Math.abs(destX - cur.x), Math.abs(destY - cur.y));
      if (distToGoal === 0 || (stopAdjacent && distToGoal <= 1)) {
        bestNode = cur;
        break;
      }
      if (distToGoal < bestDist) {
        bestDist = distToGoal;
        bestNode = cur;
      }

      for (const [dx, dy] of DIR_DELTAS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
        const idx = nx + ny * WORLD_W;
        if (visited[idx]) continue;

        const isGoal = nx === destX && ny === destY;
        const occupant = this.getUnitAt(nx, ny);
        const allowOccupied = occupant && occupant.side === unit.side && occupant.state === 'MOVING';
        if (!this.canUnitEnterTile(unit.group, nx, ny, !allowOccupied && !isGoal)) continue;
        if (isGoal && occupant) continue;

        visited[idx] = 1;
        const stepCost = dx !== 0 && dy !== 0 ? 1.35 : 1.0;
        const g = cur.g + stepCost;
        const h = Math.hypot(destX - nx, destY - ny);
        open.push({ x: nx, y: ny, g, f: g + h, parent: cur });
      }
    }

    const path = [];
    let node = bestNode;
    while (node && node.parent) {
      path.push([node.x, node.y]);
      node = node.parent;
    }
    path.reverse();
    return path.slice(0, 36);
  }

  // EndGuardMode from SRC/UNITS.CPP lines 5600-5677:
  // Plays reverse Obelisk -> Basal Golem animation (cel 8 down to 1) before allowing movement.
  endGuardMode(unit) {
    if (!unit || unit.type !== UNIT_TYPE.ACOLYTE) return;
    if (unit.state === 'OBELISK' || unit.state === 'OBELISKING_TO') {
      unit.state = 'OBELISKING_FROM';
      this.setUnitAnim(unit, 'FROM_OBELISK');
      const sp = this.getStructure(unit.tileX, unit.tileY);
      if (sp && sp.func === FUNC.GEN_FOUND) {
        this.checkFoundationFilled(sp);
      }
    }
  }

  // Command Orders
  orderMove(unit, tx, ty) {
    if (!unit || unit.currHP <= 0 || unit.state === 'DYING' || unit.state === 'TRANSFORMING') return;
    unit.standGuard = false;
    unit.primaryAction = 'MOVE';
    unit.targetX = Math.max(0, Math.min(WORLD_W - 1, tx));
    unit.targetY = Math.max(0, Math.min(WORLD_H - 1, ty));
    unit.targetUnit = null;
    unit.targetBldg = null;
    unit.path = this.findPath(unit, unit.targetX, unit.targetY, false);

    if (unit.type === UNIT_TYPE.ACOLYTE && (unit.state === 'OBELISK' || unit.state === 'OBELISKING_TO')) {
      this.endGuardMode(unit);
    } else if (unit.state !== 'MOVING' && unit.state !== 'OBELISKING_FROM') {
      unit.state = 'IDLE';
    }
  }

  orderAttackUnit(unit, enemyUnit) {
    if (!unit || !enemyUnit || unit.currHP <= 0 || unit.state === 'TRANSFORMING') return;
    unit.standGuard = false;
    unit.primaryAction = 'ATTACK';
    unit.targetUnit = enemyUnit;
    unit.targetBldg = null;
    unit.targetX = enemyUnit.tileX;
    unit.targetY = enemyUnit.tileY;
    unit.path = this.findPath(unit, enemyUnit.tileX, enemyUnit.tileY, true);
    if (unit.type === UNIT_TYPE.ACOLYTE && (unit.state === 'OBELISK' || unit.state === 'OBELISKING_TO')) {
      this.endGuardMode(unit);
    }
  }

  orderAttackBuilding(unit, bldg, tx, ty) {
    if (!unit || !bldg || unit.currHP <= 0 || unit.state === 'TRANSFORMING') return;
    unit.standGuard = false;
    unit.primaryAction = 'ATTACK';
    unit.targetUnit = null;
    unit.targetBldg = bldg;
    unit.targetX = tx ?? bldg.xPos;
    unit.targetY = ty ?? bldg.yPos;
    unit.path = this.findPath(unit, unit.targetX, unit.targetY, true);
    if (unit.type === UNIT_TYPE.ACOLYTE && (unit.state === 'OBELISK' || unit.state === 'OBELISKING_TO')) {
      this.endGuardMode(unit);
    }
  }

  orderGuard(unit, forceToObelisk = false) {
    if (!unit || unit.currHP <= 0 || unit.state === 'DYING' || unit.state === 'TRANSFORMING') return;
    unit.path = [];
    unit.tileXOff = 9;
    unit.tileYOff = 18;
    if (unit.type === UNIT_TYPE.ACOLYTE) {
      // Toggle back to Basal Golem if already in Obelisk mode (unless forced on startup)
      if (!forceToObelisk && (unit.state === 'OBELISK' || unit.state === 'OBELISKING_TO')) {
        unit.primaryAction = 'NONE';
        this.endGuardMode(unit);
        return;
      }
      unit.primaryAction = 'GUARD';
      unit.state = 'OBELISKING_TO';
      this.setUnitAnim(unit, 'TO_OBELISK');
    } else {
      unit.primaryAction = 'GUARD';
      unit.state = 'IDLE';
      this.setUnitAnim(unit, 'GUARD');
    }
  }

  orderDisband(unit) {
    if (!unit || unit.currHP <= 0) return;
    this.mana[unit.side] = Math.min(MANA.MAX, this.mana[unit.side] + MANA.DISBAND);
    this.sfx.launchPositional(SND.DISBAND, unit.tileX, unit.tileY, this.viewX, this.viewY);
    this.spawnEffect(ANIM_RES.DISBAND_FX, unit.tileX, unit.tileY, 3);
    this.removeUnit(unit);
  }

  orderSkill(unit, targetX = null, targetY = null) {
    if (!unit || unit.currHP <= 0) return false;
    if (unit.type === UNIT_TYPE.ACOLYTE) {
      // Transfer stored Mana from Basal Golem / Obelisk to Player Mana pool
      const transfer = Math.min(unit.currMana, 10);
      if (transfer <= 0) {
        this.sfx.play(SND.ERROR, 0.7);
        return false;
      }
      unit.currMana -= transfer;
      this.mana[unit.side] = Math.min(MANA.MAX, this.mana[unit.side] + transfer);
      this.spawnEffect(ANIM_RES.MANA_TRANSFER, unit.tileX, unit.tileY, 3);
      const [px, py] = this.portalCoords[unit.side] || [unit.tileX, unit.tileY];
      this.spawnEffect(ANIM_RES.MANA_RECEIVE, px, py, 3);
      this.sfx.launchPositional(SND.MAGICAL_ENERGY, unit.tileX, unit.tileY, this.viewX, this.viewY);
      return true;
    }

    // Cleric / Paladin Heal or Gnome Repair
    const cost = unit.group.skillCost || 5;
    if (this.mana[unit.side] < cost) {
      this.sfx.play(SND.ERROR, 0.7);
      this.addMessage('NOT ENOUGH MANA!', unit.tileX, unit.tileY);
      return false;
    }

    const tx = targetX ?? unit.tileX;
    const ty = targetY ?? unit.tileY;
    const tUnit = this.getUnitAt(tx, ty);
    const tBldg = this.getStructure(tx, ty);

    if (tUnit && tUnit.side === unit.side && tUnit.currHP < tUnit.maxHP) {
      this.mana[unit.side] -= cost;
      tUnit.currHP = Math.min(tUnit.maxHP, tUnit.currHP + 12);
      this.spawnEffect(ANIM_RES.HEAL_REPAIR, tUnit.tileX, tUnit.tileY, 3);
      this.sfx.launchPositional(SND.HEAL_REPAIR, tUnit.tileX, tUnit.tileY, this.viewX, this.viewY);
      this.xp[unit.side] += 5;
      return true;
    }

    if (tBldg && tBldg.owner === unit.side && tBldg.currHP > 0 && tBldg.currHP < tBldg.maxHP) {
      this.mana[unit.side] -= cost;
      tBldg.currHP = Math.min(tBldg.maxHP, tBldg.currHP + 35);
      this.spawnEffect(ANIM_RES.HEAL_REPAIR, tx, ty, 3);
      this.sfx.launchPositional(SND.HEAL_REPAIR, tx, ty, this.viewX, this.viewY);
      this.xp[unit.side] += 5;
      return true;
    }

    return false;
  }

  orderTransformUnit(unit, newTypeId) {
    if (!unit || unit.currHP <= 0) return false;
    const targetGroup = this.unitGroups.get(newTypeId);
    if (!targetGroup) return false;

    // If not yet researched, start Research using XP!
    if (!this.researched[unit.side].has(newTypeId)) {
      return this.startResearch(newTypeId, unit.side);
    }

    const cost = targetGroup.transformCost || MANA.TRANSFORM;
    if (this.mana[unit.side] < cost) {
      if (unit.side === this.playerSide) {
        this.sfx.play(SND.ERROR, 0.7);
        this.addMessage(`NEED ${cost} MANA TO TRANSFORM!`, unit.tileX, unit.tileY);
      }
      return false;
    }

    this.mana[unit.side] -= cost;
    unit.state = 'TRANSFORMING';
    unit.primaryAction = 'TRANSFORM';
    unit.path = [];
    unit.tileXOff = 9;
    unit.tileYOff = 18;
    unit.transformTargetType = newTypeId;
    const durationSecs = Math.max(4, Math.min(12, targetGroup.transformTime || 6));
    unit.transformEndTick = this.ticks + durationSecs * TICKS_PER_SEC;
    this.setUnitAnim(unit, 'METAPOD');
    this.sfx.launchPositional(SND.METAPOD_START, unit.tileX, unit.tileY, this.viewX, this.viewY);

    if (unit === this.selectedUnit && unit.side === this.playerSide) {
      this.statBoxMode = 'TRANSFORMING';
    }
    return true;
  }

  startResearch(typeId, side = this.playerSide) {
    const group = this.unitGroups.get(typeId);
    if (!group || this.researched[side].has(typeId)) return false;

    if (side === this.playerSide && this.researchState.subject) {
      this.addMessage('ALREADY RESEARCHING!', this.cursorX, this.cursorY);
      return false;
    }

    const xpCost = group.expRequired || 50;
    if (this.xp[side] < xpCost) {
      if (side === this.playerSide) {
        this.sfx.play(SND.ERROR, 0.7);
        this.addMessage(`NEED ${xpCost} XP TO RESEARCH ${group.name}!`, this.cursorX, this.cursorY);
      }
      return false;
    }

    this.xp[side] -= xpCost;
    if (side === this.playerSide) {
      const phaseTicks = Math.max(15, Math.floor(((group.researchTime || 6) * TICKS_PER_SEC) / 6));
      this.researchState = {
        subject: typeId,
        phase: 0,
        phaseTicks,
        nextTick: this.ticks + phaseTicks,
      };
      this.sfx.play(SND.PAGE_TURNS || 7292, 0.75);
      this.addMessage(`RESEARCHING ${group.name}...`, this.cursorX, this.cursorY);
    } else {
      this.researched[side].add(typeId);
    }
    return true;
  }

  summonAtPortal(side) {
    if (this.mana[side] < MANA.SUMMON) {
      if (side === this.playerSide) {
        this.sfx.play(SND.ERROR, 0.7);
        this.addMessage(`NEED ${MANA.SUMMON} MANA TO SUMMON!`, this.cursorX, this.cursorY);
      }
      return null;
    }

    const [px, py] = this.portalCoords[side] || [29, 37];
    const spot = this.findOpenSpotNear(px, py, UNIT_TYPE.ACOLYTE);
    if (!spot) {
      if (side === this.playerSide) this.sfx.play(SND.ERROR, 0.7);
      return null;
    }

    this.mana[side] -= MANA.SUMMON;
    const unit = this.createUnit(UNIT_TYPE.ACOLYTE, side, spot[0], spot[1]);
    this.spawnEffect(ANIM_RES.TRANSFORM_POOF, spot[0], spot[1], 3);
    this.sfx.launchPositional(SND.SUMMON, spot[0], spot[1], this.viewX, this.viewY);
    if (side === this.playerSide) {
      this.addMessage('BASAL GOLEM IS READY.', spot[0], spot[1]);
    }
    return unit;
  }

  spawnEffect(resNum, tileX, tileY, delay = 3, xOff = 9, yOff = 18) {
    this.effects.push({
      resNum,
      cel: 1,
      tileX,
      tileY,
      xOff,
      yOff,
      delay,
      nextTick: this.ticks + delay,
    });
  }

  removeUnit(unit) {
    if (this.unitGrid[unit.tileX + unit.tileY * WORLD_W] === unit) {
      this.unitGrid[unit.tileX + unit.tileY * WORLD_W] = null;
    }
    const idx = this.units.indexOf(unit);
    if (idx !== -1) this.units.splice(idx, 1);
    if (this.selectedUnit === unit) {
      this.selectedUnit = null;
      this.statBoxMode = 'TERRAIN';
    }
    this.selectedGroup = this.selectedGroup.filter((u) => u !== unit);
  }

  // Main Simulation Step (20 ticks/sec)
  step(renderer) {
    if (this.isPaused || this.winnerSide) return;
    this.ticks++;

    renderer.cyclePalettes(this.ticks);

    // Cycle background animations
    for (const bg of this.bgAnims) {
      if (this.ticks >= bg.nextTick) {
        bg.nextTick = this.ticks + bg.speed;
        const maxCels = renderer.getCelCount(bg.resNum) || 1;
        bg.cel = (bg.cel % maxCels) + 1;
      }
    }

    // Cycle one-shot effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      if (this.ticks >= fx.nextTick) {
        fx.nextTick = this.ticks + fx.delay;
        const maxCels = renderer.getCelCount(fx.resNum) || 1;
        if (fx.cel < maxCels) {
          fx.cel++;
        } else {
          this.effects.splice(i, 1);
        }
      }
    }

    // Cycle projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.stepsLeft--;
      if (this.ticks >= p.nextCelTick) {
        p.nextCelTick = this.ticks + 2;
        const maxCels = renderer.getCelCount(p.resNum) || 1;
        p.cel = (p.cel % maxCels) + 1;
      }
      if (p.stepsLeft <= 0) {
        if (p.impactRes) {
          this.spawnEffect(p.impactRes, p.targetX, p.targetY, 2);
        }
        if (p.targetUnit && p.targetUnit.currHP > 0) {
          this.applyDamageToUnit(p.owner, p.targetUnit, p.damage);
        } else if (p.targetBldg && p.targetBldg.currHP > 0) {
          this.applyDamageToBuilding(p.owner, p.targetBldg, p.damage, p.targetX, p.targetY);
        }
        this.projectiles.splice(i, 1);
      }
    }

    // Cycle Research progress
    if (this.researchState.subject && this.ticks >= this.researchState.nextTick) {
      this.researchState.phase++;
      if (this.researchState.phase >= 6) {
        const doneType = this.researchState.subject;
        this.researched[this.playerSide].add(doneType);
        this.researchState.subject = 0;
        this.researchState.phase = 0;
        const g = this.unitGroups.get(doneType);
        this.sfx.play(SND.HERALD_TRUMPET, 0.8);
        const [px, py] = this.portalCoords[this.playerSide] || [29, 37];
        this.addMessage(`RESEARCH COMPLETED: ${g ? g.name : 'UNIT'}!`, px, py);
      } else {
        this.researchState.nextTick = this.ticks + this.researchState.phaseTicks;
      }
    }

    // Cycle Units
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (!u) continue;
      this.stepUnit(u, renderer);
    }

    // Computer AI Step
    if (this.ticks >= this.aiNextTick) {
      this.aiNextTick = this.ticks + 30;
      this.stepAI();
    }
  }

  stepUnit(u, renderer) {
    // Advance sprite animation cel (forward or reverse)
    if (u.animDelay > 0 && this.ticks >= u.nextAnimTick) {
      u.nextAnimTick = this.ticks + u.animDelay;
      const maxCels = renderer.getCelCount(u.animRes) || 1;
      if (u.animFwd !== false) {
        if (u.animCel < maxCels) {
          u.animCel++;
        } else if (u.animLoop) {
          u.animCel = 1;
        } else if (u.state === 'OBELISKING_TO') {
          u.state = 'OBELISK';
          u.animDelay = 0; // Hold on cel 8 (full Obelisk tower)
          const sp = this.getStructure(u.tileX, u.tileY);
          if (sp && sp.func === FUNC.GEN_FOUND) {
            this.checkFoundationFilled(sp);
          }
        } else if (u.state === 'DYING') {
          this.removeUnit(u);
          return;
        } else if (u.state === 'ATTACKING') {
          u.state = 'IDLE';
          this.setUnitAnim(u, 'IDLE', u.dir);
        }
      } else {
        // Reverse animation (Obelisk -> Basal Golem: cels 8..1 of RES_ANIM 534)
        if (u.animCel > 1) {
          u.animCel--;
        } else if (u.state === 'OBELISKING_FROM') {
          u.state = 'IDLE';
          this.setUnitAnim(u, 'IDLE', u.dir);
        }
      }
    }

    if (
      u.state === 'DYING' ||
      u.state === 'OBELISKING_TO' ||
      u.state === 'OBELISKING_FROM'
    ) {
      return;
    }

    // Transforming Metapod completion
    if (u.state === 'TRANSFORMING') {
      if (this.ticks >= u.transformEndTick) {
        const newType = u.transformTargetType || UNIT_TYPE.WARRIOR;
        const newGroup = this.unitGroups.get(newType);
        if (newGroup) {
          u.type = newType;
          u.group = newGroup;
          u.name = newGroup.name;
          u.maxHP = newGroup.maxHP;
          u.currHP = newGroup.maxHP;
          u.baseAttack = newGroup.baseAttack;
          u.baseDefense = newGroup.baseDefense;
          u.baseRange = newGroup.baseAttackRange;
          u.baseMove = newGroup.baseMoveRate;
          this.updateUnitTerrainStats(u);
        }
        u.state = 'IDLE';
        u.primaryAction = 'NONE';
        this.setUnitAnim(u, 'IDLE', DIR.DOWN);
        this.spawnEffect(ANIM_RES.TRANSFORM_POOF, u.tileX, u.tileY, 3);
        this.sfx.launchPositional(SND.TRANSFORM, u.tileX, u.tileY, this.viewX, this.viewY);
        if (u.side === this.playerSide) {
          this.addMessage(`${u.name} IS READY.`, u.tileX, u.tileY);
          if (this.selectedUnit === u) this.statBoxMode = 'TERRAIN';
        }
      }
      return;
    }

    // Obelisk Mana Meditation
    if (u.type === UNIT_TYPE.ACOLYTE && u.state === 'OBELISK') {
      if (this.ticks >= u.nextManaTick) {
        u.nextManaTick = this.ticks + TICKS_PER_SEC * 5;
        if (u.currMana < MANA.ACOLYTE_MAX) {
          u.currMana += MANA.MEDITATE;
        }
        // Auto-transfer mana to side pool so both manual Transfer and passive Obelisk income work seamlessly
        this.mana[u.side] = Math.min(MANA.MAX, this.mana[u.side] + MANA.MEDITATE);
      }
      return;
    }

    // Sub-tile movement paced by MOVE_2_TICKS & MOVE_2_STEPS (SRC/UNITS.CPP lines 6432-6436)
    if (u.state === 'MOVING') {
      if (this.ticks < (u.nextMoveStepTick || 0)) return;
      const cm = Math.max(1, Math.min(10, u.currMove || 2));
      u.nextMoveStepTick = this.ticks + MOVE_2_TICKS[cm];
      u.stepIndex += MOVE_2_STEPS[cm];

      const dx = u.nextStepX - u.tileX;
      const dy = u.nextStepY - u.tileY;
      const progress = Math.min(1, u.stepIndex / TILE_W);
      u.tileXOff = Math.round(9 + dx * TILE_W * progress);
      u.tileYOff = Math.round(18 + dy * TILE_H * progress);

      if (progress >= 1) {
        // Arrive at nextStep tile
        if (this.unitGrid[u.tileX + u.tileY * WORLD_W] === u) {
          this.unitGrid[u.tileX + u.tileY * WORLD_W] = null;
        }
        u.tileX = u.nextStepX;
        u.tileY = u.nextStepY;
        u.tileXOff = 9;
        u.tileYOff = 18;
        this.unitGrid[u.tileX + u.tileY * WORLD_W] = u;
        u.state = 'IDLE';

        this.updateUnitTerrainStats(u);
        this.checkUnitTransformer(u);
        if (u.side === this.playerSide) {
          this.defogRect(u.tileX - 3, u.tileY - 3, u.tileX + 3, u.tileY + 3);
          if (this.selectedUnit === u) {
            this.cursorX = u.tileX;
            this.cursorY = u.tileY;
          }
        }
        if (!u.path || u.path.length === 0) {
          if (u.type === UNIT_TYPE.ACOLYTE) {
            u.primaryAction = 'NONE';
            this.orderGuard(u, true);
          } else {
            this.setUnitAnim(u, 'IDLE', u.dir);
          }
        }
      }
      return;
    }

    // Evaluate actions when IDLE
    if (this.ticks < u.nextActionTick) return;
    u.nextActionTick = this.ticks + 4;

    // Standing still Basal Golems transform back into Obelisk towers (SRC/UNITS.CPP line 84612)
    if (
      u.type === UNIT_TYPE.ACOLYTE &&
      u.state === 'IDLE' &&
      u.primaryAction === 'NONE' &&
      (!u.path || u.path.length === 0)
    ) {
      this.orderGuard(u, true);
      return;
    }

    if (u.primaryAction === 'ATTACK') {
      if (u.targetUnit && u.targetUnit.currHP > 0 && u.targetUnit.state !== 'DYING') {
        const dist = Math.max(
          Math.abs(u.targetUnit.tileX - u.tileX),
          Math.abs(u.targetUnit.tileY - u.tileY)
        );
        if (dist <= u.currRange) {
          this.performUnitAttack(u, u.targetUnit, null, u.targetUnit.tileX, u.targetUnit.tileY);
          return;
        }
        u.path = this.findPath(u, u.targetUnit.tileX, u.targetUnit.tileY, true);
      } else if (u.targetBldg && u.targetBldg.currHP > 0) {
        // Find closest tile of target building
        let bestTile = [u.targetBldg.xPos, u.targetBldg.yPos];
        let bestDist = 999;
        for (const [bx, by] of u.targetBldg.tiles) {
          const d = Math.max(Math.abs(bx - u.tileX), Math.abs(by - u.tileY));
          if (d < bestDist) {
            bestDist = d;
            bestTile = [bx, by];
          }
        }
        if (bestDist <= u.currRange) {
          this.performUnitAttack(u, null, u.targetBldg, bestTile[0], bestTile[1]);
          return;
        }
        if (u.path.length === 0) {
          u.path = this.findPath(u, bestTile[0], bestTile[1], true);
        }
      } else {
        u.primaryAction = 'NONE';
        this.setUnitAnim(u, 'IDLE', u.dir);
      }
    }

    // Take next step along path
    if (u.path && u.path.length > 0) {
      const [nx, ny] = u.path[0];
      if (!this.getUnitAt(nx, ny)) {
        u.path.shift();
        const dir = this.getDirection(nx - u.tileX, ny - u.tileY);
        u.nextStepX = nx;
        u.nextStepY = ny;
        u.stepIndex = 0;
        u.nextMoveStepTick = this.ticks;
        u.state = 'MOVING';
        this.setUnitAnim(u, 'WALK', dir);
        return;
      } else {
        // Re-path around obstacle
        u.path = this.findPath(u, u.targetX, u.targetY, u.primaryAction === 'ATTACK');
      }
    } else if (u.primaryAction === 'MOVE') {
      u.primaryAction = 'NONE';
      if (u.type === UNIT_TYPE.ACOLYTE) {
        this.orderGuard(u, true);
      } else {
        this.setUnitAnim(u, 'IDLE', u.dir);
      }
    }

    // Auto-defend / acquire nearby enemies within sight
    if (u.primaryAction === 'NONE' && u.currAttack > 0 && !u.standGuard) {
      const enemy = this.findNearestEnemy(u, 4);
      if (enemy) {
        this.orderAttackUnit(u, enemy);
      }
    }
  }

  findNearestEnemy(unit, maxDist = 5) {
    let best = null;
    let bestDist = maxDist + 1;
    for (const other of this.units) {
      if (other.side === unit.side || other.side === SIDE0 || other.currHP <= 0 || other.state === 'DYING')
        continue;
      const d = Math.max(Math.abs(other.tileX - unit.tileX), Math.abs(other.tileY - unit.tileY));
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }

  performUnitAttack(attacker, targetUnit, targetBldg, tx, ty) {
    const dir = this.getDirection(tx - attacker.tileX, ty - attacker.tileY);
    attacker.state = 'ATTACKING';
    this.setUnitAnim(attacker, 'ATTACK', dir);
    attacker.nextActionTick = this.ticks + TICKS_PER_SEC;

    const dmg = Math.max(
      1,
      attacker.currAttack - (targetUnit ? Math.floor(targetUnit.currDefense / 2) : 1)
    );

    if (attacker.currRange > 1) {
      // Ranged projectile
      const projRes = attacker.group.baseAnim + ANIM_OFF.PROJECTILE;
      const impactRes = attacker.group.baseAnim + ANIM_OFF.IMPACT;
      const startX = attacker.tileX * TILE_W + 9;
      const startY = attacker.tileY * TILE_H + 18;
      const endX = tx * TILE_W + 9;
      const endY = ty * TILE_H + 18;
      const steps = 8;
      this.projectiles.push({
        owner: attacker,
        resNum: projRes,
        impactRes,
        cel: 1,
        nextCelTick: this.ticks + 2,
        x: startX,
        y: startY,
        vx: (endX - startX) / steps,
        vy: (endY - startY) / steps,
        stepsLeft: steps,
        targetUnit,
        targetBldg,
        targetX: tx,
        targetY: ty,
        damage: dmg,
      });
      this.sfx.launchPositional(SND.BOW_TWANG, attacker.tileX, attacker.tileY, this.viewX, this.viewY);
    } else {
      // Melee strike
      this.sfx.launchPositional(SND.SWORD_CLASH, tx, ty, this.viewX, this.viewY);
      if (targetUnit) {
        this.applyDamageToUnit(attacker, targetUnit, dmg);
      } else if (targetBldg) {
        this.applyDamageToBuilding(attacker, targetBldg, dmg, tx, ty);
      }
    }
  }

  applyDamageToUnit(attacker, victim, dmg) {
    if (!victim || victim.currHP <= 0 || victim.state === 'DYING') return;
    victim.currHP -= dmg;
    victim.standGuard = false;

    if (victim.currHP <= 0) {
      victim.currHP = 0;
      victim.state = 'DYING';
      victim.path = [];
      this.setUnitAnim(victim, 'DIE');
      if (this.unitGrid[victim.tileX + victim.tileY * WORLD_W] === victim) {
        this.unitGrid[victim.tileX + victim.tileY * WORLD_W] = null;
      }

      const scream =
        victim.type === UNIT_TYPE.ZOMBIE ||
        victim.type === UNIT_TYPE.GHOUL ||
        victim.type === UNIT_TYPE.WRAITH
          ? SND.DEATH_UNDEAD
          : victim.type === UNIT_TYPE.GARGOYLE
          ? SND.DEMONIC_WAIL
          : SND.DEATH_MALE;
      this.sfx.launchPositional(scream, victim.tileX, victim.tileY, this.viewX, this.viewY);

      if (attacker && attacker.side !== victim.side) {
        this.xp[attacker.side] += victim.group.expGained || 15;
      }

      if (victim.side === this.playerSide) {
        this.addMessage(`YOUR ${victim.name} HAS DIED!`, victim.tileX, victim.tileY);
      } else {
        this.addMessage(`ENEMY ${victim.name} SLAIN!`, victim.tileX, victim.tileY);
      }
      this.checkWinConditions();
    } else if (victim.primaryAction === 'NONE' && attacker && victim.currAttack > 0) {
      this.orderAttackUnit(victim, attacker);
    }
  }

  applyDamageToBuilding(attacker, bldg, dmg, hitX, hitY) {
    if (!bldg || bldg.currHP <= 0) return;
    bldg.currHP = Math.max(0, bldg.currHP - dmg);
    this.spawnEffect(ANIM_RES.STRUCTURE_HIT, hitX, hitY, 3);

    if (bldg.currHP <= 0) {
      this.destroyBuilding(bldg, attacker);
    }
  }

  destroyBuilding(bldg, attacker) {
    bldg.currHP = 0;
    this.sfx.launchPositional(SND.CRASH, bldg.xPos, bldg.yPos, this.viewX, this.viewY);

    for (const [tx, ty] of bldg.tiles) {
      this.spawnEffect(ANIM_RES.COLLAPSE, tx, ty, 3);
      const t = this.getTile(tx, ty);
      if (t && t.swapTile > 0) {
        this.setTileNum(tx, ty, t.swapTile);
      }
    }

    if (attacker && attacker.side !== bldg.owner) {
      this.xp[attacker.side] += bldg.func === FUNC.KEEP ? 250 : 150;
    }

    const oldFunc = bldg.func;
    const oldOwner = bldg.owner;

    // Special buildings revert to Generic Foundation (SRC/MAPS.CPP line 2180)
    if (BUILDING_UNITS[oldFunc] && oldFunc !== FUNC.PORTAL) {
      bldg.func = FUNC.GEN_FOUND;
      bldg.owner = SIDE0;
      bldg.maxHP = 0;
    }

    if (oldOwner === this.playerSide) {
      this.addMessage('YOUR STRUCTURE HAS BEEN DESTROYED!', bldg.xPos, bldg.yPos);
    } else {
      this.addMessage('ENEMY STRUCTURE DESTROYED!', bldg.xPos, bldg.yPos);
    }

    this.checkWinConditions();
  }

  checkWinConditions() {
    if (this.winnerSide) return;

    // Check #WIN conditions from map config (e.g. #WIN SIDE1 STRUCT CRYPT SIDE2 0)
    for (const wc of this.winConditions) {
      const winner = wc.ownerSide === 'SIDE1' ? SIDE1 : SIDE2;
      const targetSide = wc.targetSide === 'SIDE1' ? SIDE1 : SIDE2;
      if (wc.category === 'STRUCT') {
        const funcMap = {
          CRYPT: FUNC.CRYPT,
          BARRACKS: FUNC.BARRACKS,
          KEEP: FUNC.KEEP,
          ARBORLODGE: FUNC.ARBORLODGE,
          RUNESTONE: FUNC.RUNESTONE,
          TEMPLE: FUNC.TEMPLE,
        };
        const targetFunc = funcMap[wc.spec];
        if (targetFunc) {
          let count = 0;
          for (const sp of this.spaces) {
            if (sp && sp.owner === targetSide && sp.func === targetFunc && sp.currHP > 0) {
              count++;
            }
          }
          if (count <= wc.targetCount) {
            this.winnerSide = winner;
            this.sfx.play(winner === this.playerSide ? SND.TRUMPET : SND.DRUMS, 0.85);
            return;
          }
        }
      }
    }
  }

  // Computer Opponent AI (SIDE2)
  stepAI() {
    const aiSide = this.enemySide;
    const aiUnits = this.units.filter((u) => u.side === aiSide && u.currHP > 0);
    const acolytes = aiUnits.filter((u) => u.type === UNIT_TYPE.ACOLYTE);
    const fighters = aiUnits.filter((u) => u.type !== UNIT_TYPE.ACOLYTE);

    // 1. Keep at least 1 Basal Golem in Obelisk mode generating mana
    const obelisks = acolytes.filter((u) => u.state === 'OBELISK');
    if (obelisks.length === 0 && acolytes.length > 0) {
      const idleAc = acolytes.find((u) => u.state === 'IDLE');
      if (idleAc) {
        this.orderGuard(idleAc);
        return;
      }
    }

    // 2. Summon new Basal Golem if AI has plenty of mana
    if (this.mana[aiSide] >= MANA.SUMMON + 20 && aiUnits.length < 10) {
      this.summonAtPortal(aiSide);
    }

    // 3. Transform extra Basal Golems at AI's Crypt or Barracks
    const aiBldg = this.spaces.find(
      (sp) =>
        sp &&
        sp.owner === aiSide &&
        sp.currHP > 0 &&
        (sp.func === FUNC.CRYPT || sp.func === FUNC.BARRACKS)
    );
    if (aiBldg && acolytes.length >= 2) {
      const candidate = acolytes.find((u) => u.state === 'IDLE' && u !== obelisks[0]);
      if (candidate) {
        this.checkUnitTransformer(candidate);
        if (candidate.nearbyTransformer === aiBldg.func) {
          const choices = BUILDING_UNITS[aiBldg.func] || [];
          const pick = choices[0]; // Zombie or Warrior
          if (pick && this.mana[aiSide] >= MANA.TRANSFORM) {
            this.orderTransformUnit(candidate, pick);
          }
        } else if (candidate.primaryAction === 'NONE') {
          const spot = this.findOpenSpotNear(aiBldg.xPos, aiBldg.yPos, UNIT_TYPE.ACOLYTE);
          if (spot) this.orderMove(candidate, spot[0], spot[1]);
        }
      }
    }

    // 4. Send idle fighters to attack player units or Keep when group >= 3
    const activeFighters = fighters.filter((u) => !u.standGuard && u.primaryAction === 'NONE');
    if (activeFighters.length >= 2) {
      const playerTarget = this.units.find((u) => u.side === this.playerSide && u.currHP > 0);
      const playerKeep = this.spaces.find(
        (sp) => sp && sp.owner === this.playerSide && sp.currHP > 0 && sp.func === FUNC.KEEP
      );
      for (const f of activeFighters) {
        if (playerTarget) {
          this.orderAttackUnit(f, playerTarget);
        } else if (playerKeep) {
          this.orderAttackBuilding(f, playerKeep, playerKeep.xPos, playerKeep.yPos);
        }
      }
    }
  }

  centerCameraOn(tileX, tileY) {
    this.viewX = Math.max(-1, Math.min(WORLD_W - 11, (tileX | 0) - 6));
    this.viewY = Math.max(-1, Math.min(WORLD_H - 7, (tileY | 0) - 4));
  }

  moveCursor(tx, ty, playSelectSound = false) {
    const x = Math.max(0, Math.min(WORLD_W - 1, tx | 0));
    const y = Math.max(0, Math.min(WORLD_H - 1, ty | 0));
    this.cursorX = x;
    this.cursorY = y;

    if (this.statBoxMode !== 'TERRAIN' && this.statBoxMode !== 'TRANSFORMING') {
      this.statBoxMode = 'TERRAIN';
    }

    if (this.isTileFogged(x, y)) {
      this.selectedUnit = null;
      this.selectedBuilding = null;
      this.statBoxMode = 'TERRAIN';
      return;
    }

    const u = this.getUnitAt(x, y);
    if (u && u.currHP > 0) {
      this.selectedUnit = u;
      this.selectedBuilding = null;
      this.statBoxMode = u.state === 'TRANSFORMING' ? 'TRANSFORMING' : 'TERRAIN';
      if (playSelectSound && u.side === this.playerSide) {
        const snd = 11200000 + u.type;
        this.sfx.play(snd, 0.75);
      }
      return;
    }

    const sp = this.getStructure(x, y);
    if (sp && ((sp.maxHP > 0 && sp.currHP > 0) || sp.func === FUNC.PORTAL)) {
      this.selectedUnit = null;
      this.selectedBuilding = sp;
      this.statBoxMode = 'TERRAIN';
      return;
    }

    this.selectedUnit = null;
    this.selectedBuilding = null;
    this.statBoxMode = 'TERRAIN';
  }

  addMessage(text, x = null, y = null) {
    this.messages.unshift({ text: text.toUpperCase(), time: Date.now() });
    if (this.messages.length > 5) this.messages.pop();
    if (x != null && y != null) {
      this.lastEventCoords = [x, y];
    }
  }
}

