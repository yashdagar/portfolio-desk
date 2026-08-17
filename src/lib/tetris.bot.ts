/**
 * The player for attract mode.
 *
 * The resting shot is the composed frame nearly every visitor sees, and the
 * centre monitor is the largest thing in it. An empty board sitting there would
 * be worse than whatever it replaced, so when nobody is playing, something has
 * to be — and it has to be good enough that watching it isn't embarrassing.
 *
 * One ply: try every rotation in every column, drop each, and score the board
 * that results. It doesn't look ahead to the next piece and doesn't use hold, so
 * it will eventually lose. That's fine, and arguably better than a bot that
 * never does: topping out and starting again is more interesting to glance at
 * than a stack that never changes shape.
 */

import {
  HEIGHT,
  WIDTH,
  canPlace,
  cells,
  type Game,
  type PieceKind,
  type Rotation,
} from "./tetris";

export interface Placement {
  rot: Rotation;
  /** Column of the piece's box, i.e. what `Piece.col` should end up as. */
  col: number;
}

/**
 * Lee's weights, which are well-travelled and play a respectable game for four
 * numbers. Holes dominates in practice: a buried gap costs every row above it,
 * so the bot will happily build two rows taller to avoid making one.
 */
const HEIGHT_WEIGHT = -0.510066;
const LINES_WEIGHT = 0.760666;
const HOLES_WEIGHT = -0.35663;
const BUMPINESS_WEIGHT = -0.184483;

/** Drop a piece into a copy of the board and clear what it fills. */
function settle(
  board: Game["board"],
  kind: PieceKind,
  rot: Rotation,
  col: number,
): { board: Game["board"]; lines: number } | null {
  let row = 0;
  if (!canPlace(board, { kind, rot, row, col })) return null;
  while (canPlace(board, { kind, rot, row: row + 1, col })) row++;

  const out = [...board];
  for (const [r, c] of cells({ kind, rot, row, col })) {
    if (r >= 0) out[r * WIDTH + c] = kind;
  }

  const kept: (PieceKind | null)[] = [];
  let lines = 0;
  for (let r = 0; r < HEIGHT; r++) {
    const line = out.slice(r * WIDTH, r * WIDTH + WIDTH);
    if (line.every(Boolean)) lines++;
    else kept.push(...line);
  }
  return {
    board: [...new Array(lines * WIDTH).fill(null), ...kept],
    lines,
  };
}

/** Height of each column, measured from the floor up to its highest filled cell. */
function heights(board: Game["board"]): number[] {
  const out = new Array(WIDTH).fill(0);
  for (let c = 0; c < WIDTH; c++) {
    for (let r = 0; r < HEIGHT; r++) {
      if (board[r * WIDTH + c]) {
        out[c] = HEIGHT - r;
        break;
      }
    }
  }
  return out;
}

/** Empty cells with something above them — the thing that actually kills you. */
function holes(board: Game["board"], cols: number[]): number {
  let count = 0;
  for (let c = 0; c < WIDTH; c++) {
    const top = HEIGHT - cols[c];
    for (let r = top + 1; r < HEIGHT; r++) {
      if (!board[r * WIDTH + c]) count++;
    }
  }
  return count;
}

function score(board: Game["board"], lines: number): number {
  const cols = heights(board);
  let bumpiness = 0;
  for (let c = 0; c < WIDTH - 1; c++) {
    bumpiness += Math.abs(cols[c] - cols[c + 1]);
  }
  return (
    HEIGHT_WEIGHT * cols.reduce((a, b) => a + b, 0) +
    LINES_WEIGHT * lines +
    HOLES_WEIGHT * holes(board, cols) +
    BUMPINESS_WEIGHT * bumpiness
  );
}

/**
 * Where to put the current piece. Null when there is nowhere legal, which means
 * the game is already lost.
 */
export function bestPlacement(game: Game): Placement | null {
  if (!game.current || game.over) return null;
  const kind = game.current.kind;

  let best: Placement | null = null;
  let bestScore = -Infinity;

  for (let rot = 0 as Rotation; rot < 4; rot = (rot + 1) as Rotation) {
    // Columns start negative because a piece's box is wider than its cells —
    // an L rotated left has an empty first column and legitimately hangs off
    // the left wall.
    for (let col = -2; col < WIDTH; col++) {
      const landed = settle(game.board, kind, rot, col);
      if (!landed) continue;
      const value = score(landed.board, landed.lines);
      if (value > bestScore) {
        bestScore = value;
        best = { rot, col };
      }
    }
  }
  return best;
}
