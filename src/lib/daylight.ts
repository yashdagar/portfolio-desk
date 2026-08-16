/**
 * What the room's light should be doing right now, in Gurugram.
 *
 * Deliberately not an astronomical model: at 28.5°N the sun rises between 05:25
 * and 07:10 across the year, so a fixed schedule is wrong by minutes.
 */

export interface Daylight {
  /** 0 = fully dark, 1 = full daylight. */
  level: number;
  /** Warmth of the window light. Dawn and dusk are gold, midday is blue-white. */
  windowColor: string;
  /** Local glow around the opening itself. */
  windowIntensity: number;
  /** Direct sun, which is what actually casts the window patch. */
  sunColor: string;
  sunIntensity: number;
  /** Soft shadowless daylight arriving from the window's side of the room. */
  skyIntensity: number;
  /** The lamp comes up as the window falls away. */
  lampIntensity: number;
  /**
   * Bias strip and shelf spot. Deliberately not `1 - level`: nobody runs bias
   * lighting at half brightness at four o'clock, so this crosses over between
   * dusk and full dark and reads as a switch rather than a dimmer.
   */
  nightIntensity: number;
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

  // Colour isn't a function of level alone: dawn and dusk are both half lit and
  // both gold, where the hours between are blue-white.
  const midday = smoothstep(0, 1, 1 - Math.abs(h - (SUNRISE + SUNSET) / 2) / 5);
  const warm = mixHex(GOLDEN, NOON, midday);
  const windowColor = mixHex(NIGHT_BLUE, warm, level);

  const night = level < 0.12;

  return {
    level,
    windowColor,
    // Never zero: a pure-black window reads as a hole rather than as glass.
    windowIntensity: 0.1 + level * 2.4,
    // Shadow-casting, and separate from the sky fill because one light doing
    // both jobs is what made midday look like fog. The exponent front-loads it
    // so the sun arrives shortly after dawn.
    sunColor: mixHex(GOLDEN, "#fff2df", midday),
    sunIntensity: Math.pow(level, 0.75) * 3.4,
    // Daylight passing straight through a solid wall, which is wrong and useful:
    // directional so it still models what it touches, shadowless so it lifts the
    // room. Cranking the ambient instead produces a flat grey noon.
    skyIntensity: level * 1.75,
    lampIntensity: 0.5 + (1 - level) * 3.2,
    nightIntensity: 1 - smoothstep(0.06, 0.42, level),
    bounceColor: mixHex("#3a2c22", "#9fb6d6", level),
    // Low. Ambient adds to every surface whichever way it faces, so it is the
    // fastest way to flatten a render — contrast comes from the sun and the
    // lamp, and this only stops the unlit side going to pure black.
    bounceIntensity: 0.07 + level * 0.34,
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
