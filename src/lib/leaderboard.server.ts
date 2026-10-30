import {
  BlobError,
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  head,
  put,
} from "@vercel/blob";

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
 * re-read and collide again in lockstep.
 */
const ATTEMPTS = 16;
const BACKOFF_MS = 120;
const BACKOFF_CAP_MS = 1_200;

export function leaderboardConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * The current version comes from `head`, which asks the Blob API, and the
 * content is then fetched under a URL keyed on that version.
 *
 * Fetching the file by its plain URL is not enough, even with the SDK's
 * `useCache: false`: the CDN kept serving a version that had long since been
 * replaced, every write built on it was refused, and the board stopped
 * accepting games altogether. Keyed on the ETag, a cached copy can only ever
 * be the version it claims to be.
 */
async function load(): Promise<{ board: Board; etag: string | null }> {
  let meta;
  try {
    meta = await head(PATHNAME);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { board: EMPTY_BOARD, etag: null };
    throw error;
  }

  const url = new URL(meta.url);
  url.searchParams.set("v", meta.etag);
  const res = await get(url.toString(), { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { board: EMPTY_BOARD, etag: meta.etag };

  try {
    const text = await new Response(res.stream).text();
    return { board: readBoard(JSON.parse(text)), etag: meta.etag };
  } catch {
    return { board: EMPTY_BOARD, etag: meta.etag };
  }
}

export async function readLeaderboard(): Promise<Board> {
  return (await load()).board;
}

/**
 * One write at a time per instance. Concurrent requests mostly land on the same
 * instance, and queued they each build on the last one's result instead of all
 * racing from the same read.
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
      await new Promise((r) =>
        setTimeout(
          r,
          Math.min(BACKOFF_CAP_MS, BACKOFF_MS * (1 + attempt)) * Math.random(),
        ),
      );
    }
  }
  throw new Error("leaderboard: too many concurrent writes");
}
