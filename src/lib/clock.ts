"use client";

/**
 * The instant the room is rendering.
 *
 * Normally just now. `?t=HH:MM` pins it to an IST wall-clock time so both
 * halves of the design — the daylit room and the lamplit one — can be looked at
 * without waiting for the hour to come round.
 *
 * Shared rather than duplicated because the first version only wired the
 * override into the lighting: the room went dark for 23:20 while the clock in
 * the corner still read the real time, so every screenshot quietly disagreed
 * with itself.
 */
export function sceneNow(): Date {
  if (typeof window === "undefined") return new Date();

  const forced = new URLSearchParams(window.location.search).get("t");
  const match = forced && /^(\d{1,2}):(\d{2})$/.exec(forced);
  if (!match) return new Date();

  const [h, m] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m > 59) return new Date();

  // A UTC instant that lands on this IST wall-clock time.
  return new Date(Date.UTC(2026, 0, 1, h - 5, m - 30));
}

/** True when the clock is pinned, so the UI can stop ticking. */
export function isPinned(): boolean {
  if (typeof window === "undefined") return false;
  const forced = new URLSearchParams(window.location.search).get("t");
  return !!forced && /^\d{1,2}:\d{2}$/.test(forced);
}
