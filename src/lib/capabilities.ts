"use client";

import { useEffect, useState } from "react";

export type Mode =
  /** Full interactive scene. */
  | "scene"
  /** A non-interactive hero render, with the content below it as DOM. */
  | "hero"
  /** No canvas at all. */
  | "flat";

export interface Capabilities {
  mode: Mode;
  /** Null until measured on the client. */
  ready: boolean;
}

/**
 * Deliberately conservative: a scene that stutters communicates worse than a
 * page, so anything suggesting the device won't manage it drops a tier.
 *
 * Client-only — none of these signals exist during SSR, and guessing produces a
 * hydration mismatch on top of a wrong answer.
 */
export function useCapabilities(): Capabilities {
  const [caps, setCaps] = useState<Capabilities>({ mode: "flat", ready: false });

  useEffect(() => {
    setCaps({ mode: decide(), ready: true });
  }, []);

  return caps;
}

function decide(): Mode {
  // Someone who asked for less motion shouldn't get a room that drifts and blooms.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "flat";

  if (!hasWebGL()) return "flat";

  // The best cheap proxy for single-digit frame rates.
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 2) return "flat";

  // No hover and no mouse-look, which the seated camera is built around. Rather
  // than invent a touch scheme, phones get the room as a hero image and the
  // content as ordinary scrollable DOM.
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  if (coarse || narrow) return "hero";

  return "scene";
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}
