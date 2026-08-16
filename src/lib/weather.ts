import type { Daylight } from "./daylight";

/**
 * Real weather in Gurugram, applied to the room's light.
 *
 * The window was already the only part of the scene connected to the outside
 * world, and it was connected to a clock rather than to a sky — so a monsoon
 * afternoon rendered exactly like a clear one. This closes that: cloud cover
 * kills the hard sun patch and lifts the soft fill, rain puts streaks on the
 * glass, and haze eats the skyline.
 *
 * All of it is a *modifier*. The daylight model stands alone and the room lights
 * itself correctly with no weather at all, because a decorative API that can
 * fail must never be load-bearing.
 */

export const GURUGRAM = { lat: 28.4595, lon: 77.0266 } as const;

export type Condition =
  | "clear"
  | "cloudy"
  | "overcast"
  | "fog"
  | "rain"
  | "storm"
  | "snow";

export interface Weather {
  tempC: number;
  /** 0..1 */
  cloud: number;
  condition: Condition;
  /** Short human line for the HUD, e.g. "31° overcast". */
  label: string;
}

/**
 * WMO code to something the renderer can act on.
 *
 * Deliberately coarse. There are ninety-nine of these codes and the room can
 * express about five states, so the map collapses hard — "slight drizzle" and
 * "heavy rain" both mean water on the glass.
 */
function classify(code: number): Condition {
  if (code >= 95) return "storm";
  if (code >= 80) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 51 && code <= 67) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code === 3) return "overcast";
  if (code === 1 || code === 2) return "cloudy";
  return "clear";
}

const WORDS: Record<Condition, string> = {
  clear: "clear",
  cloudy: "part cloud",
  overcast: "overcast",
  fog: "haze",
  rain: "rain",
  storm: "storm",
  snow: "snow",
};

export function readWeather(
  current:
    | {
        temperature_2m?: number;
        weather_code?: number;
        cloud_cover?: number;
      }
    | undefined,
): Weather | null {
  if (!current || current.temperature_2m === undefined) return null;

  const condition = classify(current.weather_code ?? 0);
  const tempC = Math.round(current.temperature_2m);

  return {
    tempC,
    cloud: Math.min(1, Math.max(0, (current.cloud_cover ?? 0) / 100)),
    condition,
    label: `${tempC}° ${WORDS[condition]}`,
  };
}

/** True when there's water on the glass. */
export function isWet(w: Weather | null): boolean {
  return w?.condition === "rain" || w?.condition === "storm";
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    "#" +
    pa
      .map((v, i) => Math.round(v + (pb[i] - v) * t))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Flat grey-blue. What every colour in the sky collapses toward under cloud. */
const OVERCAST = "#9aa6b0";

/**
 * Apply weather to the daylight model.
 *
 * The important term is `sunIntensity`. It's the only shadow-caster outdoors,
 * so it alone owns whether there's a hard-edged window patch on the desk — and
 * the single most recognisable thing about an overcast day is that the patch is
 * gone. Cloud therefore hits it far harder than it hits anything else, and some
 * of what it takes is handed to the shadowless fill, because an overcast sky is
 * genuinely a brighter *diffuse* source than a clear one.
 */
export function withWeather(day: Daylight, w: Weather | null): Daylight {
  if (!w) return day;

  const wet = isWet(w);
  // Rain and fog are opaque regardless of what the cloud-cover number claims;
  // it reports the fraction of sky covered, not how thick the cover is.
  const cover = Math.min(
    1,
    Math.max(w.cloud, wet ? 0.95 : w.condition === "fog" ? 0.8 : 0),
  );

  return {
    ...day,
    // Direct sun collapses under cloud. Never quite to zero: even under thick
    // overcast there's a bright patch where the sun is, and killing it entirely
    // flattens the room the same way the old flat ambient did.
    sunIntensity: day.sunIntensity * (1 - cover * 0.92),
    // Some of it comes back as soft light from the whole sky.
    skyIntensity: day.skyIntensity * (1 + cover * 0.45),
    windowIntensity: day.windowIntensity * (1 - cover * 0.25),
    // Colour collapses toward flat grey-blue, and further under rain.
    windowColor: mixHex(day.windowColor, OVERCAST, cover * 0.7),
    sunColor: mixHex(day.sunColor, OVERCAST, cover * 0.5),
    bounceColor: mixHex(day.bounceColor, OVERCAST, cover * 0.4),
  };
}
