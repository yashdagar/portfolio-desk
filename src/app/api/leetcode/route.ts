import { NextResponse } from "next/server";

import { fetchLeetCodeStats, type LeetCodeStats } from "@/lib/leetcode";

/**
 * LeetCode stats for the centre monitor.
 *
 * Proxied rather than called from the browser, for the same three reasons the
 * weather is: the response gets cached once for everyone instead of once per
 * visitor, LeetCode's endpoint sets no CORS headers so a browser can't call it
 * at all, and an outage lands here as a null rather than as an unhandled fetch
 * inside a render loop.
 *
 * An hour of staleness, because a solve count that moves by one or two a day
 * is not a live figure and pretending otherwise just costs someone else's
 * infrastructure.
 */
export async function GET() {
  const stats = await fetchLeetCodeStats();

  return NextResponse.json<LeetCodeStats | null>(stats, {
    headers: {
      "cache-control": stats
        ? "public, max-age=1800, stale-while-revalidate=86400"
        : "public, max-age=120",
    },
  });
}
