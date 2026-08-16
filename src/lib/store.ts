"use client";

import { create } from "zustand";

import type { ScreenId } from "./layout";

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
  /**
   * Set once the visitor has focused anything.
   *
   * The only thing this drives is whether to keep showing the hint. A prompt
   * that stays up after you've clearly understood the interaction is nagging.
   */
  hasInteracted: boolean;
  /**
   * The escape hatch: read it as an ordinary page instead.
   *
   * Someone who wants the information and not the room should be one click away
   * from it, and shouldn't have to work out that the room is optional.
   */
  forceFlat: boolean;

  focusScreen: (id: ScreenId) => void;
  focusBox: (id: BoxId) => void;
  clearFocus: () => void;
  setReady: () => void;
  setForceFlat: (v: boolean) => void;
}

export const useScene = create<SceneState>((set) => ({
  focus: { kind: "none" },
  ready: false,
  hasInteracted: false,
  forceFlat: false,

  focusScreen: (id) =>
    set({ focus: { kind: "screen", id }, hasInteracted: true }),
  focusBox: (id) => set({ focus: { kind: "box", id }, hasInteracted: true }),
  clearFocus: () => set({ focus: { kind: "none" } }),
  setReady: () => set({ ready: true }),
  setForceFlat: (forceFlat) => set({ forceFlat }),
}));

/** Convenience selector — avoids re-rendering on unrelated state changes. */
export const useFocus = () => useScene((s) => s.focus);

/*
 * Expose the store for screenshot tooling in development.
 *
 * Driving focus through the real store rather than synthesising clicks at
 * guessed pixel coordinates means the captured frame is the same state a user
 * would reach, and the test doesn't silently start passing against empty space
 * when the layout moves.
 */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __scene: typeof useScene }).__scene = useScene;
}
