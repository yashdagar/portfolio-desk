"use client";

import type { ActivityFeed } from "@/lib/activity";
import { PROFILE } from "@/lib/profile";
import { useActivity } from "@/lib/useActivity";

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
    <div className="grid h-full w-full grid-cols-[1.5fr_1fr] gap-10 bg-screen px-9 py-8 font-sans text-ink-dim">
      <div className="flex flex-col">
        <h1 className="text-[42px] font-medium leading-none tracking-tight text-ink">
          {PROFILE.name}
        </h1>
        <p className="mt-3 font-mono text-[14px] text-accent">
          {PROFILE.role} · {PROFILE.location}
        </p>

        <div className="mt-7 space-y-4 text-[16px] leading-relaxed">
          {PROFILE.bio.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>

        {feed && (
          <p className="mt-auto pt-6 font-mono text-[13px] text-ink-faint tabular-nums">
            {feed.totals.year} commits in the last year
            {feed.totals.streak > 0 && ` · ${feed.totals.streak}d streak`}
            {` · on GitHub since ${PROFILE.githubSince}`}
          </p>
        )}
      </div>

      <ul className="flex flex-col justify-center gap-4 border-l border-screen-line pl-8">
        {contacts.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              {...(link.href.startsWith("mailto:")
                ? {}
                : { target: "_blank", rel: "noreferrer" })}
              className="group block focus-visible:outline-none"
            >
              <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                {link.label}
              </span>
              <span className="mt-1 block truncate text-[15px] text-ink underline decoration-screen-line underline-offset-4 transition-colors group-hover:decoration-accent group-focus-visible:decoration-accent">
                {link.handle}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
