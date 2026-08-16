"use client";

import type { ActivityFeed, Commit, CommitKind } from "@/lib/activity";
import { groupCommits, relativeTime, useActivity } from "@/lib/useActivity";

/**
 * The commit feed.
 *
 * Three tiers render differently on purpose. Public and personal commits show
 * their message; work commits show a type label and nothing else, because the
 * message never left the Action that collected it. The contrast between a run
 * of readable lines and a run of bare labels is the most honest way to say
 * "there is more here than I can show you".
 */

const KIND_COLOR: Record<CommitKind, string> = {
  feat: "text-add",
  fix: "text-del",
  perf: "text-accent",
  refactor: "text-accent",
  test: "text-ink-dim",
  docs: "text-ink-dim",
  chore: "text-ink-faint",
  style: "text-ink-faint",
  build: "text-ink-faint",
  ci: "text-ink-faint",
  other: "text-ink-faint",
};

/**
 * Only rendered for work commits.
 *
 * The kind is sniffed from the message, so where the message is visible the tag
 * restates it — and since most of Yash's messages are prose rather than
 * conventional commits, ~80% would read "other" and indent every line behind an
 * empty column. On a work commit it's the entire content, so it stays.
 */
function KindTag({ kind }: { kind: CommitKind }) {
  return (
    <span
      className={`w-[52px] shrink-0 font-mono text-[13px] tabular-nums ${KIND_COLOR[kind]}`}
    >
      {kind}
    </span>
  );
}

function WorkRow({ commit }: { commit: Commit }) {
  return (
    <li className="flex items-baseline gap-3 py-[3px] pl-3">
      <KindTag kind={commit.kind} />
      {/*
        A run of blocks rather than the real message. Fixed-width and identical
        for every commit — a length-proportional redaction would leak how long
        the subject was.
      */}
      <span
        aria-label="redacted"
        className="h-[9px] flex-1 rounded-[1px] bg-redact"
      />
      <span className="shrink-0 font-mono text-[12px] text-ink-faint tabular-nums">
        {relativeTime(commit.at)}
      </span>
    </li>
  );
}

function OwnRow({ commit }: { commit: Commit }) {
  const body = (
    <>
      <span className="flex-1 truncate text-ink">{commit.message}</span>
      <span className="shrink-0 font-mono text-[12px] text-ink-faint tabular-nums">
        {relativeTime(commit.at)}
      </span>
    </>
  );

  return (
    <li>
      {commit.url ? (
        <a
          href={commit.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-baseline gap-3 rounded-sm py-[3px] pl-3 transition-colors hover:bg-screen-raised focus-visible:bg-screen-raised focus-visible:outline-none"
        >
          {body}
        </a>
      ) : (
        <div className="flex items-baseline gap-3 py-[3px] pl-3">{body}</div>
      )}
    </li>
  );
}

function GroupHeading({
  day,
  repo,
  visibility,
  count,
}: {
  day: string;
  repo?: string;
  visibility: Commit["visibility"];
  count: number;
}) {
  const label =
    visibility === "work"
      ? "private · work"
      : (repo?.replace(/^yashdagar\//, "") ?? "—");

  return (
    <div className="mt-4 flex items-baseline gap-2 border-b border-screen-line pb-1 first:mt-0">
      <span className="font-mono text-[13px] text-accent">{label}</span>
      {visibility === "personal" && (
        <span className="font-mono text-[11px] text-ink-faint">private</span>
      )}
      <span className="ml-auto font-mono text-[12px] text-ink-faint tabular-nums">
        {count > 1 ? `${count} commits · ` : ""}
        {new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })}
      </span>
    </div>
  );
}

export function CommitFeed({ initial }: { initial?: ActivityFeed | null }) {
  const { feed, failed } = useActivity(initial ?? null);

  if (failed) {
    return (
      <Shell>
        <p className="text-ink-dim">
          Couldn&apos;t reach the feed. It refreshes from a scheduled job — try
          again shortly.
        </p>
      </Shell>
    );
  }

  if (!feed) {
    return (
      <Shell>
        <p className="animate-pulse font-mono text-ink-faint">reading…</p>
      </Shell>
    );
  }

  const groups = groupCommits(feed.commits);
  const workCount = feed.commits.filter((c) => c.visibility === "work").length;

  return (
    <Shell>
      <header className="mb-4 flex items-baseline gap-4 border-b border-screen-line pb-3">
        <h2 className="font-mono text-[15px] text-ink">commits</h2>
        <span className="font-mono text-[13px] text-ink-dim tabular-nums">
          {feed.totals.year} this year
        </span>
        {feed.totals.streak > 0 && (
          <span className="font-mono text-[13px] text-accent tabular-nums">
            {feed.totals.streak}d streak
          </span>
        )}
        <span className="ml-auto font-mono text-[12px] text-ink-faint">
          updated {relativeTime(feed.generatedAt)}
        </span>
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.map((group, i) => (
          <li key={`${group.day}-${group.repo ?? "work"}-${i}`}>
            <GroupHeading
              day={group.day}
              repo={group.repo}
              visibility={group.visibility}
              count={group.commits.length}
            />
            <ul className="mt-1">
              {group.commits.map((commit) =>
                commit.visibility === "work" ? (
                  <WorkRow key={commit.id} commit={commit} />
                ) : (
                  <OwnRow key={commit.id} commit={commit} />
                ),
              )}
            </ul>
          </li>
        ))}
      </ol>

      {workCount > 0 && (
        <footer className="mt-3 border-t border-screen-line pt-2 font-mono text-[12px] text-ink-faint">
          {workCount} commits to private work repos are shown as type labels
          only. The messages never leave the job that collects them.
        </footer>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col bg-screen px-5 py-4 font-sans text-[14px] leading-relaxed text-ink-dim">
      {children}
    </div>
  );
}
