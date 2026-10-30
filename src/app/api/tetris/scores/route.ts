import { randomBytes, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  cleanName,
  EMPTY_BOARD,
  publicBoard,
  record,
  rename,
  validResult,
  type PublicBoard,
} from "@/lib/leaderboard";
import {
  leaderboardConfigured,
  readLeaderboard,
  updateLeaderboard,
} from "@/lib/leaderboard.server";

/**
 * The shared Tetris leaderboard.
 *
 *   GET    the top of the table
 *   POST   { score, lines }      a game just ended; returns { id, key }
 *   PATCH  { id, key, name }     put a name to it, once
 *
 * Recording and naming are separate on purpose. The game is saved the instant
 * it ends, so walking away from the name prompt still leaves the score on the
 * board; the key that comes back is what proves the person naming it is the
 * person who played it.
 *
 * Nothing here can stop someone posting a score they didn't earn — the game
 * runs in their browser. `validResult` only refuses the impossible ones.
 */

/** Short, and shared through the CDN: one read per few seconds whatever the
 *  traffic, and the player's own write comes back in its response anyway. */
const LIST_CACHE = "public, max-age=0, s-maxage=10, stale-while-revalidate=30";

export async function GET() {
  if (!leaderboardConfigured()) {
    return NextResponse.json<PublicBoard>(publicBoard(EMPTY_BOARD), {
      headers: { "cache-control": "public, max-age=60" },
    });
  }
  try {
    return NextResponse.json<PublicBoard>(publicBoard(await readLeaderboard()), {
      headers: { "cache-control": LIST_CACHE },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const json: unknown = await req.json();
    return json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!leaderboardConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const input = await body(req);
  if (!input || !validResult(input.score, input.lines)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const entry = {
    id: randomUUID(),
    key: randomBytes(16).toString("hex"),
    name: "",
    score: input.score as number,
    lines: input.lines as number,
    at: new Date().toISOString(),
  };

  try {
    const board = await updateLeaderboard((b) => record(b, entry));
    return NextResponse.json({
      id: entry.id,
      key: entry.key,
      board: publicBoard(board!),
    });
  } catch (error) {
    console.error("tetris: record failed", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  if (!leaderboardConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const input = await body(req);
  const name = cleanName(input?.name);
  if (
    !input ||
    !name ||
    typeof input.id !== "string" ||
    typeof input.key !== "string"
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const board = await updateLeaderboard((b) =>
      rename(b, input.id as string, input.key as string, name),
    );
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ board: publicBoard(board) });
  } catch (error) {
    console.error("tetris: rename failed", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
