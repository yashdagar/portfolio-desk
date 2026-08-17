/**
 * A Tetris engine. Pure, seeded, and with no import from React, the DOM or the
 * clock — everything time-dependent arrives as a `dt` in milliseconds.
 *
 * Seeded rather than `Math.random()` for two reasons that both bite hard. The
 * page is server-rendered, and a random board in render is a hydration mismatch.
 * And a game whose piece order can't be reproduced can't be tested, which for
 * something with this much branching is the difference between working and
 * appearing to work.
 *
 * The rules are the modern ones, not 1984's: SRS rotation with wall kicks, a
 * seven-bag randomiser, hold, and a lock delay that resets when you move. Those
 * last two are most of what separates a Tetris that feels right from one that
 * feels broken, however correct its line clears are.
 */

export type PieceKind = "I" | "J" | "L" | "O" | "S" | "T" | "Z";
export type Rotation = 0 | 1 | 2 | 3;

export const WIDTH = 10;
/** Rows above the visible field. Pieces spawn here and fall into view. */
export const BUFFER = 2;
export const VISIBLE = 20;
export const HEIGHT = BUFFER + VISIBLE;

/** How long a grounded piece waits before it sets, in milliseconds. */
export const LOCK_DELAY = 500;
/**
 * Moving or rotating restarts that wait, but only this many times. Uncapped, a
 * piece spun in place never locks and the game stops being one.
 */
export const MAX_LOCK_RESETS = 15;

export const KINDS: readonly PieceKind[] = ["I", "J", "L", "O", "S", "T", "Z"];

/**
 * The canonical seven, desaturated to sit in a warm room rather than glow out
 * of it. S and Z are deliberately the palette's own `--add` and `--del`: those
 * two already mean "good thing" and "bad thing" everywhere else on these
 * screens, and a green S reading as an addition costs nothing.
 *
 * Seven saturated hues is a deliberate exception to the room's one-accent rule.
 * See docs/ui-detailing.md §6 for why a game gets one.
 */
export const PIECE_COLOURS: Record<PieceKind, string> = {
  I: "#5ec9d6",
  J: "#5b7fd4",
  L: "#d99154",
  O: "#d9c15e",
  S: "#7ec699",
  T: "#a97fd0",
  Z: "#d98b8b",
};

/** Cell offsets `[row, col]` inside the piece's own box, one list per rotation. */
type Shape = readonly (readonly [number, number])[];

const SHAPES: Record<PieceKind, readonly Shape[]> = {
  I: [
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  ],
  J: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
  ],
  L: [
    [
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  ],
  O: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
  S: [
    [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  Z: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 2],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
  ],
};

/** Where a piece's box starts, so the spawn straddles the middle columns. */
const SPAWN_COL: Record<PieceKind, number> = {
  I: 3,
  J: 3,
  L: 3,
  O: 4,
  S: 3,
  T: 3,
  Z: 3,
};

/**
 * Super Rotation System kick tables, written the way every reference prints
 * them: `[x, y]` with y pointing *up*. Rows here run downward, so applying one
 * subtracts y — done in `rotate`, once, rather than in the tables, so these can
 * be checked against any source without translating them first.
 */
const JLSTZ_KICKS: Record<string, readonly (readonly [number, number])[]> = {
  "0>1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "1>0": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "1>2": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "2>1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "2>3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "3>2": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "3>0": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "0>3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};

const I_KICKS: Record<string, readonly (readonly [number, number])[]> = {
  "0>1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "1>0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "1>2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "2>1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "2>3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "3>2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "3>0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "0>3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

export interface Piece {
  kind: PieceKind;
  rot: Rotation;
  /** Top-left of the piece's box, which may sit outside the board. */
  row: number;
  col: number;
}

export interface Game {
  /** Flat, `HEIGHT * WIDTH`, row-major. Null is empty. */
  board: (PieceKind | null)[];
  current: Piece | null;
  /** Always at least seven deep, so five can be shown without special cases. */
  queue: PieceKind[];
  hold: PieceKind | null;
  /** Hold is once per piece, or it's an infinite swap. */
  held: boolean;
  seed: number;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  /** Milliseconds the piece has been resting on something. */
  lockTimer: number;
  lockResets: number;
  /** Milliseconds accumulated toward the next gravity step. */
  dropTimer: number;
  /** Rows taken out by the most recent lock, for the UI to react to. */
  cleared: number;
  /** Which rows those were, indexed into `preClear` rather than `board`. */
  clearedRows: number[];
  /**
   * The board a frame before those rows came out, piece included. The renderer
   * holds this on screen for a moment so a clear is something you watch happen
   * rather than something you infer from the stack being shorter.
   */
  preClear: (PieceKind | null)[] | null;
}

/**
 * mulberry32. The state is carried in `Game` rather than captured in a closure
 * so that a game is a value: two games with the same seed play identically, and
 * a test can assert on the piece order.
 */
function random(seed: number): { value: number; seed: number } {
  const a = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: a };
}

/**
 * Seven-bag: every seven pieces contains each shape exactly once. It is what
 * stops the game handing out four S pieces in a row, which is unsurvivable and
 * reads as the game cheating rather than as bad luck.
 */
function bag(seed: number): { pieces: PieceKind[]; seed: number } {
  const pieces = [...KINDS];
  let s = seed;
  for (let i = pieces.length - 1; i > 0; i--) {
    const r = random(s);
    s = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return { pieces, seed: s };
}

function refill(queue: PieceKind[], seed: number) {
  let out = queue;
  let s = seed;
  while (out.length < 7) {
    const next = bag(s);
    out = [...out, ...next.pieces];
    s = next.seed;
  }
  return { queue: out, seed: s };
}

/** Absolute board cells a piece covers. Rows may be negative while spawning. */
export function cells(piece: Piece): [number, number][] {
  return SHAPES[piece.kind][piece.rot].map(
    ([r, c]) => [piece.row + r, piece.col + c] as [number, number],
  );
}

/** Exported for the attract-mode bot, which tries placements the game hasn't. */
export function canPlace(board: Game["board"], piece: Piece): boolean {
  for (const [row, col] of cells(piece)) {
    if (col < 0 || col >= WIDTH || row >= HEIGHT) return false;
    // Above the board is legal: a piece is half-spawned before it falls in.
    if (row < 0) continue;
    if (board[row * WIDTH + col]) return false;
  }
  return true;
}

function spawn(kind: PieceKind): Piece {
  return { kind, rot: 0, row: 0, col: SPAWN_COL[kind] };
}

/**
 * Guideline gravity: `(0.8 - (level - 1) * 0.007) ^ (level - 1)` seconds a row.
 * Clamped at the top because the curve keeps going after the point where a
 * frame is already too coarse to express it.
 */
export function gravityMs(level: number): number {
  const l = Math.min(level, 20);
  return Math.max(16, (0.8 - (l - 1) * 0.007) ** (l - 1) * 1000);
}

export function createGame(seed: number): Game {
  const start = refill([], seed);
  const [first, ...rest] = start.queue;
  const filled = refill(rest, start.seed);
  return {
    board: new Array(WIDTH * HEIGHT).fill(null),
    current: spawn(first),
    queue: filled.queue,
    hold: null,
    held: false,
    seed: filled.seed,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    lockTimer: 0,
    lockResets: 0,
    dropTimer: 0,
    cleared: 0,
    clearedRows: [],
    preClear: null,
  };
}

/** True when the piece has something directly under it. */
export function grounded(game: Game): boolean {
  if (!game.current) return true;
  return !canPlace(game.board, { ...game.current, row: game.current.row + 1 });
}

/**
 * A successful move restarts the lock countdown, which is what lets you slide a
 * piece along the floor into a gap. Capped, or it never sets at all.
 */
function afterAction(game: Game, moved: Game): Game {
  if (!grounded(moved)) return { ...moved, lockTimer: 0 };
  if (moved.lockResets >= MAX_LOCK_RESETS) return moved;
  return { ...moved, lockTimer: 0, lockResets: moved.lockResets + 1 };
}

export function move(game: Game, dCol: number): Game {
  if (game.over || !game.current) return game;
  const next = { ...game.current, col: game.current.col + dCol };
  if (!canPlace(game.board, next)) return game;
  return afterAction(game, { ...game, current: next });
}

export function rotate(game: Game, dir: 1 | -1): Game {
  if (game.over || !game.current) return game;
  // O has one shape, so every kick is the identity and the loop is wasted work.
  if (game.current.kind === "O") return game;

  const from = game.current.rot;
  const to = ((((from + dir) % 4) + 4) % 4) as Rotation;
  const table = game.current.kind === "I" ? I_KICKS : JLSTZ_KICKS;
  for (const [x, y] of table[`${from}>${to}`]) {
    const next: Piece = {
      ...game.current,
      rot: to,
      col: game.current.col + x,
      row: game.current.row - y,
    };
    if (canPlace(game.board, next))
      return afterAction(game, { ...game, current: next });
  }
  return game;
}

/** One row down, worth a point. Returns unchanged if it can't. */
export function softDrop(game: Game): Game {
  if (game.over || !game.current) return game;
  const next = { ...game.current, row: game.current.row + 1 };
  if (!canPlace(game.board, next)) return game;
  return {
    ...game,
    current: next,
    score: game.score + 1,
    lockTimer: 0,
    dropTimer: 0,
  };
}

export function hardDrop(game: Game): Game {
  if (game.over || !game.current) return game;
  let piece = game.current;
  let dropped = 0;
  while (canPlace(game.board, { ...piece, row: piece.row + 1 })) {
    piece = { ...piece, row: piece.row + 1 };
    dropped++;
  }
  return lock({ ...game, current: piece, score: game.score + dropped * 2 });
}

/**
 * Where a piece would land, as a box top-left row. Takes the two things it
 * needs rather than a whole game, so the renderer can ask about the board it is
 * holding without inventing the rest of one.
 */
export function ghostRow(
  board: Game["board"],
  piece: Piece | null,
): number | null {
  if (!piece) return null;
  let row = piece.row;
  while (canPlace(board, { ...piece, row: row + 1 })) row++;
  return row;
}

export function hold(game: Game): Game {
  if (game.over || !game.current || game.held) return game;
  const stored = game.hold;
  const [head, ...rest] = game.queue;
  const incoming = stored ?? head;
  const next = spawn(incoming);
  // Refusing rather than ending the game: swapping into a blocked spawn is the
  // player's mistake to recover from, not a top-out.
  if (!canPlace(game.board, next)) return game;
  const filled = stored
    ? { queue: game.queue, seed: game.seed }
    : refill(rest, game.seed);
  return {
    ...game,
    current: next,
    hold: game.current.kind,
    held: true,
    queue: filled.queue,
    seed: filled.seed,
    lockTimer: 0,
    lockResets: 0,
    dropTimer: 0,
  };
}

const CLEAR_SCORE = [0, 100, 300, 500, 800];

/** Settle the current piece, clear what it filled, and bring in the next. */
export function lock(game: Game): Game {
  if (game.over || !game.current) return game;

  const board = [...game.board];
  const placed = cells(game.current);
  for (const [row, col] of placed) {
    if (row >= 0) board[row * WIDTH + col] = game.current.kind;
  }

  // Locking entirely above the visible field is a lock-out: there was no room
  // left to place it, even though nothing collided on the way down.
  if (placed.every(([row]) => row < BUFFER)) {
    return {
      ...game,
      board,
      current: null,
      over: true,
      cleared: 0,
      clearedRows: [],
      preClear: null,
    };
  }

  const kept: (PieceKind | null)[] = [];
  const clearedRows: number[] = [];
  for (let row = 0; row < HEIGHT; row++) {
    const line = board.slice(row * WIDTH, row * WIDTH + WIDTH);
    if (line.every(Boolean)) clearedRows.push(row);
    else kept.push(...line);
  }
  const cleared = clearedRows.length;
  const settled = [
    ...new Array(cleared * WIDTH).fill(null),
    ...kept,
  ] as (PieceKind | null)[];

  const lines = game.lines + cleared;
  const level = 1 + Math.floor(lines / 10);

  const [head, ...rest] = game.queue;
  const filled = refill(rest, game.seed);
  const next = spawn(head);

  return {
    ...game,
    board: settled,
    // The board as it looked with the piece in it and the full rows still
    // there. The rows have to be seen going, or a tetris and a single look
    // identical: the stack is simply lower than it was a frame ago.
    preClear: cleared ? board : null,
    clearedRows,
    // Blocked at the spawn point: nowhere to put the next piece, so that's it.
    current: canPlace(settled, next) ? next : null,
    over: !canPlace(settled, next),
    queue: filled.queue,
    seed: filled.seed,
    held: false,
    score: game.score + CLEAR_SCORE[cleared] * game.level,
    lines,
    level,
    lockTimer: 0,
    lockResets: 0,
    dropTimer: 0,
    cleared,
  };
}

/**
 * Advance by `dt` milliseconds. Gravity and the lock countdown are separate
 * clocks: a piece that can still fall is never counting down, and one that
 * can't isn't accumulating fall.
 */
export function tick(game: Game, dt: number): Game {
  if (game.over || !game.current) return game;

  let piece = game.current;
  const step = gravityMs(game.level);
  let drop = game.dropTimer + dt;
  while (drop >= step) {
    const next = { ...piece, row: piece.row + 1 };
    if (!canPlace(game.board, next)) {
      // Grounded. Holding the remainder would make the piece drop the instant
      // a gap opened under it, which looks like a glitch rather than gravity.
      drop = 0;
      break;
    }
    drop -= step;
    piece = next;
  }
  const out: Game = { ...game, current: piece, dropTimer: drop };

  if (grounded(out)) {
    const lockTimer = out.lockTimer + dt;
    return lockTimer >= LOCK_DELAY ? lock(out) : { ...out, lockTimer };
  }
  return out.lockTimer === 0 ? out : { ...out, lockTimer: 0 };
}
