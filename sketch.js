// sketch.js
// Four grid types: square, triangular, hexagon‐corners, circular‐polar
// Each run picks one at random, animates the random‐walk + leaf coloring,
// then when it exhausts picks a new grid, forever looping.

const cellSize   = 20;            // base for square, triangular, circular
const hexRadius  = 20;            // for hexagon‐corners
const bgColor    = '#EFE6DD';
const linkColor  = '#888888';
const dotColors  = ['#FF7F7F', '#7F9EFF', '#FFF97F'];

// Graph storage (shared)
let posMap = new Map();           // key → {x,y}
let adj    = new Map();           // key → Set<neighborKey>

// Walk state (shared)
let visited, visitedSet, linkCount, deadMarked;

// Available grid types:
const GRID_TYPES = ['square','triangular','hexagon','circular'];
let currentGrid;

function setup() {
  createCanvas(600, 600);
  stroke(linkColor);
  noFill();
  pickNewGrid();
}

function draw() {
  // find visited nodes with unvisited neighbors
  let frontier = visited.filter(k => getUnvisitedNeighbors(k).length > 0);

  if (frontier.length === 0) {
    // color final leaves, then switch grid
    markAllLeaves();
    pickNewGrid();
    return;
  }

  // step the random‐walk
  let curKey = random(frontier);
  let nbrs   = getUnvisitedNeighbors(curKey);
  let nxtKey = random(nbrs);

  // draw the edge
  let c1 = posMap.get(curKey), c2 = posMap.get(nxtKey);
  stroke(linkColor);
  strokeWeight(4);
  line(c1.x, c1.y, c2.x, c2.y);

  // bump degrees
  linkCount[curKey] = (linkCount[curKey]||0) + 1;
  linkCount[nxtKey] = (linkCount[nxtKey]||0) + 1;

  // mark visited
  visited.push(nxtKey);
  visitedSet.add(nxtKey);

  // color any new leaves
  markAllLeaves();
}


// —————————————————————————————————————
// GRID SWITCH & RESET
// —————————————————————————————————————
function pickNewGrid() {
  // randomly choose one of the four
  currentGrid = random(GRID_TYPES);

  // build the selected graph, and get its seed key
  let startKey;
  switch (currentGrid) {
    case 'square':     startKey = buildSquareGraph();    break;
    case 'triangular': startKey = buildTriGraph();      break;
    case 'hexagon':    startKey = buildHexGraph();      break;
    case 'circular':   startKey = buildCircularGraph(); break;
  }

  // reset walk state
  visited     = [startKey];
  visitedSet  = new Set([startKey]);
  linkCount   = { [startKey]: 0 };
  deadMarked  = new Set();

  // clear canvas
  background(bgColor);
}


// —————————————————————————————————————
// BUILD: SQUARE GRID (4-neighbors)
// —————————————————————————————————————
function buildSquareGraph() {
  posMap.clear(); adj.clear();
  let cols = floor(width  / cellSize) + 1;
  let rows = floor(height / cellSize) + 1;

  // interior only (avoid half‐links on edges)
  for (let i = 1; i < cols - 1; i++) {
    for (let j = 1; j < rows - 1; j++) {
      let key = coordKey(i, j);
      posMap.set(key, { x: i*cellSize, y: j*cellSize });
      adj.set(key, new Set());
    }
  }

  // link N/E/S/W
  for (let key of posMap.keys()) {
    let [i,j] = key.split(',').map(Number);
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(d => {
      let nk = coordKey(i+d[0], j+d[1]);
      if (posMap.has(nk)) adj.get(key).add(nk);
    });
  }

  // seed in center
  let ci = floor(cols/2), cj = floor(rows/2);
  return coordKey(ci, cj);
}


// —————————————————————————————————————
// BUILD: TRIANGULAR GRID (true 6‐neighbor lattice)
// —————————————————————————————————————
const TRI_DIRS = [
  { dq:  1, dr:  0 },
  { dq: -1, dr:  0 },
  { dq:  0, dr:  1 },
  { dq:  0, dr: -1 },
  { dq:  1, dr: -1 },
  { dq: -1, dr:  1 },
];

function buildTriGraph() {
  posMap.clear(); adj.clear();

  let maxQ = floor(width  / cellSize) + 1;
  let maxR = floor(height / cellSize) + 1;
  for (let q = -maxQ; q <= maxQ; q++) {
    for (let r = -maxR; r <= maxR; r++) {
      let x = width/2  + cellSize*(q + r/2);
      let y = height/2 + (sqrt(3)/2)*cellSize*r;
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

  // link the six axial neighbors
  for (let key of posMap.keys()) {
    let [q,r] = key.split(',').map(Number);
    TRI_DIRS.forEach(d => {
      let nk = coordKey(q + d.dq, r + d.dr);
      if (posMap.has(nk)) adj.get(key).add(nk);
    });
  }

  // seed at q=0,r=0
  return coordKey(0, 0);
}


// —————————————————————————————————————
// BUILD: HEXAGON‐CORNERS GRID (6‐corner graph)
// —————————————————————————————————————
function buildHexGraph() {
  posMap.clear(); adj.clear();
  let wHex = sqrt(3)*hexRadius;
  let hHex = 1.5 * hexRadius;
  let maxQ = floor(width  / wHex) + 2;
  let maxR = floor(height / hHex) + 2;

  // gather every corner
  for (let q = -maxQ; q <= maxQ; q++) {
    for (let r = -maxR; r <= maxR; r++) {
      let cx = width/2  + wHex*(q + r/2);
      let cy = height/2 + hHex*r;
      if (
        cx - hexRadius >= 0 && cx + hexRadius <= width &&
        cy - hexRadius >= 0 && cy + hexRadius <= height
      ) {
        let corners = [];
        for (let i = 0; i < 6; i++) {
          let ang = PI/6 + PI/3*i;
          let x  = cx + hexRadius*cos(ang);
          let y  = cy + hexRadius*sin(ang);
          let xR = round(x*100)/100, yR = round(y*100)/100;
          let key = `${xR},${yR}`;
          if (!posMap.has(key)) {
            posMap.set(key, { x: xR, y: yR });
            adj.set(key, new Set());
          }
          corners.push(key);
        }
        // link each hex corner in a loop
        for (let i = 0; i < 6; i++) {
          let a = corners[i], b = corners[(i+1)%6];
          adj.get(a).add(b);
          adj.get(b).add(a);
        }
      }
    }
  }

  // seed = corner nearest canvas center
  let best, bestD = Infinity;
  let cx = width/2, cy = height/2;
  for (let [key,pos] of posMap) {
    let d = dist(pos.x,pos.y, cx,cy);
    if (d < bestD) { bestD = d; best = key; }
  }
  return best;
}


// —————————————————————————————————————
// BUILD: CIRCULAR (POLAR) GRID
// concentric rings of points, linked ringwise + radially
// —————————————————————————————————————
function buildCircularGraph() {
  posMap.clear(); adj.clear();

  let cx = width/2, cy = height/2;
  // max number of full rings that fit with margin cellSize
  let maxRing = floor((min(width,height)/2 - cellSize) / cellSize);
  let rings = [];

  // ring 0 = center point
  let centerKey = `${round(cx*100)/100},${round(cy*100)/100}`;
  posMap.set(centerKey, { x: cx, y: cy });
  adj.set(centerKey, new Set());
  rings[0] = [centerKey];

  // rings 1…maxRing
  for (let i = 1; i <= maxRing; i++) {
    let n = max(6, floor(2*PI*i));  // at least 6 pts
    let ring = [];
    for (let j = 0; j < n; j++) {
      let theta = TWO_PI * j / n;
      let x = cx + i*cellSize * cos(theta);
      let y = cy + i*cellSize * sin(theta);
      let xR = round(x*100)/100, yR = round(y*100)/100;
      let key = `${xR},${yR}`;
      posMap.set(key, { x: xR, y: yR });
      adj.set(key, new Set());
      ring.push(key);
    }
    rings[i] = ring;
  }

  // link ring 0 ←→ ring1
  rings[1].forEach(k => {
    adj.get(centerKey).add(k);
    adj.get(k).add(centerKey);
  });

  // link each ring in a loop
  for (let i = 1; i <= maxRing; i++) {
    let ring = rings[i];
    for (let j = 0; j < ring.length; j++) {
      let a = ring[j], b = ring[(j+1)%ring.length];
      adj.get(a).add(b);
      adj.get(b).add(a);
    }
  }

  // radial links between rings
  for (let i = 2; i <= maxRing; i++) {
    let curr = rings[i], prev = rings[i-1];
    curr.forEach(k => {
      let p = posMap.get(k);
      // find closest in prev
      let best, bestD = Infinity;
      prev.forEach(pk => {
        let pp = posMap.get(pk);
        let d2 = (pp.x-p.x)**2 + (pp.y-p.y)**2;
        if (d2 < bestD) { bestD = d2; best = pk; }
      });
      adj.get(k).add(best);
      adj.get(best).add(k);
    });
  }

  return centerKey;
}


// —————————————————————————————————————
// WALK SUPPORT
// —————————————————————————————————————
function getUnvisitedNeighbors(k) {
  return Array.from(adj.get(k)).filter(x => !visitedSet.has(x));
}

function markAllLeaves() {
  visited.forEach(k => {
    if (
      !deadMarked.has(k) &&
      linkCount[k] === 1 &&
      getUnvisitedNeighbors(k).length === 0
    ) {
      let p = posMap.get(k);
      noStroke();
      fill(random(dotColors));
      // choose dot‐size by grid
      let d = (currentGrid === 'hexagon' ? hexRadius : cellSize)*0.6;
      ellipse(p.x, p.y, d);
      deadMarked.add(k);
    }
  });
}

function coordKey(a,b) {
  return `${a},${b}`;
}
