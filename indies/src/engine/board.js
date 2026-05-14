/**
 * board.js — Hex Grid Engine (4 rows × 7 columns, pointy-top)
 * Uses axial coordinates (q, r) for all grid logic.
 */
import { Graphics, Container, Text, TextStyle } from 'pixi.js';

// Direction vectors for pointy-top hex neighbors
const DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export class HexGrid {
  /**
   * @param {number} rows    — number of rows (4 for player, 4 for enemy = 8 total)
   * @param {number} cols    — number of columns (7)
   * @param {number} hexSize — outer radius of each hex in pixels
   */
  constructor(rows = 8, cols = 7, hexSize = 40) {
    this.rows = rows;
    this.cols = cols;
    this.hexSize = hexSize;

    // Containers
    this.container = new Container();
    this.gridGfx = new Graphics();
    this.highlightGfx = new Graphics();
    this.container.addChild(this.gridGfx);
    this.container.addChild(this.highlightGfx);

    // Map of "q,r" → cell data
    this.cells = new Map();
    this.benchCells = [];

    // Generate the grid cells
    this._generateGrid();
    this._generateBench();
  }

  _generateBench() {
    // 10 bench slots in 2 rows of 5
    for (let i = 0; i < 10; i++) {
      const row = Math.floor(i / 5);
      const col = i % 5;
      this.benchCells.push({
        id: `bench_${i}`,
        index: i,
        unit: null,
        side: 'bench',
        // Visual position (well below the hex grid)
        x: (col - 2) * 80,
        y: 550 + row * 80,
      });
    }
  }

  /* ── Grid Generation ── */
  _generateGrid() {
    // We use offset layout: for each row r, columns 0..cols-1
    // Convert offset (col, row) → axial (q, r)
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const axial = this.offsetToAxial(col, row);
        const key = `${axial.q},${axial.r}`;
        this.cells.set(key, {
          q: axial.q,
          r: axial.r,
          col,
          row,
          unit: null,
          side: row < this.rows / 2 ? 'enemy' : 'player', // top half = enemy, bottom = player
        });
      }
    }
  }

  /* ── Coordinate Conversions ── */

  /** Offset (col, row) → Axial (q, r) for odd-r layout */
  offsetToAxial(col, row) {
    const q = col - Math.floor(row / 2);
    const r = row;
    return { q, r };
  }

  /** Axial (q, r) → Offset (col, row) for odd-r layout */
  axialToOffset(q, r) {
    const col = q + Math.floor(r / 2);
    const row = r;
    return { col, row };
  }

  /** Axial (q, r) → pixel center position (pointy-top) */
  axialToPixel(q, r) {
    const size = this.hexSize;
    const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = size * ((3 / 2) * r);
    return { x, y };
  }

  /** Pixel → fractional axial (pointy-top) */
  pixelToAxial(px, py) {
    const size = this.hexSize;
    const q = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / size;
    const r = ((2 / 3) * py) / size;
    return this.hexRound(q, r);
  }

  /** Round fractional axial to nearest hex */
  hexRound(q, r) {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  }

  /** Distance between two axial coords */
  hexDistance(a, b) {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  }

  /** Get 6 neighboring axial coords */
  getNeighbors(q, r) {
    return DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
  }

  /** Get cell data at axial position */
  getCellAt(q, r) {
    return this.cells.get(`${q},${r}`) || null;
  }

  /** Get bench cell by global coordinates (hit test) */
  getBenchCellAt(lx, ly) {
    for (const bc of this.benchCells) {
      const dx = lx - bc.x;
      const dy = ly - bc.y;
      if (Math.sqrt(dx*dx + dy*dy) < 25) return bc;
    }
    return null;
  }

  /** Generic cell getter (handles both grid and bench) */
  findCellAt(gx, gy) {
    const lx = gx - this.container.x;
    const ly = gy - this.container.y;
    // Check bench first
    const bc = this.getBenchCellAt(lx, ly);
    if (bc) return bc;
    // Check grid
    const axial = this.pixelToAxial(lx, ly);
    const cell = this.getCellAt(axial.q, axial.r);
    // Extra hit test for grid cell because axial rounding is broad
    if (cell) {
      const px = this.axialToPixel(cell.q, cell.r);
      const dx = lx - px.x;
      const dy = ly - px.y;
      if (Math.sqrt(dx*dx + dy*dy) < this.hexSize * 0.9) return cell;
    }
    return null;
  }

  /* ── Drawing ── */

  /** Compute hex corner positions (pointy-top) */
  _hexCorners(cx, cy, size) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      corners.push({
        x: cx + size * Math.cos(angle),
        y: cy + size * Math.sin(angle),
      });
    }
    return corners;
  }

  /** Draw the full grid */
  drawGrid() {
    const gfx = this.gridGfx;
    gfx.clear();

    for (const [, cell] of this.cells) {
      const { x, y } = this.axialToPixel(cell.q, cell.r);
      const corners = this._hexCorners(x, y, this.hexSize);

      // Fill — very subtle
      const fillAlpha = cell.side === 'player' ? 0.04 : 0.02;
      const fillColor = cell.side === 'player' ? 0x00F5FF : 0xFF007A;
      gfx.poly(corners.flatMap(c => [c.x, c.y]));
      gfx.fill({ color: fillColor, alpha: fillAlpha });

      // Stroke
      gfx.poly(corners.flatMap(c => [c.x, c.y]));
      gfx.stroke({ color: 0x1F2937, width: 1, alpha: 0.6 });
    }

    // Draw Bench
    for (const bc of this.benchCells) {
      gfx.circle(bc.x, bc.y, 24);
      gfx.fill({ color: 0x1F2937, alpha: 0.4 });
      gfx.circle(bc.x, bc.y, 24);
      gfx.stroke({ color: 0x374151, width: 2, alpha: 0.8 });
    }
  }

  /** Highlight a specific cell (hover / selection) */
  highlightCell(cell, color = 0x00F5FF) {
    const gfx = this.highlightGfx;
    gfx.clear();
    if (!cell) return;

    if (cell.side === 'bench') {
      gfx.circle(cell.x, cell.y, 26);
      gfx.stroke({ color, width: 2, alpha: 1 });
    } else {
      const { x, y } = this.axialToPixel(cell.q, cell.r);
      const corners = this._hexCorners(x, y, this.hexSize);
      gfx.poly(corners.flatMap(c => [c.x, c.y]));
      gfx.fill({ color, alpha: 0.12 });
      gfx.poly(corners.flatMap(c => [c.x, c.y]));
      gfx.stroke({ color, width: 2, alpha: 0.8 });
    }
  }

  /** Clear highlight */
  clearHighlight() {
    this.highlightGfx.clear();
  }

  /** Center the grid container within given width/height */
  centerIn(width, height) {
    // Calculate grid bounding box (including bench)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Check hex cells
    for (const [, cell] of this.cells) {
      const { x, y } = this.axialToPixel(cell.q, cell.r);
      const corners = this._hexCorners(x, y, this.hexSize);
      for (const c of corners) {
        minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
      }
    }
    // Check bench cells
    for (const bc of this.benchCells) {
      minX = Math.min(minX, bc.x - 30); minY = Math.min(minY, bc.y - 30);
      maxX = Math.max(maxX, bc.x + 30); maxY = Math.max(maxY, bc.y + 30);
    }

    const gridW = maxX - minX;
    const gridH = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.container.x = width / 2 - centerX;
    this.container.y = height / 2 - centerY;

    return { gridW, gridH };
  }

  /** Convert global pixel to local grid axial coords */
  globalToAxial(globalX, globalY) {
    const localX = globalX - this.container.x;
    const localY = globalY - this.container.y;
    return this.pixelToAxial(localX, localY);
  }

  /** Get all cells for a given side (player, enemy, bench) */
  getCellsBySide(side) {
    if (side === 'bench') return this.benchCells;
    const result = [];
    for (const [, cell] of this.cells) {
      if (cell.side === side) result.push(cell);
    }
    return result;
  }

  /** Get empty cells for a given side */
  getEmptyCells(side) {
    return this.getCellsBySide(side).filter(c => c.unit === null);
  }
}
