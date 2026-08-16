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

  focusScreen: (id: ScreenId) => void;
  focusBox: (id: BoxId) => void;
  clearFocus: () => void;
  setReady: () => void;
}

export const useScene = create<SceneState>((set) => ({
  focus: { kind: "none" },
  ready: false,

  focusScreen: (id) => set({ focus: { kind: "screen", id } }),
  focusBox: (id) => set({ focus: { kind: "box", id } }),
  clearFocus: () => set({ focus: { kind: "none" } }),
  setReady: () => set({ ready: true }),
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
