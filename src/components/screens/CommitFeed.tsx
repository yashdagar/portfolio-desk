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
 * The format is the argument. A commit list rendered as cards is a design
 * choice about someone else's data; a commit list rendered as `git log` output
 * is the thing itself, in the format every reader of this screen already knows
 * how to parse — and the one format nobody can accuse of being arranged
 * flatteringly. Density comes free with it: one commit is one line, and a
 * hundred and forty lines is the whole point of the screen.
 *
 * Linear, and deliberately not `--graph`. The collector reads GitHub's events
 * API, which gives no parent shas at all, so any branch topology drawn here
 * would be invented. The one thing a terminal must never do is print something
 * that isn't true.
 *
 * Three tiers still render differently. Public and personal commits show their
 * message; work commits show a type label and a blackout, because the message
 * never left the Action that collected it. In a log the contrast is sharper
 * than it was in cards — a redacted line sits in the same column as the ones
 * you can read.
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

/** Where the prompt claims to be. All nine repos really do live under it. */
const CWD = "~/dev";
const COMMAND = "git log --oneline --since=1.year";

/*
 * Column widths.
 *
 * Fixed rather than derived, because the columns have to line up down the whole
 * log and every row is its own element — a row needs its own background to
 * highlight on hover, which rules out `display: contents` and therefore rules
 * out one shared grid. The message takes whatever is left; at the 1100px this
 * panel is authored at that's about 95 characters, and the longest real message
 * in the feed is 76.
 */
const SHA = "w-[66px]";
const REPO = "w-[152px]";
const AGE = "w-[46px]";

/*
 * The message.
 *
 * Below 720px the columns stop being affordable — the flat page gives the
 * message about 50 characters and a phone gives it 24, which truncates every
 * line to "Night lights, a d…" and makes the log unreadable at exactly the
 * width where it's most likely to be read by someone who isn't going to lean
 * in. So the row reflows: sha, repo and age stay on the first line, the message
 * wraps in full underneath. A narrow terminal wraps long lines rather than
 * truncating them, so this is also the more faithful behaviour of the two.
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
 * Only rendered for work commits.
 *
 * The kind is sniffed from the message, so where the message is visible the tag
 * restates it — and since most of Yash's messages are prose rather than
 * conventional commits, ~80% would read "other" and indent every line behind an
 * empty column. On a work commit it's the entire content, so it stays.
 *
 * Fixed width, wide enough for "refactor". Sized to its text it would push the
 * blackout that follows it a different distance on every row, and a redaction
 * column that starts in a different place each time reads as damage rather than
 * as policy.
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
      {/*
        Seven characters, because that's what git abbreviates to and the eye
        reads the column as shas rather than as ids. Accent-coloured for the
        same reason git colours it: it's the only part of the line that is
        machine output rather than something a person wrote.
      */}
      <span className={`${SHA} shrink-0 text-accent`}>
        {commit.id.slice(0, 7)}
      </span>

      {work ? (
        <span className={`${BODY} flex items-center gap-2`}>
          <KindTag kind={commit.kind} />
          {/*
            A blackout of fixed width, identical on every work commit — a
            length-proportional redaction would leak how long the subject was.
            Fully rounded on purpose: a sharp-cornered bar reads as a loading
            skeleton, which tells exactly the wrong story. A capsule reads as
            something deliberately withheld.
          */}
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
        The repo column prints only when it changes. A column of nine identical
        strings is what you'd delete by hand; leaving the gap is what makes a
        run of commits on one repo read as one session.

        Once the row has reflowed there's no column to keep, so it stops being a
        fixed width and just sits in the gap the sha and the age leave on the
        first line — where it's the only thing that says which project you're
        looking at. Container queries, not media queries: in the room this DOM
        is mounted at a fixed 1100px on a plane and has no relationship to the
        browser viewport at all.
      */}
      <span
        className={`${REPO} shrink-0 truncate text-ink-faint @max-[720px]:w-auto`}
      >
        {repo?.replace(/^yashdagar\//, "")}
      </span>
      {/*
        The server renders "35m" and the client, a moment later, renders "36m".
        React treats that as a hydration mismatch and throws the whole subtree
        away to re-render it — for a number that is *supposed* to disagree,
        since it's the time since something happened. This is the case the
        escape hatch exists for.
      */}
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
 * A date, printed as a comment wherever the day turns over.
 *
 * `git log --oneline` has no such line, and the log is poorer for it — the age
 * column tells you a commit was 43 days ago, which nobody can convert into a
 * date or into "that was a Sunday". This is the one addition to the format,
 * and it's marked as a comment so it's visibly annotation rather than output.
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
 * The prompt, with the path in accent the way a real one has it.
 *
 * Inline flow rather than a flex row, so that a command too long for the panel
 * wraps to the left margin the way a wrapped shell line does. As a flex row the
 * continuation hung under the command instead, which reads as a layout bug.
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
            /*
              git's own wording. A terminal that reports a failure in a product
              voice — "something went wrong, please try again" — stops being a
              terminal at exactly the moment it matters.
            */
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
        {/*
          The live line. The prompt is back and waiting, which is what a shell
          looks like after a command finishes — and it's the honest place to put
          the freshness stamp, right next to the cursor that will print the next
          commit when the collector finds one.
        */}
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
 * Window chrome.
 *
 * Present for one reason: from the rest pose this panel is 600px across and
 * nobody is reading a word of it, so the screen has to say what it is through
 * shape alone — and a title bar with three dots over a field of monospace is
 * the most instantly legible shape in computing.
 *
 * The dots are neutral rather than red/amber/green. Three saturated hues for
 * pure decoration would break the one-accent rule that the whole room's colour
 * is built on, and an unfocused terminal greys them out anyway.
 */
function TitleBar({ totals }: { totals?: ActivityFeed["totals"] }) {
  return (
    <header className="flex shrink-0 items-center gap-3 rounded-card bg-screen-raised px-3 py-2">
      <span className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-[9px] rounded-full bg-screen-hi" />
        ))}
      </span>
      {/*
        Sight-unseen on a phone: the two totals are worth more than the hostname
        and there isn't room for both, so the title goes to the screen reader
        only rather than truncating to "y…".
      */}
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
      Mono throughout, at 13px. This is the one screen where the type is the
      format rather than a choice about it: a proportional font would break the
      columns, and columns are what make a log scannable.

      `@container` so the row layout can respond to the panel instead of the
      viewport. Mounted in the room, this DOM sits on a plane at a fixed design
      width and the browser viewport tells it nothing.

      The bed keeps its very slight lift toward the top. A 16:9 field of
      perfectly even near-black is the one thing a real monitor never shows.
    */
    <div className="@container flex h-full w-full flex-col overflow-hidden bg-screen bg-[radial-gradient(120%_80%_at_50%_0%,#151a1e_0%,transparent_70%)] px-4 py-4 font-mono text-[13px] leading-[1.65] text-ink-dim">
      {children}
    </div>
  );
}
