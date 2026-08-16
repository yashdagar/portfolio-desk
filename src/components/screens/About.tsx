"use client";

import type { ActivityFeed, Commit } from "@/lib/activity";
import { PROFILE } from "@/lib/profile";
import { useActivity } from "@/lib/useActivity";

const WEEKS = 18;

/**
 * A contribution grid, built from the same commits the left monitor lists.
 *
 * It's here because the bio is short and this screen had a hole in the middle
 * of it — but it earns its place beyond filling space. The claim on this panel
 * is "the feed is live, it's what I actually pushed"; a grid of the last four
 * months is that claim as a shape rather than a sentence, and it's the one
 * element on the screen that reads from the rest pose, where the text doesn't.
 *
 * Work commits count. Their messages never leave the collector, but the fact
 * that a day had work in it is not a secret, and excluding them would draw a
 * picture of someone who doesn't have a job.
 */
function ContributionGrid({ commits }: { commits: Commit[] }) {
  const counts = new Map<string, number>();
  for (const c of commits) {
    const day = c.at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
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
    <div className="mt-8">
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

/**
 * The centre monitor: who this is, and how to reach him.
 *
 * No projects — the shelf holds those. This screen's whole job is name, claim,
 * and contact, in that order, readable in about eight seconds.
 */
export function About({ initial }: { initial?: ActivityFeed | null }) {
  const { feed } = useActivity(initial ?? null);

  const contacts = [
    ...PROFILE.links,
    { label: "Email", href: `mailto:${PROFILE.email}`, handle: PROFILE.email },
  ];

  return (
    /*
     * Two columns rather than one.
     *
     * The bio is deliberately short, so a single top-to-bottom column on a 16:9
     * panel leaves a large dead band through the middle. Splitting it puts the
     * claim on the left and the ways to act on it down the right, and both
     * columns reach the bottom of the screen.
     */
    <div className="grid h-full w-full grid-cols-[1.45fr_1fr] gap-8 bg-screen bg-[radial-gradient(110%_80%_at_35%_0%,#161c20_0%,transparent_68%)] px-9 py-8 font-sans text-ink-dim">
      <div className="flex flex-col">
        {/*
          The one place in the whole project where restraint beats decoration.
          Everything else on this screen got a shape; the name doesn't need one.
        */}
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

        {feed && <ContributionGrid commits={feed.commits} />}

        {feed && (
          <p className="mt-auto pt-6">
            <span className="inline-block rounded-full bg-screen-raised px-4 py-2 font-mono text-[13px] text-ink-faint tabular-nums">
              {feed.totals.year} commits in the last year
              {feed.totals.streak > 0 && ` · ${feed.totals.streak}d streak`}
              {` · on GitHub since ${PROFILE.githubSince}`}
            </span>
          </p>
        )}
      </div>

      {/*
        Contacts as cards rather than as underlined text.

        Four small links stacked in a column read as a footer no matter where
        they're placed, and a footer is the last thing anyone clicks. Filled
        cards with the whole rectangle as the hit target read as the thing to
        do next, which is exactly what they are on a page whose job is to get
        someone to make contact.
      */}
      <ul className="flex flex-col justify-center gap-2.5">
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
