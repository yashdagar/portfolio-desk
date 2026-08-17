"use client";

import { PROFILE } from "@/lib/profile";
import {
  DIFFICULTY_TONE as TONE,
  LEETCODE_URL,
  type Difficulty,
  type LeetCodeStats,
} from "@/lib/leetcode";

/**
 * The LeetCode profile, framed as a browser window. The frame is load-bearing:
 * it says this is a real page rather than a widget someone designed, and it
 * gives the panel one click target that opens the real profile — which a page
 * of nested links can't have, since an anchor can't contain another anchor.
 */

const ORDER: Difficulty[] = ["Easy", "Medium", "Hard"];

/**
 * A fixed date, not "3 days ago": this renders on the server for the flat page
 * and on the client in the room, and a relative time differs between the two by
 * however long the request took. UTC removes the other half of the problem.
 */
const when = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Worth copying from LeetCode rather than inventing, because it does something
 * bars can't: the three difficulties are parts of one quantity, so the total and
 * the mix read in a single glance.
 */
function SolvedRing({ stats }: { stats: LeetCodeStats }) {
  const R = 58;
  const C = 2 * Math.PI * R;
  const catalogue = ORDER.reduce((n, d) => n + stats.solved[d].total, 0);

  // A prefix sum rather than a running total in a closure: the React compiler
  // rejects a `let` reassigned during render, and three items make the quadratic
  // slice-and-sum free.
  const lengths = ORDER.map(
    (d) => (catalogue > 0 ? stats.solved[d].count / catalogue : 0) * C,
  );
  const arcs = ORDER.map((d, i) => ({
    d,
    len: lengths[i],
    at: lengths.slice(0, i).reduce((n, l) => n + l, 0),
  }));

  return (
    <svg
      viewBox="0 0 140 140"
      className="size-[140px] shrink-0"
      role="img"
      aria-label={`${stats.total} problems solved of ${catalogue}`}
    >
      {/* Rotated so the ring starts at twelve o'clock rather than at three. */}
      <g transform="rotate(-90 70 70)">
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="currentColor"
          className="text-screen-line"
          strokeWidth="11"
        />
        {arcs.map((a) => (
          <circle
            key={a.d}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={TONE[a.d]}
            strokeWidth="11"
            strokeLinecap="butt"
            strokeDasharray={`${a.len} ${C - a.len}`}
            strokeDashoffset={-a.at}
          />
        ))}
      </g>
      <text
        x="70"
        y="66"
        textAnchor="middle"
        className="fill-ink text-[30px] font-medium tabular-nums"
      >
        {stats.total.toLocaleString("en-IN")}
      </text>
      <text
        x="70"
        y="88"
        textAnchor="middle"
        className="fill-ink-faint text-[13px] tabular-nums"
      >
        / {catalogue.toLocaleString("en-IN")}
      </text>
    </svg>
  );
}

/** How many weeks of the calendar to show. A year, near enough. */
const WEEKS = 52;

/**
 * The one graphic here that isn't a summary: totals say nothing about whether
 * the work happened in one heroic fortnight or every week for a year.
 */
function SubmissionCalendar({ days }: { days: Record<string, number> }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Monday-first weekday index, so the rows run the way a calendar does.
  const weekday = (today.getUTCDay() + 6) % 7;
  // The last column is the current week, most of which is usually still in the
  // future; those cells render empty rather than being dropped, so the grid
  // keeps its rectangle.
  const last = new Date(today);
  last.setUTCDate(last.getUTCDate() + (6 - weekday));

  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() - (WEEKS * 7 - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, future: d > today, count: days[key] ?? 0, date: d };
  });

  // Deliberately low thresholds: counts are long-tailed, so scaled against the
  // maximum a normal week renders as the palest tint and the year looks empty.
  const tone = (n: number) =>
    n === 0
      ? "bg-screen-raised"
      : n < 2
        ? "bg-accent/25"
        : n < 4
          ? "bg-accent/45"
          : n < 8
            ? "bg-accent/70"
            : "bg-accent";

  /** A month label above the first column that starts a new month. */
  const months = cells
    .filter((c, i) => i % 7 === 0 && c.date.getUTCDate() <= 7)
    .map((c) => ({
      key: c.key,
      col: Math.floor(cells.indexOf(c) / 7),
      label: c.date.toLocaleDateString("en-GB", {
        month: "short",
        timeZone: "UTC",
      }),
    }));

  return (
    <div>
      <div className="relative mb-1.5 h-[13px]">
        {months.map((m) => (
          <span
            key={m.key}
            className="absolute font-mono text-[10px] text-ink-faint"
            style={{ left: m.col * 16 }}
          >
            {m.label}
          </span>
        ))}
      </div>
      {/* 13 px cells rather than 11, now that the panel is 40".
          A year grid is 52 columns wide however big the cells are, so it can
          only use extra height by growing — and a heatmap whose individual days
          are legible is worth more than one with margin around it. */}
      <div
        className="grid w-fit grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: "repeat(7, 13px)" }}
        role="img"
        aria-label="Submissions over the last year"
      >
        {cells.map((c) => (
          <span
            key={c.key}
            title={c.future ? undefined : `${c.count} on ${c.key}`}
            className={`size-[13px] rounded-[3px] ${
              c.future ? "bg-transparent" : tone(c.count)
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function LeetCodeProfile({ stats }: { stats: LeetCodeStats }) {
  const links = [
    ...stats.links,
    // The email is the one contact LeetCode has no field for, and it's the one
    // that matters most on a portfolio. It goes in with the rest.
    { label: "Email", href: `mailto:${PROFILE.email}` },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-screen font-sans text-ink-dim">
      {/* The whole chrome is the link out: a page of nested links can't itself
          be one, so the target has to be somewhere no other link lives. */}
      <a
        href={LEETCODE_URL}
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-3 border-b border-screen-line bg-screen-raised px-5 py-3 transition-colors duration-150 hover:bg-screen-hi focus-visible:bg-screen-hi focus-visible:outline-none"
      >
        <span className="flex gap-[6px]">
          {["#e05c62", "#e8a33d", "#37bfa5"].map((c) => (
            <span
              key={c}
              className="size-[10px] rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
        </span>
        <span className="flex-1 truncate rounded-full bg-screen px-4 py-[5px] font-mono text-[13px] text-ink-dim">
          leetcode.com/u/{stats.user}
        </span>
        <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-faint">
          Open ↗
        </span>
      </a>

      <div className="flex min-h-0 flex-1 flex-col px-7 py-6">
        <div className="grid grid-cols-[300px_1fr_1fr] gap-7">
          {/* Identity. */}
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-3.5">
              {stats.avatar && (
                // A plain img, not next/image: this DOM is mounted onto a plane
                // in a 3D scene, where the loader's srcset and lazy sentinel do
                // nothing useful and its wrapper fights the layout.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stats.avatar}
                  alt=""
                  width={62}
                  height={62}
                  className="size-[62px] shrink-0 rounded-full bg-screen-raised object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-[21px] font-medium leading-tight text-ink">
                  {stats.realName ?? PROFILE.name}
                </p>
                <p className="truncate font-mono text-[13px] text-ink-faint">
                  {stats.user}
                </p>
              </div>
            </div>

            {/* Both paragraphs. The second one was cut when this column had to
                share 336 mm of panel with a chart and two lists; on a 40" it
                fits, and it's the line that explains why the feed next door is
                worth looking at. */}
            {PROFILE.bio.map((line) => (
              <p key={line} className="mt-4 text-[13px] leading-relaxed">
                {line}
              </p>
            ))}

            <dl className="mt-4 space-y-1.5 font-mono text-[12px] text-ink-faint">
              {stats.rank !== null && (
                <div className="flex gap-2">
                  <dt className="w-[52px] shrink-0">rank</dt>
                  <dd className="text-ink-dim tabular-nums">
                    #{stats.rank.toLocaleString("en-IN")}
                  </dd>
                </div>
              )}
              {stats.country && (
                <div className="flex gap-2">
                  <dt className="w-[52px] shrink-0">from</dt>
                  <dd className="text-ink-dim">{stats.country}</dd>
                </div>
              )}
              {stats.school && (
                <div className="flex gap-2">
                  <dt className="w-[52px] shrink-0">school</dt>
                  <dd className="text-ink-dim">{stats.school}</dd>
                </div>
              )}
            </dl>

            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-4">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    {...(l.href.startsWith("mailto:")
                      ? {}
                      : { target: "_blank", rel: "noreferrer" })}
                    className="font-mono text-[12px] text-ink-dim underline decoration-screen-line underline-offset-4 transition-colors hover:decoration-accent"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Solved. */}
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-6">
              <SolvedRing stats={stats} />

              <dl className="min-w-0 flex-1 space-y-2.5">
                {ORDER.map((d) => {
                  const { count, total } = stats.solved[d];
                  const pct = total > 0 ? (count / total) * 100 : 0;

                  return (
                    <div key={d}>
                      <div className="flex items-baseline justify-between">
                        <dt
                          className="font-mono text-[11px] uppercase tracking-[0.1em]"
                          style={{ color: TONE[d] }}
                        >
                          {d}
                        </dt>
                        <dd className="font-mono text-[11px] text-ink-faint tabular-nums">
                          {count}
                          <span className="text-ink-faint/60">/{total}</span>
                        </dd>
                      </div>
                      {/* The track is drawn even at zero width, so an empty
                        difficulty reads as "none yet" rather than as a
                        missing row. */}
                      <dd className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-screen-line">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: TONE[d] }}
                        />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            {stats.badges.length > 0 && (
              <div className="mt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  Badges
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {stats.badges.slice(0, 6).map((b) => (
                    <li
                      key={b}
                      className="rounded-full bg-screen-raised px-2.5 py-1 font-mono text-[11px] text-ink-dim"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* What that's made of, and what it's been doing lately. */}
          <div className="flex min-h-0 flex-col">
            {stats.languages.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  Languages
                </p>
                <ul className="mt-2 space-y-1.5">
                  {stats.languages.slice(0, 6).map((l) => (
                    <li
                      key={l.name}
                      className="flex items-center gap-3 font-mono text-[12px]"
                    >
                      <span className="w-[74px] shrink-0 truncate text-ink-dim">
                        {l.name}
                      </span>
                      <span className="h-[4px] flex-1 overflow-hidden rounded-full bg-screen-line">
                        <span
                          className="block h-full rounded-full bg-accent/70"
                          style={{
                            width: `${(l.solved / stats.languages[0].solved) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="w-[34px] shrink-0 text-right text-ink-faint tabular-nums">
                        {l.solved}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stats.recent.length > 0 && (
              <div className="mt-5 min-h-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  Recently solved
                </p>
                <ul className="mt-2 space-y-[7px]">
                  {stats.recent.slice(0, 10).map((p) => (
                    <li key={p.slug} className="flex items-baseline gap-3">
                      <a
                        href={`https://leetcode.com/problems/${p.slug}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-[13px] text-ink-dim transition-colors hover:text-ink"
                      >
                        {p.title}
                      </a>
                      <span className="shrink-0 font-mono text-[11px] text-ink-faint tabular-nums">
                        {when(p.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* `mt-auto` rather than a fixed offset: the panes above are all
            content-height, so this stays balanced with four badges or none. */}
        <div className="mt-auto flex items-end justify-between gap-8 border-t border-screen-line pt-5">
          <SubmissionCalendar days={stats.calendar} />
          <p className="shrink-0 pb-1 text-right font-mono text-[11px] leading-relaxed text-ink-faint tabular-nums">
            {stats.activeDays} active days
            <br />
            {stats.streak}-day streak
          </p>
        </div>
      </div>
    </div>
  );
}
