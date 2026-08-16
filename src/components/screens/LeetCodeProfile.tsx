"use client";

import { PROFILE } from "@/lib/profile";
import {
  DIFFICULTY_TONE as TONE,
  LEETCODE_URL,
  type Difficulty,
  type LeetCodeStats,
} from "@/lib/leetcode";

/**
 * The centre monitor: the LeetCode profile, open in a browser.
 *
 * It used to be an "about me" page with a small LeetCode card in the sidebar,
 * which had the emphasis exactly backwards. A bio is a claim and this is
 * evidence, and the evidence is the thing worth putting on the largest screen
 * on the desk. Nothing is lost by the swap, either — a LeetCode profile
 * genuinely carries a name, a location, a school and a row of outbound links,
 * so the identity that used to live here still does. It just arrives attached
 * to a thousand solved problems.
 *
 * Framed as a browser window rather than as a bare panel, and that frame is
 * load-bearing in two ways. It tells you instantly that this is a real page
 * somewhere rather than a widget someone designed, and it gives the whole thing
 * one obvious click target that opens the real profile — which a page of nested
 * links can't have, since an anchor can't contain another anchor.
 */

const ORDER: Difficulty[] = ["Easy", "Medium", "Hard"];

/**
 * A fixed date, not "3 days ago".
 *
 * This component renders on the server for the flat page and on the client in
 * the room. A relative time computed at render differs between the two by
 * however long the request took, and React calls that a hydration mismatch.
 * Pinning the timezone to UTC removes the other half of the same problem.
 */
const when = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * The solved ring.
 *
 * LeetCode's own headline graphic, and worth copying rather than inventing
 * because it does something bars can't: it shows the three difficulties as
 * parts of one quantity, so you read the total and the mix in a single glance.
 * Drawn as SVG arcs on one circle — each difficulty's sweep is its share of the
 * problems solved, and the unfilled remainder of the ring is everything on the
 * site that hasn't been.
 */
function SolvedRing({ stats }: { stats: LeetCodeStats }) {
  const R = 58;
  const C = 2 * Math.PI * R;
  const catalogue = ORDER.reduce((n, d) => n + stats.solved[d].total, 0);

  /*
   * Each arc's length, then where it starts — as a prefix sum rather than a
   * running total carried in a closure.
   *
   * The obvious version accumulates into a `let` inside the map callback, which
   * the React compiler rejects: a variable reassigned during render can hold a
   * stale value if the component re-renders partway through. Three items make
   * the quadratic slice-and-sum free, and it has no state to be stale.
   */
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
 * The submission calendar.
 *
 * The one graphic on a LeetCode profile that isn't a summary — everything else
 * up the page is a total, and totals say nothing about whether the work
 * happened in one heroic fortnight or every week for a year. This says which,
 * and here the answer is 299 days out of 365, which is the actual claim being
 * made by the whole panel.
 *
 * It also fills the bottom half of an ultrawide, which the three columns above
 * it cannot: they're a sidebar, a chart and two short lists, and none of them
 * has 200 more pixels of anything to say. A full-width band of a year's work is
 * the right thing to put under them for the same reason it's at the bottom of
 * the real page.
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

  /*
   * Five steps, and the thresholds are deliberately low.
   *
   * Submission counts are long-tailed — most active days are one to three
   * problems and the occasional contest day is forty. Scaled against the
   * maximum, a normal week of real work renders as the palest possible tint and
   * the whole year looks empty. The point of the grid is which days had
   * anything in them at all.
   */
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
            style={{ left: m.col * 14 }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div
        className="grid w-fit grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: "repeat(7, 11px)" }}
        role="img"
        aria-label="Submissions over the last year"
      >
        {cells.map((c) => (
          <span
            key={c.key}
            title={c.future ? undefined : `${c.count} on ${c.key}`}
            className={`size-[11px] rounded-[3px] ${
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
      {/*
        Browser chrome, and the whole of it is the link out.

        A page of a dozen nested links can't itself be a link, so the click
        target has to be somewhere no other link lives. The address bar is where
        anyone would click to go to a site anyway.
      */}
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

            <p className="mt-4 text-[13px] leading-relaxed">{PROFILE.bio[0]}</p>

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
                  {stats.badges.slice(0, 4).map((b) => (
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
                  {stats.languages.slice(0, 4).map((l) => (
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
                  {stats.recent.slice(0, 5).map((p) => (
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

        {/*
          A year of submissions, full width, under everything else.

          `mt-auto` rather than a fixed offset: the three panes above are all
          content-height and the tallest of them decides where this starts, so
          pinning it to the bottom is what keeps the panel balanced whether
          there are four badges or none.
        */}
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
