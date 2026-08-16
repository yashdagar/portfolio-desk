"use client";

import { useEffect, useState } from "react";

import type { ActivityFeed, Commit } from "./activity";

/**
 * Load the commit feed.
 *
 * From `/api/activity` rather than from `/data/activity.json`, and the
 * difference is the whole point of the refetch below. The static file is baked
 * into the deployment, so a tab left open overnight refetched exactly the bytes
 * it was already given; the route reads the file the collector actually commits
 * every twenty minutes, so leaving the page open now does what it looks like it
 * does.
 */
export function useActivity(initial: ActivityFeed | null = null) {
  // Seeded from the server so the first paint already has the real commits, not
  // a spinner. The refetch below still runs, so a tab left open overnight picks
  // up whatever the scheduled job wrote in the meantime.
  const [feed, setFeed] = useState<ActivityFeed | null>(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/activity")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: ActivityFeed) => alive && setFeed(data))
      .catch(() => alive && !initial && setFailed(true));
    return () => {
      alive = false;
    };
  }, [initial]);

  return { feed, failed };
}

export interface CommitGroup {
  /** YYYY-MM-DD. */
  day: string;
  /** Repo name, or undefined for a run of work commits. */
  repo?: string;
  visibility: Commit["visibility"];
  commits: Commit[];
}

/**
 * Collapse consecutive commits from the same repo on the same day.
 *
 * Without this the feed opens with fifteen visually identical rows — one
 * afternoon of work on one repo — which reads as noise rather than as intensity.
 * Grouping keeps the chronology honest while letting a burst look like a burst.
 */
export function groupCommits(commits: Commit[]): CommitGroup[] {
  const groups: CommitGroup[] = [];

  for (const commit of commits) {
    const day = commit.at.slice(0, 10);
    const last = groups.at(-1);

    const continues =
      last &&
      last.day === day &&
      last.visibility === commit.visibility &&
      last.repo === commit.repo;

    if (continues) {
      last.commits.push(commit);
    } else {
      groups.push({
        day,
        repo: commit.repo,
        visibility: commit.visibility,
        commits: [commit],
      });
    }
  }

  return groups;
}

/** "3 days ago", "just now" — short enough for a monitor bezel. */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (seconds < 90) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d ago`;
  const months = days / 30.44;
  if (months < 12) return `${Math.round(months)}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
