"use client";

import { useEffect, useState } from "react";

import type { LeetCodeStats } from "./leetcode";

/**
 * Read the LeetCode stats, starting from whatever the server already rendered.
 *
 * The `initial` is the important half. The centre monitor is also the flat page
 * and the no-WebGL fallback, so these numbers have to be in the HTML source
 * rather than appearing a moment after hydration — a recruiter reading with
 * JavaScript off should see the solve count like everyone else.
 *
 * Fetched again on the client only when the server didn't manage it, which is
 * the case where LeetCode was down or slow during the render. Once it's here it
 * doesn't move: a solve count is not something anyone needs to watch tick over
 * while they read a bio.
 */
export function useLeetCode(initial: LeetCodeStats | null = null) {
  const [stats, setStats] = useState<LeetCodeStats | null>(initial);

  useEffect(() => {
    if (initial) return;

    let alive = true;
    fetch("/api/leetcode")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (alive) setStats(json);
      })
      .catch(() => {
        // Nothing to do. The screen is complete without it.
      });

    return () => {
      alive = false;
    };
  }, [initial]);

  return stats;
}
