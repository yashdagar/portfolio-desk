import { BlobError, BlobPreconditionFailedError, get, put } from "@vercel/blob";

import { EMPTY_BOARD, readBoard, type Board } from "./leaderboard";

/**
 * The leaderboard as one private JSON file in Vercel Blob.
 *
 * One file rather than a row per game, because the screen only ever wants the
 * top of the table and reading one small file is one cheap request, where
 * listing a folder of games on every read is the expensive kind.
 *
 * One file per environment, so a preview deployment being tested never puts
 * its games on the board production visitors see.
 *
 * Server-only — the read-write token must never reach a bundle.
 */
const PATHNAME = `tetris/${process.env.VERCEL_ENV ?? "development"}/leaderboard.json`;

/**
 * Lost races are retried, backing off by a random amount so the losers don't
 * re-read and collide again in lockstep. Long enough in total to outlast the
 * few seconds a read can lag behind a write.
 */
const ATTEMPTS = 10;
const BACKOFF_MS = 120;

export function leaderboardConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * What this instance last wrote, and every version it has overwritten.
 *
 * Reads lag writes by a few seconds, even around the CDN. A read that comes
 * back with a version this instance has already overwritten is that lag, not
 * news, and the copy held here is the truth. A read with any other version is
 * someone else's newer write, and wins.
 */
let lastWrite: { board: Board; etag: string } | null = null;
const superseded = new Set<string | null>();

async function load(): Promise<{ board: Board; etag: string | null }> {
  const res = await get(PATHNAME, { access: "private", useCache: false });
  const read =
    !res || res.statusCode !== 200
      ? { board: EMPTY_BOARD, etag: null }
      : await parse(res.stream, res.blob.etag);

  if (lastWrite && superseded.has(read.etag)) {
    return { board: lastWrite.board, etag: lastWrite.etag };
  }
  return read;
}

async function parse(stream: ReadableStream, etag: string) {
  try {
    const text = await new Response(stream).text();
    return { board: readBoard(JSON.parse(text)), etag };
  } catch {
    return { board: EMPTY_BOARD, etag };
  }
}

export async function readLeaderboard(): Promise<Board> {
  return (await load()).board;
}

/**
 * One write at a time per instance. Concurrent requests mostly land on the same
 * instance, and queued they each build on the last one's result instead of all
 * racing from the same stale read.
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Apply `change` to the latest board and save it, retrying on a lost race.
 *
 * `change` returning null means "nothing to write", and comes back as null.
 * It may run more than once, so it must be a pure function of the board.
 */
export function updateLeaderboard(
  change: (board: Board) => Board | null,
): Promise<Board | null> {
  const run = queue.then(() => write(change));
  queue = run.catch(() => undefined);
  return run;
}

async function write(
  change: (board: Board) => Board | null,
): Promise<Board | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const { board, etag } = await load();
    const next = change(board);
    if (!next) return null;

    try {
      const saved = await put(PATHNAME, JSON.stringify(next), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        // No ETag means no file yet, and creating one must not silently replace
        // a file someone else created a moment ago.
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
      });
      lastWrite = { board: next, etag: saved.etag };
      superseded.add(etag);
      return next;
    } catch (error) {
      const lostRace =
        error instanceof BlobPreconditionFailedError ||
        (!etag && error instanceof BlobError);
      if (!lostRace) throw error;
      await new Promise((r) =>
        setTimeout(r, BACKOFF_MS * (1 + attempt) * Math.random()),
      );
    }
  }
  throw new Error("leaderboard: too many concurrent writes");
}
