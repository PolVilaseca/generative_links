// sketch.js
// Four grid types: square, triangular, hexagon‐corners, circular‐polar
// Each run starts with the square grid, animates the random‐walk + leaf coloring,
// then when it exhausts waits 2 seconds, picks a new grid at random, and restarts.

const cellSize   = 20;
const hexRadius  = 20;
const bgColor    = '#EFE6DD';
const linkColor  = '#888888';
const dotColors  = ['#FF7F7F', '#7F9EFF', '#FFF97F'];

const GRID_TYPES = ['square','triangular','hexagon','circular'];

let posMap = new Map();  // key → {x,y}
let adj    = new Map();  // key → Set<neighborKey>

let visited, visitedSet, linkCount, deadMarked;
let currentGrid;

// For delayed reset
let waitingToReset = false;
let resetStartTime = 0;
const resetDelayMs = 2000;  // 2 seconds

// Ensure first run is always square
let firstRun = true;

const TRI_DIRS = [
  { dq:  1, dr:  0 },
  { dq: -1, dr:  0 },
  { dq:  0, dr:  1 },
  { dq:  0, dr: -1 },
  { dq:  1, dr: -1 },
  { dq: -1, dr:  1 },
];

function setup() {
  createCanvas(600, 600);
  stroke(linkColor);
  noFill();
  pickNewGrid();
}

function draw() {
  // handle reset delay by time
  if (waitingToReset) {
    if (millis() - resetStartTime >= resetDelayMs) {
      waitingToReset = false;
      pickNewGrid();
    }
    return;
  }

  // normal walk step
  let frontier = visited.filter(k => getUnvisitedNeighbors(k).length > 0);

  if (frontier.length === 0) {
    markAllLeaves();
    waitingToReset = true;
    resetStartTime = millis();
    return;
  }

  let curKey = random(frontier);
  let nbrs   = getUnvisitedNeighbors(curKey);
  let nxtKey = random(nbrs);

  let c1 = posMap.get(curKey),
      c2 = posMap.get(nxtKey);

  stroke(linkColor);
  strokeWeight(4);
  line(c1.x, c1.y, c2.x, c2.y);

  linkCount[curKey] = (linkCount[curKey] || 0) + 1;
  linkCount[nxtKey] = (linkCount[nxtKey] || 0) + 1;

  visited.push(nxtKey);
  visitedSet.add(nxtKey);

  markAllLeaves();
}

// ———————————————————————————————
// Pick a new grid, build it, and reset walk state
// ———————————————————————————————
function pickNewGrid() {
  // first run: force square grid
  if (firstRun) {
    currentGrid = 'square';
    firstRun = false;
  } else {
    currentGrid = random(GRID_TYPES);
  }

  let startKey;
  switch (currentGrid) {
    case 'square':
      startKey = buildSquareGraph();
      break;
    case 'triangular':
      startKey = buildTriGraph();
      break;
    case 'hexagon':
      startKey = buildHexGraph();
      break;
    case 'circular':
      startKey = buildCircularGraph();
      break;
  }

  visited     = [startKey];
  visitedSet  = new Set([startKey]);
  linkCount   = { [startKey]: 0 };
  deadMarked  = new Set();

  background(bgColor);
}

// ———————————————————————————————
// Build square grid (4-neighbors)
// ———————————————————————————————
function buildSquareGraph() {
  posMap.clear();
  adj.clear();

  let cols = floor(width  / cellSize) + 1;
  let rows = floor(height / cellSize) + 1;

  // interior only
  for (let i = 1; i < cols - 1; i++) {
    for (let j = 1; j < rows - 1; j++) {
      let key = coordKey(i, j);
      posMap.set(key, { x: i * cellSize, y: j * cellSize });
      adj.set(key, new Set());
    }
  }

  // link N/E/S/W
  for (let key of posMap.keys()) {
    let [i, j] = key.split(',').map(Number);
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([di, dj]) => {
      let nk = coordKey(i + di, j + dj);
      if (posMap.has(nk)) adj.get(key).add(nk);
    });
  }

  let ci = floor(cols / 2), cj = floor(rows / 2);
  return coordKey(ci, cj);
}

// ———————————————————————————————
// Build triangular lattice (6-neighbors)
// ———————————————————————————————
function buildTriGraph() {
  posMap.clear();
  adj.clear();

  let maxQ = floor(width  / cellSize) + 1;
  let maxR = floor(height / cellSize) + 1;

  for (let q = -maxQ; q <= maxQ; q++) {
    for (let r = -maxR; r <= maxR; r++) {
      let x = width/2  + cellSize * (q + r/2);
      let y = height/2 + (sqrt(3)/2) * cellSize * r;
      if (
        x >= cellSize && x <= width  - cellSize &&
        y >= cellSize && y <= height - cellSize
      ) {
        let key = coordKey(q, r);
        posMap.set(key, { x, y });
        adj.set(key, new Set());
      }
    }
  }

  for (let key of posMap.keys()) {
    let [q, r] = key.split(',').map(Number);
    TRI_DIRS.forEach(d => {
      let nk = coordKey(q + d.dq, r + d.dr);
      if (posMap.has(nk)) adj.get(key).add(nk);
    });
  }

  return coordKey(0, 0);
}

// ———————————————————————————————
// Build hexagon-corners graph
// ———————————————————————————————
function buildHexGraph() {
  posMap.clear();
  adj.clear();

  let wHex = sqrt(3) * hexRadius;
  let hHex = 1.5 * hexRadius;
  let maxQ = floor(width  / wHex) + 2;
  let maxR = floor(height / hHex) + 2;

  for (let q = -maxQ; q <= maxQ; q++) {
    for (let r = -maxR; r <= maxR; r++) {
      let cx = width/2  + wHex * (q + r/2);
      let cy = height/2 + hHex * r;
      if (
        cx - hexRadius >= 0 && cx + hexRadius <= width &&
        cy - hexRadius >= 0 && cy + hexRadius <= height
      ) {
        let corners = [];
        for (let i = 0; i < 6; i++) {
          let ang = PI/6 + PI/3 * i;
          let x  = cx + hexRadius * cos(ang);
          let y  = cy + hexRadius * sin(ang);
          let xR = round(x * 100) / 100;
          let yR = round(y * 100) / 100;
          let key = `${xR},${yR}`;
          if (!posMap.has(key)) {
            posMap.set(key, { x: xR, y: yR });
            adj.set(key, new Set());
          }
          corners.push(key);
        }
        for (let i = 0; i < 6; i++) {
          let a = corners[i], b = corners[(i+1)%6];
          adj.get(a).add(b);
          adj.get(b).add(a);
        }
      }
    }
  }

  let bestKey = null, bestD = Infinity;
  let cx = width/2, cy = height/2;
  for (let [k, pos] of posMap) {
    let d = dist(pos.x, pos.y, cx, cy);
    if (d < bestD) {
      bestD = d;
      bestKey = k;
    }
  }
  return bestKey;
}

// ———————————————————————————————
// Build circular (polar) grid
// ———————————————————————————————
function buildCircularGraph() {
  posMap.clear();
  adj.clear();

  let cx = width/2, cy = height/2;
  let maxRing = floor((min(width, height)/2 - cellSize) / cellSize);
  let rings = [];

  // center point
  let centerKey = `${round(cx*100)/100},${round(cy*100)/100}`;
  posMap.set(centerKey, { x: cx, y: cy });
  adj.set(centerKey, new Set());
  rings[0] = [centerKey];

  for (let i = 1; i <= maxRing; i++) {
    let n = max(6, floor(2 * PI * i));
    let ring = [];
    for (let j = 0; j < n; j++) {
      let theta = TWO_PI * j / n;
      let x = cx + i*cellSize * cos(theta);
      let y = cy + i*cellSize * sin(theta);
      let xR = round(x * 100) / 100;
      let yR = round(y * 100) / 100;
      let key = `${xR},${yR}`;
      posMap.set(key, { x: xR, y: yR });
      adj.set(key, new Set());
      ring.push(key);
    }
    rings[i] = ring;
  }

  rings[1].forEach(k => {
    adj.get(centerKey).add(k);
    adj.get(k).add(centerKey);
  });

  for (let i = 1; i <= maxRing; i++) {
    let ring = rings[i];
    for (let j = 0; j < ring.length; j++) {
      let a = ring[j], b = ring[(j+1)%ring.length];
      adj.get(a).add(b);
      adj.get(b).add(a);
    }
  }

  for (let i = 2; i <= maxRing; i++) {
    let curr = rings[i], prev = rings[i-1];
    curr.forEach(k => {
      let p = posMap.get(k);
      let best, bestD = Infinity;
      prev.forEach(pk => {
        let pp = posMap.get(pk);
        let d2 = (pp.x - p.x)**2 + (pp.y - p.y)**2;
        if (d2 < bestD) {
          bestD = d2;
          best = pk;
        }
      });
      adj.get(k).add(best);
      adj.get(best).add(k);
    });
  }

  return centerKey;
}

// ———————————————————————————————
// Helpers
// ———————————————————————————————
function getUnvisitedNeighbors(key) {
  return Array.from(adj.get(key)).filter(k => !visitedSet.has(k));
}

function markAllLeaves() {
  for (let key of visited) {
    if (
      !deadMarked.has(key) &&
      linkCount[key] === 1 &&
      getUnvisitedNeighbors(key).length === 0
    ) {
      let p = posMap.get(key);
      noStroke();
      fill(random(dotColors));
      let d = (currentGrid === 'hexagon' ? hexRadius : cellSize) * 0.6;
      ellipse(p.x, p.y, d);
      deadMarked.add(key);
    }
  }
}

function coordKey(a, b) {
  return `${a},${b}`;
}
