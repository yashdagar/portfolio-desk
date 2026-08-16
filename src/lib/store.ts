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
  /**
   * Which stop the lamp's dimmer is on: an index into `LAMP_LEVELS`.
   *
   * Scene state rather than a prop threaded from Room to Scene, because the two
   * halves of "the lamp is on" live in different trees — the light itself is in
   * the lighting rig and the glowing strip is in the lamp model, and the click
   * target is a third thing again. Anything that has to stay in step across
   * three places belongs in the store.
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
  /*
   * `hasInteracted` too, deliberately.
   *
   * The hint in the corner asks the visitor to click something, and a visitor
   * who has just discovered that the lamp is a switch has answered it — leaving
   * the prompt up after that is the nagging the flag exists to prevent.
   */
  cycleLamp: () =>
    set((s) => ({
      lampStep: (s.lampStep + 1) % LAMP_LEVELS.length,
      hasInteracted: true,
    })),
}));

/** Convenience selector — avoids re-rendering on unrelated state changes. */
export const useFocus = () => useScene((s) => s.focus);

/** How bright the lamp is asked to be right now, as a multiplier. */
export const useLampLevel = () => useScene((s) => LAMP_LEVELS[s.lampStep]);

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
