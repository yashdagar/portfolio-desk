"use client";

import { create } from "zustand";

import { LAMP_LEVELS, type ScreenId } from "./layout";

/** What the camera is currently attending to. */
export type Focus = { kind: "none" } | { kind: "screen"; id: ScreenId } | {
  kind: "box";
  id: BoxId;
};

export type BoxId = "catan" | "chess";

interface SceneState {
  focus: Focus;
  /** True once the first frame has been drawn, so the loader can retire. */
  ready: boolean;
  /** Drives whether to keep showing the hint. */
  hasInteracted: boolean;
  /** The escape hatch: read it as an ordinary page instead. */
  forceFlat: boolean;
  /**
   * An index into `LAMP_LEVELS`. In the store because the light, the glowing
   * strip and the click target live in three different trees.
   */
  lampStep: number;

  focusScreen: (id: ScreenId) => void;
  focusBox: (id: BoxId) => void;
  clearFocus: () => void;
  setReady: () => void;
  setForceFlat: (v: boolean) => void;
  cycleLamp: () => void;
}

export const useScene = create<SceneState>((set) => ({
  focus: { kind: "none" },
  ready: false,
  hasInteracted: false,
  forceFlat: false,
  lampStep: 0,

  focusScreen: (id) =>
    set({ focus: { kind: "screen", id }, hasInteracted: true }),
  focusBox: (id) => set({ focus: { kind: "box", id }, hasInteracted: true }),
  clearFocus: () => set({ focus: { kind: "none" } }),
  setReady: () => set({ ready: true }),
  setForceFlat: (forceFlat) => set({ forceFlat }),
  // `hasInteracted` too: the hint asks the visitor to click something, and
  // finding the lamp is a switch answers it.
  cycleLamp: () =>
    set((s) => ({
      lampStep: (s.lampStep + 1) % LAMP_LEVELS.length,
      hasInteracted: true,
    })),
}));

export const useFocus = () => useScene((s) => s.focus);

/** How bright the lamp is asked to be right now, as a multiplier. */
export const useLampLevel = () => useScene((s) => LAMP_LEVELS[s.lampStep]);

// For screenshot tooling: driving focus through the real store rather than
// clicks at guessed coordinates means the capture can't pass against empty space
// when the layout moves.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __scene: typeof useScene }).__scene = useScene;
}
