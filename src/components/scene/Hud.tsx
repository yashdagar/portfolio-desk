"use client";

import { useEffect, useState } from "react";

import { isPinned, sceneNow } from "@/lib/clock";
import { daylight } from "@/lib/daylight";
import { useScene } from "@/lib/store";

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
          className="pointer-events-auto shrink-0 rounded-sm border border-screen-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-faint transition-colors hover:border-accent hover:text-ink focus-visible:border-accent focus-visible:text-ink focus-visible:outline-none"
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
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 -translate-y-24 rounded-sm bg-screen-raised px-4 py-2 font-mono text-[12px] text-ink transition-transform focus-visible:translate-y-0 focus-visible:outline-none"
        >
          Lean back
        </button>
      )}
    </>
  );
}
