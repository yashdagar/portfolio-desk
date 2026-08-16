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
   * The room's own lights: the bias strip behind the monitors and the spot over
   * the shelf. 0 through the day, 1 once it's properly dark.
   *
   * Deliberately not `1 - level`. The lamp fades in gradually because a desk
   * lamp genuinely does get switched on early on a grey afternoon, but nobody
   * runs bias lighting at half brightness at four o'clock — these go on when it
   * gets dark and are off before that. A ramp that crosses over between dusk
   * and full dark is what reads as a switch rather than as a dimmer.
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
    windowIntensity: 0.1 + level * 2.4,
    /*
     * Direct sun.
     *
     * Separate from the sky fill above because they do completely different
     * jobs: this one is shadow-casting and has to punch through a 90 cm opening
     * hard enough to lay a bright, clearly-edged patch on the floor, while the
     * fill is a shadowless wash that stops the far side of everything going
     * black. Running one light for both is what made midday look like fog.
     *
     * The exponent front-loads it, so the sun arrives shortly after dawn rather
     * than easing in over four hours the way a linear ramp would.
     */
    sunColor: mixHex(GOLDEN, "#fff2df", midday),
    sunIntensity: Math.pow(level, 0.75) * 3.4,
    /*
     * Sky.
     *
     * Physically this is daylight passing straight through a solid wall, which
     * is wrong and is exactly what makes it useful: it's directional, so it
     * still models everything it touches, but it's shadowless, so it lifts the
     * whole room the way a large bright opening actually does. The alternative
     * — cranking the ambient until midday is bright enough — is what produced
     * the flat grey noon this replaced.
     */
    skyIntensity: level * 1.75,
    // The lamp fades in as daylight goes, and stays on a little into the
    // morning the way a real one does before anyone thinks to switch it off.
    lampIntensity: 0.5 + (1 - level) * 3.2,
    nightIntensity: 1 - smoothstep(0.06, 0.42, level),
    bounceColor: mixHex("#3a2c22", "#9fb6d6", level),
    /*
     * Bounce, feeding a hemisphere light rather than a flat ambient.
     *
     * Much lower than it used to be. Ambient is the one term that adds value to
     * every surface no matter which way it faces, so it is also the fastest way
     * to destroy a render — the old 0.43 at noon was lifting the shadows until
     * nothing in the frame had any shape left. Contrast has to come from the sun
     * and the lamp; this only stops the unlit side going to pure black.
     */
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
