import { BlobError, BlobPreconditionFailedError, get, put } from "@vercel/blob";

import { EMPTY_BOARD, readBoard, type Board } from "./leaderboard";

/**
 * The leaderboard as one private JSON file in Vercel Blob.
 *
 * One file rather than a row per game, because the screen only ever wants the
 * top of the table and reading one small file is one request. Two games ending
 * at once is handled by the ETag: each write says which version it was built
 * from, the second one is refused, and it re-reads and tries again.
 *
 * One file per environment, so a preview deployment being tested never puts
 * its games on the board production visitors see.
 *
 * Server-only — the read-write token must never reach a bundle.
 */
const PATHNAME = `tetris/${process.env.VERCEL_ENV ?? "development"}/leaderboard.json`;

/** Enough for any realistic pile-up of games ending in the same second. */
const ATTEMPTS = 6;

export function leaderboardConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function load(): Promise<{ board: Board; etag: string | null }> {
  // Around the CDN: a cached copy is exactly the stale version a write built on
  // would be refused for.
  const res = await get(PATHNAME, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { board: EMPTY_BOARD, etag: null };
  const text = await new Response(res.stream).text();
  try {
    return { board: readBoard(JSON.parse(text)), etag: res.blob.etag };
  } catch {
    return { board: EMPTY_BOARD, etag: res.blob.etag };
  }
}

export async function readLeaderboard(): Promise<Board> {
  return (await load()).board;
}

/**
 * Apply `change` to the latest board and save it, retrying on a lost race.
 *
 * `change` returning null means "nothing to write", and comes back as null.
 * It may run more than once, so it must be a pure function of the board.
 */
export async function updateLeaderboard(
  change: (board: Board) => Board | null,
): Promise<Board | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const { board, etag } = await load();
    const next = change(board);
    if (!next) return null;

    try {
      await put(PATHNAME, JSON.stringify(next), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        // No ETag means no file yet, and creating one must not silently replace
        // a file someone else created a moment ago.
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
      });
      return next;
    } catch (error) {
      const lostRace =
        error instanceof BlobPreconditionFailedError ||
        (!etag && error instanceof BlobError);
      if (!lostRace) throw error;
    }
  }
  throw new Error("leaderboard: too many concurrent writes");
}
