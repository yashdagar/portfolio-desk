import { readFile } from "node:fs/promises";
import path from "node:path";

import { ACTIVITY_URL, type ActivityFeed } from "./activity";

/**
 * Read the feed on the server so its text is in the HTML source — client-only
 * leaves the commit list as "reading…" for crawlers and preview cards.
 *
 * From GitHub rather than the local `public/` copy, which is frozen at whatever
 * was committed when the deployment was built. The local file stays as the
 * fallback: it covers the network being unreachable at build time, and it's what
 * a fresh clone renders before it has a deployment at all.
 *
 * Server-only — this imports node:fs, so a client component importing it fails
 * the build rather than shipping a broken bundle.
 */
export async function readActivity(): Promise<ActivityFeed | null> {
  try {
    // Matching GitHub's own CDN. The collector only runs every twenty minutes.
    const res = await fetch(ACTIVITY_URL, { next: { revalidate: 300 } });
    if (res.ok) return (await res.json()) as ActivityFeed;
  } catch {
    // Fall through to the committed copy.
  }

  try {
    const file = path.join(process.cwd(), "public", "data", "activity.json");
    return JSON.parse(await readFile(file, "utf8")) as ActivityFeed;
  } catch {
    // A fresh clone has no collected file yet. The client fetch still runs.
    return null;
  }
}
