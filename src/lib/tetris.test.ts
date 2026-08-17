import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bestPlacement } from "./tetris.bot";
import {
  BUFFER,
  HEIGHT,
  KINDS,
  LOCK_DELAY,
  MAX_LOCK_RESETS,
  PIECE_COLOURS,
  WIDTH,
  canPlace,
  cells,
  createGame,
  ghostRow,
  gravityMs,
  hardDrop,
  hold,
  move,
  rotate,
  softDrop,
  tick,
  type Game,
  type PieceKind,
  type Rotation,
} from "./tetris";

/*
 * The engine is worth testing precisely because it is the part nobody can check
 * by looking. A wrong kick table or an off-by-one in the line clear produces a
 * game that runs, animates and scores — and is subtly not Tetris.
 */

function blank(): (PieceKind | null)[] {
  return new Array(WIDTH * HEIGHT).fill(null);
}

/** Fill a row except the columns named, which is how a clear gets set up. */
function fillRow(board: (PieceKind | null)[], row: number, except: number[]) {
  for (let c = 0; c < WIDTH; c++) {
    if (!except.includes(c)) board[row * WIDTH + c] = "L";
  }
}

function at(
  game: Game,
  kind: PieceKind,
  rot: Rotation,
  row: number,
  col: number,
): Game {
  return { ...game, current: { kind, rot, row, col } };
}

function filled(game: Game, row: number): number {
  let n = 0;
  for (let c = 0; c < WIDTH; c++) if (game.board[row * WIDTH + c]) n++;
  return n;
}

describe("the randomiser", () => {
  it("plays the same game twice from the same seed", () => {
    assert.deepEqual(createGame(42).queue, createGame(42).queue);
    assert.equal(createGame(42).current?.kind, createGame(42).current?.kind);
  });

  it("plays a different game from a different seed", () => {
    assert.notDeepEqual(createGame(1).queue, createGame(2).queue);
  });

  it("deals each of the seven before repeating any", () => {
    const game = createGame(3);
    const first = [game.current!.kind, ...game.queue.slice(0, 6)];
    assert.equal(new Set(first).size, 7);
  });

  it("does the same for the bag after it", () => {
    const second = createGame(3).queue.slice(6, 13);
    assert.equal(new Set(second).size, 7);
  });

  it("keeps enough queued to show five without running dry", () => {
    let game = createGame(5);
    for (let i = 0; i < 30; i++) game = hardDrop(game);
    assert.ok(game.queue.length >= 5);
  });

  it("gives every piece a colour", () => {
    for (const kind of KINDS) assert.ok(PIECE_COLOURS[kind]);
  });
});

describe("moving", () => {
  it("shifts sideways", () => {
    const game = at(createGame(1), "O", 0, 0, 4);
    assert.equal(move(game, 1).current?.col, 5);
    assert.equal(move(game, -1).current?.col, 3);
  });

  it("refuses to leave the board", () => {
    const game = at(createGame(1), "O", 0, 0, 8);
    assert.equal(move(game, 1), game);
  });

  it("refuses to walk through a stack", () => {
    const board = blank();
    board[0 * WIDTH + 6] = "L";
    const game = { ...at(createGame(1), "O", 0, 0, 4), board };
    assert.equal(move(game, 1), game);
  });
});

describe("rotation", () => {
  it("comes back to where it started after four turns", () => {
    let game = at(createGame(1), "T", 0, 5, 4);
    for (let i = 0; i < 4; i++) game = rotate(game, 1);
    assert.equal(game.current?.rot, 0);
    assert.equal(game.current?.col, 4);
    assert.equal(game.current?.row, 5);
  });

  it("leaves O alone, which has nothing to turn", () => {
    const game = at(createGame(1), "O", 0, 5, 4);
    assert.equal(rotate(game, 1), game);
  });

  it("kicks a J off the left wall rather than refusing", () => {
    // Rotating in place would put a cell at column -1. The second kick in the
    // 1>2 table shifts it a column right, which fits.
    const game = at(createGame(1), "J", 1, 0, -1);
    const turned = rotate(game, 1);
    assert.equal(turned.current?.rot, 2);
    assert.equal(turned.current?.col, 0);
  });

  it("kicks an I two columns, which is why it has its own table", () => {
    const game = at(createGame(1), "I", 1, 0, -2);
    const turned = rotate(game, 1);
    assert.equal(turned.current?.rot, 2);
    assert.equal(turned.current?.col, 0);
  });

  it("gives up when no kick in the table fits", () => {
    // Walled in on both sides with a one-column slot: nothing can turn here.
    const board = blank();
    for (let r = 0; r < HEIGHT; r++) {
      for (let c = 0; c < WIDTH; c++) {
        if (c !== 4) board[r * WIDTH + c] = "L";
      }
    }
    const game = { ...at(createGame(1), "I", 1, 0, 2), board };
    assert.equal(rotate(game, 1), game);
  });
});

describe("clearing lines", () => {
  it("takes out a completed row and scores it", () => {
    const board = blank();
    fillRow(board, HEIGHT - 1, [0]);
    // A vertical I in column 0 — rotation 1 sits in the box's third column.
    const game = { ...at(createGame(1), "I", 1, HEIGHT - 4, -2), board };
    const done = hardDrop(game);
    assert.equal(done.cleared, 1);
    assert.equal(done.lines, 1);
    assert.equal(done.score, 100);
  });

  it("scores a tetris at eight times a single", () => {
    const board = blank();
    for (let r = HEIGHT - 4; r < HEIGHT; r++) fillRow(board, r, [0]);
    const game = { ...at(createGame(1), "I", 1, HEIGHT - 4, -2), board };
    const done = hardDrop(game);
    assert.equal(done.cleared, 4);
    assert.equal(done.score, 800);
  });

  it("drops everything above the cleared row down", () => {
    const board = blank();
    fillRow(board, HEIGHT - 1, [0]);
    board[(HEIGHT - 5) * WIDTH + 9] = "T";
    const game = { ...at(createGame(1), "I", 1, HEIGHT - 4, -2), board };
    const done = hardDrop(game);
    assert.equal(done.board[(HEIGHT - 5) * WIDTH + 9], null);
    assert.equal(done.board[(HEIGHT - 4) * WIDTH + 9], "T");
  });

  it("scores by the level the row was cleared on", () => {
    const board = blank();
    fillRow(board, HEIGHT - 1, [0]);
    const game = {
      ...at(createGame(1), "I", 1, HEIGHT - 4, -2),
      board,
      level: 5,
    };
    assert.equal(hardDrop(game).score, 500);
  });

  it("raises the level every ten rows", () => {
    const board = blank();
    for (let r = HEIGHT - 4; r < HEIGHT; r++) fillRow(board, r, [0]);
    const game = { ...at(createGame(1), "I", 1, HEIGHT - 4, -2), board, lines: 8 };
    assert.equal(hardDrop(game).level, 2);
  });
});

describe("dropping", () => {
  it("pays one a row for a soft drop", () => {
    const game = at(createGame(1), "O", 0, 0, 4);
    assert.equal(softDrop(game).score, 1);
    assert.equal(softDrop(game).current?.row, 1);
  });

  it("pays two a row for a hard drop, and locks", () => {
    const game = at(createGame(1), "O", 0, 0, 4);
    const done = hardDrop(game);
    assert.equal(done.score, (HEIGHT - 2) * 2);
    assert.equal(filled(done, HEIGHT - 1), 2);
  });

  it("puts the ghost where the piece would land", () => {
    const game = at(createGame(1), "O", 0, 0, 4);
    assert.equal(ghostRow(game.board, game.current), HEIGHT - 2);
  });
});

describe("the lock delay", () => {
  const grounded = () => at(createGame(1), "O", 0, HEIGHT - 2, 4);

  it("waits before setting a piece that has landed", () => {
    const game = tick(grounded(), 100);
    assert.equal(game.lockTimer, 100);
    assert.equal(filled(game, HEIGHT - 1), 0);
  });

  it("sets it once the wait is up", () => {
    const game = tick(tick(grounded(), 100), LOCK_DELAY);
    assert.equal(filled(game, HEIGHT - 1), 2);
  });

  it("restarts the wait when the piece moves", () => {
    const game = move(tick(grounded(), 400), -1);
    assert.equal(game.lockTimer, 0);
  });

  it("stops restarting it eventually, or the piece never sets", () => {
    let game = tick(grounded(), 400);
    for (let i = 0; i < 20; i++) game = move(game, i % 2 === 0 ? 1 : -1);
    assert.equal(game.lockResets, MAX_LOCK_RESETS);

    game = tick(game, 200);
    const before = game.lockTimer;
    game = move(game, 1);
    assert.equal(game.lockTimer, before);
  });

  it("isn't counting while the piece can still fall", () => {
    const game = tick(at(createGame(1), "O", 0, 0, 4), 400);
    assert.equal(game.lockTimer, 0);
  });
});

describe("gravity", () => {
  it("falls a row a second on level one", () => {
    assert.equal(gravityMs(1), 1000);
    const game = tick(at(createGame(1), "O", 0, 0, 4), 1000);
    assert.equal(game.current?.row, 1);
  });

  it("speeds up as the level goes", () => {
    assert.ok(gravityMs(5) < gravityMs(1));
    assert.ok(gravityMs(10) < gravityMs(5));
  });

  it("stops speeding up once a frame is too coarse to say", () => {
    assert.equal(gravityMs(20), 16);
    assert.equal(gravityMs(60), gravityMs(20));
  });
});

describe("hold", () => {
  it("stores the current piece and brings in the next", () => {
    const game = createGame(1);
    const first = game.current!.kind;
    const held = hold(game);
    assert.equal(held.hold, first);
    assert.equal(held.current?.kind, game.queue[0]);
    assert.equal(held.held, true);
  });

  it("refuses a second hold on the same piece", () => {
    const held = hold(createGame(1));
    assert.equal(hold(held), held);
  });

  it("allows it again once a piece has been placed", () => {
    const held = hold(createGame(1));
    assert.equal(hardDrop(held).held, false);
  });

  it("swaps the two back on the next hold", () => {
    const game = createGame(1);
    const first = game.current!.kind;
    const swapped = hold(hardDrop(hold(game)));
    assert.equal(swapped.current?.kind, first);
  });
});

describe("ending", () => {
  it("ends when the next piece has nowhere to spawn", () => {
    const board = blank();
    for (let r = 0; r < BUFFER; r++) {
      for (const c of [3, 4, 5, 6]) board[r * WIDTH + c] = "L";
    }
    const game = { ...at(createGame(1), "O", 0, HEIGHT - 2, 0), board };
    assert.equal(hardDrop(game).over, true);
  });

  it("ends when a piece locks without reaching the visible field", () => {
    const board = blank();
    for (let r = BUFFER; r < HEIGHT; r++) fillRow(board, r, []);
    const game = { ...at(createGame(1), "O", 0, 0, 4), board };
    const done = hardDrop(game);
    assert.equal(done.over, true);
    assert.equal(done.cleared, 0);
  });

  it("stops responding once it's over", () => {
    const over: Game = { ...createGame(1), over: true };
    assert.equal(move(over, 1), over);
    assert.equal(rotate(over, 1), over);
    assert.equal(hardDrop(over), over);
    assert.equal(tick(over, 1000), over);
  });
});

describe("the attract-mode bot", () => {
  it("only ever names a placement the piece actually fits in", () => {
    let game = createGame(11);
    for (let i = 0; i < 40 && !game.over; i++) {
      const spot = bestPlacement(game);
      assert.ok(spot, "should find somewhere on a survivable board");
      const piece = {
        kind: game.current!.kind,
        rot: spot.rot,
        row: 0,
        col: spot.col,
      };
      assert.ok(canPlace(game.board, piece));
      for (const [, col] of cells(piece)) {
        assert.ok(col >= 0 && col < WIDTH);
      }
      game = hardDrop({ ...game, current: piece });
    }
  });

  it("has nothing to say about a finished game", () => {
    assert.equal(bestPlacement({ ...createGame(1), over: true }), null);
  });

  it("plays well enough to be worth watching", () => {
    let game = createGame(7);
    for (let i = 0; i < 80 && !game.over; i++) {
      const spot = bestPlacement(game);
      if (!spot) break;
      game = hardDrop({
        ...game,
        current: { kind: game.current!.kind, rot: spot.rot, row: 0, col: spot.col },
      });
    }
    assert.equal(game.over, false);
    assert.ok(game.lines >= 8, `cleared only ${game.lines} rows in 80 pieces`);
  });
});
