"use client";

import { useEffect, useRef, useState } from "react";

import type { ActivityFeed, Commit } from "./activity";

/**
 * How often the client asks for the feed again.
 *
 * Two minutes against a URL the route caches for five, so most of these are
 * served out of the browser's own memory cache and never touch the network.
 * That's the point: polling faster than the cache doesn't fetch anything new, it
 * just guarantees we pick up the fresh copy within a couple of minutes of the
 * cache expiring rather than waiting out another whole window.
 */
const POLL_MS = 120_000;

/** Refetch on returning to the tab only if the last one is older than this. */
const STALE_MS = 60_000;

/** How long two callers count as asking for the same thing. */
const SHARE_MS = 5_000;

/**
 * One request, however many components ask for it.
 *
 * Two things make the naive version fire more than once: the flat page mounts
 * this hook twice (the feed and the commit count under the about text), and
 * React's development mode runs every effect twice on top of that. All of them
 * land in the same tick, so all of them miss the HTTP cache and four identical
 * GETs go out. Sharing the promise for a few seconds collapses that to one
 * without any of the callers having to know about each other.
 */
let inFlight: { at: number; promise: Promise<ActivityFeed> } | null = null;

function fetchFeed(): Promise<ActivityFeed> {
  const now = Date.now();
  if (inFlight && now - inFlight.at < SHARE_MS) return inFlight.promise;

  const promise = fetch("/api/activity").then((r) =>
    r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
  );
  inFlight = { at: now, promise };
  // A rejected promise must not be handed to the next caller — and a bare
  // `.catch` here also keeps the shared failure from surfacing as unhandled.
  promise.catch(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  return promise;
}

/**
 * Load the commit feed, and keep loading it.
 *
 * From `/api/activity` rather than from `/data/activity.json`, and the
 * difference is the whole point of the polling below. The static file is baked
 * into the deployment, so a tab left open overnight refetched exactly the bytes
 * it was already given; the route reads the file the collector actually commits
 * every twenty minutes, so leaving the page open now does what it looks like it
 * does.
 *
 * `fresh` carries the ids that arrived after the first render, which is what
 * lets the feed animate a new commit in without animating all hundred and forty
 * on first paint.
 */
export function useActivity(initial: ActivityFeed | null = null) {
  // Seeded from the server so the first paint already has the real commits, not
  // a spinner.
  const [feed, setFeed] = useState<ActivityFeed | null>(initial);
  const [failed, setFailed] = useState(false);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(EMPTY);

  /*
   * Every id we've already shown.
   *
   * Seeded lazily from whatever the first render had, so the commits that were
   * server-rendered count as seen and don't animate. Null means "nothing shown
   * yet" — distinct from an empty set, which would make the first fetch's
   * hundred and forty commits all read as new arrivals.
   */
  const seen = useRef<Set<string> | null>(
    initial ? new Set(initial.commits.map((c) => c.id)) : null,
  );
  const lastFetch = useRef(0);

  useEffect(() => {
    let alive = true;

    const load = () => {
      lastFetch.current = Date.now();
      fetchFeed()
        .then((data: ActivityFeed) => {
          if (!alive) return;
          const before = seen.current;
          seen.current = new Set(data.commits.map((c) => c.id));
          setFeed(data);
          setFailed(false);
          // First feed of the session: everything in it is history, not news.
          if (before) {
            const arrived = data.commits
              .map((c) => c.id)
              .filter((id) => !before.has(id));
            if (arrived.length) setFresh(new Set(arrived));
          }
        })
        .catch(() => {
          // A failed poll is not a failed screen — the commits already on it are
          // still true. Only the very first load is allowed to show the error.
          if (alive && !seen.current) setFailed(true);
        });
    };

    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);

    // A backgrounded tab stops polling, so catch it up when it comes forward.
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastFetch.current > STALE_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { feed, failed, fresh };
}

const EMPTY: ReadonlySet<string> = new Set();

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

/** One printed line of the log. */
export type LogLine =
  /** A dim `# 14 Aug` separator, printed when the date changes. */
  | { type: "day"; key: string; day: string; count: number }
  /** A commit. `repo` is only set when it differs from the line above. */
  | { type: "commit"; key: string; commit: Commit; repo?: string };

/**
 * Flatten the feed into terminal output.
 *
 * The list stays linear — one commit, one line, newest first, exactly what
 * `git log --oneline` prints. What grouping is still doing here is deciding
 * what *not* to print: the repo column repeats only when it changes, the way a
 * column of identical strings would be pruned by hand, and a date comment goes
 * in wherever the day turns over. Both come out of the same runs `groupCommits`
 * already finds, so a burst of fifteen commits on one repo still reads as one
 * block without any of them being hidden inside a fold.
 */
export function toLogLines(commits: Commit[]): LogLine[] {
  const lines: LogLine[] = [];
  let currentDay: string | null = null;
  let currentRepo: string | null = null;

  for (const group of groupCommits(commits)) {
    if (group.day !== currentDay) {
      currentDay = group.day;
      // Deliberately counts the day, not the group: a day split across three
      // repos should say six, not 3 + 2 + 1.
      const count = commits.filter((c) => c.at.startsWith(group.day)).length;
      lines.push({ type: "day", key: `day-${group.day}`, day: group.day, count });
      // A date line breaks the column, so the repo name has to reappear under it
      // even if it hasn't changed.
      currentRepo = null;
    }

    const label = group.visibility === "work" ? "private" : (group.repo ?? "—");
    const changed = label !== currentRepo;
    currentRepo = label;

    group.commits.forEach((commit, i) => {
      lines.push({
        type: "commit",
        key: commit.id,
        commit,
        repo: changed && i === 0 ? label : undefined,
      });
    });
  }

  return lines;
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

/** The same thing without the "ago", for a column that has no room for it. */
export function shortAge(iso: string, now = Date.now()): string {
  const t = relativeTime(iso, now);
  return t === "just now" ? "now" : t.replace(" ago", "");
}
