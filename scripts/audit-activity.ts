/**
 * Audit `public/data/activity.json` before it is committed — the independent
 * second opinion on the collector's own guards. It exists because once a leak is
 * pushed to a public repo it is in the history permanently, and rotating a token
 * does not undo it.
 *
 * The strongest check is only possible inside the Action: it fetches the real
 * names of the private work repos and asserts none appear in the output, which
 * catches a leak by its content rather than by a guessed pattern.
 *
 * Exits non-zero on any finding, failing the workflow before the commit step.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertNoLeak, isBlockedRepo, type ActivityFeed } from "../src/lib/activity";

const FILE = path.join(process.cwd(), "public", "data", "activity.json");
const WORK_ORG = process.env.WORK_ORG ?? "CodingNinjasHQ";

/** Things that should never appear in a published feed, whatever the source. */
const FORBIDDEN_PATTERNS: [RegExp, string][] = [
  [/\bghp_[A-Za-z0-9]{20,}/, "GitHub personal access token"],
  [/\bgho_[A-Za-z0-9]{20,}/, "GitHub OAuth token"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, "GitHub fine-grained token"],
  [/\bsk-[A-Za-z0-9]{20,}/, "OpenAI-style secret key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, "JWT"],
  [/[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "email address"],
];

async function main() {
const findings: string[] = [];
const fail = (msg: string) => findings.push(msg);

const raw = await readFile(FILE, "utf8");
const feed = JSON.parse(raw) as ActivityFeed;

/* ---- 1. Per-commit invariants ------------------------------------------- */

for (const commit of feed.commits) {
  try {
    assertNoLeak(commit);
  } catch (err) {
    fail((err as Error).message);
  }
  if (commit.repo && isBlockedRepo(commit.repo)) {
    fail(`blocked repo present in feed: ${commit.repo}`);
  }
}

/* ---- 2. Nothing secret-shaped anywhere in the file ----------------------- */

for (const [pattern, label] of FORBIDDEN_PATTERNS) {
  const hit = pattern.exec(raw);
  if (hit) fail(`${label} found in output: ${hit[0].slice(0, 24)}…`);
}

/* ---- 3. No work repo name appears, checked against the real list --------- */

const workToken = process.env.WORK_GITHUB_TOKEN;
if (workToken) {
  const res = await fetch(
    `https://api.github.com/orgs/${WORK_ORG}/repos?per_page=100`,
    {
      headers: {
        authorization: `Bearer ${workToken}`,
        accept: "application/vnd.github+json",
        "user-agent": "portfolio-desk-audit",
      },
    },
  );

  if (res.ok) {
    const repos = (await res.json()) as { name: string; full_name: string }[];
    const haystack = raw.toLowerCase();
    let checked = 0;
    for (const repo of repos) {
      // Very short names would false-positive against ordinary words.
      if (repo.name.length < 4) continue;
      checked++;
      if (haystack.includes(repo.name.toLowerCase())) {
        fail(`work repo name leaked: ${repo.name}`);
      }
    }
    if (haystack.includes(WORK_ORG.toLowerCase())) {
      fail(`work org name leaked: ${WORK_ORG}`);
    }
    console.log(`checked ${checked} work repo names against the output`);
  } else {
    // Not fatal — the org listing can fail for permission reasons that have
    // nothing to do with whether the output is clean.
    console.warn(`could not list ${WORK_ORG} repos to cross-check (${res.status})`);
  }
} else {
  console.log("no WORK_GITHUB_TOKEN — skipping the work-repo cross-check");
}

/* ---- 4. Sanity ----------------------------------------------------------- */

if (!feed.commits.length) fail("feed is empty");
if (!feed.generatedAt) fail("feed has no generatedAt");

const workCount = feed.commits.filter((c) => c.visibility === "work").length;
console.log(
  `audited ${feed.commits.length} commits (${workCount} work-tier), ` +
    `${(raw.length / 1024).toFixed(0)}kb`,
);

if (findings.length) {
  console.error(`\n${findings.length} finding(s):`);
  for (const f of findings) console.error("  ✗ " + f);
  process.exit(1);
}

console.log("clean");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
