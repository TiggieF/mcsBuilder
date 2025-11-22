'use strict';

// ===== Canvas + drawing context =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ===== Core tuning constants =====
const grid = { cols: 38, rows: 20, cell: 30 };
const FPS = 30;
const frameDuration = 1000 / FPS;
const MAX_FLOORS = 10;
const BUILDER_BASE_STAMINA = 5;
const DELIVERY_BASE_STAMINA = 5;
const DELIVERY_STAMINA_PER_FLOOR = 2;
const STAMINA_REST_RATE = 0.25 / 1.5;
const DELIVERY_TRIP_COST = 0.5;
const STAMINA_BUILD_COST = 2.5;
const DELIVERY_LEVEL_FLASH_DURATION = 2.4;
const WORKER_ACTIVE_SPEED = 85;
const WORKER_CARRY_SPEED = 75;
const DELIVERY_LOAD_TIME = 1.1;
const DELIVERY_DROP_TIME = 0.6;
const WORKER_IDLE_SPEED = 28;
const WORKER_APPROACH_BUFFER = 4;
const PATH_REPLAN_INTERVAL = 1;
const PATH_FAILURE_RETRY = 0.45;
const MATERIAL_BASE = 10;
const MATERIAL_PER_FLOOR = 5;
const BUILD_BASE = 5;
const BUILD_PER_FLOOR = 5;
const BUILD_PROGRESS_SLOWDOWN = 1.5;
const PLAYER_INTERACT_COOLDOWN = 0.35;
const EDGE_MARGIN = 1;
const RED_BULL_INTERVAL = 300;
const RED_BULL_DURATION = 60;
const RED_BULL_PLAYER_MULT = 2;
const RED_BULL_WORKER_MULT = 1.3;
const RED_BULL_BUILD_MULT = 0.9;

const MATERIAL_RULES = [
  { name: 'concrete', floors: [1, 3], color: '#9c9c9c' },
  { name: 'wood', floors: [4, 7], color: '#b3773c' },
  { name: 'glass', floors: [8, 10], color: '#7cd7ff' }
];

// ===== Simple worker state machines =====
const WorkerFSMConfig = {
  builder: {
    idle: { build: 'headingToSite', rest: 'headingToDorm', cancel: 'idle' },
    headingToSite: { arriveWork: 'building', rest: 'headingToDorm', cancel: 'idle' },
    building: { complete: 'idle', rest: 'headingToDorm', cancel: 'idle' },
    headingToDorm: { arriveRest: 'resting' },
    resting: { recovered: 'idle' }
  },
  delivery: {
    idle: { fetch: 'headingToDepot', rest: 'headingToDorm', cancel: 'idle' },
    headingToDepot: { arriveSource: 'loading', rest: 'headingToDorm', cancel: 'idle' },
    loading: { loadComplete: 'headingToSite', rest: 'headingToDorm', cancel: 'idle' },
    headingToSite: { arriveSite: 'delivering', rest: 'headingToDorm', cancel: 'idle' },
    delivering: { dropComplete: 'headingToDepot', rest: 'headingToDorm', cancel: 'idle' },
    headingToDorm: { arriveRest: 'resting' },
    resting: { recovered: 'idle' }
  }
};

function createStateMachine(role) {
  return {
    role,
    state: 'idle',
    transition(event, worker) {
      const map = WorkerFSMConfig[role][this.state];
      if (!map) {
        return false;
      }
      const next = map[event];
      if (!next) {
        return false;
      }
      const previous = this.state;
      this.state = next;
      logStateTransition(worker, event, previous, next);
      return true;
    }
  };
}

canvas.width = grid.cols * grid.cell;
canvas.height = grid.rows * grid.cell;

// ===== Palette + texture references =====
const MCS_FLOOR_PALETTES = [
  { primary: '#303a65', secondary: '#47578c', shadow: '#1d233c' },
  { primary: '#2f4f6f', secondary: '#4b6d98', shadow: '#1a2d45' },
  { primary: '#2b5d4a', secondary: '#3f8b6b', shadow: '#162e25' },
  { primary: '#5d542b', secondary: '#8b7a3f', shadow: '#2e2716' },
  { primary: '#5d2b4b', secondary: '#8b3f6d', shadow: '#2e1625' },
  { primary: '#2b5d5b', secondary: '#3f8b87', shadow: '#162e2c' }
];

// Cache the generated canvas patterns to keep drawing inexpensive
const textures = {
  grass: createGrassPattern('#1f3a1c', '#2f5327', '#3f6d31'),
  mcs: createStripedPattern(
    MCS_FLOOR_PALETTES[0].primary,
    MCS_FLOOR_PALETTES[0].secondary,
    MCS_FLOOR_PALETTES[0].shadow
  ),
  building: createBrickPattern('#744d2b', '#4b321b', '#301f10'),
  cafe: createBrickPattern('#223937', '#1b2c2a', '#12201e'),
  dorm: createStripedPattern('#3e2b58', '#5b3f7a', '#211334'),
  rock: createRockPattern('#505667', '#292c36', '#8f95a6'),
  pond: createWaterPattern('#1c3558', '#2d5a8c', '#13213a')
};

// ===== Utility helpers =====
function materialNeededForFloor(floor) {
  return MATERIAL_BASE + MATERIAL_PER_FLOOR * (floor - 1);
}

function materialForFloor(floor) {
  const rule = MATERIAL_RULES.find(entry => floor >= entry.floors[0] && floor <= entry.floors[1]);
  return rule ? rule.name : MATERIAL_RULES[MATERIAL_RULES.length - 1].name;
}

function materialColor(material) {
  const rule = MATERIAL_RULES.find(entry => entry.name === material);
  return rule ? rule.color : '#9c9c9c';
}

function materialLabel(material) {
  return material ? material.charAt(0).toUpperCase() + material.slice(1) : 'Unknown';
}

function getDepotName(material) {
  if (material === 'concrete') return 'Concrete Depot';
  if (material === 'glass') return 'Glass Depot';
  return 'Wood Depot';
}

function buildTimeFor(floor) {
  return BUILD_BASE + BUILD_PER_FLOOR * (floor - 1);
}

// ===== World layout =====
const zones = generateZones();
const zoneEdgeMap = zones.map(getZoneEdgeCells);
const zoneDirectory = zones.reduce((acc, zone, index) => {
  acc[zone.name] = { zone, edges: zoneEdgeMap[index] };
  return acc;
}, {});
const baseBlocked = createBlockedSetFromZones(zones);

let playerCell = findPlayerStartCell(baseBlocked);
const rockForbiddenCells = computeRockForbiddenCells(zones);
const rocks = generateRocks(zones, playerCell, zoneEdgeMap, rockForbiddenCells);
const blockedCells = createBlockedSet(zones, rocks);

if (blockedCells.has(cellKey(playerCell))) {
  playerCell = findNearestWalkableCell(playerCell, blockedCells);
}

const spawnCell = { ...playerCell };
const rockTiles = buildRockTiles(rocks);
const solidRects = [...zones, ...rockTiles];

const world = {
  currentMaterial: materialForFloor(1),
  redBullBuff: { active: false, expiresAt: 0 },
  nextRedBullAt: RED_BULL_INTERVAL,
  redBullTile: null
};

let state = createInitialState(spawnCell, blockedCells);
let player = state.player;
let workers = state.workers;

refreshMcsZoneTexture();

const keys = {};
let isPaused = false;
const speedOptions = [0.5, 1, 2, 4, 8, 16, 32, 64, 128];
let speedIndex = speedOptions.indexOf(1);
state.time.speed = speedOptions[speedIndex];
let bubbleTimeout = null;
let gameComplete = false;
let finishTime = 0;

const statusEl = document.getElementById('panelStatus');
const hudFloor = document.getElementById('hud-floor');
const hudTime = document.getElementById('hud-time');
const hudFloors = document.getElementById('hud-floors');
const hudDelivery = document.getElementById('hud-delivery');
// ===== HUD + panel references =====
const pauseBtn = document.getElementById('pauseBtn');
const speedBtn = document.getElementById('speedBtn');
const materialFill = document.getElementById('materialFill');
const materialText = document.getElementById('materialText');
const materialName = document.getElementById('materialName');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const bubble = document.getElementById('textBubble');
const winOverlay = document.getElementById('winOverlay');
const winTimeEl = document.getElementById('winTime');
const restartBtn = document.getElementById('restartBtn');
const workerCards = Array.from(document.querySelectorAll('.worker-card'));
bubble.style.display = 'none';
updateSpeedLabel();

// ----- Geometry helpers -----
function rectsOverlap(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

function expandedRect(rect, padding) {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
  };
}

function cellKey(cell) {
  return `${cell.col},${cell.row}`;
}

function pointToCell(point) {
  const col = clamp(Math.floor(point.x / grid.cell), 0, grid.cols - 1);
  const row = clamp(Math.floor(point.y / grid.cell), 0, grid.rows - 1);
  return { col, row };
}

function cellToCenter(cell) {
  return {
    x: cell.col * grid.cell + grid.cell / 2,
    y: cell.row * grid.cell + grid.cell / 2
  };
}

function cellsEqual(a, b) {
  return a && b && a.col === b.col && a.row === b.row;
}

function parseCellKey(key) {
  const [col, row] = key.split(',').map(Number);
  return { col, row };
}

function heuristic(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

// ----- Pathfinding helpers (A* variant) -----
function computeDynamicBlockers(worker, goalKey) {
  const blocked = new Set();
  workers.forEach(other => {
    if (other === worker || !other.visible) {
      return;
    }
    const cell = pointToCell(workerCenter(other));
    const key = cellKey(cell);
    if (key !== goalKey) {
      blocked.add(key);
    }
  });
  const playerCellKey = cellKey(pointToCell({ x: player.x + player.width / 2, y: player.y + player.height / 2 }));
  if (playerCellKey !== goalKey) {
    blocked.add(playerCellKey);
  }
  return blocked;
}

function findPath(start, goal, worker) {
  const startKey = cellKey(start);
  const goalKey = cellKey(goal);
  if (startKey === goalKey) {
    return [goal];
  }
  if (blockedCells.has(startKey) && startKey !== goalKey) {
    return null;
  }

  const dynamicBlockers = computeDynamicBlockers(worker, goalKey);
  let path = findPathWithBlockers(start, goal, goalKey, dynamicBlockers);
  if (!path && dynamicBlockers.size > 0) {
    path = findPathWithBlockers(start, goal, goalKey, null);
  }
  return path;
}

function findPathWithBlockers(start, goal, goalKey, dynamicBlockers) {
  const open = new Map();
  const openList = [];
  const cameFrom = new Map();
  const gScore = new Map();

  const startKey = cellKey(start);
  gScore.set(startKey, 0);
  const startNode = { cell: start, key: startKey, f: heuristic(start, goal) };
  open.set(startKey, startNode);
  openList.push(startNode);

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift();
    open.delete(current.key);

    if (current.key === goalKey) {
      return reconstructPath(cameFrom, current.key);
    }

    const neighbors = [
      { col: current.cell.col + 1, row: current.cell.row },
      { col: current.cell.col - 1, row: current.cell.row },
      { col: current.cell.col, row: current.cell.row + 1 },
      { col: current.cell.col, row: current.cell.row - 1 }
    ];

    neighbors.forEach(neighbor => {
      if (!withinGrid(neighbor.col, neighbor.row)) {
        return;
      }
      const neighborKey = cellKey(neighbor);
      if (dynamicBlockers && dynamicBlockers.has(neighborKey) && neighborKey !== goalKey) {
        return;
      }
      if (blockedCells.has(neighborKey) && neighborKey !== goalKey) {
        return;
      }
      const currentG = gScore.has(current.key) ? gScore.get(current.key) : Infinity;
      const tentativeG = currentG + 1;
      const neighborBest = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;
      if (tentativeG >= neighborBest) {
        return;
      }
      cameFrom.set(neighborKey, current.key);
      gScore.set(neighborKey, tentativeG);
      const fScore = tentativeG + heuristic(neighbor, goal);
      const existing = open.get(neighborKey);
      if (existing) {
        existing.f = fScore;
      } else {
        const node = { cell: neighbor, key: neighborKey, f: fScore };
        open.set(neighborKey, node);
        openList.push(node);
      }
    });
  }

  return null;
}

function reconstructPath(cameFrom, goalKey) {
  const path = [];
  let currentKey = goalKey;
  while (currentKey) {
    path.push(parseCellKey(currentKey));
    currentKey = cameFrom.get(currentKey);
  }
  return path.reverse();
}

// ----- Collision lookups -----
function getPlayerRect() {
  return {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height
  };
}

function getWorkerRects(options = {}) {
  const { exclude } = options;
  return workers
    .filter(worker => worker !== exclude && worker.visible)
    .map(worker => ({
      x: worker.x,
      y: worker.y,
      width: worker.width,
      height: worker.height
    }));
}

function getCollisionRects(options = {}) {
  const { includeWorkers = true, excludeWorker = null, includePlayer = false } = options;
  const rects = [...solidRects];
  if (includeWorkers) {
    rects.push(...getWorkerRects({ exclude: excludeWorker }));
  }
  if (includePlayer) {
    rects.push(getPlayerRect());
  }
  return rects;
}

function getZoneInfo(name) {
  return zoneDirectory[name] || null;
}

function getApproachCenter(name) {
  const info = getZoneInfo(name);
  if (!info) {
    return null;
  }
  for (const cell of info.edges) {
    if (!blockedCells.has(cellKey(cell))) {
      return {
        x: cell.col * grid.cell + grid.cell / 2,
        y: cell.row * grid.cell + grid.cell / 2
      };
    }
  }
  if (info.edges.length > 0) {
    const fallback = info.edges[0];
    const col = clamp(fallback.col, 0, grid.cols - 1);
    const row = clamp(fallback.row, 0, grid.rows - 1);
    return {
      x: col * grid.cell + grid.cell / 2,
      y: row * grid.cell + grid.cell / 2
    };
  }
  return {
    x: info.zone.x + info.zone.width / 2,
    y: info.zone.y + info.zone.height / 2
  };
}

function workerCenter(worker) {
  return {
    x: worker.x + worker.width / 2,
    y: worker.y + worker.height / 2
  };
}

function alignWorkerToCenter(worker, center) {
  if (!center) return;
  worker.x = center.x - worker.width / 2;
  worker.y = center.y - worker.height / 2;
}

function getWorkerMaxStamina(worker) {
  if (!worker) {
    return BUILDER_BASE_STAMINA;
  }
  if (typeof worker.maxStamina === 'number') {
    return worker.maxStamina;
  }
  return worker.role === 'delivery' ? DELIVERY_BASE_STAMINA : BUILDER_BASE_STAMINA;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function logStateTransition(worker, event, fromState, toState) {
  const label = worker ? worker.name : 'Worker';
  const timestamp = formatTime(state.time.elapsed || 0);
  console.log(`[${timestamp}] ${label}: ${fromState} —${event}→ ${toState}`);
}


function updateHUD() {
  const floorNumber = Math.min(state.floor.n, MAX_FLOORS);
  hudFloor.textContent = `${floorNumber}`;

  const currentNeed = state.floor.need;
  const currentMaterial = world.currentMaterial;
  const storedAmount = state.stock[currentMaterial] || 0;
  const materialRatio = currentNeed <= 0
    ? 1
    : Math.max(0, Math.min(1, storedAmount / currentNeed));
  const storedLabel = Number.isInteger(storedAmount) ? storedAmount : storedAmount.toFixed(1);
  const needLabel = currentNeed > 0 ? currentNeed : '—';
  materialText.textContent = `${storedLabel}/${needLabel}`;
  materialFill.style.width = `${materialRatio * 100}%`;
  materialName.textContent = materialLabel(currentMaterial);

  const floorsBuilt = state.progress.floorsBuilt;
  const totalFloors = state.progress.totalFloors;
  const overallProgress = Math.max(0, Math.min(1, (floorsBuilt + state.floor.progress) / totalFloors));
  const overallPercent = Math.round(overallProgress * 100);
  progressText.textContent = `${overallPercent}%`;
  progressFill.style.width = `${overallPercent}%`;
  hudFloors.textContent = `${floorsBuilt} / ${totalFloors}`;

  const deliveryWorker = workers.find(worker => worker.role === 'delivery');
  if (deliveryWorker) {
    const deliveryMax = getWorkerMaxStamina(deliveryWorker);
    hudDelivery.textContent = `L${deliveryWorker.level} · ${Math.round(deliveryMax)} SP`;
  }

  const timeDisplay = gameComplete ? finishTime : state.time.elapsed;
  hudTime.textContent = formatTime(timeDisplay);
}

function createGrassPattern(primary, secondary, accent) {
  const tile = document.createElement('canvas');
  tile.width = 16;
  tile.height = 16;
  const tctx = tile.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.fillStyle = primary;
  tctx.fillRect(0, 0, tile.width, tile.height);
  tctx.fillStyle = secondary;
  for (let y = 0; y < tile.height; y += 4) {
    for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < tile.width; x += 4) {
      tctx.fillRect(x, y, 2, 2);
    }
  }
  tctx.fillStyle = accent;
  const accentPixels = [
    [1, 1], [5, 3], [9, 1], [13, 5],
    [3, 9], [11, 11], [7, 13], [15, 15]
  ];
  accentPixels.forEach(([x, y]) => {
    tctx.fillRect(x % tile.width, y % tile.height, 2, 2);
  });
  return ctx.createPattern(tile, 'repeat');
}

function createStripedPattern(primary, secondary, shadow) {
  const tile = document.createElement('canvas');
  tile.width = 16;
  tile.height = 16;
  const tctx = tile.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.fillStyle = shadow;
  tctx.fillRect(0, 0, tile.width, tile.height);
  tctx.fillStyle = primary;
  for (let x = 0; x < tile.width; x += 4) {
    tctx.fillRect(x, 0, 3, tile.height);
  }
  tctx.fillStyle = secondary;
  for (let y = 0; y < tile.height; y += 8) {
    tctx.fillRect(0, y, tile.width, 2);
  }
  return ctx.createPattern(tile, 'repeat');
}

function createBrickPattern(base, mortar, shadow) {
  const tile = document.createElement('canvas');
  tile.width = 16;
  tile.height = 16;
  const tctx = tile.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.fillStyle = shadow;
  tctx.fillRect(0, 0, tile.width, tile.height);
  tctx.fillStyle = mortar;
  tctx.fillRect(1, 1, tile.width - 2, tile.height - 2);
  tctx.fillStyle = base;
  for (let row = 0; row < tile.height; row += 6) {
    const offset = (row / 6) % 2 === 0 ? 0 : 4;
    for (let col = offset; col < tile.width; col += 8) {
      tctx.fillRect(col, row, 6, 4);
    }
  }
  tctx.fillStyle = shadow;
  for (let y = 0; y < tile.height; y += 4) {
    tctx.fillRect(0, y, tile.width, 1);
  }
  return ctx.createPattern(tile, 'repeat');
}

function createRockPattern(primary, shadow, highlight) {
  const tile = document.createElement('canvas');
  tile.width = 16;
  tile.height = 16;
  const tctx = tile.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.fillStyle = shadow;
  tctx.fillRect(0, 0, tile.width, tile.height);
  tctx.fillStyle = primary;
  const blocks = [
    [2, 2, 4, 4], [8, 1, 5, 5], [1, 9, 6, 5]
  ];
  blocks.forEach(([x, y, w, h]) => {
    tctx.fillRect(x, y, w, h);
  });
  tctx.fillStyle = highlight;
  [[3, 3], [9, 3], [5, 11]].forEach(([x, y]) => {
    tctx.fillRect(x, y, 2, 2);
  });
  return ctx.createPattern(tile, 'repeat');
}

function createWaterPattern(base, ripple, highlight) {
  const tile = document.createElement('canvas');
  tile.width = 16;
  tile.height = 16;
  const tctx = tile.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.fillStyle = base;
  tctx.fillRect(0, 0, tile.width, tile.height);
  tctx.fillStyle = ripple;
  for (let y = 0; y < tile.height; y += 4) {
    tctx.fillRect(0, y, tile.width, 2);
  }
  tctx.fillStyle = highlight;
  for (let x = 0; x < tile.width; x += 6) {
    tctx.fillRect(x, (x % 2 === 0 ? 3 : 1), 3, 1);
  }
  return ctx.createPattern(tile, 'repeat');
}

function getMcsPatternForFloorsBuilt(floorsBuilt) {
  const paletteIndex = ((floorsBuilt % MCS_FLOOR_PALETTES.length) + MCS_FLOOR_PALETTES.length) % MCS_FLOOR_PALETTES.length;
  const palette = MCS_FLOOR_PALETTES[paletteIndex] || MCS_FLOOR_PALETTES[0];
  return createStripedPattern(palette.primary, palette.secondary, palette.shadow);
}

function refreshMcsZoneTexture() {
  const info = zoneDirectory['MCS Construction'];
  if (!info || !state || !state.floor) {
    return;
  }
  const builtFloors = Math.max(0, state.progress ? state.progress.floorsBuilt : state.floor.n - 1);
  const pattern = getMcsPatternForFloorsBuilt(builtFloors);
  info.zone.color = pattern;
  textures.mcs = pattern;
}

function generateZones() {
  const placed = [];
  const zones = [];

  const configs = [
    {
      name: 'MCS Construction',
      description: 'Future site of the Computer Science building.',
      tilesWide: 5,
      tilesHigh: 5,
      color: textures.mcs,
      padding: grid.cell
    },
    {
      name: 'Concrete Depot',
      description: 'Unlimited concrete supply.',
      tilesWide: 2,
      tilesHigh: 2,
      color: '#9c9c9c',
      padding: grid.cell * 0.75,
      material: 'concrete'
    },
    {
      name: 'Wood Depot',
      description: 'Lumber pickup for mid floors.',
      tilesWide: 2,
      tilesHigh: 2,
      color: '#9b6d3c',
      padding: grid.cell * 0.75,
      material: 'wood'
    },
    {
      name: 'Glass Depot',
      description: 'Glass and facade materials.',
      tilesWide: 2,
      tilesHigh: 2,
      color: '#6bd3ff',
      padding: grid.cell * 0.75,
      material: 'glass'
    },
    {
      name: 'Starbucks',
      description: 'Quick caffeine stop for the crew.',
      tilesWide: 2,
      tilesHigh: 2,
      color: textures.cafe,
      padding: grid.cell * 0.75
    },
    {
      name: 'Dorm Beds',
      description: 'Where exhausted workers rest up.',
      tilesWide: 2,
      tilesHigh: 2,
      color: textures.dorm,
      padding: grid.cell * 0.75
    }
  ];

  configs.forEach(config => {
    const zone = placeRandomZone(config, placed, config.padding);
    zones.push(zone);
    placed.push(zone);
  });

  return zones;
}

function computeRockForbiddenCells(zones) {
  const forbidden = new Set();
  const margin = 1;
  zones.forEach(zone => {
    const startCol = Math.floor(zone.x / grid.cell);
    const startRow = Math.floor(zone.y / grid.cell);
    const cols = Math.floor(zone.width / grid.cell);
    const rows = Math.floor(zone.height / grid.cell);
    for (let col = startCol - margin; col < startCol + cols + margin; col++) {
      for (let row = startRow - margin; row < startRow + rows + margin; row++) {
        if (withinGrid(col, row)) {
          forbidden.add(cellKey({ col, row }));
        }
      }
    }
  });
  return forbidden;
}

function placeRandomZone(config, placed, padding) {
  const width = config.tilesWide * grid.cell;
  const height = config.tilesHigh * grid.cell;
  let minCol = EDGE_MARGIN;
  let minRow = EDGE_MARGIN;
  let maxCol = grid.cols - config.tilesWide - EDGE_MARGIN;
  let maxRow = grid.rows - config.tilesHigh - EDGE_MARGIN;

  if (maxCol < minCol) {
    minCol = 0;
    maxCol = grid.cols - config.tilesWide;
  }
  if (maxRow < minRow) {
    minRow = 0;
    maxRow = grid.rows - config.tilesHigh;
  }

  let attempts = 0;

  while (attempts < 400) {
    const col = getRandomInt(minCol, maxCol);
    const row = getRandomInt(minRow, maxRow);
    const zone = {
      name: config.name,
      description: config.description,
      x: col * grid.cell,
      y: row * grid.cell,
      width,
      height,
      color: config.color,
      solid: true,
      material: config.material || null
    };

    const overlaps = placed.some(existing => rectsOverlap(zone, expandedRect(existing, padding)));
    if (!overlaps) {
      return zone;
    }
    attempts += 1;
  }

  const fallbackCol = Math.max(minCol, Math.min(maxCol, EDGE_MARGIN));
  const fallbackRow = Math.max(minRow, Math.min(maxRow, EDGE_MARGIN));

  return {
    name: config.name,
    description: config.description,
    x: fallbackCol * grid.cell,
    y: fallbackRow * grid.cell,
    width,
    height,
    color: config.color,
    solid: true,
    material: config.material || null
  };
}

function createBlockedSetFromZones(zones) {
  const set = new Set();
  zones.forEach(zone => markZoneCells(set, zone));
  return set;
}

function createBlockedSet(zones, rocks) {
  const set = createBlockedSetFromZones(zones);
  rocks.forEach(rock => {
    rock.cells.forEach(cell => set.add(cellKey(cell)));
  });
  return set;
}

function markZoneCells(set, zone) {
  const startCol = Math.floor(zone.x / grid.cell);
  const startRow = Math.floor(zone.y / grid.cell);
  const cols = Math.floor(zone.width / grid.cell);
  const rows = Math.floor(zone.height / grid.cell);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      set.add(cellKey({ col: startCol + c, row: startRow + r }));
    }
  }
}

function findPlayerStartCell(blockedSet) {
  const preferred = { col: Math.floor(grid.cols / 2), row: grid.rows - 2 };
  if (!blockedSet.has(cellKey(preferred))) {
    return preferred;
  }
  return findNearestWalkableCell(preferred, blockedSet);
}

function findNearestWalkableCell(start, blockedSet) {
  const queue = [start];
  const visited = new Set([cellKey(start)]);

  while (queue.length > 0) {
    const cell = queue.shift();
    const key = cellKey(cell);
    if (withinGrid(cell.col, cell.row) && !blockedSet.has(key)) {
      return cell;
    }

    const neighbors = [
      { col: cell.col + 1, row: cell.row },
      { col: cell.col - 1, row: cell.row },
      { col: cell.col, row: cell.row + 1 },
      { col: cell.col, row: cell.row - 1 }
    ];

    neighbors.forEach(neighbor => {
      const nKey = cellKey(neighbor);
      if (!visited.has(nKey) && withinGrid(neighbor.col, neighbor.row)) {
        visited.add(nKey);
        queue.push(neighbor);
      }
    });
  }

  return { col: 1, row: 1 };
}

function withinGrid(col, row) {
  return col >= 0 && row >= 0 && col < grid.cols && row < grid.rows;
}

function generateRocks(zones, startCell, zoneEdgeMap, forbiddenCells = new Set()) {
  const occupancy = createBlockedSetFromZones(zones);
  const rocks = [];
  const rockCount = getRandomInt(7, 12);
  const shapeTypes = ['rectangle', 'square', 'circle'];

  for (let i = 0; i < rockCount; i++) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 350) {
      attempts += 1;
      const type = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
      let cells = [];

      if (type === 'rectangle') {
        const width = getRandomInt(3, 6);
        const height = getRandomInt(2, 4);
        const maxCol = grid.cols - width;
        const maxRow = grid.rows - height;
        if (maxCol < 0 || maxRow < 0) continue;
        const originCol = getRandomInt(0, maxCol);
        const originRow = getRandomInt(0, maxRow);
        for (let dx = 0; dx < width; dx++) {
          for (let dy = 0; dy < height; dy++) {
            cells.push({ col: originCol + dx, row: originRow + dy });
          }
        }
      } else if (type === 'square') {
        const size = getRandomInt(2, 4);
        const maxCol = grid.cols - size;
        const maxRow = grid.rows - size;
        if (maxCol < 0 || maxRow < 0) continue;
        const originCol = getRandomInt(0, maxCol);
        const originRow = getRandomInt(0, maxRow);
        for (let dx = 0; dx < size; dx++) {
          for (let dy = 0; dy < size; dy++) {
            cells.push({ col: originCol + dx, row: originRow + dy });
          }
        }
      } else {
        const radius = getRandomInt(1, 2);
        const diameter = radius * 2 + 1;
        const maxCol = grid.cols - diameter;
        const maxRow = grid.rows - diameter;
        if (maxCol < 0 || maxRow < 0) continue;
        const originCol = getRandomInt(0, maxCol);
        const originRow = getRandomInt(0, maxRow);
        const centerCol = originCol + radius;
        const centerRow = originRow + radius;
        for (let col = originCol; col < originCol + diameter; col++) {
          for (let row = originRow; row < originRow + diameter; row++) {
            const dx = col - centerCol;
            const dy = row - centerRow;
            if (dx * dx + dy * dy <= radius * radius + 0.4) {
              cells.push({ col, row });
            }
          }
        }
      }

      if (!cells.length) continue;
      if (cells.some(cell => !withinGrid(cell.col, cell.row))) continue;
      if (cells.some(cell => cell.col <= 0 || cell.row <= 0 || cell.col >= grid.cols - 1 || cell.row >= grid.rows - 1)) continue;
      if (cells.some(cell => forbiddenCells.has(cellKey(cell)))) continue;
      if (cells.some(cell => occupancy.has(cellKey(cell)))) continue;
      if (cells.some(cell => cell.col === startCell.col && cell.row === startCell.row)) continue;

      cells.forEach(cell => occupancy.add(cellKey(cell)));

      if (ensureConnectivity(occupancy, startCell, zoneEdgeMap)) {
        let kind = 'rock';
        if (type === 'rectangle' && Math.random() < 0.45) {
          kind = 'pond';
        } else if (type === 'circle') {
          kind = 'fountain';
        }
        rocks.push({ cells, kind });
        placed = true;
      } else {
        cells.forEach(cell => occupancy.delete(cellKey(cell)));
      }
    }
  }

  return rocks;
}

function ensureConnectivity(occupancy, startCell, zoneEdgeMap) {
  if (!withinGrid(startCell.col, startCell.row) || occupancy.has(cellKey(startCell))) {
    return false;
  }
  const reachable = floodFill(occupancy, startCell);
  return zoneEdgeMap.every(edges => edges.some(cell => {
    const key = cellKey(cell);
    return !occupancy.has(key) && reachable.has(key);
  }));
}

function floodFill(occupancy, startCell) {
  const visited = new Set();
  const queue = [];
  const startKey = cellKey(startCell);
  queue.push(startCell);
  visited.add(startKey);

  while (queue.length) {
    const cell = queue.shift();
    const neighbors = [
      { col: cell.col + 1, row: cell.row },
      { col: cell.col - 1, row: cell.row },
      { col: cell.col, row: cell.row + 1 },
      { col: cell.col, row: cell.row - 1 }
    ];

    neighbors.forEach(neighbor => {
      const key = cellKey(neighbor);
      if (!visited.has(key) && withinGrid(neighbor.col, neighbor.row) && !occupancy.has(key)) {
        visited.add(key);
        queue.push(neighbor);
      }
    });
  }

  return visited;
}

function getZoneEdgeCells(zone) {
  const cells = [];
  const startCol = Math.floor(zone.x / grid.cell);
  const startRow = Math.floor(zone.y / grid.cell);
  const cols = Math.floor(zone.width / grid.cell);
  const rows = Math.floor(zone.height / grid.cell);

  for (let col = startCol; col < startCol + cols; col++) {
    cells.push({ col, row: startRow - 1 });
    cells.push({ col, row: startRow + rows });
  }
  for (let row = startRow; row < startRow + rows; row++) {
    cells.push({ col: startCol - 1, row });
    cells.push({ col: startCol + cols, row });
  }

  const unique = new Map();
  cells.forEach(cell => {
    if (withinGrid(cell.col, cell.row)) {
      unique.set(cellKey(cell), cell);
    }
  });
  return Array.from(unique.values());
}

function buildRockTiles(rocks) {
  const tiles = [];
  rocks.forEach(rock => {
    rock.cells.forEach(cell => {
      tiles.push({
        x: cell.col * grid.cell,
        y: cell.row * grid.cell,
        width: grid.cell,
        height: grid.cell,
        solid: true
      });
    });
  });
  return tiles;
}

// ===== Entity factories =====
function createPlayer(cell) {
  const width = 26;
  const height = 26;
  return {
    x: cell.col * grid.cell + (grid.cell - width) / 2,
    y: cell.row * grid.cell + (grid.cell - height) / 2,
    width,
    height,
    speed: 150,
    color: '#f9f871',
    item: 'none',
    material: null,
    cooldown: 0
  };
}

function createWorkers(playerCell, blocked) {
  const builderCell = findWorkerCell({ col: playerCell.col - 2, row: playerCell.row - 1 }, blocked);
  const deliveryCell = findWorkerCell({ col: playerCell.col + 2, row: playerCell.row - 1 }, blocked);
  return [
    createWorker('W1', 'builder', 'Builder', builderCell, '#777d8a', '#f4a261', '#ffe082'),
    createWorker('W2', 'delivery', 'Delivery', deliveryCell, '#868d9a', '#58d4ff', '#a8e8ff')
  ];
}

function createInitialState(playerCell, blocked) {
  const player = createPlayer(playerCell);
  const workers = createWorkers(playerCell, blocked);
  world.currentMaterial = materialForFloor(1);
  world.redBullBuff = { active: false, expiresAt: 0 };
  world.redBullTile = null;
  world.nextRedBullAt = RED_BULL_INTERVAL;
  return {
    time: { elapsed: 0, speed: 1 },
    progress: { floorsBuilt: 0, totalFloors: MAX_FLOORS },
    floor: { n: 1, progress: 0, need: materialNeededForFloor(1), buildTime: buildTimeFor(1) },
    stock: { concrete: 2, wood: 0, glass: 0 },
    player,
    workers
  };
}

function findWorkerCell(preferred, blocked) {
  if (!preferred || !withinGrid(preferred.col, preferred.row) || blocked.has(cellKey(preferred))) {
    return findNearestWalkableCell(preferred || { col: 2, row: 2 }, blocked);
  }
  return preferred;
}

function createWorker(id, role, name, cell, idleColor, activeColor, accentColor) {
  const width = 20;
  const height = 20;
  const maxStamina = role === 'delivery' ? DELIVERY_BASE_STAMINA : BUILDER_BASE_STAMINA;
  return {
    id,
    role,
    name,
    stateMachine: createStateMachine(role),
    x: cell.col * grid.cell + (grid.cell - width) / 2,
    y: cell.row * grid.cell + (grid.cell - height) / 2,
    width,
    height,
    colorIdle: idleColor,
    colorActive: activeColor,
    accentColor,
    order: 'idle',
    stamina: maxStamina,
    maxStamina,
    level: 1,
    levelGlow: 0,
    inv: 0,
    cargo: null,
    orderStarted: false,
    tripTimer: 0,
    idleSpeed: WORKER_IDLE_SPEED,
    idleCooldown: Math.random() * 1.5,
    target: null,
    path: null,
    pathIndex: 0,
    pathGoal: null,
    pathNeedsRecalc: false,
    pathReplanTimer: 0,
    pathBlocked: false,
    pathFailureCooldown: 0,
    activity: 'idle',
    visible: true,
    buildReserved: false,
    restAnchor: null,
    taskTimer: 0
  };
}

// ===== Player controls =====
function handleMovement(dt) {
  let playerHorizontalInput = 0;
  let playerVerticalInput = 0;
  if (keys['KeyW']) playerVerticalInput -= 1;
  if (keys['KeyS']) playerVerticalInput += 1;
  if (keys['KeyA']) playerHorizontalInput -= 1;
  if (keys['KeyD']) playerHorizontalInput += 1;

  if (playerHorizontalInput !== 0 && playerVerticalInput !== 0) {
    const diagonalNormalization = Math.SQRT1_2;
    playerHorizontalInput *= diagonalNormalization;
    playerVerticalInput *= diagonalNormalization;
  }

  const distance = player.speed * getPlayerSpeedMultiplier() * dt * state.time.speed;

  const collisionRects = getCollisionRects();

  if (playerHorizontalInput !== 0) {
    const nextRect = {
      x: player.x + playerHorizontalInput * distance,
      y: player.y,
      width: player.width,
      height: player.height
    };
    if (!collisionRects.some(s => rectsOverlap(nextRect, s))) {
      player.x = nextRect.x;
    }
  }

  if (playerVerticalInput !== 0) {
    const nextRect = {
      x: player.x,
      y: player.y + playerVerticalInput * distance,
      width: player.width,
      height: player.height
    };
    if (!collisionRects.some(s => rectsOverlap(nextRect, s))) {
      player.y = nextRect.y;
    }
  }

  player.x = clamp(player.x, 2, canvas.width - player.width - 2);
  player.y = clamp(player.y, 2, canvas.height - player.height - 2);
}

// ===== Worker brain loop =====
function updateWorkers(dt) {
  const simDt = gameComplete ? 0 : dt * state.time.speed;
  workers.forEach(worker => {
    worker.pathReplanTimer += simDt;
    if (worker.pathFailureCooldown > 0) {
      worker.pathFailureCooldown = Math.max(0, worker.pathFailureCooldown - simDt);
    }
    if (!gameComplete) {
      if (worker.target || (worker.path && worker.path.length > 0)) {
        if (worker.pathReplanTimer >= PATH_REPLAN_INTERVAL) {
          worker.pathNeedsRecalc = true;
          worker.pathReplanTimer = 0;
        }
      } else {
        worker.pathReplanTimer = 0;
      }
    } else {
      worker.target = null;
      worker.path = null;
    }

    if (!gameComplete) {
      processWorkerOrder(worker, simDt);
    }

    if (worker.levelGlow > 0) {
      worker.levelGlow = Math.max(0, worker.levelGlow - simDt);
    }

    if (!gameComplete && worker.order === 'idle' && worker.visible) {
      if (worker.idleCooldown > 0) {
        worker.idleCooldown -= simDt;
      } else if (!worker.target) {
        const target = pickTargetCell(worker, blockedCells);
        if (target) {
          setWorkerDestination(worker, target);
        }
        worker.idleCooldown = Math.random() * 1.5 + 0.5;
      }

      if (worker.target) {
        const reached = moveWorkerToward(worker, worker.target, worker.idleSpeed * getWorkerSpeedMultiplier(), simDt);
        if (reached) {
          setWorkerDestination(worker, null);
        }
      }
    }
  });
}

function processWorkerOrder(worker, dt) {
  if (gameComplete) {
    worker.orderStarted = false;
    return;
  }
  if (worker.order === 'rest') {
    handleRest(worker, dt);
    return;
  }

  if (worker.order === 'idle') {
    worker.activity = 'idle';
    worker.orderStarted = false;
    worker.buildReserved = false;
    worker.taskTimer = 0;
    return;
  }

  if (worker.stamina <= 0) {
    setWorkerOrder(worker, 'rest', `${worker.name} heads to the dorm to recover.`);
    return;
  }

  if (worker.role === 'builder' && worker.order === 'build') {
    handleBuilder(worker, dt);
  } else if (worker.role === 'delivery' && worker.order === 'deliver') {
    handleDelivery(worker, dt);
  }
}

function handleBuilder(worker, dt) {
  const approach = getApproachCenter('MCS Construction');
  if (!approach) {
    return;
  }
  const requiredMaterial = world.currentMaterial;

  if (worker.activity !== 'toSite' && worker.activity !== 'building') {
    worker.activity = 'toSite';
    setWorkerDestination(worker, approach);
  }

  if (worker.activity === 'toSite') {
    const arrived = moveWorkerToward(worker, approach, WORKER_ACTIVE_SPEED * getWorkerSpeedMultiplier(), dt);
    if (arrived) {
      alignWorkerToCenter(worker, approach);
      worker.stateMachine.transition('arriveWork', worker);
      setWorkerDestination(worker, null);
      worker.activity = 'building';
      if (!worker.buildReserved) {
        if ((state.stock[requiredMaterial] || 0) < state.floor.need) {
          setWorkerOrder(worker, 'idle', 'Need more material before building.');
          return;
        }
        if (worker.stamina < STAMINA_BUILD_COST) {
          setWorkerOrder(worker, 'rest', `${worker.name} needs rest before building.`);
          return;
        }
        state.stock[requiredMaterial] = Math.max(0, (state.stock[requiredMaterial] || 0) - state.floor.need);
        worker.stamina = Math.max(0, worker.stamina - STAMINA_BUILD_COST);
        worker.buildReserved = true;
      }
    }
    return;
  }

  if (worker.activity === 'building') {
    if (!worker.buildReserved) {
      worker.activity = 'toSite';
      setWorkerDestination(worker, approach);
      return;
    }
    const buildMultiplier = getBuildTimeMultiplier();
    const progressGain = dt / (state.floor.buildTime * BUILD_PROGRESS_SLOWDOWN * buildMultiplier);
    state.floor.progress = Math.min(1, state.floor.progress + progressGain);
    if (state.floor.progress >= 1) {
      worker.buildReserved = false;
      completeFloor();
      worker.stateMachine.transition('complete', worker);
      if (worker.stamina < STAMINA_BUILD_COST) {
        setWorkerOrder(worker, 'rest', `${worker.name} completes the floor and heads to the dorm.`);
      } else {
        setWorkerOrder(worker, 'idle', `${worker.name} completes the floor!`);
      }
    }
  }
}

function handleDelivery(worker, dt) {
  const requiredMaterial = world.currentMaterial;
  const depotName = getDepotName(requiredMaterial);
  const depotApproach = getApproachCenter(depotName);
  const mcsApproach = getApproachCenter('MCS Construction');
  const label = materialLabel(requiredMaterial);
  if (!depotApproach || !mcsApproach) {
    return;
  }

  const deliveryStates = ['toDepot', 'loading', 'toMcs', 'delivering'];
  if (!deliveryStates.includes(worker.activity)) {
    worker.activity = 'toDepot';
    setWorkerDestination(worker, depotApproach);
  }

  if (worker.activity === 'toDepot') {
    const arrived = moveWorkerToward(worker, depotApproach, WORKER_ACTIVE_SPEED * getWorkerSpeedMultiplier(), dt);
    if (arrived) {
      alignWorkerToCenter(worker, depotApproach);
      worker.stateMachine.transition('arriveSource', worker);
      worker.activity = 'loading';
      worker.taskTimer = 0;
      setWorkerDestination(worker, null);
    }
    return;
  }

  if (worker.activity === 'loading') {
    worker.taskTimer += dt;
    if (worker.taskTimer >= DELIVERY_LOAD_TIME) {
      worker.taskTimer = 0;
      const remaining = Math.max(0, state.floor.need - (state.stock[requiredMaterial] || 0));
      if (remaining <= 0 && (!worker.cargo || worker.cargo !== requiredMaterial)) {
        setWorkerOrder(worker, 'idle', `${label} already stocked for this floor.`);
        return;
      }
      worker.inv = 1;
      worker.cargo = requiredMaterial;
      worker.stateMachine.transition('loadComplete', worker);
      worker.activity = 'toMcs';
      setWorkerDestination(worker, mcsApproach);
    }
    return;
  }

  if (worker.activity === 'toMcs') {
    const arrived = moveWorkerToward(worker, mcsApproach, WORKER_CARRY_SPEED * getWorkerSpeedMultiplier(), dt);
    if (arrived) {
      alignWorkerToCenter(worker, mcsApproach);
      worker.stateMachine.transition('arriveSite', worker);
      worker.activity = 'delivering';
      worker.taskTimer = 0;
    }
    return;
  }

  if (worker.activity === 'delivering') {
    worker.taskTimer += dt;
    if (worker.taskTimer >= DELIVERY_DROP_TIME) {
      worker.taskTimer = 0;
      if (worker.inv <= 0 || !worker.cargo) {
        worker.activity = 'toDepot';
        setWorkerDestination(worker, depotApproach);
        return;
      }
      const delivered = worker.inv;
      state.stock[worker.cargo] = (state.stock[worker.cargo] || 0) + delivered;
      worker.inv = 0;
      const dropMaterial = materialLabel(worker.cargo);
      worker.cargo = null;
      worker.stateMachine.transition('dropComplete', worker);
      worker.stamina = Math.max(0, worker.stamina - DELIVERY_TRIP_COST);
      statusEl.textContent = `${worker.name} delivered ${delivered} ${dropMaterial.toLowerCase()}.`;
      if (worker.stamina <= 0) {
        setWorkerOrder(worker, 'rest', `${worker.name} is exhausted and heads to the dorm.`);
        return;
      }
      worker.activity = 'toDepot';
      setWorkerDestination(worker, depotApproach);
    }
  }
}

function handleRest(worker, dt) {
  const dormApproach = getApproachCenter('Dorm Beds');
  if (!dormApproach) {
    return;
  }

  if (worker.activity !== 'toDorm' && worker.activity !== 'resting') {
    worker.activity = 'toDorm';
    worker.visible = true;
    setWorkerDestination(worker, dormApproach);
    worker.restAnchor = dormApproach;
  }

  if (worker.activity === 'toDorm') {
    const arrived = moveWorkerToward(worker, dormApproach, WORKER_ACTIVE_SPEED * getWorkerSpeedMultiplier(), dt);
    if (arrived) {
      alignWorkerToCenter(worker, dormApproach);
      worker.stateMachine.transition('arriveRest', worker);
      setWorkerDestination(worker, null);
      worker.activity = 'resting';
      worker.visible = false;
    }
    return;
  }

  if (worker.activity === 'resting') {
    const maxStamina = getWorkerMaxStamina(worker);
    worker.stamina = Math.min(maxStamina, worker.stamina + STAMINA_REST_RATE * dt);
    if (worker.stamina >= maxStamina - 0.01) {
      worker.stamina = maxStamina;
      worker.visible = true;
      if (worker.restAnchor) {
        alignWorkerToCenter(worker, worker.restAnchor);
      }
      worker.stateMachine.transition('recovered', worker);
      setWorkerOrder(worker, 'idle', `${worker.name} feels refreshed and leaves the dorm.`);
    }
  }
}

function celebrateDeliveryLevelUp() {
  const deliveryWorker = workers.find(w => w.role === 'delivery');
  if (!deliveryWorker || !state.progress) {
    return;
  }
  const floorsBuilt = state.progress.floorsBuilt;
  const totalFloors = state.progress.totalFloors;
  deliveryWorker.maxStamina = DELIVERY_BASE_STAMINA + DELIVERY_STAMINA_PER_FLOOR * floorsBuilt;
  deliveryWorker.stamina = deliveryWorker.maxStamina;
  deliveryWorker.level = Math.min(totalFloors + 1, floorsBuilt + 1);
  deliveryWorker.levelGlow = DELIVERY_LEVEL_FLASH_DURATION;
  refreshWorkerCards();
}

function completeFloor() {
  const finished = state.floor.n;
  state.progress.floorsBuilt = Math.min(state.progress.floorsBuilt + 1, state.progress.totalFloors);
  celebrateDeliveryLevelUp();

  if (finished >= MAX_FLOORS) {
    state.floor.progress = 1;
    state.floor.need = 0;
    refreshMcsZoneTexture();
    triggerWin(finished);
    return;
  }

  state.floor.n = Math.min(finished + 1, MAX_FLOORS);
  state.floor.progress = 0;
  state.floor.need = materialNeededForFloor(state.floor.n);
  state.floor.buildTime = buildTimeFor(state.floor.n);
  world.currentMaterial = materialForFloor(state.floor.n);
  workers.forEach(w => {
    if (w.role === 'delivery' && w.order === 'deliver') {
      w.activity = 'toDepot';
      w.inv = 0;
      w.cargo = null;
      setWorkerDestination(w, getApproachCenter(getDepotName(world.currentMaterial)));
    }
  });
  refreshMcsZoneTexture();
  const message = `Floor ${finished} complete! Preparing materials for floor ${state.floor.n}.`;
  statusEl.textContent = message;
  showBubble(`Floor ${finished} complete!`);
}

function triggerWin(finalFloor) {
  if (gameComplete) {
    return;
  }
  gameComplete = true;
  finishTime = state.time.elapsed;
  state.time.speed = 0;
  updateSpeedLabel();
  document.body.classList.add('game-complete');
  if (winOverlay) {
    winOverlay.classList.add('show');
  }
  if (winTimeEl) {
    winTimeEl.textContent = formatTime(finishTime);
  }
  if (pauseBtn) {
    pauseBtn.textContent = 'Paused';
    pauseBtn.disabled = true;
  }
  if (speedBtn) {
    speedBtn.disabled = true;
  }
  if (restartBtn) {
    restartBtn.focus();
  }
  const message = `Construction complete! ${finalFloor} floors ready for class.`;
  statusEl.textContent = message;
  showBubble(`Campus ready in ${formatTime(finishTime)}!`);
}

function restartGame() {
  if (bubbleTimeout) {
    clearTimeout(bubbleTimeout);
    bubbleTimeout = null;
  }
  state = createInitialState(spawnCell, blockedCells);
  player = state.player;
  workers = state.workers;
  state.time.speed = speedOptions[speedIndex];
  updateSpeedLabel();
  finishTime = 0;
  gameComplete = false;
  isPaused = false;
  document.body.classList.remove('game-complete');
  if (winOverlay) {
    winOverlay.classList.remove('show');
  }
  if (winTimeEl) {
    winTimeEl.textContent = '00:00';
  }
  if (pauseBtn) {
    pauseBtn.disabled = false;
    pauseBtn.textContent = 'Pause';
  }
  if (speedBtn) {
    speedBtn.disabled = false;
  }
  refreshMcsZoneTexture();
  statusEl.textContent = 'Project reset. Ready for another build!';
  showBubble('Fresh blueprint loaded. Let\'s build again!');
  refreshWorkerCards();
  updateHUD();
}

function pickTargetCell(worker, blocked) {
  const baseCol = Math.round((worker.x + worker.width / 2) / grid.cell);
  const baseRow = Math.round((worker.y + worker.height / 2) / grid.cell);

  for (let attempt = 0; attempt < 20; attempt++) {
    const offsetCol = getRandomInt(-4, 4);
    const offsetRow = getRandomInt(-3, 3);
    const col = baseCol + offsetCol;
    const row = baseRow + offsetRow;
    if (!withinGrid(col, row)) continue;
    const key = `${col},${row}`;
    if (blocked.has(key)) continue;
    return {
      x: col * grid.cell + grid.cell / 2,
      y: row * grid.cell + grid.cell / 2
    };
  }

  return null;
}

function moveWorker(worker, dx, dy) {
  let moved = false;
  const collisionRects = getCollisionRects({ includeWorkers: true, excludeWorker: worker, includePlayer: true });

  if (dx !== 0) {
    const nextRect = {
      x: worker.x + dx,
      y: worker.y,
      width: worker.width,
      height: worker.height
    };
    if (!collisionRects.some(s => rectsOverlap(nextRect, s))) {
      worker.x = nextRect.x;
      moved = true;
    } else if (Math.abs(dx) > 0.01) {
      worker.pathNeedsRecalc = true;
      worker.pathReplanTimer = 0;
    }
  }

  if (dy !== 0) {
    const nextRect = {
      x: worker.x,
      y: worker.y + dy,
      width: worker.width,
      height: worker.height
    };
    if (!collisionRects.some(s => rectsOverlap(nextRect, s))) {
      worker.y = nextRect.y;
      moved = true;
    } else if (Math.abs(dy) > 0.01) {
      worker.pathNeedsRecalc = true;
      worker.pathReplanTimer = 0;
    }
  }

  worker.x = clamp(worker.x, 2, canvas.width - worker.width - 2);
  worker.y = clamp(worker.y, 2, canvas.height - worker.height - 2);
  return moved;
}

function moveTowardPoint(worker, target, speed, dt) {
  const center = workerCenter(worker);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= WORKER_APPROACH_BUFFER) {
    alignWorkerToCenter(worker, target);
    return true;
  }
  if (distance === 0) {
    return true;
  }
  const step = speed * dt;
  const ratio = Math.min(1, step / distance);
  const moveX = dx * ratio;
  const moveY = dy * ratio;
  const movedX = moveWorker(worker, moveX, 0);
  const movedY = moveWorker(worker, 0, moveY);
  if ((!movedX && Math.abs(moveX) > 0.01) || (!movedY && Math.abs(moveY) > 0.01)) {
    worker.pathNeedsRecalc = true;
  }
  const newCenter = workerCenter(worker);
  return Math.hypot(target.x - newCenter.x, target.y - newCenter.y) <= WORKER_APPROACH_BUFFER;
}

function ensureWorkerPath(worker, target) {
  if (!target) {
    worker.path = null;
    worker.pathIndex = 0;
    worker.pathGoal = null;
    worker.pathBlocked = false;
    worker.pathFailureCooldown = 0;
    return false;
  }

  const goalCell = pointToCell(target);
  const goalKey = cellKey(goalCell);
  const currentCell = pointToCell(workerCenter(worker));

  if (cellsEqual(currentCell, goalCell)) {
    worker.path = null;
    worker.pathIndex = 0;
    worker.pathGoal = goalKey;
    worker.pathNeedsRecalc = false;
    worker.pathBlocked = false;
    worker.pathFailureCooldown = 0;
    return true;
  }

  const hasPathArray = Array.isArray(worker.path);
  const hasActivePath = hasPathArray && worker.pathIndex < worker.path.length;
  const needsNewPath =
    worker.pathNeedsRecalc ||
    worker.pathGoal !== goalKey ||
    (!hasActivePath && !hasPathArray);

  if (needsNewPath) {
    if (
      worker.pathBlocked &&
      worker.pathFailureCooldown > 0 &&
      !worker.pathNeedsRecalc &&
      worker.pathGoal === goalKey
    ) {
      return false;
    }

    const pathCells = findPath(currentCell, goalCell, worker);

    if (pathCells && pathCells.length > 0) {
      if (cellsEqual(pathCells[0], currentCell)) {
        pathCells.shift();
      }
      worker.path = pathCells.map(cellToCenter);
      worker.pathIndex = 0;
      worker.pathBlocked = false;
      worker.pathFailureCooldown = 0;
    } else {
      worker.path = null;
      worker.pathIndex = 0;
      worker.pathBlocked = true;
      worker.pathFailureCooldown = PATH_FAILURE_RETRY;
      worker.pathGoal = goalKey;
      worker.pathNeedsRecalc = false;
      worker.pathReplanTimer = 0;
      return false;
    }

    worker.pathGoal = goalKey;
    worker.pathNeedsRecalc = false;
    worker.pathReplanTimer = 0;
    return true;
  }

  return true;
}

function setWorkerDestination(worker, target) {
  if (!target) {
    worker.target = null;
    worker.path = null;
    worker.pathIndex = 0;
    worker.pathGoal = null;
    worker.pathNeedsRecalc = false;
    worker.pathReplanTimer = 0;
    worker.pathBlocked = false;
    worker.pathFailureCooldown = 0;
    return;
  }
  worker.target = target;
  worker.pathNeedsRecalc = true;
  worker.pathGoal = null;
  worker.pathReplanTimer = 0;
  worker.pathBlocked = false;
  worker.pathFailureCooldown = 0;
}

function moveWorkerToward(worker, target, speed, dt) {
  if (!target) {
    return false;
  }

  const pathReady = ensureWorkerPath(worker, target);
  if (!pathReady) {
    return false;
  }

  if (worker.path && worker.pathIndex < worker.path.length) {
    const waypoint = worker.path[worker.pathIndex];
    if (moveTowardPoint(worker, waypoint, speed, dt)) {
      worker.pathIndex += 1;
    }
    if (worker.pathIndex < worker.path.length) {
      return false;
    }
  }

  const arrived = moveTowardPoint(worker, target, speed, dt);
  if (arrived) {
    worker.path = null;
    worker.pathIndex = 0;
    worker.pathGoal = null;
    worker.pathNeedsRecalc = false;
    worker.pathReplanTimer = 0;
    worker.pathBlocked = false;
    worker.pathFailureCooldown = 0;
    return true;
  }

  return false;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shadeColor(hex, percent) {
  const normalized = hex.replace('#', '');
  const num = parseInt(normalized, 16);
  const r = clamp((num >> 16) + Math.round(2.55 * percent), 0, 255);
  const g = clamp(((num >> 8) & 0x00ff) + Math.round(2.55 * percent), 0, 255);
  const b = clamp((num & 0x0000ff) + Math.round(2.55 * percent), 0, 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function isRedBullActive() {
  return world.redBullBuff.active && state.time.elapsed < world.redBullBuff.expiresAt;
}

function getPlayerSpeedMultiplier() {
  return isRedBullActive() ? RED_BULL_PLAYER_MULT : 1;
}

function getWorkerSpeedMultiplier() {
  return isRedBullActive() ? RED_BULL_WORKER_MULT : 1;
}

function getBuildTimeMultiplier() {
  return isRedBullActive() ? RED_BULL_BUILD_MULT : 1;
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let col = 1; col < grid.cols; col++) {
    const x = col * grid.cell + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let row = 1; row < grid.rows; row++) {
    const y = row * grid.cell + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawRocks() {
  rocks.forEach(rock => {
    const pattern = rock.kind === 'pond'
      ? textures.pond
      : rock.kind === 'fountain'
        ? textures.pond
        : textures.rock;
    rock.cells.forEach(cell => {
      const x = cell.col * grid.cell;
      const y = cell.row * grid.cell;
      ctx.fillStyle = pattern;
      ctx.fillRect(x, y, grid.cell, grid.cell);
      ctx.strokeStyle = rock.kind === 'pond' ? '#0b2038' : '#11141d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, grid.cell - 2, grid.cell - 2);
      if (rock.kind === 'pond' || rock.kind === 'fountain') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(x + 4, y + 4, grid.cell - 8, 3);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x, y + grid.cell - 6, grid.cell, 6);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(x + 6, y + 6, 6, 2);
      }
    });
  });
}

function drawZones() {
  zones.forEach(zone => {
    ctx.fillStyle = zone.color instanceof CanvasPattern ? zone.color : zone.color;
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(zone.x, zone.y, zone.width, 4);

    ctx.strokeStyle = '#0a0d18';
    ctx.lineWidth = 2;
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
    ctx.strokeStyle = 'rgba(252, 227, 138, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(zone.x - 3, zone.y - 3, zone.width + 6, zone.height + 6);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(zone.x, zone.y, zone.width, 18);

    ctx.fillStyle = '#f7f7fb';
    ctx.font = '12px "Press Start 2P", "VT323", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(zone.name, zone.x + zone.width / 2, zone.y + 2);

    ctx.font = '10px "Press Start 2P", "VT323", monospace';
    ctx.fillStyle = 'rgba(252, 227, 138, 0.85)';
    ctx.fillText('SPACE', zone.x + zone.width / 2, zone.y + zone.height - 18);

    if (zone.name === 'MCS Construction') {
      drawFloorProgress(zone);
    }
  });
  ctx.textAlign = 'left';
}

function drawRedBull() {
  if (!world.redBullTile) {
    return;
  }
  const x = world.redBullTile.col * grid.cell;
  const y = world.redBullTile.row * grid.cell;
  ctx.save();
  ctx.fillStyle = '#1d4df5';
  ctx.fillRect(x + 4, y + 4, grid.cell - 8, grid.cell - 8);
  ctx.strokeStyle = '#a8d8ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, y + 4, grid.cell - 8, grid.cell - 8);
  ctx.fillStyle = '#fce38a';
  ctx.beginPath();
  ctx.moveTo(x + grid.cell / 2 - 4, y + 8);
  ctx.lineTo(x + grid.cell / 2 + 2, y + grid.cell / 2 - 2);
  ctx.lineTo(x + grid.cell / 2 - 4, y + grid.cell / 2 - 2);
  ctx.lineTo(x + grid.cell / 2 + 4, y + grid.cell - 10);
  ctx.lineTo(x + grid.cell / 2 - 2, y + grid.cell / 2 + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFloorProgress(zone) {
  if (!state || !state.progress) {
    return;
  }
  const totalFloors = state.progress.totalFloors;
  const floorsBuilt = Math.min(state.progress.floorsBuilt, totalFloors);
  const currentFloorProgress = Math.min(1, state.floor.progress);
  const overallProgress = Math.min(1, (floorsBuilt + currentFloorProgress) / totalFloors);

  const padding = 10;
  const segmentSpacing = 4;
  const barWidth = zone.width - padding * 2;
  const segmentWidth = (barWidth - (totalFloors - 1) * segmentSpacing) / totalFloors;
  const barX = zone.x + padding;
  const barY = Math.max(16, zone.y - 30);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '10px "Press Start 2P", "VT323", monospace';

  ctx.fillStyle = 'rgba(6, 8, 18, 0.78)';
  ctx.fillRect(barX - 12, barY - 18, barWidth + 24, 36);
  ctx.strokeStyle = 'rgba(252, 227, 138, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barX - 12, barY - 18, barWidth + 24, 36);

  for (let i = 0; i < totalFloors; i += 1) {
    const segmentX = barX + i * (segmentWidth + segmentSpacing);
    const completion = i < floorsBuilt ? 1 : i === floorsBuilt ? currentFloorProgress : 0;
    ctx.fillStyle = 'rgba(32, 36, 56, 0.9)';
    ctx.fillRect(segmentX, barY - 6, segmentWidth, 12);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeRect(segmentX, barY - 6, segmentWidth, 12);
    if (completion > 0) {
      const gradient = ctx.createLinearGradient(segmentX, barY - 6, segmentX + segmentWidth, barY + 6);
      gradient.addColorStop(0, '#67f3a2');
      gradient.addColorStop(1, '#2db4ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(segmentX, barY - 6, segmentWidth * completion, 12);
    }
  }

  ctx.fillStyle = '#f7f7fb';
  ctx.fillText(`Floor ${Math.min(state.floor.n, totalFloors)} of ${totalFloors}`, barX + barWidth / 2, barY - 12);
  ctx.fillStyle = 'rgba(252, 227, 138, 0.95)';
  ctx.fillText(`${Math.round(overallProgress * 100)}%`, barX + barWidth / 2, barY + 10);
  ctx.restore();
}

function drawWorkers() {
  ctx.font = '10px "Press Start 2P", "VT323", monospace';
  ctx.textBaseline = 'bottom';
  workers.forEach(worker => {
    if (!worker.visible) {
      return;
    }
    const bodyY = worker.y;
    ctx.fillStyle = '#00000088';
    ctx.fillRect(worker.x - 4, bodyY + worker.height, worker.width + 8, 6);

    const isIdle = worker.order === 'idle';
    const highlight = worker.role === 'delivery' && worker.levelGlow > 0;
    const idleColor = highlight ? '#ffe082' : worker.colorIdle;
    const activeColor = highlight ? '#ffb300' : worker.colorActive;
    const accentColor = highlight ? '#ffe9a6' : worker.accentColor;
    const idleAccent = highlight ? '#e0c777' : '#5b6170';
    const beltColor = highlight ? '#ffbfa5' : (isIdle ? '#6e7280' : '#f08080');
    const infoBg = highlight ? 'rgba(66, 42, 12, 0.85)' : '#1d2238ee';
    const nameColor = highlight ? '#ffe082' : '#f7f7fb';
    const levelColor = highlight ? '#fff4c1' : '#9aa0b7';
    const stateColor = highlight ? '#fff0a6' : (isIdle ? '#9aa0b7' : '#fce38a');

    ctx.fillStyle = isIdle ? idleColor : activeColor;
    ctx.fillRect(worker.x, bodyY, worker.width, worker.height);

    ctx.fillStyle = isIdle ? idleAccent : accentColor;
    ctx.fillRect(worker.x + 2, bodyY, worker.width - 4, 5);

    ctx.fillStyle = isIdle ? '#3f4554' : '#41434f';
    ctx.fillRect(worker.x + 4, bodyY + 4, 4, 4);
    ctx.fillRect(worker.x + worker.width - 8, bodyY + 4, 4, 4);

    ctx.fillStyle = beltColor;
    ctx.fillRect(worker.x + 6, bodyY + worker.height - 6, worker.width - 12, 4);

    ctx.fillStyle = infoBg;
    ctx.fillRect(worker.x - 20, bodyY - 64, worker.width + 40, 58);

    ctx.textAlign = 'center';
    ctx.fillStyle = stateColor;
    ctx.fillText(getWorkerFloatingLabel(worker), worker.x + worker.width / 2, bodyY - 48);

    ctx.fillStyle = levelColor;
    ctx.fillText(`L${worker.level}`, worker.x + worker.width / 2, bodyY - 34);

    ctx.fillStyle = nameColor;
    ctx.fillText(worker.name, worker.x + worker.width / 2, bodyY - 20);

    ctx.fillStyle = stateColor;
    const staminaText = `${worker.stamina.toFixed(1)}/${getWorkerMaxStamina(worker)}`;
    const stateLabel = formatStateLabel(worker.stateMachine.state);
    ctx.fillText(`${stateLabel} · ${staminaText}`, worker.x + worker.width / 2, bodyY - 6);
  });
  ctx.textAlign = 'left';
}

function drawPlayer() {
  const playerCellRect = {
    x: Math.floor(player.x / grid.cell) * grid.cell,
    y: Math.floor(player.y / grid.cell) * grid.cell,
    width: grid.cell,
    height: grid.cell
  };

  if (isRedBullActive()) {
    ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
    ctx.fillRect(playerCellRect.x, playerCellRect.y, playerCellRect.width, playerCellRect.height);
  }

  ctx.fillStyle = '#00000088';
  ctx.fillRect(player.x - 4, player.y + player.height, player.width + 8, 6);

  ctx.fillStyle = '#1d1f2f';
  ctx.fillRect(player.x + 4, player.y + 4, player.width - 8, player.height - 8);

  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height - 6);

  ctx.fillStyle = '#2b2e4a';
  ctx.fillRect(player.x + 6, player.y + 4, 4, 4);
  ctx.fillRect(player.x + player.width - 10, player.y + 4, 4, 4);

  ctx.fillStyle = '#f08080';
  ctx.fillRect(player.x + 6, player.y + player.height - 14, player.width - 12, 8);

  ctx.fillStyle = '#41436a';
  ctx.fillRect(player.x + 2, player.y + player.height - 6, player.width - 4, 6);

  const statusLabels = [];
  if (player.item === 'coffee') {
    statusLabels.push('LATTE');
  }
  if (isRedBullActive()) {
    statusLabels.push('REDBULL');
  }
  if (statusLabels.length > 0) {
    ctx.fillStyle = '#1d2238ee';
    const labelHeight = 26;
    const spacing = 4;
    const totalHeight = statusLabels.length * labelHeight + (statusLabels.length - 1) * spacing;
    let currentY = player.y - 10 - totalHeight;
    statusLabels.forEach(label => {
      ctx.fillRect(player.x - 14, currentY, player.width + 28, labelHeight);
      ctx.fillStyle = '#fce38a';
      ctx.font = '12px "Press Start 2P", "VT323", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, player.x + player.width / 2, currentY + labelHeight / 2 - 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#1d2238ee';
      currentY += labelHeight + spacing;
    });
  }
}

function drawScene() {
  if (textures.grass) {
    ctx.fillStyle = textures.grass;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#0e1320';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (isRedBullActive()) {
    ctx.fillStyle = 'rgba(255, 64, 64, 0.28)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();
  drawRocks();
  drawZones();
  drawRedBull();
  drawWorkers();
  drawPlayer();
}

function update(dt) {
  if (!isPaused) {
    if (!gameComplete) {
      handleMovement(dt);
    }
    const scaledDt = dt * state.time.speed;
    if (!gameComplete) {
      state.time.elapsed += scaledDt;
      updateRedBull(scaledDt);
    }
    if (player.cooldown > 0) {
      const cooldownDelta = gameComplete ? dt : scaledDt;
      player.cooldown = Math.max(0, player.cooldown - cooldownDelta);
    }
    updateWorkers(dt);
  }
  updateHUD();
}

function getContextZone() {
  const playerRect = {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height
  };
  return zones.find(zone => rectsOverlap(playerRect, expandedRect(zone, 10)));
}

function showBubble(message) {
  bubble.textContent = message;
  bubble.style.display = 'block';
  positionBubble();
  if (bubbleTimeout) {
    clearTimeout(bubbleTimeout);
  }
  bubbleTimeout = setTimeout(() => {
    bubble.style.display = 'none';
  }, 2200);
}

function updateRedBull() {
  if (gameComplete) {
    return;
  }
  if (world.redBullBuff.active && state.time.elapsed >= world.redBullBuff.expiresAt) {
    world.redBullBuff.active = false;
  }
  if (!world.redBullTile && state.time.elapsed >= world.nextRedBullAt) {
    spawnRedBullTile();
  }
  if (world.redBullTile) {
    const tileRect = {
      x: world.redBullTile.col * grid.cell,
      y: world.redBullTile.row * grid.cell,
      width: grid.cell,
      height: grid.cell
    };
    if (rectsOverlap(tileRect, getPlayerRect())) {
      applyRedBullBuff();
    }
  }
}

function spawnRedBullTile() {
  const cell = findRedBullSpawnCell();
  if (cell) {
    world.redBullTile = cell;
    world.nextRedBullAt = state.time.elapsed + RED_BULL_INTERVAL;
  } else {
    world.nextRedBullAt = state.time.elapsed + RED_BULL_INTERVAL;
  }
}

function findRedBullSpawnCell() {
  for (let attempt = 0; attempt < 400; attempt++) {
    const col = getRandomInt(EDGE_MARGIN, grid.cols - EDGE_MARGIN - 1);
    const row = getRandomInt(EDGE_MARGIN, grid.rows - EDGE_MARGIN - 1);
    const key = cellKey({ col, row });
    if (blockedCells.has(key)) {
      continue;
    }
    return { col, row };
  }
  return null;
}

function applyRedBullBuff() {
  world.redBullBuff = { active: true, expiresAt: state.time.elapsed + RED_BULL_DURATION };
  world.redBullTile = null;
  world.nextRedBullAt = state.time.elapsed + RED_BULL_INTERVAL;
  const message = 'Red Bull collected! Everyone speeds up.';
  statusEl.textContent = message;
  showBubble(message);
}

function interact() {
  if (player.cooldown > 0) {
    return;
  }
  player.cooldown = PLAYER_INTERACT_COOLDOWN;

  if (gameComplete) {
    showBubble('Campus is complete! Tap restart to run it again.');
    return;
  }

  const zone = getContextZone();
  const nearbyWorker = findNearbyWorker();

  if (player.item === 'coffee' && nearbyWorker) {
    deliverCoffee();
    return;
  }

  if (zone && zone.material) {
    const depotMsg = `${materialLabel(zone.material)} depot ready. Delivery worker will fetch.`;
    statusEl.textContent = depotMsg;
    showBubble(depotMsg);
    return;
  }

  if (zone && zone.name === 'Starbucks') {
    if (player.item === 'coffee') {
      showBubble('Arms full! Deliver this coffee first.');
    } else {
      player.item = 'coffee';
      showBubble('Hot coffee acquired! Find a worker to perk up.');
      statusEl.textContent = 'Coffee ready. Deliver to the crew to refill stamina.';
    }
    return;
  }

  if (nearbyWorker) {
    const stamina = nearbyWorker.stamina.toFixed(1);
    const staminaCap = getWorkerMaxStamina(nearbyWorker);
    const staminaCapText = Number.isInteger(staminaCap) ? staminaCap : staminaCap.toFixed(1);
    showBubble(`${nearbyWorker.name}: ${stamina}/${staminaCapText} stamina.`);
    return;
  }

  if (zone) {
    showBubble(`${zone.name}: ${zone.description}`);
    return;
  }

  if (player.item === 'coffee') {
    showBubble('You carry coffee. Find a worker to share it.');
  } else {
    showBubble('You wave into the quiet night. Nothing happens.');
  }
}

function findNearbyWorker() {
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  return workers.find(worker => {
    if (!worker.visible) {
      return false;
    }
    const wx = worker.x + worker.width / 2;
    const wy = worker.y + worker.height / 2;
    return Math.hypot(px - wx, py - wy) <= grid.cell * 1.1;
  }) || null;
}

function deliverCoffee() {
  player.item = 'none';
  workers.forEach(worker => {
    const maxStamina = getWorkerMaxStamina(worker);
    worker.stamina = maxStamina;
    if (worker.order === 'rest') {
      worker.visible = true;
      if (worker.restAnchor) {
        alignWorkerToCenter(worker, worker.restAnchor);
      }
      setWorkerOrder(worker, 'idle', `${worker.name} perks up from the latte!`);
    }
  });
  const message = 'Workers refreshed by coffee!';
  statusEl.textContent = message;
  showBubble(message);
  refreshWorkerCards();
}

function togglePause() {
  if (gameComplete) {
    showBubble('Project complete! Restart to play again.');
    return;
  }
  isPaused = !isPaused;
  if (pauseBtn) {
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  }
  statusEl.textContent = isPaused ? 'Simulation paused.' : 'Simulation running.';
}

function updateSpeedLabel() {
  const label = Number.isInteger(state.time.speed) ? state.time.speed : state.time.speed.toFixed(1);
  if (speedBtn) {
    speedBtn.textContent = `Speed: ${label}×`;
  }
  return label;
}

function cycleSpeed() {
  if (gameComplete) {
    showBubble('Speed locked — campus is already complete.');
    return;
  }
  speedIndex = (speedIndex + 1) % speedOptions.length;
  state.time.speed = speedOptions[speedIndex];
  const label = updateSpeedLabel();
  statusEl.textContent = `Speed set to ${label}×.`;
}

function handleWorkerAction(workerKey, action) {
  if (gameComplete) {
    showBubble('Project complete! Restart to assign new orders.');
    return;
  }
  const worker = workers.find(w => w.role === workerKey);
  if (!worker) {
    return;
  }
  if (worker.order === 'rest' && action !== 'cancel') {
    showBubble(`${worker.name} is resting at the dorm.`);
    return;
  }
  if (action === 'cancel') {
    setWorkerOrder(worker, 'idle');
    return;
  }
  if (action === 'rest') {
    setWorkerOrder(worker, 'rest');
    return;
  }
  if (workerKey === 'builder' && action === 'build') {
    setWorkerOrder(worker, 'build');
    return;
  }
  if (workerKey === 'delivery' && action === 'fetch') {
    setWorkerOrder(worker, 'deliver');
    return;
  }
}

function refreshWorkerCards() {
  workerCards.forEach(card => {
    const workerKey = card.dataset.worker;
    const worker = workers.find(w => w.role === workerKey);
    if (!worker) {
      return;
    }
    const orderLabel = card.querySelector('.order-label');
    if (orderLabel) {
      orderLabel.textContent = formatOrderLabel(worker.order, workerKey);
    }
    const staminaEl = card.querySelector('.summary .stamina');
    if (staminaEl) {
      staminaEl.textContent = worker.stamina.toFixed(1);
    }
    const staminaMaxEl = card.querySelector('.summary .stamina-max');
    if (staminaMaxEl) {
      const max = getWorkerMaxStamina(worker);
      staminaMaxEl.textContent = Number.isInteger(max) ? max : max.toFixed(1);
    }
    const levelEl = card.querySelector('.summary .level');
    if (levelEl) {
      levelEl.textContent = worker.level;
    }
    const stateEl = card.querySelector('.summary .state');
    if (stateEl) {
      stateEl.textContent = worker.stateMachine.state;
    }
    const buttons = card.querySelectorAll('button[data-action]');
    buttons.forEach(btn => {
      btn.classList.toggle('active', isActionActive(worker, btn.dataset.action));
    });
  });
}



function formatOrderLabel(order, workerKey) {
  if (order === 'build') {
    return 'Build';
  }
  if (order === 'deliver') {
    return workerKey === 'delivery' ? 'Fetch' : 'Deliver';
  }
  if (order === 'rest') {
    return 'Rest';
  }
  return 'Idle';
}



function formatStateLabel(state) {
  if (!state) {
    return 'Idle';
  }
  return state
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, char => char.toUpperCase());
}

function getWorkerFloatingLabel(worker) {
  if (!worker) {
    return 'Idle';
  }
  if (worker.order === 'rest' || worker.activity === 'resting') {
    return 'Resting';
  }
  if (worker.order === 'build') {
    if (worker.activity === 'building') {
      return 'Building';
    }
    return 'Heading to Site';
  }
  if (worker.order === 'deliver') {
    const label = materialLabel(world.currentMaterial);
    if (worker.activity === 'loading' || worker.activity === 'toDepot') {
      return `Fetching ${label}`;
    }
    if (worker.activity === 'delivering' || worker.activity === 'toMcs') {
      return 'Delivering Material';
    }
    return 'Returning';
  }
  return 'Idle';
}
function isActionActive(worker, action) {
  if (action === 'build') {
    return worker.order === 'build';
  }
  if (action === 'fetch') {
    return worker.order === 'deliver';
  }
  if (action === 'rest') {
    return worker.order === 'rest';
  }
  if (action === 'cancel') {
    return worker.order === 'idle';
  }
  return false;
}
function setWorkerOrder(worker, newOrder, messageOverride) {
  if (worker.order === newOrder && !messageOverride) {
    return;
  }

  const requiredMaterial = world.currentMaterial;

  if (newOrder === 'build') {
    if ((state.stock[requiredMaterial] || 0) < state.floor.need) {
      const msg = `Need more ${materialLabel(requiredMaterial).toLowerCase()} before building.`;
      statusEl.textContent = msg;
      showBubble(msg);
      refreshWorkerCards();
      return;
    }
    if (worker.stamina < STAMINA_BUILD_COST) {
      const msg = `${worker.name} is too tired to build and heads to the dorm.`;
      setWorkerOrder(worker, 'rest', msg);
      return;
    }
  } else if (newOrder === 'deliver') {
    if (worker.stamina < DELIVERY_TRIP_COST) {
      const msg = `${worker.name} needs rest before delivering and walks to the dorm.`;
      setWorkerOrder(worker, 'rest', msg);
      return;
    }
  } else if (newOrder === 'rest') {
    if (worker.activity === 'resting') {
      refreshWorkerCards();
      return;
    }
  }

  const previousOrder = worker.order;
  worker.order = newOrder;

  if (previousOrder !== newOrder) {
    if (newOrder === 'build') {
      worker.stateMachine.transition('build', worker);
    } else if (newOrder === 'deliver') {
      worker.stateMachine.transition('fetch', worker);
    } else if (newOrder === 'rest') {
      worker.stateMachine.transition('rest', worker);
    } else if (newOrder === 'idle' && previousOrder !== 'rest') {
      worker.stateMachine.transition('cancel', worker);
    }
  }

  if (newOrder === 'idle') {
    worker.orderStarted = false;
    setWorkerDestination(worker, null);
    worker.tripTimer = 0;
    worker.idleCooldown = Math.random() * 0.6;
    worker.activity = 'idle';
    worker.buildReserved = false;
    worker.inv = 0;
    worker.cargo = null;
    worker.visible = true;
  } else {
    setWorkerDestination(worker, null);
    if (newOrder === 'build') {
      worker.orderStarted = false;
      worker.buildReserved = false;
      worker.activity = 'toSite';
      setWorkerDestination(worker, getApproachCenter('MCS Construction'));
    }
    if (newOrder === 'deliver') {
      worker.tripTimer = 0;
      worker.inv = 0;
      worker.cargo = null;
      worker.activity = 'toDepot';
      setWorkerDestination(worker, getApproachCenter(getDepotName(world.currentMaterial)));
    }
    if (newOrder === 'rest') {
      worker.activity = 'toDorm';
      setWorkerDestination(worker, getApproachCenter('Dorm Beds'));
      worker.restAnchor = null;
      worker.visible = true;
      worker.inv = 0;
      worker.cargo = null;
    }
  }

  let message = messageOverride;
  if (!message) {
    if (newOrder === 'idle') {
      message = `${worker.name} is idling and waiting for orders.`;
    } else if (newOrder === 'build') {
      message = `${worker.name} starts building floor ${state.floor.n}.`;
    } else if (newOrder === 'deliver') {
      message = `${worker.name} begins fetching ${materialLabel(requiredMaterial).toLowerCase()}.`;
    } else if (newOrder === 'rest') {
      message = `${worker.name} walks to the dorm for a break.`;
    }
  }

  if (message) {
    statusEl.textContent = message;
    showBubble(message);
  }
  refreshWorkerCards();
}


function positionBubble() {
  if (bubble.style.display === 'none') {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const pageX = rect.left + window.scrollX + player.x + player.width / 2;
  const pageY = rect.top + window.scrollY + player.y - 10;
  bubble.style.left = `${pageX}px`;
  bubble.style.top = `${pageY}px`;
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    interact();
    return;
  }
  keys[event.code] = true;
});

document.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

window.addEventListener('resize', positionBubble);
window.addEventListener('scroll', positionBubble);

if (pauseBtn) {
  pauseBtn.addEventListener('click', togglePause);
}
if (speedBtn) {
  speedBtn.addEventListener('click', cycleSpeed);
}
if (restartBtn) {
  restartBtn.addEventListener('click', restartGame);
}

workerCards.forEach(card => {
  const workerKey = card.dataset.worker;
  const buttons = card.querySelectorAll('button[data-action]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      handleWorkerAction(workerKey, btn.dataset.action);
    });
  });
});

updateHUD();
refreshWorkerCards();
drawScene();
setInterval(() => {
  update(1 / FPS);
  drawScene();
  positionBubble();
}, frameDuration);
