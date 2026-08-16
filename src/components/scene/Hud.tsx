"use client";

import { useEffect, useState } from "react";

import { isPinned, sceneNow } from "@/lib/clock";
import { daylight } from "@/lib/daylight";
import type { ScreenId } from "@/lib/layout";
import { useScene } from "@/lib/store";

const SCREEN_LABELS: { id: ScreenId; label: string }[] = [
  { id: "commits", label: "Go to the commit feed" },
  { id: "about", label: "Go to about and contact" },
  { id: "music", label: "Go to now playing" },
];

/**
 * The only chrome over the room.
 *
 * Two jobs, both of which the scene fails without:
 *
 * 1. Say that the screens are clickable. A 3D room gives no affordance that a
 *    flat page gives for free — there are no underlines and no cursor changes
 *    until you're already hovering the right thing. Without a line of text
 *    people look at a nice render and leave.
 *
 * 2. Offer the way out. Someone who wants the information and not the
 *    experience should be one click from an ordinary page, and shouldn't have
 *    to guess that's possible.
 *
 * The clock is a third, quieter job: it says the room is on Yash's time, not
 * yours, which is the whole conceit stated in four characters.
 */
export function Hud() {
  const focus = useScene((s) => s.focus);
  const hasInteracted = useScene((s) => s.hasInteracted);
  const clearFocus = useScene((s) => s.clearFocus);
  const focusScreen = useScene((s) => s.focusScreen);
  const setForceFlat = useScene((s) => s.setForceFlat);

  const [clock, setClock] = useState<{ label: string; night: boolean } | null>(
    null,
  );

  useEffect(() => {
    const tick = () => {
      const d = daylight(sceneNow());
      setClock({ label: d.label, night: d.night });
    };
    tick();
    if (isPinned()) return;
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const focused = focus.kind !== "none";

  return (
    <>
      {/*
        First focusable thing on the page.
        A keyboard user landing in a 3D room needs the way out before they need
        anything else — and the flat page is the fully accessible version of
        everything here.
      */}
      <button
        type="button"
        onClick={() => setForceFlat(true)}
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-full focus:bg-accent focus:px-5 focus:py-2.5 focus:font-mono focus:text-[13px] focus:text-graphite"
      >
        Skip the room, read this as a page
      </button>

      {/*
        Keyboard access to the screens themselves. Visually hidden until
        focused, because the room already says "click a screen" to anyone using
        a mouse and a row of buttons over the render would be clutter.
      */}
      <nav
        aria-label="Screens"
        className="fixed left-4 top-16 z-50 flex flex-col gap-2"
      >
        {SCREEN_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => focusScreen(id)}
            className="sr-only focus:not-sr-only focus:rounded-full focus:bg-screen-raised focus:px-5 focus:py-2.5 focus:font-mono focus:text-[13px] focus:text-ink"
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-between gap-6 p-5 sm:p-7">
        <p className="font-mono text-[12px] leading-relaxed text-ink-faint">
          {clock && (
            <span className="text-ink-dim tabular-nums">
              {clock.label} Gurugram
              {clock.night && (
                <span className="text-ink-faint"> · he&apos;s probably asleep</span>
              )}
            </span>
          )}
          <br />
          <span
            className={`transition-opacity duration-700 ${
              focused || !hasInteracted ? "opacity-100" : "opacity-0"
            }`}
          >
            {focused ? "esc, or click away, to lean back" : "click a screen"}
          </span>
        </p>

        <button
          type="button"
          onClick={() => setForceFlat(true)}
          className="pointer-events-auto shrink-0 rounded-full bg-screen-raised/80 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim backdrop-blur-sm transition-colors duration-150 hover:bg-screen-hi hover:text-ink focus-visible:bg-screen-hi focus-visible:text-ink focus-visible:outline-none"
        >
          Read as a page
        </button>
      </div>

      {/*
        A real focusable control for the Escape action.
        Keyboard users get an actual button rather than an undiscoverable key,
        and it's visually hidden until focused so it doesn't sit on the render.
      */}
      {focused && (
        <button
          type="button"
          onClick={clearFocus}
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 -translate-y-24 rounded-full bg-screen-raised px-5 py-2.5 font-mono text-[12px] text-ink transition-transform focus-visible:translate-y-0 focus-visible:outline-none"
        >
          Lean back
        </button>
      )}
    </>
  );
}
