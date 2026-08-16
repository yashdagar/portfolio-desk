import { Flat } from "@/components/Flat";
import { readActivity } from "@/lib/activity.server";
import { fetchLeetCodeStats } from "@/lib/leetcode";
import { SceneMount } from "@/components/scene/SceneMount";

/**
 * `Flat` is rendered on the server and passed in as children, not imported by
 * the client mount. That way the full content is in the HTML source for every
 * visitor — indexable, readable with JavaScript off, and already painted before
 * the capability check decides whether to put a room in front of it.
 */
export default async function Home() {
  // Concurrently: one reads a committed JSON file, the other calls out to
  // LeetCode. Awaited in sequence they'd add the whole round trip to the time
  // to first byte for no reason at all.
  const [activity, leetcode] = await Promise.all([
    readActivity(),
    fetchLeetCodeStats(),
  ]);

  return (
    <main className="min-h-dvh w-full">
      <SceneMount activity={activity}>
        <Flat feed={activity} leetcode={leetcode} />
      </SceneMount>
    </main>
  );
}
