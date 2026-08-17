"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

import {
  createGame,
  hardDrop,
  hold,
  move,
  rotate,
  softDrop,
  tick,
  type Game,
} from "./tetris";
import { bestPlacement, type Placement } from "./tetris.bot";

/**
 * The clock, the keyboard and the high scores — everything the engine refuses
 * to know about.
 *
 * Split this way because `tetris.ts` is worth testing and none of this is: a
 * game loop and a key binding are verified by playing them, and pretending
 * otherwise means mocking a browser to assert that a timer counts.
 */

/**
 * Fixed, so the server and the first client render agree. A random opening
 * board is a hydration mismatch, and the visitor sees this seed for about a
 * second before the bot starts making its own decisions anyway.
 */
const INITIAL_SEED = 0x5eed;

/**
 * Delay before a held direction starts repeating, then the gap between
 * repeats. Without auto-shift the game feels broken however correct the engine
 * is — you cannot cross the board in time and you blame the game, not the key.
 */
const DAS = 140;
const ARR = 40;
const SOFT_REPEAT = 45;

/** One bot action per this many milliseconds, so attract mode reads as a hand
 *  moving a piece rather than pieces teleporting into place. */
const BOT_STEP = 70;

export type Mode = "attract" | "playing" | "paused" | "over";

export interface HighScore {
  name: string;
  score: number;
  lines: number;
}

const SCORES_KEY = "desk:tetris:scores";
const KEPT_SCORES = 5;

function readScores(): HighScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is HighScore =>
          !!s && typeof s.name === "string" && typeof s.score === "number",
      )
      .slice(0, KEPT_SCORES);
  } catch {
    // A corrupt or blocked localStorage is not worth a broken screen.
    return [];
  }
}

function writeScores(scores: HighScore[]) {
  try {
    window.localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch {
    // Private browsing. The board still works; the table just won't persist.
  }
}

interface TetrisState {
  game: Game;
  mode: Mode;
  scores: HighScore[];
  /** Three characters, arcade-style, while `mode` is "over". */
  initials: string;
  /** What the bot is currently working toward, and its own step clock. */
  plan: Placement | null;
  botTimer: number;

  advance: (dt: number) => void;
  startGame: (seed: number) => void;
  pause: () => void;
  resume: () => void;
  toAttract: () => void;
  loadScores: () => void;
  typeInitial: (char: string) => void;
  backspace: () => void;
  submit: () => void;

  left: () => void;
  right: () => void;
  turn: (dir: 1 | -1) => void;
  down: () => void;
  slam: () => void;
  swap: () => void;
}

export const useTetris = create<TetrisState>((set, get) => ({
  game: createGame(INITIAL_SEED),
  mode: "attract",
  scores: [],
  initials: "",
  plan: null,
  botTimer: 0,

  advance: (dt) => {
    const { mode, game } = get();
    if (mode === "paused" || mode === "over") return;

    if (mode === "attract") {
      // The bot tops out eventually — it doesn't look ahead. Starting over is
      // more interesting to glance at than a frozen stack anyway.
      if (game.over) {
        set({ game: createGame((game.seed ^ game.score) | 0), plan: null });
        return;
      }
      set({ game: tick(game, dt) });
      if (get().botTimer >= BOT_STEP) stepBot();
      else set({ botTimer: get().botTimer + dt });
      return;
    }

    const next = tick(game, dt);
    set({ game: next });
    if (next.over) set({ mode: "over", initials: "" });
  },

  startGame: (seed) =>
    set({ game: createGame(seed), mode: "playing", plan: null, botTimer: 0 }),

  pause: () => set((s) => (s.mode === "playing" ? { mode: "paused" } : s)),
  resume: () => set((s) => (s.mode === "paused" ? { mode: "playing" } : s)),

  toAttract: () =>
    set({ game: createGame(INITIAL_SEED), mode: "attract", plan: null, initials: "" }),

  loadScores: () => set({ scores: readScores() }),

  typeInitial: (char) =>
    set((s) =>
      s.initials.length >= 3 ? s : { initials: s.initials + char.toUpperCase() },
    ),

  backspace: () => set((s) => ({ initials: s.initials.slice(0, -1) })),

  submit: () => {
    const { game, initials, scores } = get();
    const entry: HighScore = {
      name: (initials || "???").padEnd(3, "?").slice(0, 3),
      score: game.score,
      lines: game.lines,
    };
    const next = [...scores, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, KEPT_SCORES);
    writeScores(next);
    set({ scores: next });
    get().toAttract();
  },

  left: () => set((s) => (s.mode === "playing" ? { game: move(s.game, -1) } : s)),
  right: () => set((s) => (s.mode === "playing" ? { game: move(s.game, 1) } : s)),
  turn: (dir) => set((s) => (s.mode === "playing" ? { game: rotate(s.game, dir) } : s)),
  down: () => set((s) => (s.mode === "playing" ? { game: softDrop(s.game) } : s)),
  swap: () => set((s) => (s.mode === "playing" ? { game: hold(s.game) } : s)),
  slam: () =>
    set((s) => {
      if (s.mode !== "playing") return s;
      const game = hardDrop(s.game);
      return game.over ? { game, mode: "over" as Mode, initials: "" } : { game };
    }),
}));

// Same reason `store.ts` exposes `__scene`: a smoke test that reads the real
// game state can't pass by photographing a board that stopped responding.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __tetris: typeof useTetris }).__tetris = useTetris;
}

/**
 * One bot action: turn toward the target, then walk to its column, then drop.
 * Deliberately not applied all at once — the point of attract mode is that it
 * looks like someone is playing.
 */
function stepBot() {
  const set = useTetris.setState;
  const { game, plan: existing } = useTetris.getState();
  if (!game.current) return;

  const plan = existing ?? bestPlacement(game);
  if (!plan) {
    set({ botTimer: 0 });
    return;
  }

  if (game.current.rot !== plan.rot) {
    set({ game: rotate(game, 1), plan, botTimer: 0 });
    return;
  }
  if (game.current.col !== plan.col) {
    const dir = game.current.col < plan.col ? 1 : -1;
    const moved = move(game, dir);
    // Blocked on the way: the plan assumed a clear path, so re-plan next step.
    set({ game: moved, plan: moved === game ? null : plan, botTimer: 0 });
    return;
  }
  set({ game: hardDrop(game), plan: null, botTimer: 0 });
}

/**
 * Runs the clock. Mount once — a second copy would double every gravity step,
 * so later mounts sit out rather than fight over the same store.
 */
let driving = false;

export function useTetrisDriver() {
  useEffect(() => {
    if (driving) return;
    driving = true;

    let frame = 0;
    let last = performance.now();

    const loop = (now: number) => {
      // A backgrounded tab resumes with a delta measured in minutes, which
      // would drop a piece through the floor and clear the board on one frame.
      const dt = Math.min(now - last, 100);
      last = now;
      if (!document.hidden) {
        useTetris.getState().advance(dt);
        pump(dt);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const onHide = () => {
      last = performance.now();
      if (document.hidden) useTetris.getState().pause();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onHide);
      driving = false;
    };
  }, []);
}

/**
 * Held-key state. Not React state: it changes on hardware events at a rate
 * nothing renders at, and putting it in the store would re-render the board on
 * every keydown.
 */
const held = { dir: 0 as -1 | 0 | 1, das: 0, arr: 0, down: false, soft: 0 };

/** Auto-shift and soft-drop repeat, stepped by the same clock as gravity. */
function pump(dt: number) {
  const { mode } = useTetris.getState();
  if (mode !== "playing") return;

  if (held.dir !== 0) {
    held.das += dt;
    if (held.das >= DAS) {
      held.arr += dt;
      while (held.arr >= ARR) {
        held.arr -= ARR;
        const store = useTetris.getState();
        if (held.dir < 0) store.left();
        else store.right();
      }
    }
  }

  if (held.down) {
    held.soft += dt;
    while (held.soft >= SOFT_REPEAT) {
      held.soft -= SOFT_REPEAT;
      useTetris.getState().down();
    }
  }
}

const LETTER = /^[A-Za-z0-9]$/;

/**
 * Binds the keyboard while `active`.
 *
 * A window listener rather than a handler on the board, because an unfocused
 * screen is `inert` (see Surface.tsx) — its DOM cannot receive a key event at
 * all, so there is nothing to attach to until it's already too late.
 */
export function useTetrisKeys(active: boolean) {
  const wasActive = useRef(false);

  useEffect(() => {
    // Losing focus mid-game pauses rather than plays on without a player.
    if (wasActive.current && !active) useTetris.getState().pause();
    wasActive.current = active;

    if (!active) {
      held.dir = 0;
      held.down = false;
      return;
    }

    const onDown = (e: KeyboardEvent) => {
      const store = useTetris.getState();
      const { mode } = store;

      if (mode === "over") {
        if (e.key === "Enter") store.submit();
        else if (e.key === "Backspace") store.backspace();
        else if (LETTER.test(e.key)) store.typeInitial(e.key);
        else return;
        e.preventDefault();
        return;
      }

      if (mode === "attract" || mode === "paused") {
        if (e.key === "Enter" || e.key === " ") {
          // A fresh seed per game: the fixed one exists for hydration, not to
          // hand every visitor the same opening.
          if (mode === "paused") store.resume();
          else store.startGame(Date.now() | 0);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          held.dir = -1;
          held.das = 0;
          held.arr = 0;
          store.left();
          break;
        case "ArrowRight":
          held.dir = 1;
          held.das = 0;
          held.arr = 0;
          store.right();
          break;
        case "ArrowDown":
          held.down = true;
          held.soft = 0;
          store.down();
          break;
        case "ArrowUp":
        case "x":
        case "X":
          store.turn(1);
          break;
        case "z":
        case "Z":
        case "Control":
          store.turn(-1);
          break;
        case "c":
        case "C":
        case "Shift":
          store.swap();
          break;
        case " ":
          store.slam();
          break;
        case "p":
        case "P":
          store.pause();
          break;
        default:
          return;
      }
      // Only for keys we actually used: arrows and space scroll the flat page,
      // and swallowing every key would trap someone who just wants to leave.
      e.preventDefault();
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && held.dir === -1) held.dir = 0;
      if (e.key === "ArrowRight" && held.dir === 1) held.dir = 0;
      if (e.key === "ArrowDown") held.down = false;
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [active]);
}
