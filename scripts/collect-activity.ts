/**
 * Collect the commit feed and write `public/data/activity.json`.
 *
 * Runs inside a GitHub Action, never at request time. That's the whole point:
 * reading private repos needs a token, and this project's deployment is public,
 * so the token stays in the Action and only redacted output is published.
 *
 * Environment:
 *   GITHUB_TOKEN       personal token (yashdagar) — reads own public + private repos
 *   WORK_GITHUB_TOKEN  optional work token (yashdagar-CN) — counts only
 *   WORK_LOGIN         work account login, default yashdagar-CN
 *   WORK_ORG           work org, default CodingNinjasHQ
 *
 * Without WORK_GITHUB_TOKEN the work tier is simply skipped, so the Action still
 * succeeds and the site still builds.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assertNoLeak,
  computeStreak,
  dropTimestampClusters,
  isBlockedRepo,
  isBotMessage,
  toOwnCommit,
  toWorkCommit,
  toWorkDays,
  type ActivityFeed,
  type Commit,
} from "../src/lib/activity";

/**
 * Logins that count as "Yash" inside his own repos: personal projects committed
 * from the work machine are authored as `yashdagar-cn`.
 *
 * This widens authorship only *within repos he owns*. It has no bearing on the
 * work tier, whose visibility is decided by the repo's owner, not the author.
 */
const OWN_LOGINS = new Set(
  (process.env.OWN_LOGINS ?? "yashdagar,yashdagar-cn")
    .split(",")
    .map((s) => s.trim().toLowerCase()),
);
const WORK_LOGIN = process.env.WORK_LOGIN ?? "yashdagar-CN";
const WORK_ORG = process.env.WORK_ORG ?? "CodingNinjasHQ";
const OUT = path.join(process.cwd(), "public", "data", "activity.json");

/** How far back to look. */
const WINDOW_DAYS = 365;
/** How many commits to publish for display. Totals are computed from all of them. */
const FEED_LIMIT = 200;

const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();

async function gh<T>(url: string, token: string): Promise<T> {
  const res = await fetch(
    url.startsWith("http") ? url : `https://api.github.com${url}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "portfolio-desk-collector",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return res.json() as Promise<T>;
}

/** Follow `Link: rel="next"` until exhausted. */
async function ghAll<T>(url: string, token: string, cap = 5): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url.startsWith("http")
    ? url
    : `https://api.github.com${url}`;
  for (let page = 0; next && page < cap; page++) {
    const res: Response = await fetch(next, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "portfolio-desk-collector",
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${next}`);
    out.push(...((await res.json()) as T[]));
    const link = res.headers.get("link") ?? "";
    next = /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] ?? null;
  }
  return out;
}

interface Repo {
  full_name: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
  language: string | null;
}

interface RepoCommit {
  sha: string;
  html_url: string;
  /** Null when the commit's email isn't linked to any GitHub account. */
  author: { login: string } | null;
  commit: { message: string; author: { date: string; email: string } | null };
}

/**
 * Own repos, public and private alike, full messages. Per-repo listing rather
 * than the search API, which barely indexes private repos.
 */
async function collectOwn(token: string): Promise<Commit[]> {
  const repos = await ghAll<Repo>(
    "/user/repos?affiliation=owner&sort=pushed&per_page=100",
    token,
  );

  const live = repos.filter(
    (r) =>
      !r.fork &&
      !r.archived &&
      !isBlockedRepo(r.full_name) &&
      r.pushed_at &&
      r.pushed_at >= since,
  );

  console.log(
    `own: ${live.length} active repos (from ${repos.length}), skipping ${
      repos.filter((r) => isBlockedRepo(r.full_name)).length
    } blocked`,
  );

  const out: Commit[] = [];
  for (const repo of live) {
    let commits: RepoCommit[] = [];
    try {
      // Fetched without an `author` filter and narrowed below: the API's filter
      // takes a single login, and his commits arrive under two identities.
      commits = await ghAll<RepoCommit>(
        `/repos/${repo.full_name}/commits?since=${since}&per_page=100`,
        token,
        3,
      );
    } catch (err) {
      // An empty repo 409s. Not worth failing the whole run over.
      console.warn(`  ! ${repo.full_name}: ${(err as Error).message}`);
      continue;
    }

    const mine = commits.filter((c) =>
      c.author ? OWN_LOGINS.has(c.author.login.toLowerCase()) : false,
    );

    for (const c of mine) {
      const message = c.commit.message ?? "";
      if (isBotMessage(message)) continue;
      out.push(
        toOwnCommit({
          visibility: repo.private ? "personal" : "public",
          sha: c.sha,
          message,
          repo: repo.full_name,
          url: c.html_url,
          language: repo.language ?? undefined,
          at: c.commit.author?.date ?? new Date().toISOString(),
        }),
      );
    }
    if (mine.length) {
      console.log(`  ${repo.full_name}: ${mine.length}/${commits.length}`);
    }
  }
  return out;
}

/**
 * Work repos: counts and type labels only. Every commit goes through
 * `toWorkCommit`, which reconstructs a fresh object rather than spreading the
 * source, so the message and repo name are dropped here.
 */
async function collectWork(token: string): Promise<Commit[]> {
  const repos = await ghAll<Repo>(
    `/orgs/${WORK_ORG}/repos?sort=pushed&per_page=100`,
    token,
  ).catch((err) => {
    console.warn(`work: cannot list ${WORK_ORG} repos — ${(err as Error).message}`);
    return [] as Repo[];
  });

  const live = repos.filter(
    (r) => !r.archived && r.pushed_at && r.pushed_at >= since,
  );
  console.log(`work: ${live.length} active repos in ${WORK_ORG}`);

  const out: Commit[] = [];
  for (const repo of live) {
    let commits: RepoCommit[] = [];
    try {
      commits = await ghAll<RepoCommit>(
        `/repos/${repo.full_name}/commits?author=${WORK_LOGIN}&since=${since}&per_page=100`,
        token,
        3,
      );
    } catch {
      continue;
    }
    for (const c of commits) {
      const message = c.commit.message ?? "";
      if (isBotMessage(message)) continue;
      out.push(
        toWorkCommit({
          sha: c.sha,
          message,
          at: c.commit.author?.date ?? new Date().toISOString(),
        }),
      );
    }
  }
  // Deliberately not logged per repo: the repo names are the sensitive part.
  console.log(`work: ${out.length} commits, redacted to type labels`);
  return out;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");

  const own = await collectOwn(token);

  const workToken = process.env.WORK_GITHUB_TOKEN;
  const work = workToken ? await collectWork(workToken) : [];
  if (!workToken) console.log("work: no WORK_GITHUB_TOKEN, tier skipped");

  const all = dropTimestampClusters([...own, ...work]).sort((a, b) =>
    b.at.localeCompare(a.at),
  );

  // The guard runs over everything, not just the work tier, so a future change
  // that mislabels an own-repo commit as `work` still gets caught. It runs
  // before the split, while the work records still exist to be checked.
  for (const c of all) assertNoLeak(c);

  /*
   * Work commits are counted, then discarded. They are never published one by
   * one, even redacted: a per-commit record carries a timestamp, and enough
   * timestamps is a record of when somebody is at their desk. A count per day
   * is everything the contribution grid reads and nothing more.
   */
  const workCommits = all.filter((c) => c.visibility === "work");
  const published = all.filter((c) => c.visibility !== "work");
  const workDays = toWorkDays(workCommits);

  const feed: ActivityFeed = {
    generatedAt: new Date().toISOString(),
    commits: published.slice(0, FEED_LIMIT),
    totals: {
      // The year total counts work; only the per-commit detail is dropped.
      year: all.length,
      streak: computeStreak(published, new Date(), workDays),
    },
    // Omitted entirely rather than written empty, so a feed collected without
    // the work token is byte-identical to one from before the tier existed.
    ...(workCommits.length ? { workDays } : {}),
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(feed, null, 2) + "\n");

  const byTier = (v: string) => all.filter((c) => c.visibility === v).length;
  console.log(
    `\nwrote ${OUT}\n` +
      `  ${all.length} commits — ${byTier("public")} public, ` +
      `${byTier("personal")} personal, ${byTier("work")} work\n` +
      `  work published as ${Object.keys(workDays).length} day counts, ` +
      `no per-commit records\n` +
      `  streak ${feed.totals.streak}d, publishing ${feed.commits.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
