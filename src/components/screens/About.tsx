"use client";

import type { ActivityFeed, Commit } from "@/lib/activity";
import type { LeetCodeStats } from "@/lib/leetcode";
import { PROFILE } from "@/lib/profile";
import { useActivity } from "@/lib/useActivity";
import { useLeetCode } from "@/lib/useLeetCode";

import { LeetCodePanel } from "./LeetCode";

const WEEKS = 18;

/**
 * A contribution grid from the same commits the left monitor lists — the panel's
 * claim as a shape rather than a sentence, and the one element on it that reads
 * from the rest pose.
 *
 * Work commits count: excluding them would draw a picture of someone who
 * doesn't have a job. They arrive already reduced to a count per day — the
 * collector never publishes them one by one — so they're folded in by key
 * rather than tallied like the rest.
 */
function ContributionGrid({
  commits,
  workDays,
}: {
  commits: Commit[];
  workDays?: Record<string, number>;
}) {
  const counts = new Map<string, number>();
  for (const c of commits) {
    const day = c.at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  for (const [day, count] of Object.entries(workDays ?? {})) {
    counts.set(day, (counts.get(day) ?? 0) + count);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Monday-first weekday index, so the grid's rows run the way a calendar does.
  const weekday = (today.getUTCDay() + 6) % 7;
  // The bottom-right cell is the end of the current week, which is in the
  // future for most of it — those cells render empty rather than being dropped,
  // so the grid keeps its rectangle.
  const last = new Date(today);
  last.setUTCDate(last.getUTCDate() + (6 - weekday));

  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() - (WEEKS * 7 - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      future: d > today,
      count: counts.get(key) ?? 0,
      col: Math.floor(i / 7),
      row: i % 7,
    };
  });

  const tone = (n: number) =>
    n === 0
      ? "bg-screen-raised"
      : n < 3
        ? "bg-accent/25"
        : n < 6
          ? "bg-accent/50"
          : n < 12
            ? "bg-accent/75"
            : "bg-accent";

  return (
    // Pushed down rather than sitting under the bio, so the gap the column has
    // to absorb falls between two unrelated blocks instead of between the grid
    // and the line that totals it up.
    <div className="mt-auto pt-8">
      <div
        className="grid w-fit grid-flow-col gap-[4px]"
        style={{ gridTemplateRows: "repeat(7, 13px)" }}
        role="img"
        aria-label={`Commit activity over the last ${WEEKS} weeks`}
      >
        {cells.map((c) => (
          <span
            key={c.key}
            title={c.future ? undefined : `${c.count} on ${c.key}`}
            className={`size-[13px] rounded-[4px] ${
              c.future ? "bg-transparent" : tone(c.count)
            }`}
          />
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-ink-faint">
        last {WEEKS} weeks
      </p>
    </div>
  );
}

/** Name, claim and contact, in that order, readable in about eight seconds.
 *  No projects — the shelf holds those. */
export function About({
  initial,
  leetcode,
}: {
  initial?: ActivityFeed | null;
  leetcode?: LeetCodeStats | null;
}) {
  const { feed } = useActivity(initial ?? null);
  const stats = useLeetCode(leetcode ?? null);

  const contacts = [
    ...PROFILE.links,
    { label: "Email", href: `mailto:${PROFILE.email}`, handle: PROFILE.email },
  ];

  return (
    // The bio is short, so one column on a 16:9 panel leaves a dead band through
    // the middle. Split, both columns reach the bottom.
    <div className="grid h-full w-full grid-cols-[1.45fr_1fr] gap-8 overflow-hidden bg-screen bg-[radial-gradient(110%_80%_at_35%_0%,#161c20_0%,transparent_68%)] px-9 py-8 font-sans text-ink-dim">
      <div className="flex flex-col">
        <h1 className="text-[44px] font-medium leading-none tracking-tight text-ink">
          {PROFILE.name}
        </h1>
        <p className="mt-4">
          <span className="rounded-full bg-accent/12 px-3 py-[5px] font-mono text-[13px] text-accent">
            {PROFILE.role} · {PROFILE.location}
          </span>
        </p>

        <div className="mt-7 max-w-[52ch] space-y-4 text-[16px] leading-relaxed">
          {PROFILE.bio.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>

        {feed && (
          <ContributionGrid commits={feed.commits} workDays={feed.workDays} />
        )}

        {feed && (
          <p className="mt-5">
            <span className="inline-block rounded-full bg-screen-raised px-4 py-2 font-mono text-[13px] text-ink-faint tabular-nums">
              {feed.totals.year} commits in the last year
              {feed.totals.streak > 0 && ` · ${feed.totals.streak}d streak`}
              {` · on GitHub since ${PROFILE.githubSince}`}
            </span>
          </p>
        )}
      </div>

      {/* Cards rather than links: four stacked links read as a footer wherever
          they're placed, and a footer is the last thing anyone clicks. */}
      <ul className="flex flex-col justify-center gap-2.5">
        {/* Evidence above actions: what has he done, then how do I reach him. */}
        {stats && (
          <li>
            <LeetCodePanel stats={stats} className="mb-1.5" />
          </li>
        )}
        {contacts.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              {...(link.href.startsWith("mailto:")
                ? {}
                : { target: "_blank", rel: "noreferrer" })}
              className="block rounded-card bg-screen-raised px-4 py-3 transition-colors duration-150 hover:bg-screen-hi focus-visible:bg-screen-hi focus-visible:outline-none"
            >
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                {link.label}
              </span>
              <span className="mt-1 block truncate text-[15px] text-ink">
                {link.handle}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
