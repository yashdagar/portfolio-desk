"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary for the canvas.
 *
 * `ssr: false` is only legal inside a Client Component, and we need it because
 * three.js requires a real WebGL context. This wrapper is also where the
 * capability check lands later: when there's no WebGL, reduced motion is
 * requested, or the device is low-power, this returns the DOM fallback instead
 * of ever loading the ~500kb of three.js.
 */
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
});

export function SceneMount() {
  return <Scene />;
}
