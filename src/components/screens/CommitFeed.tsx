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
 *
 * This is the one screen where the rounding pass had to be careful. Turning
 * every row into a card would waste half the panel, and density is the point
 * here — a hundred and twenty lines is the argument. So the softening happens
 * at the edges instead: the header stats become badges, the repo names become
 * chips, and the rows only take a shape when you're pointing at one.
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

/** A filled capsule. The unit of the whole design. */
function Badge({
  children,
  tone = "dim",
}: {
  children: React.ReactNode;
  tone?: "dim" | "accent";
}) {
  return (
    <span
      className={`rounded-full bg-screen-raised px-2.5 py-[3px] font-mono text-[12px] tabular-nums ${
        tone === "accent" ? "text-accent" : "text-ink-dim"
      }`}
    >
      {children}
    </span>
  );
}

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
      className={`w-[54px] shrink-0 rounded-chip bg-screen-raised px-1.5 py-[1px] text-center font-mono text-[12px] ${KIND_COLOR[kind]}`}
    >
      {kind}
    </span>
  );
}

function WorkRow({ commit }: { commit: Commit }) {
  return (
    <li className="flex items-center gap-3 rounded-row px-2 py-[4px]">
      <KindTag kind={commit.kind} />
      {/*
        A capsule rather than the real message. Fixed width and identical for
        every commit — a length-proportional redaction would leak how long the
        subject was.

        Fully rounded on purpose: a sharp-cornered bar reads as a loading
        skeleton, which tells exactly the wrong story. A capsule reads as
        something deliberately withheld.
      */}
      <span
        aria-label="redacted"
        className="h-[10px] flex-1 rounded-full bg-redact"
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
          className="flex items-baseline gap-3 rounded-row px-2 py-[4px] transition-colors duration-150 hover:bg-screen-hi focus-visible:bg-screen-hi focus-visible:outline-none"
        >
          {body}
        </a>
      ) : (
        <div className="flex items-baseline gap-3 px-2 py-[4px]">{body}</div>
      )}
    </li>
  );
}

/**
 * A repo heading.
 *
 * The chip replaces what used to be a chip-less label sitting on a hairline
 * rule. Both were separating the same two things, and the rule was the weaker
 * of the two — a filled shape reads as a section marker from across the room,
 * where a one-pixel line disappears at anything past arm's length.
 */
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
    <div className="mt-4 flex items-center gap-2 px-2 pb-1.5 first:mt-0">
      <span className="rounded-chip bg-accent/12 px-2 py-[2px] font-mono text-[13px] text-accent">
        {label}
      </span>
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
        <p className="rounded-card bg-screen-raised p-4 text-ink-dim">
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
      <header className="mb-3 flex flex-wrap items-center gap-2 px-2">
        <h2 className="mr-1 font-mono text-[15px] text-ink">commits</h2>
        <Badge>{feed.totals.year} this year</Badge>
        {feed.totals.streak > 0 && (
          <Badge tone="accent">{feed.totals.streak}d streak</Badge>
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
            <ul>
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
        <footer className="mt-3 rounded-card bg-screen-raised px-4 py-2.5 font-mono text-[12px] leading-relaxed text-ink-faint">
          {workCount} commits to private work repos are shown as type labels
          only. The messages never leave the job that collects them.
        </footer>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    /*
      A very slight lift toward the top of the panel. A 16:9 field of perfectly
      even near-black is the one thing a real monitor never shows, and the
      gradient costs nothing.
    */
    <div className="flex h-full w-full flex-col overflow-hidden bg-screen bg-[radial-gradient(120%_80%_at_50%_0%,#151a1e_0%,transparent_70%)] px-4 py-4 font-sans text-[14px] leading-relaxed text-ink-dim">
      {children}
    </div>
  );
}
