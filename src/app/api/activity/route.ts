import { NextResponse } from "next/server";

import { ACTIVITY_URL, type ActivityFeed } from "@/lib/activity";

/**
 * The commit feed, proxied from the file the collector commits.
 *
 * The client used to fetch `/data/activity.json` — the copy inside the
 * deployment — which meant a tab left open overnight refetched the same frozen
 * bytes it was served at build time. This reads the same file GitHub is
 * serving, so a collection reaches an open browser without a deploy.
 *
 * Proxied rather than fetched from GitHub directly, even though raw.github
 * sends `access-control-allow-origin: *` and the browser could do it itself.
 * Three reasons, in order of how much they matter: the server and the client
 * end up reading one URL under one cache policy instead of drifting apart, an
 * outage arrives here as a 503 with a cache header rather than as a CORS
 * failure inside a render, and nothing on the page has to know where the data
 * physically lives.
 */
export async function GET() {
  try {
    const res = await fetch(ACTIVITY_URL, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(String(res.status));

    return NextResponse.json<ActivityFeed>(await res.json(), {
      // Five minutes at the edge and a day of stale-while-revalidate: the
      // collector runs every twenty, so a visitor is never more than one cycle
      // behind, and a GitHub outage serves yesterday's feed rather than none.
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
