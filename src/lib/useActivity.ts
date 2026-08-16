"use client";

import { useEffect, useRef, useState } from "react";

import type { ActivityFeed, Commit } from "./activity";

/** Two minutes against a five-minute route cache, so most polls never touch the
 *  network and the fresh copy is picked up soon after the cache expires. */
const POLL_MS = 120_000;

/** Refetch on returning to the tab only if the last one is older than this. */
const STALE_MS = 60_000;

/** How long two callers count as asking for the same thing. */
const SHARE_MS = 5_000;

/**
 * One request, however many components ask. The flat page mounts this hook twice
 * and React dev mode doubles every effect, so four identical GETs go out in the
 * same tick and all of them miss the HTTP cache.
 */
let inFlight: { at: number; promise: Promise<ActivityFeed> } | null = null;

function fetchFeed(): Promise<ActivityFeed> {
  const now = Date.now();
  if (inFlight && now - inFlight.at < SHARE_MS) return inFlight.promise;

  const promise = fetch("/api/activity").then((r) =>
    r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
  );
  inFlight = { at: now, promise };
  // A rejected promise must not be handed to the next caller, and the bare
  // catch also stops the shared failure surfacing as unhandled.
  promise.catch(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  return promise;
}

/**
 * From `/api/activity`, not `/data/activity.json`: the static file is baked into
 * the deployment, so polling it refetches exactly the bytes already given.
 *
 * `fresh` carries ids that arrived after the first render, so a new commit can
 * animate in without animating all hundred and forty on first paint.
 */
export function useActivity(initial: ActivityFeed | null = null) {
  const [feed, setFeed] = useState<ActivityFeed | null>(initial);
  const [failed, setFailed] = useState(false);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(EMPTY);

  // Null means "nothing shown yet", distinct from an empty set — which would
  // make the first fetch's hundred and forty commits all read as new.
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
          if (before) {
            const arrived = data.commits
              .map((c) => c.id)
              .filter((id) => !before.has(id));
            if (arrived.length) setFresh(new Set(arrived));
          }
        })
        .catch(() => {
          // A failed poll is not a failed screen: only the first load errors.
          if (alive && !seen.current) setFailed(true);
        });
    };

    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);

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

/** Collapse consecutive commits from the same repo on the same day. */
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
 * Flatten the feed into terminal output: one commit, one line, newest first.
 * Grouping only decides what *not* to print — the repo column repeats when it
 * changes, and a date comment goes in wherever the day turns over.
 */
export function toLogLines(commits: Commit[]): LogLine[] {
  const lines: LogLine[] = [];
  let currentDay: string | null = null;
  let currentRepo: string | null = null;

  for (const group of groupCommits(commits)) {
    if (group.day !== currentDay) {
      currentDay = group.day;
      // The day, not the group: three repos in a day should say six, not 3+2+1.
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
