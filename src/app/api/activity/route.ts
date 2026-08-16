import { NextResponse } from "next/server";

import { ACTIVITY_URL, type ActivityFeed } from "@/lib/activity";

/**
 * The commit feed, proxied from the file the collector commits, so a collection
 * reaches an open browser without a deploy.
 *
 * Proxied rather than fetched from GitHub directly even though raw.github allows
 * it: server and client read one URL under one cache policy, an outage arrives
 * as a 503 rather than a CORS failure inside a render, and nothing on the page
 * has to know where the data lives.
 */
export async function GET() {
  try {
    const res = await fetch(ACTIVITY_URL, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(String(res.status));

    return NextResponse.json<ActivityFeed>(await res.json(), {
      // The collector runs every twenty minutes, so a visitor is never more than
      // a cycle behind, and an outage serves yesterday's feed rather than none.
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(null, {
      status: 503,
      headers: { "cache-control": "public, max-age=60" },
    });
  }
}
