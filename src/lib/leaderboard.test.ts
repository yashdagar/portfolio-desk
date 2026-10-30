import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cleanName,
  EMPTY_BOARD,
  KEPT,
  maxScore,
  publicBoard,
  readBoard,
  record,
  rename,
  SHOWN,
  validResult,
  type Board,
  type StoredEntry,
} from "./leaderboard";

function game(score: number, overrides: Partial<StoredEntry> = {}): StoredEntry {
  return {
    id: `g${score}`,
    key: `k${score}`,
    name: "",
    score,
    lines: 10,
    at: "2026-10-30T00:00:00.000Z",
    ...overrides,
  };
}

function boardOf(...entries: StoredEntry[]): Board {
  return entries.reduce(record, EMPTY_BOARD);
}

describe("cleanName", () => {
  it("accepts a name of exactly eight characters", () => {
    assert.equal(cleanName("Benedict"), "Benedict");
  });

  it("refuses a name of nine characters", () => {
    assert.equal(cleanName("Christina"), null);
  });

  it("trims and collapses whitespace", () => {
    assert.equal(cleanName("  Jo   Ann "), "Jo Ann");
  });

  it("counts a non-Latin name by characters, not bytes", () => {
    assert.equal(cleanName("यश"), "यश");
  });

  it("refuses an empty or blank name", () => {
    assert.equal(cleanName(""), null);
    assert.equal(cleanName("   "), null);
  });

  it("refuses markup and emoji", () => {
    assert.equal(cleanName("<b>x</b>"), null);
    assert.equal(cleanName("ace🔥"), null);
  });

  it("refuses something that isn't a string", () => {
    assert.equal(cleanName(42), null);
  });
});

describe("validResult", () => {
  it("accepts an ordinary game", () => {
    assert.ok(validResult(4_200, 23));
  });

  it("accepts a game that ended with no lines", () => {
    assert.ok(validResult(36, 0));
  });

  it("accepts the best score the engine could produce for the lines", () => {
    assert.ok(validResult(maxScore(40), 40));
  });

  it("refuses a score no game with those lines could reach", () => {
    assert.ok(!validResult(1_000_000, 3));
  });

  it("refuses negative, fractional and missing values", () => {
    assert.ok(!validResult(-1, 0));
    assert.ok(!validResult(10.5, 1));
    assert.ok(!validResult(undefined, 1));
  });
});

describe("record", () => {
  it("ranks games by score, highest first", () => {
    const board = boardOf(game(300), game(900), game(500));
    assert.deepEqual(
      board.entries.map((e) => e.score),
      [900, 500, 300],
    );
  });

  it("puts the earlier of two equal scores first", () => {
    const board = boardOf(
      game(500, { id: "late", at: "2026-10-30T10:00:00.000Z" }),
      game(500, { id: "early", at: "2026-10-30T09:00:00.000Z" }),
    );
    assert.deepEqual(
      board.entries.map((e) => e.id),
      ["early", "late"],
    );
  });

  it("counts every game, including ones too low to keep", () => {
    let board = EMPTY_BOARD;
    for (let i = 0; i < KEPT + 5; i++) {
      board = record(board, game(1_000 + i, { id: `g${i}` }));
    }
    assert.equal(board.games, KEPT + 5);
    assert.equal(board.entries.length, KEPT);
    assert.equal(board.entries.at(-1)!.score, 1_005);
  });
});

describe("rename", () => {
  it("names a game with its key", () => {
    const board = rename(boardOf(game(500)), "g500", "k500", "Yash");
    assert.equal(board?.entries[0].name, "Yash");
  });

  it("refuses the wrong key", () => {
    assert.equal(rename(boardOf(game(500)), "g500", "nope", "Yash"), null);
  });

  it("refuses a game that is already named", () => {
    const named = boardOf(game(500, { name: "Ana" }));
    assert.equal(rename(named, "g500", "k500", "Yash"), null);
  });

  it("refuses a game that isn't on the board", () => {
    assert.equal(rename(boardOf(game(500)), "gone", "k500", "Yash"), null);
  });
});

describe("publicBoard", () => {
  it("shows only the top rows", () => {
    const board = boardOf(...Array.from({ length: 9 }, (_, i) => game(i * 100)));
    assert.equal(publicBoard(board).entries.length, SHOWN);
  });

  it("never exposes the keys", () => {
    const shown = publicBoard(boardOf(game(500)));
    assert.ok(!JSON.stringify(shown).includes("k500"));
  });
});

describe("readBoard", () => {
  it("round-trips a saved board", () => {
    const board = boardOf(game(900), game(300));
    assert.deepEqual(readBoard(JSON.parse(JSON.stringify(board))), board);
  });

  it("treats a file that isn't a board as empty", () => {
    assert.deepEqual(readBoard("garbage"), EMPTY_BOARD);
    assert.deepEqual(readBoard({ entries: "nope" }), EMPTY_BOARD);
  });

  it("drops malformed rows and keeps the rest", () => {
    const read = readBoard({
      games: 3,
      entries: [game(900), { id: "bad", score: "lots" }],
    });
    assert.deepEqual(
      read.entries.map((e) => e.id),
      ["g900"],
    );
    assert.equal(read.games, 3);
  });
});
