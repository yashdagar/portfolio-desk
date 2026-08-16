/**
 * What the room's light should be doing right now, in Gurugram.
 *
 * The window and the desk lamp are driven by real IST rather than a fixed
 * "night scene", so someone opening this at 3pm sees a daylit room and someone
 * opening it at 2am sees a lamp. It costs nothing and it's the cheapest way to
 * make the space feel like a real place that exists while you aren't looking.
 *
 * Deliberately not an astronomical model. Gurugram sits at 28.5°N, where the
 * sun rises between about 05:25 and 07:10 across the year — a difference of
 * under two hours. A fixed schedule is wrong by minutes, and nobody can tell.
 */

export interface Daylight {
  /** 0 = fully dark, 1 = full daylight. */
  level: number;
  /** Warmth of the window light. Dawn and dusk are gold, midday is blue-white. */
  windowColor: string;
  /** How hard the window pushes. */
  windowIntensity: number;
  /** The lamp comes up as the window falls away. */
  lampIntensity: number;
  /** Ambient bounce colour — cool by day, warm at night from the lamp. */
  bounceColor: string;
  bounceIntensity: number;
  /** Local time, for display. */
  label: string;
  /** True when Yash is plausibly asleep, which the UI can note. */
  night: boolean;
}

const SUNRISE = 6.0;
const SUNSET = 18.9;
/** How long the sky takes to turn over, in hours. */
const TWILIGHT = 1.4;

/** Hours since IST midnight, as a float. */
export function istHours(now: Date = new Date()): number {
  // IST is UTC+5:30 and has no daylight saving, so this is exact.
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const ist = new Date(utc + 5.5 * 3_600_000);
  return ist.getHours() + ist.getMinutes() / 60 + ist.getSeconds() / 3600;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mixed = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return "#" + mixed.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const NIGHT_BLUE = "#243a5c";
const GOLDEN = "#ffb066";
const NOON = "#cfe0ff";

export function daylight(now: Date = new Date()): Daylight {
  const h = istHours(now);

  // Rises through dawn, falls through dusk.
  const level =
    smoothstep(SUNRISE - TWILIGHT / 2, SUNRISE + TWILIGHT, h) *
    (1 - smoothstep(SUNSET - TWILIGHT, SUNSET + TWILIGHT / 2, h));

  /*
   * Colour is not a function of level alone: dawn and dusk are both "half lit"
   * but the sun is low and gold at both, and high and blue-white in between.
   * `midday` peaks at solar noon and falls off toward either horizon.
   */
  const midday = smoothstep(0, 1, 1 - Math.abs(h - (SUNRISE + SUNSET) / 2) / 5);
  const warm = mixHex(GOLDEN, NOON, midday);
  const windowColor = mixHex(NIGHT_BLUE, warm, level);

  const night = level < 0.12;

  return {
    level,
    windowColor,
    // Never fully zero: a city window at night still carries some skyglow, and
    // a pure-black window reads as a hole in the wall rather than as glass.
    windowIntensity: 0.06 + level * 2.4,
    // The lamp fades in as daylight goes, and stays on a little into the
    // morning the way a real one does before anyone thinks to switch it off.
    lampIntensity: 0.5 + (1 - level) * 3.2,
    bounceColor: mixHex("#3a2c22", "#9fb6d6", level),
    bounceIntensity: 0.05 + level * 0.38,
    label: formatIst(now),
    night,
  };
}

export function formatIst(now: Date = new Date()): string {
  const h = istHours(now);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
