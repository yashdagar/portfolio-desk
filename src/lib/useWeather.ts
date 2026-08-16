"use client";

import { useEffect, useState } from "react";

import type { Weather } from "./weather";

/**
 * Poll the weather.
 *
 * Half an hour, which is twice the route's own cache window, so most calls are
 * a conditional hit on the CDN rather than anything reaching Open-Meteo.
 */
export function useWeather(intervalMs = 1_800_000) {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch("/api/weather");
        if (res.ok && alive) setWeather(await res.json());
      } catch {
        // Keep whatever we had. The room is already lit.
      }
      if (alive) timer = setTimeout(poll, intervalMs);
    };

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [intervalMs]);

  return weather;
}
