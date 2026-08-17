import { NextResponse } from "next/server";

import { GURUGRAM, readWeather, type Weather } from "@/lib/weather";

/**
 * Open-Meteo, because it needs no key and no account: a decorative lookup is not
 * worth a fourth secret sitting in an environment.
 *
 * Proxied rather than called from the browser, so the response is cached once
 * for everyone and an outage lands here as a null rather than as an unhandled
 * fetch in the render loop.
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
    // A null, not a 500: weather modifies a scene that works without it, so its
    // failure mode is "clear day".
    return NextResponse.json(null, {
      headers: { "cache-control": "public, max-age=120" },
    });
  }
}
