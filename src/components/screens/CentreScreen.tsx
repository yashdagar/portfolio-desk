"use client";

import type { ActivityFeed } from "@/lib/activity";
import type { LeetCodeStats } from "@/lib/leetcode";
import { useLeetCode } from "@/lib/useLeetCode";

import { About } from "./About";
import { LeetCodeProfile } from "./LeetCodeProfile";

/**
 * The centre monitor: the LeetCode profile, with the bio page behind it.
 *
 * The fallback is the reason this is its own component rather than two lines
 * inside the scene graph. LeetCode is an undocumented endpoint on somebody
 * else's infrastructure, and the largest screen on the desk cannot go blank
 * because it had a bad minute. With no stats the screen shows what it used to —
 * name, bio, contacts — which is a complete page in its own right rather than a
 * placeholder with a spinner on it.
 *
 * Shared with the /screens preview page, so whatever gets judged flat is
 * literally the component the room mounts.
 */
export function CentreScreen({
  initial,
  leetcode,
}: {
  initial?: ActivityFeed | null;
  leetcode?: LeetCodeStats | null;
}) {
  const stats = useLeetCode(leetcode ?? null);
  return stats ? (
    <LeetCodeProfile stats={stats} />
  ) : (
    <About initial={initial ?? null} />
  );
}
