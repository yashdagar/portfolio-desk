"use client";

import type { ActivityFeed, Commit, CommitKind } from "@/lib/activity";
import {
  relativeTime,
  shortAge,
  toLogLines,
  useActivity,
  type LogLine,
} from "@/lib/useActivity";

/**
 * The commit feed, as a terminal running `git log --oneline`.
 *
 * Linear, and deliberately not `--graph`: the collector reads GitHub's events
 * API, which gives no parent shas, so any branch topology drawn here would be
 * invented.
 *
 * Public and personal commits show their message; work commits show a type
 * label and a blackout, because the message never left the Action.
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

const CWD = "~/dev";
const COMMAND = "git log --oneline --since=1.year";

/*
 * Fixed rather than derived: rows need their own background to highlight on
 * hover, which rules out `display: contents` and so rules out one shared grid.
 */
const SHA = "w-[66px]";
const REPO = "w-[152px]";
const AGE = "w-[46px]";

/*
 * Below 720px the columns leave the message 24 characters, so the row reflows
 * and the message wraps in full underneath. A narrow terminal wraps rather than
 * truncating anyway.
 */
const BODY =
  "min-w-0 flex-1 @max-[720px]:order-last @max-[720px]:w-full @max-[720px]:flex-none";

/** A filled capsule. Used for the two totals in the title bar. */
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
 * Work commits only: elsewhere the kind is sniffed from a message that is
 * already visible, and most would read "other".
 *
 * Fixed width, or the blackout starts in a different place on every row — which
 * reads as damage rather than as policy.
 */
function KindTag({ kind }: { kind: CommitKind }) {
  return (
    <span
      className={`w-[76px] shrink-0 rounded-chip bg-screen-raised px-1.5 py-[1px] text-center font-mono text-[12px] ${KIND_COLOR[kind]}`}
    >
      {kind}
    </span>
  );
}

function Row({
  commit,
  repo,
  fresh,
}: {
  commit: Commit;
  repo?: string;
  fresh: boolean;
}) {
  const work = commit.visibility === "work";

  const inner = (
    <>
      <span className={`${SHA} shrink-0 text-accent`}>
        {commit.id.slice(0, 7)}
      </span>

      {work ? (
        <span className={`${BODY} flex items-center gap-2`}>
          <KindTag kind={commit.kind} />
          {/* Fixed width: a length-proportional redaction leaks how long the
              subject was. Rounded, or it reads as a loading skeleton. */}
          <span
            aria-label="redacted"
            className="h-[9px] w-[260px] max-w-full rounded-full bg-redact"
          />
        </span>
      ) : (
        <span
          className={`${BODY} truncate text-ink @max-[720px]:overflow-visible @max-[720px]:whitespace-normal`}
        >
          {commit.message}
        </span>
      )}

      {/*
        Prints only when it changes, so a run of commits on one repo reads as one
        session. Container queries, not media: mounted in the room this DOM sits
        on a plane at a fixed width and the viewport tells it nothing.
      */}
      <span
        className={`${REPO} shrink-0 truncate text-ink-faint @max-[720px]:w-auto`}
      >
        {repo?.replace(/^yashdagar\//, "")}
      </span>
      {/* Server renders "35m", client renders "36m" a moment later. The number
          is supposed to disagree. */}
      <span
        suppressHydrationWarning
        className={`${AGE} shrink-0 text-right text-ink-faint tabular-nums @max-[720px]:ml-auto`}
      >
        {shortAge(commit.at)}
      </span>
    </>
  );

  const shape = `flex items-center gap-4 rounded-row px-2 py-[3px] @max-[720px]:flex-wrap @max-[720px]:gap-x-3 @max-[720px]:gap-y-0 @max-[720px]:py-1.5 ${
    fresh ? "animate-commit-in" : ""
  }`;

  return (
    <li>
      {commit.url ? (
        <a
          href={commit.url}
          target="_blank"
          rel="noreferrer"
          className={`${shape} transition-colors duration-150 hover:bg-screen-hi focus-visible:bg-screen-hi focus-visible:outline-none`}
        >
          {inner}
        </a>
      ) : (
        <div className={shape}>{inner}</div>
      )}
    </li>
  );
}

/**
 * The one addition to `git log --oneline`'s format, marked as a comment so it is
 * visibly annotation rather than output. The age column can't tell you a commit
 * was on a Sunday.
 */
function DayLine({ day, count }: { day: string; count: number }) {
  const date = new Date(day + "T00:00:00Z");
  return (
    <li className="mt-4 flex items-center gap-2 px-2 pt-1 text-ink-faint first:mt-0">
      <span>
        #{" "}
        {date.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })}
      </span>
      <span className="tabular-nums">
        · {count} commit{count === 1 ? "" : "s"}
      </span>
      <span className="ml-2 h-px flex-1 bg-screen-line" />
    </li>
  );
}

/**
 * Inline flow rather than a flex row, so a command too long for the panel wraps
 * to the left margin the way a shell line does.
 */
function Prompt({ command }: { command?: string }) {
  return (
    <p className="px-2">
      <span className="text-accent">{CWD}</span>{" "}
      <span className="text-ink-faint">$</span>{" "}
      {command ? (
        <span className="text-ink">{command}</span>
      ) : (
        <span
          aria-hidden
          className="animate-caret inline-block h-[15px] w-[8px] translate-y-[2px] bg-accent"
        />
      )}
    </p>
  );
}

export function CommitFeed({ initial }: { initial?: ActivityFeed | null }) {
  const { feed, failed, fresh } = useActivity(initial ?? null);

  if (!feed) {
    return (
      <Shell>
        <TitleBar />
        <div className="flex-1 py-3">
          <Prompt command={COMMAND} />
          {failed ? (
            // git's own wording: a terminal that fails in a product voice stops
            // being a terminal at the moment it matters.
            <p className="mt-2 px-2 text-del">
              fatal: could not read the feed. It is refreshed by a scheduled
              job — try again shortly.
            </p>
          ) : (
            <p className="mt-2 px-2 text-ink-faint">
              <span className="animate-pulse">reading…</span>
            </p>
          )}
        </div>
      </Shell>
    );
  }

  const lines = toLogLines(feed.commits);
  const workCount = feed.commits.filter((c) => c.visibility === "work").length;

  return (
    <Shell>
      <TitleBar totals={feed.totals} />

      <ol className="min-h-0 flex-1 overflow-y-auto py-3 pr-1">
        <li className="mb-2">
          <Prompt command={COMMAND} />
        </li>
        {lines.map((line: LogLine) =>
          line.type === "day" ? (
            <DayLine key={line.key} day={line.day} count={line.count} />
          ) : (
            <Row
              key={line.key}
              commit={line.commit}
              repo={line.repo}
              fresh={fresh.has(line.key)}
            />
          ),
        )}
      </ol>

      <footer className="shrink-0 border-t border-screen-line pt-2.5">
        {workCount > 0 && (
          <p className="px-2 pb-1.5 text-ink-faint">
            # {workCount} commits to private work repos print as a type label
            only. The messages never leave the job that collects them.
          </p>
        )}
        <div className="flex items-center">
          <Prompt />
          <span
            suppressHydrationWarning
            className="ml-auto px-2 text-ink-faint tabular-nums"
          >
            updated {relativeTime(feed.generatedAt)}
          </span>
        </div>
      </footer>
    </Shell>
  );
}

/**
 * From the rest pose this panel is 600px across and unreadable, so it has to say
 * what it is through shape alone. The dots are neutral: three saturated hues
 * would break the room's one-accent rule, and an unfocused terminal greys them
 * out anyway.
 */
function TitleBar({ totals }: { totals?: ActivityFeed["totals"] }) {
  return (
    <header className="flex shrink-0 items-center gap-3 rounded-card bg-screen-raised px-3 py-2">
      <span className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-[9px] rounded-full bg-screen-hi" />
        ))}
      </span>
      {/* On a phone the totals are worth more than the hostname, so this goes
          screen-reader-only rather than truncating to "y…". */}
      <h2 className="truncate text-ink-dim @max-[560px]:sr-only">
        yash@desk: <span className="text-ink-faint">{CWD}</span>
      </h2>
      {totals && (
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <Badge>{totals.year} this year</Badge>
          {totals.streak > 0 && (
            <Badge tone="accent">{totals.streak}d streak</Badge>
          )}
        </span>
      )}
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    /*
      `@container` so the rows respond to the panel: mounted in the room this DOM
      sits on a plane at a fixed design width and the viewport tells it nothing.
      The slight lift toward the top is there because a field of perfectly even
      near-black is the one thing a real monitor never shows.
    */
    <div className="@container flex h-full w-full flex-col overflow-hidden bg-screen bg-[radial-gradient(120%_80%_at_50%_0%,#151a1e_0%,transparent_70%)] px-4 py-4 font-mono text-[13px] leading-[1.65] text-ink-dim">
      {children}
    </div>
  );
}
