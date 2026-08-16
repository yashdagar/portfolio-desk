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
 * Decide how much of the 3D to serve.
 *
 * Deliberately conservative. The site's job is to communicate, and a scene that
 * stutters or never loads communicates worse than a page — so anything that
 * suggests the device or the visitor won't enjoy it drops a tier rather than
 * gambling.
 *
 * Runs only on the client: none of these signals exist during SSR, and guessing
 * during render produces a hydration mismatch on top of a wrong answer.
 */
export function useCapabilities(): Capabilities {
  const [caps, setCaps] = useState<Capabilities>({ mode: "flat", ready: false });

  useEffect(() => {
    setCaps({ mode: decide(), ready: true });
  }, []);

  return caps;
}

function decide(): Mode {
  // Someone who asked the OS for less motion should not be handed a room that
  // drifts, damps and blooms.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "flat";

  if (!hasWebGL()) return "flat";

  // Very low core counts are the best cheap proxy for a device that will render
  // this at single-digit frame rates.
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 2) return "flat";

  /*
   * A coarse pointer means there's no hover and no mouse-look, which are the
   * two things the seated camera is built around. Rather than invent a touch
   * control scheme that nobody asked for, phones get the room as a hero image
   * and the content as ordinary scrollable DOM — which is what a phone is good
   * at, and what a recruiter on a train actually wants.
   */
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
