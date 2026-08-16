/**
 * Shared types and filtering rules for the commit feed.
 *
 * This module is imported by both the build-time collector (scripts/, running
 * inside a GitHub Action) and the client. Keep it free of Node and DOM APIs so
 * both can use it.
 */

/** How much of a commit we're allowed to show. */
export type Visibility =
  /** Public repo. Message shown verbatim. */
  | "public"
  /** Yash's own private repo. He owns it, so the message is shown verbatim. */
  | "personal"
  /** Employer's private repo. Type label only — no message, no repo name. */
  | "work";

export type CommitKind =
  | "feat"
  | "fix"
  | "chore"
  | "refactor"
  | "docs"
  | "test"
  | "style"
  | "perf"
  | "build"
  | "ci"
  | "other";

export interface Commit {
  /** Stable id, so the client can key and diff across refreshes. */
  id: string;
  visibility: Visibility;
  kind: CommitKind;
  /** Absent for `work` — the message never leaves the Action. */
  message?: string;
  /** Absent for `work` — the repo name is sensitive on its own. */
  repo?: string;
  /** Absent for `work`. */
  url?: string;
  language?: string;
  /** ISO 8601, UTC. */
  at: string;
}

export interface ActivityFeed {
  /** When the collector last ran. */
  generatedAt: string;
  commits: Commit[];
  totals: {
    /** Real commits in the last year, after filtering. */
    year: number;
    /** Consecutive days with at least one real commit, ending today. */
    streak: number;
  };
}

/*
 * ---------------------------------------------------------------------------
 * Filtering
 * ---------------------------------------------------------------------------
 *
 * The feed's whole claim is that it shows real work. Automated commits — a
 * commit generator, a LeetCode sync extension — would drown that out and, worse,
 * advertise themselves to the exact audience most likely to look closely. So
 * they're removed at collection time, before anything is published.
 */

/** Repos whose commits never appear, matched on `owner/name` with `*` wildcards. */
export const BLOCKED_REPOS = [
  "*/commiter", // synthetic commit generator: "W8-Commit 87443"
  "*/committed",
  "*/leetcode", // LeetHub sync target
  "*/leethub",
  "*/codeforces", // CFPusher sync target
];

/** Commit messages that are machine-written rather than authored. */
const BOT_MESSAGE_PATTERNS = [
  /\bcommit\s+\d+\s*$/i, // "W8-Commit 87443"
  /-\s*LeetHub\s*$/i, // "Time: 285 ms (71.21%) - LeetHub"
  /^add\s+.+\s+to\s+topics\.?$/i, // LeetHub topic bookkeeping
  /\[CFPusher\]/i, // "Update topic-wise problem index [CFPusher]"
  /\bfrom\s+Codeforces\b/i, // "Add The Bakery [B] from Codeforces"
  /^update\s+readme(\.md)?$/i,
  /^merge\s+(pull\s+request|branch|remote-tracking)/i, // real, but not authored work
  /^\[?bot\]?\b/i,
];

/**
 * A generator that stamps thousands of commits gives them all the same second.
 * Any second holding at least this many commits is treated as synthetic.
 */
const SAME_SECOND_LIMIT = 5;

export function isBlockedRepo(fullName: string): boolean {
  const lower = fullName.toLowerCase();
  return BLOCKED_REPOS.some((pattern) => {
    const rx = new RegExp(
      "^" + pattern.toLowerCase().split("*").map(escapeRegex).join(".*") + "$",
    );
    return rx.test(lower);
  });
}

export function isBotMessage(message: string): boolean {
  const first = message.split("\n", 1)[0].trim();
  if (!first) return true;
  return BOT_MESSAGE_PATTERNS.some((rx) => rx.test(first));
}

/**
 * Drop commits that share a timestamp with many others.
 *
 * Applied after the per-message rules, because a generator whose message format
 * we haven't seen still gives itself away through its timestamps.
 */
export function dropTimestampClusters<T extends { at: string }>(items: T[]): T[] {
  const bySecond = new Map<string, number>();
  for (const item of items) {
    const second = item.at.slice(0, 19);
    bySecond.set(second, (bySecond.get(second) ?? 0) + 1);
  }
  return items.filter(
    (item) => (bySecond.get(item.at.slice(0, 19)) ?? 0) < SAME_SECOND_LIMIT,
  );
}

/*
 * ---------------------------------------------------------------------------
 * Classification
 * ---------------------------------------------------------------------------
 */

const KIND_ALIASES: Record<string, CommitKind> = {
  feat: "feat",
  feature: "feat",
  add: "feat",
  fix: "fix",
  bugfix: "fix",
  hotfix: "fix",
  bug: "fix",
  chore: "chore",
  refactor: "refactor",
  docs: "docs",
  doc: "docs",
  test: "test",
  tests: "test",
  style: "style",
  perf: "perf",
  build: "build",
  ci: "ci",
};

/**
 * Derive a conventional-commit type from a message.
 *
 * For work commits this is the *only* thing that survives, so it must be
 * derivable from the message's shape alone and must never echo its content.
 * Falls back to keyword sniffing when the message isn't conventionally
 * formatted, and to "other" when nothing matches.
 */
export function classify(message: string): CommitKind {
  const first = message.split("\n", 1)[0].trim();

  // Conventional commits: "feat(scope)!: subject"
  const conventional = /^([a-z]+)(\([^)]*\))?!?:/i.exec(first);
  if (conventional) {
    const kind = KIND_ALIASES[conventional[1].toLowerCase()];
    if (kind) return kind;
  }

  // Otherwise sniff the leading verb, which is how most non-conventional
  // messages still signal intent ("Fix the parser", "Add a route").
  const leading = /^([a-z]+)\b/i.exec(first);
  if (leading) {
    const kind = KIND_ALIASES[leading[1].toLowerCase()];
    if (kind) return kind;
  }

  return "other";
}

/**
 * Where the site reads the feed from at runtime: the committed file, served by
 * GitHub, not the copy inside its own deployment.
 *
 * The collector runs in a scheduled Action and commits `activity.json` back to
 * this repo. Reading it out of `public/` meant the live feed was whatever had
 * been baked in at the last deploy — so the data refreshed every twenty minutes
 * in the repo and never once on the site, and the only way to publish a commit
 * was to redeploy the whole app. That coupling is the actual bug: a feed whose
 * whole claim is "this is live" cannot depend on a build step.
 *
 * Fetching the same file from raw.githubusercontent.com breaks it. Nothing is
 * given away by doing so — the file is already public, already committed, and
 * already redacted before it is written — and the token still never comes near
 * the deployment, which was the only reason for the Action in the first place.
 * GitHub serves it with a five-minute cache, which is well inside the twenty
 * minutes between collections.
 */
export const ACTIVITY_URL =
  "https://raw.githubusercontent.com/yashdagar/portfolio-desk/main/public/data/activity.json";

/*
 * ---------------------------------------------------------------------------
 * Shaping
 * ---------------------------------------------------------------------------
 *
 * The collector writes its output to `public/data/activity.json` in a public
 * repo, so anything that lands in a work commit is published permanently and
 * irrevocably. These two constructors are the only sanctioned way to build a
 * Commit, and `assertNoLeak` is checked against every one before writing.
 */

/** Fields that must never appear on a `work` commit. */
const FORBIDDEN_ON_WORK = ["message", "repo", "url", "language"] as const;

export function toOwnCommit(input: {
  visibility: "public" | "personal";
  sha: string;
  message: string;
  repo: string;
  url: string;
  language?: string;
  at: string;
}): Commit {
  return {
    id: input.sha.slice(0, 12),
    visibility: input.visibility,
    kind: classify(input.message),
    message: input.message.split("\n", 1)[0].trim(),
    repo: input.repo,
    url: input.url,
    language: input.language,
    at: input.at,
  };
}

/**
 * Build a work commit.
 *
 * Deliberately takes the message as an argument and deliberately does not keep
 * it: the classification has to be derived from it, but nothing else may
 * survive the call. Note there is no spread of the input anywhere in here —
 * every published field is written out by hand, so a new field appearing
 * upstream cannot silently leak through.
 */
export function toWorkCommit(input: {
  sha: string;
  message: string;
  at: string;
}): Commit {
  return {
    // Hash the sha rather than truncating it: a real sha prefix is enough to
    // confirm a guessed commit against the private repo.
    id: "w" + fnv1a(input.sha).toString(36),
    visibility: "work",
    kind: classify(input.message),
    at: input.at,
  };
}

/**
 * Throw if a commit would publish something it shouldn't.
 *
 * Belt and braces over `toWorkCommit` — this runs on every commit immediately
 * before serialisation, so a future refactor that reintroduces a spread still
 * fails loudly rather than quietly leaking.
 */
export function assertNoLeak(commit: Commit): void {
  if (commit.visibility !== "work") return;
  for (const field of FORBIDDEN_ON_WORK) {
    if (commit[field] !== undefined) {
      throw new Error(
        `work commit ${commit.id} carries a forbidden field: ${field}`,
      );
    }
  }
  if (!/^w[0-9a-z]+$/.test(commit.id)) {
    throw new Error(`work commit id ${commit.id} is not a hashed id`);
  }
}

/** Small non-cryptographic hash — only needs to be non-reversible by eye. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Consecutive days ending today that have at least one commit. */
export function computeStreak(commits: Commit[], today = new Date()): number {
  const days = new Set(commits.map((c) => c.at.slice(0, 10)));
  let streak = 0;
  const cursor = new Date(today);
  // Today not yet having a commit shouldn't zero a streak that's still alive,
  // so start counting from yesterday if today is empty.
  if (!days.has(iso(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(iso(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
