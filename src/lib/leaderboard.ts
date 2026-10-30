/**
 * The Tetris leaderboard, shared by everyone who plays.
 *
 * Pure on purpose: the rules for what gets in, how it ranks and who may name it
 * are the part worth testing, and none of them should need a storage bucket to
 * check. `leaderboard.server.ts` is the thin layer that reads and writes it.
 */

/** Long enough for most first names, short enough to sit in a 300px column. */
export const NAME_MAX = 8;

/** Rows on the screen. */
export const SHOWN = 5;

/**
 * Rows kept. Every finished game is written, but the file is rewritten whole on
 * each one, so it can't grow forever — and nobody scrolls to rank 4,000.
 */
export const KEPT = 200;

export interface Entry {
  id: string;
  /** Empty until the player names it. A game is on the board the moment it
   *  ends, whether or not anyone stays to type. */
  name: string;
  score: number;
  lines: number;
  /** ISO time the game ended. Breaks ties: whoever got there first keeps it. */
  at: string;
}

/** What's stored. `key` is handed only to the player who finished the game,
 *  and is what lets them, and nobody else, put a name to it. */
export interface StoredEntry extends Entry {
  key: string;
}

export interface Board {
  /** Every game ever finished, including the ones that fell off the bottom. */
  games: number;
  entries: StoredEntry[];
}

export interface PublicBoard {
  games: number;
  entries: Entry[];
}

export const EMPTY_BOARD: Board = { games: 0, entries: [] };

/**
 * Letters in any script, digits, and the punctuation real names have. Anything
 * else — markup, emoji, control characters — is a reason to say no rather than
 * something to strip quietly into a name the player didn't type.
 */
const NAME_CHARS = /^[\p{L}\p{M}\p{N} .'-]+$/u;

/** Tidied name, or null if it can't go on the board. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!name || [...name].length > NAME_MAX) return null;
  return NAME_CHARS.test(name) ? name : null;
}

/**
 * The most a game with this many lines could have scored.
 *
 * Clears pay at most 200 a line (800 for a tetris) times the level, which
 * rises every ten lines. Drops pay at most 2 a row over a 22-row well, for
 * every piece that was ever placed — the cells cleared plus a full board left
 * standing. Generous, so no honest game is ever refused; it only stops the
 * request that claims a million points from three lines.
 */
export function maxScore(lines: number): number {
  const clears = 200 * lines * (1 + lines / 10);
  const pieces = (lines * 10 + 200) / 4;
  return Math.ceil(clears + pieces * 44);
}

export function validResult(score: unknown, lines: unknown): boolean {
  return (
    Number.isInteger(score) &&
    Number.isInteger(lines) &&
    (lines as number) >= 0 &&
    (lines as number) <= 100_000 &&
    (score as number) >= 0 &&
    (score as number) <= maxScore(lines as number)
  );
}

function rank(a: Entry, b: Entry): number {
  return b.score - a.score || a.at.localeCompare(b.at);
}

export function record(board: Board, entry: StoredEntry): Board {
  return {
    games: board.games + 1,
    entries: [...board.entries, entry].sort(rank).slice(0, KEPT),
  };
}

/**
 * Name a game, once, with the key that came back when it was recorded.
 *
 * Null when it can't be done: wrong key, already named, or the game has since
 * been pushed off the bottom by better ones.
 */
export function rename(
  board: Board,
  id: string,
  key: string,
  name: string,
): Board | null {
  const entry = board.entries.find((e) => e.id === id);
  if (!entry || entry.key !== key || entry.name) return null;
  return {
    ...board,
    entries: board.entries.map((e) => (e.id === id ? { ...e, name } : e)),
  };
}

/** The top of the table, keys removed. */
export function publicBoard(board: Board): PublicBoard {
  return {
    games: board.games,
    entries: board.entries
      .slice(0, SHOWN)
      .map(({ id, name, score, lines, at }) => ({ id, name, score, lines, at })),
  };
}

/** A stored file that doesn't look like a board is treated as no board at all,
 *  rather than as a crash on every request until someone fixes it by hand. */
export function readBoard(raw: unknown): Board {
  if (!raw || typeof raw !== "object") return EMPTY_BOARD;
  const { games, entries } = raw as Partial<Board>;
  if (!Array.isArray(entries)) return EMPTY_BOARD;
  const valid = entries.filter(
    (e): e is StoredEntry =>
      !!e &&
      typeof e.id === "string" &&
      typeof e.key === "string" &&
      typeof e.name === "string" &&
      typeof e.at === "string" &&
      Number.isInteger(e.score) &&
      Number.isInteger(e.lines),
  );
  return {
    games: Number.isInteger(games) ? Math.max(games!, valid.length) : valid.length,
    entries: valid.sort(rank).slice(0, KEPT),
  };
}
