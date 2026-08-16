import { NextResponse } from "next/server";

import { GURUGRAM, readWeather, type Weather } from "@/lib/weather";

/**
 * The weather in Gurugram.
 *
 * Open-Meteo, because it needs no key and no account — which matters more than
 * it sounds. Every other live source in this project costs a secret sitting in
 * an environment somewhere, and a decorative weather lookup is not worth adding
 * a fourth one.
 *
 * Proxied rather than called from the browser so the response is cached once
 * for everyone instead of once per visitor, and so a rate limit or an outage
 * lands here as a null rather than as an unhandled fetch in the render loop.
 */
const URL_ =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${GURUGRAM.lat}&longitude=${GURUGRAM.lon}` +
  "&current=temperature_2m,weather_code,cloud_cover,is_day,wind_speed_10m" +
  "&timezone=Asia%2FKolkata";

export async function GET() {
  try {
    const res = await fetch(URL_, {
      // Weather moves slowly and the room reads it as light, not as a forecast.
      // Fifteen minutes is far finer than anything visible on screen.
      next: { revalidate: 900 },
    });
    if (!res.ok) throw new Error(String(res.status));

    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        cloud_cover?: number;
        is_day?: number;
        wind_speed_10m?: number;
      };
    };

    const weather = readWeather(json.current);
    if (!weather) throw new Error("no current block");

    return NextResponse.json<Weather>(weather, {
      headers: { "cache-control": "public, max-age=600" },
    });
  } catch {
    /*
     * A null, not a 500.
     *
     * The room has to light itself whether or not anyone can tell it what the
     * sky is doing, and it already knows the time. Weather is a modifier on a
     * scene that works without it, so its failure mode is "clear day", not
     * "broken screen".
     */
    return NextResponse.json(null, {
      headers: { "cache-control": "public, max-age=120" },
    });
  }
}
