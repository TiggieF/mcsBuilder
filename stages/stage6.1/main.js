'use strict';

// ===== Core tuning constants =====
const grid = { cols: 38, rows: 20, cell: 30 };
const GRID_PIXEL_WIDTH = grid.cols * grid.cell;
const GRID_PIXEL_HEIGHT = grid.rows * grid.cell;
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
const WOOD_BASE = 10;
const WOOD_PER_FLOOR = 5;
const BUILD_BASE = 5;
const BUILD_PER_FLOOR = 5;
const BUILD_PROGRESS_SLOWDOWN = 1.5;
const PLAYER_INTERACT_COOLDOWN = 0.35;
const EDGE_MARGIN = 1;
let fsmLogEl = null;

const documentElement = document.documentElement;
if (documentElement) {
  documentElement.style.setProperty('--grid-cols', grid.cols);
  documentElement.style.setProperty('--grid-rows', grid.rows);
  documentElement.style.setProperty('--cell-size', `${grid.cell}px`);
}

const playfieldEl = document.querySelector('.grid-wrapper');
const gridEl = document.getElementById('grid');
const entityLayer = document.getElementById('entityLayer');

if (playfieldEl) {
  playfieldEl.style.width = `${GRID_PIXEL_WIDTH}px`;
  playfieldEl.style.height = `${GRID_PIXEL_HEIGHT}px`;
}

const tileElements = new Map();
const mcsTileEls = [];
let zoneLabelsBuilt = false;
let floorBoardEl = null;
let floorBoardSegments = [];
let playerDom = null;

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
    idle: { fetch: 'headingToWood', rest: 'headingToDorm', cancel: 'idle' },
    headingToWood: { arriveSource: 'loading', rest: 'headingToDorm', cancel: 'idle' },
    loading: { loadComplete: 'headingToSite', rest: 'headingToDorm', cancel: 'idle' },
    headingToSite: { arriveSite: 'delivering', rest: 'headingToDorm', cancel: 'idle' },
    delivering: { dropComplete: 'headingToWood', rest: 'headingToDorm', cancel: 'idle' },
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

// ===== Palette + texture references =====
const MCS_FLOOR_PALETTES = [
  { primary: '#303a65', secondary: '#47578c', shadow: '#1d233c' },
  { primary: '#2f4f6f', secondary: '#4b6d98', shadow: '#1a2d45' },
  { primary: '#2b5d4a', secondary: '#3f8b6b', shadow: '#162e25' },
  { primary: '#5d542b', secondary: '#8b7a3f', shadow: '#2e2716' },
  { primary: '#5d2b4b', secondary: '#8b3f6d', shadow: '#2e1625' },
  { primary: '#2b5d5b', secondary: '#3f8b87', shadow: '#162e2c' }
];

const ZONE_CONFIGS = [
  {
    name: 'MCS Construction',
    description: 'Future site of the Computer Science building.',
    tilesWide: 5,
    tilesHigh: 5,
    slug: 'mcs',
    hint: 'SPACE',
    padding: grid.cell
  },
  {
    name: 'Wood House',
    description: 'Stockpile for framing lumber.',
    tilesWide: 2,
    tilesHigh: 2,
    slug: 'wood',
    hint: 'SPACE',
    padding: grid.cell * 0.75
  },
  {
    name: 'Starbucks',
    description: 'Quick caffeine stop for the crew.',
    tilesWide: 2,
    tilesHigh: 2,
    slug: 'cafe',
    hint: 'SPACE',
    padding: grid.cell * 0.75
  },
  {
    name: 'Dorm Beds',
    description: 'Where exhausted workers rest up.',
    tilesWide: 2,
    tilesHigh: 2,
    slug: 'dorm',
    hint: 'SPACE',
    padding: grid.cell * 0.75
  }
];

// ===== Utility helpers =====
function woodNeeded(floor) {
  return WOOD_BASE + WOOD_PER_FLOOR * (floor - 1);
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
const tileMatrix = createTileMatrix(zones, rocks);

let state = createInitialState(spawnCell, blockedCells);
let player = state.player;
let workers = state.workers;

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
const contrastBtn = document.getElementById('contrastBtn');
const woodFill = document.getElementById('woodFill');
const woodText = document.getElementById('woodText');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const bubble = document.getElementById('textBubble');
const winOverlay = document.getElementById('winOverlay');
const winTimeEl = document.getElementById('winTime');
const restartBtn = document.getElementById('restartBtn');
const workerCards = Array.from(document.querySelectorAll('.worker-card'));
fsmLogEl = document.getElementById('fsmLog');
bubble.style.display = 'none';
updateSpeedLabel();

buildGridDom(tileMatrix);
createZoneLabels();
createFloorProgressBoard();
rebuildEntityElements();
refreshMcsZoneTexture();

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
  if (!fsmLogEl) {
    return;
  }
  const label = worker ? worker.name : 'Worker';
  const timestamp = formatTime(state.time.elapsed || 0);
  const entry = document.createElement('li');
  entry.textContent = `[${timestamp}] ${label}: ${fromState} —${event}→ ${toState}`;
  fsmLogEl.prepend(entry);
  while (fsmLogEl.children.length > 8) {
    fsmLogEl.removeChild(fsmLogEl.lastChild);
  }
}


function updateHUD() {
  const floorNumber = Math.min(state.floor.n, MAX_FLOORS);
  hudFloor.textContent = `${floorNumber}`;

  const currentNeed = state.floor.need;
  const woodRatio = currentNeed <= 0
    ? 1
    : Math.max(0, Math.min(1, state.stock.wood / currentNeed));
  const woodAmount = Number.isInteger(state.stock.wood)
    ? state.stock.wood
    : state.stock.wood.toFixed(1);
  const woodNeedDisplay = currentNeed > 0 ? currentNeed : '—';
  woodText.textContent = `${woodAmount}/${woodNeedDisplay}`;
  woodFill.style.width = `${woodRatio * 100}%`;

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
  updateFloorProgressBoard();
}

function updateFloorProgressBoard() {
  if (!floorBoardEl || !state || !state.progress) {
    return;
  }
  const floorsBuilt = state.progress.floorsBuilt;
  const totalFloors = state.progress.totalFloors;
  floorBoardSegments.forEach((segment, index) => {
    segment.classList.remove('complete', 'active', 'pending');
    if (index < floorsBuilt) {
      segment.classList.add('complete');
      segment.style.removeProperty('--segment-progress');
    } else if (index === floorsBuilt && floorsBuilt < totalFloors) {
      segment.classList.add('active');
      const progressPercent = Math.round(Math.min(1, state.floor.progress) * 100);
      segment.style.setProperty('--segment-progress', `${progressPercent}%`);
    } else {
      segment.classList.add('pending');
      segment.style.removeProperty('--segment-progress');
    }
  });
  const metaCurrent = floorBoardEl.querySelector('.current');
  const metaPercent = floorBoardEl.querySelector('.percent');
  if (metaCurrent) {
    const currentFloor = Math.min(state.floor.n, totalFloors);
    metaCurrent.textContent = `Floor ${currentFloor} / ${totalFloors}`;
  }
  if (metaPercent) {
    const overall = Math.min(1, (floorsBuilt + state.floor.progress) / totalFloors);
    metaPercent.textContent = `${Math.round(overall * 100)}% Complete`;
  }
}

function createTileMatrix(zones, rocks) {
  const matrix = Array.from({ length: grid.rows }, () => (
    Array.from({ length: grid.cols }, () => ({ zone: null, rock: null }))
  ));

  zones.forEach(zone => {
    const startCol = Math.floor(zone.x / grid.cell);
    const startRow = Math.floor(zone.y / grid.cell);
    const cols = Math.floor(zone.width / grid.cell);
    const rows = Math.floor(zone.height / grid.cell);
    for (let col = 0; col < cols; col += 1) {
      for (let row = 0; row < rows; row += 1) {
        const gridCol = startCol + col;
        const gridRow = startRow + row;
        if (!withinGrid(gridCol, gridRow)) {
          continue;
        }
        matrix[gridRow][gridCol].zone = zone;
      }
    }
  });

  rocks.forEach(rock => {
    rock.cells.forEach(cell => {
      if (!withinGrid(cell.col, cell.row)) {
        return;
      }
      matrix[cell.row][cell.col].rock = rock;
    });
  });

  return matrix;
}

function getTileClass(tile) {
  if (tile.rock) {
    return tile.rock.kind === 'pond' || tile.rock.kind === 'fountain'
      ? 'tile-pond'
      : 'tile-rock';
  }
  if (tile.zone) {
    const slug = tile.zone.slug || 'mcs';
    return `tile-zone-${slug}`;
  }
  return 'tile-grass';
}

function buildGridDom(matrix) {
  if (!gridEl || !matrix) {
    return;
  }
  gridEl.innerHTML = '';
  tileElements.clear();
  mcsTileEls.length = 0;
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const data = matrix[row][col];
      const tile = document.createElement('div');
      tile.className = `tile ${getTileClass(data)}`;
      tile.dataset.col = col;
      tile.dataset.row = row;
      fragment.appendChild(tile);
      tileElements.set(cellKey({ col, row }), tile);
      if (data.zone && data.zone.slug === 'mcs') {
        mcsTileEls.push(tile);
      }
    }
  }
  gridEl.appendChild(fragment);
}

function createZoneLabels() {
  if (!entityLayer || zoneLabelsBuilt) {
    return;
  }
  zoneLabelsBuilt = true;
  zones.forEach(zone => {
    const label = document.createElement('div');
    label.className = 'zone-label';
    label.style.left = `${zone.x + zone.width / 2}px`;
    label.style.top = `${zone.y + 14}px`;
    const title = document.createElement('div');
    title.textContent = zone.name;
    label.appendChild(title);
    if (zone.hint) {
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = zone.hint;
      label.appendChild(hint);
    }
    entityLayer.appendChild(label);
  });
}

function createFloorProgressBoard() {
  if (!entityLayer || floorBoardEl) {
    return;
  }
  const info = zoneDirectory['MCS Construction'];
  if (!info) {
    return;
  }
  const board = document.createElement('div');
  board.className = 'floor-board';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'MCS Progress';
  board.appendChild(title);
  const segments = document.createElement('div');
  segments.className = 'segments';
  board.appendChild(segments);
  floorBoardSegments = [];
  for (let i = 0; i < MAX_FLOORS; i += 1) {
    const segment = document.createElement('div');
    segment.className = 'segment pending';
    segments.appendChild(segment);
    floorBoardSegments.push(segment);
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  const current = document.createElement('div');
  current.className = 'current';
  const percent = document.createElement('div');
  percent.className = 'percent';
  meta.appendChild(current);
  meta.appendChild(percent);
  board.appendChild(meta);
  board.style.left = `${info.zone.x + info.zone.width / 2}px`;
  board.style.top = `${Math.max(0, info.zone.y - 10)}px`;
  entityLayer.appendChild(board);
  floorBoardEl = board;
  updateFloorProgressBoard();
}

function rebuildEntityElements() {
  if (!entityLayer) {
    return;
  }
  entityLayer.querySelectorAll('.entity').forEach(node => node.remove());
  playerDom = createPlayerElement();
  if (playerDom && playerDom.root) {
    entityLayer.appendChild(playerDom.root);
  }
  workers.forEach(worker => {
    worker.dom = createWorkerElement(worker);
    if (worker.dom && worker.dom.root) {
      entityLayer.appendChild(worker.dom.root);
    }
  });
  updateEntityLayer();
}

function createPlayerElement() {
  if (!entityLayer) {
    return null;
  }
  const root = document.createElement('div');
  root.className = 'entity player';
  root.style.width = `${player.width}px`;
  root.style.height = `${player.height}px`;
  const body = document.createElement('div');
  body.className = 'body';
  root.appendChild(body);
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Player';
  root.appendChild(label);
  return { root, body, label };
}

function createWorkerElement(worker) {
  if (!entityLayer) {
    return null;
  }
  const root = document.createElement('div');
  root.className = `entity worker ${worker.role}`;
  root.style.width = `${worker.width}px`;
  root.style.height = `${worker.height}px`;
  const body = document.createElement('div');
  body.className = 'body';
  root.appendChild(body);
  const label = document.createElement('div');
  label.className = 'label';
  const nameEl = document.createElement('span');
  nameEl.className = 'name';
  nameEl.textContent = `${worker.name} · L${worker.level}`;
  const stateEl = document.createElement('span');
  stateEl.className = 'state';
  label.appendChild(nameEl);
  label.appendChild(stateEl);
  root.appendChild(label);
  return { root, body, label, nameEl, stateEl };
}

function setEntityPosition(element, x, y) {
  if (!element) {
    return;
  }
  element.style.transform = `translate(${x}px, ${y}px)`;
}

function updateEntityLayer() {
  if (playerDom && playerDom.root) {
    setEntityPosition(playerDom.root, player.x, player.y);
    const carryingCoffee = player.item === 'coffee';
    playerDom.label.textContent = carryingCoffee ? 'Player · Coffee' : 'Player';
    playerDom.root.classList.toggle('has-coffee', carryingCoffee);
  }
  workers.forEach(worker => {
    const dom = worker.dom;
    if (!dom || !dom.root) {
      return;
    }
    dom.root.style.display = worker.visible ? 'flex' : 'none';
    setEntityPosition(dom.root, worker.x, worker.y - worker.jumpOffset);
    dom.body.style.background = worker.order === 'idle' ? worker.colorIdle : worker.colorActive;
    dom.body.style.setProperty('--entity-accent', worker.accentColor);
    dom.root.classList.toggle('active', worker.order !== 'idle');
    dom.root.classList.toggle('glow', worker.role === 'delivery' && worker.levelGlow > 0);
    if (dom.nameEl) {
      dom.nameEl.textContent = `${worker.name} · L${worker.level}`;
    }
    if (dom.stateEl) {
      const max = getWorkerMaxStamina(worker);
      const staminaCap = Number.isInteger(max) ? max : max.toFixed(1);
      dom.stateEl.textContent = `${formatStateLabel(worker.stateMachine.state)} · ${worker.stamina.toFixed(1)}/${staminaCap}`;
    }
  });
}

function refreshMcsZoneTexture() {
  if (!state || !state.progress) {
    return;
  }
  const builtFloors = Math.max(0, state.progress.floorsBuilt);
  const paletteIndex = ((builtFloors % MCS_FLOOR_PALETTES.length) + MCS_FLOOR_PALETTES.length) % MCS_FLOOR_PALETTES.length;
  const palette = MCS_FLOOR_PALETTES[paletteIndex] || MCS_FLOOR_PALETTES[0];
  mcsTileEls.forEach(tile => {
    tile.style.setProperty('--mcs-primary', palette.primary);
    tile.style.setProperty('--mcs-secondary', palette.secondary);
    tile.style.setProperty('--mcs-shadow', palette.shadow);
  });
}

function generateZones() {
  const placed = [];
  const zones = [];

  ZONE_CONFIGS.forEach(config => {
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
      slug: config.slug,
      hint: config.hint || '',
      solid: true
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
    solid: true
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
  const rockCount = getRandomInt(9, 15);
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
  return {
    time: { elapsed: 0, speed: 1 },
    progress: { floorsBuilt: 0, totalFloors: MAX_FLOORS },
    floor: { n: 1, progress: 0, need: woodNeeded(1), buildTime: buildTimeFor(1) },
    stock: { wood: 2 },
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
    jumping: false,
    jumpTime: 0,
    jumpDuration: 0.45,
    jumpHeight: 12,
    jumpOffset: 0,
    hasJumped: false,
    activity: 'idle',
    visible: true,
    buildReserved: false,
    restAnchor: null,
    taskTimer: 0
  };
}

// ===== Player controls =====
function handleMovement(dt) {
  let vx = 0;
  let vy = 0;
  if (keys['KeyW']) vy -= 1;
  if (keys['KeyS']) vy += 1;
  if (keys['KeyA']) vx -= 1;
  if (keys['KeyD']) vx += 1;

  if (vx !== 0 && vy !== 0) {
    const inv = Math.SQRT1_2;
    vx *= inv;
    vy *= inv;
  }

  const distance = player.speed * dt * state.time.speed;

  const collisionRects = getCollisionRects();

  if (vx !== 0) {
    const nextRect = {
      x: player.x + vx * distance,
      y: player.y,
      width: player.width,
      height: player.height
    };
    if (!collisionRects.some(s => rectsOverlap(nextRect, s))) {
      player.x = nextRect.x;
    }
  }

  if (vy !== 0) {
    const nextRect = {
      x: player.x,
      y: player.y + vy * distance,
      width: player.width,
      height: player.height
    };
    if (!collisionRects.some(s => rectsOverlap(nextRect, s))) {
      player.y = nextRect.y;
    }
  }

  player.x = clamp(player.x, 2, GRID_PIXEL_WIDTH - player.width - 2);
  player.y = clamp(player.y, 2, GRID_PIXEL_HEIGHT - player.height - 2);
}

// ===== Worker brain loop =====
function updateWorkers(dt) {
  const simDt = gameComplete ? 0 : dt * state.time.speed;
  const animDt = gameComplete ? dt : simDt;
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

    if (worker.order === 'idle' && worker.visible && !worker.hasJumped && !gameComplete) {
      triggerIdleJump(worker);
    }

    if (worker.levelGlow > 0) {
      worker.levelGlow = Math.max(0, worker.levelGlow - animDt);
    }

    if (worker.jumping) {
      worker.jumpTime += animDt;
      const jumpProgress = Math.min(worker.jumpTime / worker.jumpDuration, 1);
      worker.jumpOffset = Math.sin(jumpProgress * Math.PI) * worker.jumpHeight;
      if (jumpProgress >= 1) {
        worker.jumping = false;
        worker.jumpOffset = 0;
      }
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
        const reached = moveWorkerToward(worker, worker.target, worker.idleSpeed, simDt);
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

  if (worker.activity !== 'toSite' && worker.activity !== 'building') {
    worker.activity = 'toSite';
    setWorkerDestination(worker, approach);
  }

  if (worker.activity === 'toSite') {
    const arrived = moveWorkerToward(worker, approach, WORKER_ACTIVE_SPEED, dt);
    if (arrived) {
      alignWorkerToCenter(worker, approach);
      worker.stateMachine.transition('arriveWork', worker);
      setWorkerDestination(worker, null);
      worker.activity = 'building';
      if (!worker.buildReserved) {
        if (state.stock.wood < state.floor.need) {
          setWorkerOrder(worker, 'idle', 'Need more wood before building.');
          return;
        }
        if (worker.stamina < STAMINA_BUILD_COST) {
          setWorkerOrder(worker, 'rest', `${worker.name} needs rest before building.`);
          return;
        }
        state.stock.wood = Math.max(0, state.stock.wood - state.floor.need);
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
    const progressGain = dt / (state.floor.buildTime * BUILD_PROGRESS_SLOWDOWN);
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
  const woodApproach = getApproachCenter('Wood House');
  const mcsApproach = getApproachCenter('MCS Construction');
  if (!woodApproach || !mcsApproach) {
    return;
  }

  if (!['toWood', 'loading', 'toMcs', 'delivering'].includes(worker.activity)) {
    worker.activity = 'toWood';
    setWorkerDestination(worker, woodApproach);
  }

  if (worker.activity === 'toWood') {
    const arrived = moveWorkerToward(worker, woodApproach, WORKER_ACTIVE_SPEED, dt);
    if (arrived) {
      alignWorkerToCenter(worker, woodApproach);
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
      const remaining = Math.max(0, state.floor.need - state.stock.wood);
      if (remaining <= 0) {
        setWorkerOrder(worker, 'idle', 'Wood stock is full for this floor.');
        return;
      }
      worker.inv = Math.min(1, remaining);
      worker.stateMachine.transition('loadComplete', worker);
      worker.activity = 'toMcs';
      setWorkerDestination(worker, mcsApproach);
    }
    return;
  }

  if (worker.activity === 'toMcs') {
    const arrived = moveWorkerToward(worker, mcsApproach, WORKER_CARRY_SPEED, dt);
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
      if (worker.inv <= 0) {
        worker.activity = 'toWood';
        setWorkerDestination(worker, woodApproach);
        return;
      }
      const room = Math.max(0, state.floor.need - state.stock.wood);
      if (room <= 0) {
        worker.activity = 'toWood';
        setWorkerDestination(worker, woodApproach);
        setWorkerOrder(worker, 'idle', 'Wood stock is full for this floor.');
        return;
      }
      const delivered = Math.min(worker.inv, room);
      state.stock.wood = Math.min(state.floor.need, state.stock.wood + delivered);
      worker.inv -= delivered;
      worker.stateMachine.transition('dropComplete', worker);
      worker.stamina = Math.max(0, worker.stamina - DELIVERY_TRIP_COST);
      statusEl.textContent = `${worker.name} delivered ${delivered} wood.`;
      if (worker.stamina <= 0) {
        setWorkerOrder(worker, 'rest', `${worker.name} is exhausted and heads to the dorm.`);
        return;
      }
      worker.activity = 'toWood';
      setWorkerDestination(worker, woodApproach);
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
    const arrived = moveWorkerToward(worker, dormApproach, WORKER_ACTIVE_SPEED, dt);
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
  deliveryWorker.hasJumped = false;
  triggerIdleJump(deliveryWorker);
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
  state.floor.need = woodNeeded(state.floor.n);
  state.floor.buildTime = buildTimeFor(state.floor.n);
  state.stock.wood = Math.min(state.stock.wood, state.floor.need);
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
  rebuildEntityElements();
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

function triggerIdleJump(worker) {
  worker.hasJumped = true;
  worker.jumping = true;
  worker.jumpTime = 0;
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

  worker.x = clamp(worker.x, 2, GRID_PIXEL_WIDTH - worker.width - 2);
  worker.y = clamp(worker.y, 2, GRID_PIXEL_HEIGHT - worker.height - 2);
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

function drawScene() {
  updateEntityLayer();
}

function update(dt) {
  if (!isPaused) {
    if (!gameComplete) {
      handleMovement(dt);
    }
    const scaledDt = dt * state.time.speed;
    if (!gameComplete) {
      state.time.elapsed += scaledDt;
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
    const wy = worker.y + worker.height / 2 - worker.jumpOffset;
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

function toggleContrast() {
  document.body.classList.toggle('high-contrast');
  statusEl.textContent = document.body.classList.contains('high-contrast')
    ? 'High contrast enabled.'
    : 'High contrast disabled.';
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

  if (newOrder === 'build') {
    if (state.stock.wood < state.floor.need) {
      const msg = 'Need more wood before building.';
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
    worker.hasJumped = false;
    worker.activity = 'idle';
    worker.buildReserved = false;
    worker.inv = 0;
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
      worker.activity = 'toWood';
      setWorkerDestination(worker, getApproachCenter('Wood House'));
    }
    if (newOrder === 'rest') {
      worker.activity = 'toDorm';
      setWorkerDestination(worker, getApproachCenter('Dorm Beds'));
      worker.restAnchor = null;
      worker.visible = true;
      worker.inv = 0;
    }
  }

  let message = messageOverride;
  if (!message) {
    if (newOrder === 'idle') {
      message = `${worker.name} is idling and waiting for orders.`;
    } else if (newOrder === 'build') {
      message = `${worker.name} starts building floor ${state.floor.n}.`;
    } else if (newOrder === 'deliver') {
      message = `${worker.name} begins fetching wood.`;
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
  const baseRect = playfieldEl ? playfieldEl.getBoundingClientRect() : { left: 0, top: 0 };
  const pageX = baseRect.left + window.scrollX + player.x + player.width / 2;
  const pageY = baseRect.top + window.scrollY + player.y - 10;
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
if (contrastBtn) {
  contrastBtn.addEventListener('click', toggleContrast);
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
