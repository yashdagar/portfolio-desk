"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { useScene } from "@/lib/store";
import {
  BUFFER,
  PIECE_COLOURS,
  VISIBLE,
  WIDTH,
  cells,
  ghostRow,
  type Game,
  type PieceKind,
} from "@/lib/tetris";
import { useTetris, useTetrisDriver, useTetrisKeys } from "@/lib/useTetris";

/**
 * The centre monitor: Tetris, on a 40" ultrawide.
 *
 * A 10 × 20 well is 1:2 and the panel is 2.37:1, which sounds like the worst
 * possible pairing until you notice the alternative. Splitting the game across
 * two monitors doesn't work here — `CameraRig` flies the camera in until the
 * focused panel fills the frame, so anything on a neighbouring screen is out of
 * shot exactly when you need it. Everything the player looks at has to be on
 * this one panel, and an ultrawide is the only one with room for all of it.
 *
 * Every piece of state is selected narrowly on purpose. The store ticks at
 * 60 Hz because gravity needs a clock, but `board` only changes when a piece
 * locks and `current` only when it moves, so nothing here re-renders on a frame
 * where nothing happened.
 */

/**
 * Pitch is CELL + GAP; the gap is the panel showing through, not a border.
 * Twenty rows at this size leaves a line's worth of room under the well, which
 * is where the prompt goes — over the board it covers the stack it is inviting
 * you to come and play with.
 */
const CELL = 29;
const GAP = 2;

const EMPTY = "rgba(255,255,255,0.04)";

function Cell({ colour, ghost }: { colour: string; ghost: boolean }) {
  return (
    <span
      className="rounded-chip"
      style={
        ghost
          ? {
              background: "transparent",
              boxShadow: `inset 0 0 0 2px ${colour}`,
            }
          : { background: colour }
      }
    />
  );
}

/**
 * The well. Memoised on the two things that can change it, because the parent
 * re-renders far more often than this needs to.
 */
const Well = memo(function Well({
  board,
  current,
}: {
  board: Game["board"];
  current: Game["current"];
}) {
  const { painted, ghosts, ghostColour } = useMemo(() => {
    // Only the visible rows: pieces spawn in a buffer above the well.
    const painted = board.slice(BUFFER * WIDTH);
    const ghosts = new Set<number>();

    if (current) {
      const landing = ghostRow(board, current);
      if (landing !== null) {
        for (const [row, col] of cells({ ...current, row: landing })) {
          if (row >= BUFFER) ghosts.add((row - BUFFER) * WIDTH + col);
        }
      }
      for (const [row, col] of cells(current)) {
        if (row >= BUFFER) painted[(row - BUFFER) * WIDTH + col] = current.kind;
      }
    }
    return {
      painted,
      ghosts,
      ghostColour: current ? PIECE_COLOURS[current.kind] : EMPTY,
    };
  }, [board, current]);

  return (
    <div
      className="grid rounded-card bg-screen p-2"
      style={{
        gridTemplateColumns: `repeat(${WIDTH}, ${CELL}px)`,
        gridTemplateRows: `repeat(${VISIBLE}, ${CELL}px)`,
        gap: GAP,
      }}
    >
      {painted.map((kind, i) => (
        <Cell
          key={i}
          ghost={!kind && ghosts.has(i)}
          colour={
            kind ? PIECE_COLOURS[kind] : ghosts.has(i) ? ghostColour : EMPTY
          }
        />
      ))}
    </div>
  );
});

/** A piece on its own, for the hold slot and the queue. Trimmed to its own
 *  bounding box so an I and an O both sit centred rather than top-left. */
function Mini({ kind, cell = 13 }: { kind: PieceKind; cell?: number }) {
  const shape = cells({ kind, rot: 0, row: 0, col: 0 });
  const rows = shape.map(([r]) => r);
  const cols = shape.map(([, c]) => c);
  const top = Math.min(...rows);
  const left = Math.min(...cols);
  const h = Math.max(...rows) - top + 1;
  const w = Math.max(...cols) - left + 1;
  const set = new Set(shape.map(([r, c]) => `${r - top},${c - left}`));

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${w}, ${cell}px)`,
        gridTemplateRows: `repeat(${h}, ${cell}px)`,
        gap: 2,
      }}
    >
      {Array.from({ length: w * h }, (_, i) => {
        const on = set.has(`${Math.floor(i / w)},${i % w}`);
        return (
          <span
            key={i}
            className="rounded-[3px]"
            style={{ background: on ? PIECE_COLOURS[kind] : "transparent" }}
          />
        );
      })}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </h3>
  );
}

function Slot({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-[74px] items-center justify-center rounded-row bg-screen-raised ${className}`}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="mt-1 font-mono text-[26px] leading-none text-ink tabular-nums">
        {value}
      </p>
    </div>
  );
}

/**
 * What's covering the board and why. The states are deliberately distinct:
 * "click the screen" and "press enter" are different instructions, and showing
 * the wrong one is the difference between a game and a picture of one.
 */
function Overlay({ interactive }: { interactive: boolean }) {
  const mode = useTetris((s) => s.mode);
  const score = useTetris((s) => s.game.score);
  const lines = useTetris((s) => s.game.lines);
  const initials = useTetris((s) => s.initials);

  // Attract mode is never covered. The bot playing behind it is the entire
  // reason the screen looks alive from across the room, and frosting it over to
  // advertise itself would be self-defeating — the prompt goes under the well.
  if (mode === "playing" || mode === "attract") return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card bg-screen/85 px-6 text-center backdrop-blur-[2px]">
      {mode === "over" ? (
        <>
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-del">
            Game over
          </p>
          <p className="font-mono text-[34px] leading-none text-ink tabular-nums">
            {score.toLocaleString("en-GB")}
          </p>
          <p className="font-mono text-[12px] text-ink-faint">{lines} rows</p>
          <div className="mt-2">
            <Label>Your initials</Label>
            <p className="mt-2 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`flex size-9 items-center justify-center rounded-chip font-mono text-[18px] ${
                    initials[i]
                      ? "bg-screen-hi text-ink"
                      : "bg-screen-raised text-ink-faint"
                  }`}
                >
                  {initials[i] ?? "·"}
                </span>
              ))}
            </p>
            <p className="mt-3 font-mono text-[11px] text-ink-faint">
              type, then ↵
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-accent">
            Paused
          </p>
          <p className="max-w-[260px] font-mono text-[12px] leading-relaxed text-ink-dim">
            {interactive
              ? "Press ↵ to carry on"
              : "Click this screen to carry on"}
          </p>
        </>
      )}
    </div>
  );
}

/** Chunky enough to hit with a thumb. Only rendered where there's no keyboard. */
function TouchPad() {
  // Actions off `getState` rather than a hook: subscribing to the store here
  // would re-render six buttons at 60 Hz to draw six characters that never
  // change.
  const pad: [string, string, () => void][] = [
    ["←", "Move left", () => useTetris.getState().left()],
    ["⟳", "Rotate", () => useTetris.getState().turn(1)],
    ["→", "Move right", () => useTetris.getState().right()],
    ["↓", "Soft drop", () => useTetris.getState().down()],
    ["⤓", "Hard drop", () => useTetris.getState().slam()],
    ["H", "Hold", () => useTetris.getState().swap()],
  ];
  return (
    <div className="mt-3 flex gap-2 md:hidden">
      {pad.map(([glyph, label, act]) => (
        <button
          key={label}
          onClick={act}
          aria-label={label}
          className="flex-1 rounded-row bg-screen-raised py-3 font-mono text-[13px] text-ink-dim active:bg-screen-hi"
        >
          {glyph}
        </button>
      ))}
    </div>
  );
}

const KEYS: [string, string][] = [
  ["← →", "move"],
  ["↑ / X", "rotate"],
  ["Z", "rotate back"],
  ["↓", "soft drop"],
  ["Space", "hard drop"],
  ["C", "hold"],
  ["Esc", "step back"],
];

export function Tetris({
  variant = "mounted",
}: {
  /** "flat" is the no-WebGL page, where there is no camera to focus a screen
   *  with — so the board arms itself on a click instead. */
  variant?: "mounted" | "flat";
}) {
  const focus = useScene((s) => s.focus);
  const [armed, setArmed] = useState(false);
  const interactive =
    variant === "flat"
      ? armed
      : focus.kind === "screen" && focus.id === "about";

  useTetrisDriver();
  useTetrisKeys(interactive);

  // After mount, or the server and the client disagree about a table that only
  // exists in this browser.
  useEffect(() => {
    useTetris.getState().loadScores();
  }, []);

  // The flat page has no camera to step back from, so Escape has to do it —
  // otherwise arming the board once means the arrow keys never scroll again.
  useEffect(() => {
    if (variant !== "flat" || !armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, armed]);

  const board = useTetris((s) => s.game.board);
  const current = useTetris((s) => s.game.current);
  const score = useTetris((s) => s.game.score);
  const level = useTetris((s) => s.game.level);
  const lines = useTetris((s) => s.game.lines);
  const heldPiece = useTetris((s) => s.game.hold);
  const queue = useTetris((s) => s.game.queue);
  const scores = useTetris((s) => s.scores);
  const mode = useTetris((s) => s.mode);

  return (
    /*
      Two elements, and it has to be two: `@container` sets up the query for a
      element's *descendants*, never for itself, so the layout can't live on the
      same node that declares the container. Put it there and the rails lay
      themselves out a thousand pixels off-screen while every child's own query
      works perfectly, which is a confusing way to find out.
    */
    <div
      className="@container h-full w-full overflow-hidden bg-screen bg-[radial-gradient(110%_80%_at_50%_0%,#151a1e_0%,transparent_70%)] font-sans text-ink-dim"
      onClick={variant === "flat" ? () => setArmed(true) : undefined}
    >
      {/*
        Five columns on the ultrawide it was designed for; below that the rails
        fold under the board. A container query, not a media query — mounted in
        the room this DOM sits on a plane at a fixed 1720px and the viewport
        tells it nothing. The wide layout is the default and the narrow one
        overrides it, so the panel in the room never waits on a query.
      */}
      <div className="grid h-full w-full grid-cols-[1fr_192px_auto_192px_1fr] items-center gap-8 px-9 py-6 @max-[1180px]:flex @max-[1180px]:h-auto @max-[1180px]:flex-col @max-[1180px]:items-center @max-[1180px]:gap-5 @max-[1180px]:px-4">
        {/* Leaderboard. First on the ultrawide, last when it has to queue up. */}
        <section className="flex h-full w-full max-w-[300px] flex-col justify-center gap-6 justify-self-end @max-[1180px]:order-5 @max-[1180px]:h-auto @max-[1180px]:max-w-[334px]">
          <div>
            <p className="font-mono text-[15px] uppercase tracking-[0.42em] text-accent">
              Tetris
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {mode === "attract" ? "demo playing" : "in play"}
            </p>
          </div>
          <div>
            <Label>High scores</Label>
            {scores.length ? (
              <ol className="mt-3 space-y-1.5">
                {scores.map((s, i) => (
                  <li
                    key={`${s.name}-${i}`}
                    className="flex items-baseline gap-3 rounded-row bg-screen-raised px-3 py-1.5 font-mono text-[13px] tabular-nums"
                  >
                    <span className="text-ink-faint">{i + 1}</span>
                    <span className="text-ink">{s.name}</span>
                    <span className="ml-auto text-ink-dim">
                      {s.score.toLocaleString("en-GB")}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 rounded-row bg-screen-raised px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-faint">
                Nobody has played yet. The table is yours alone — it lives in
                this browser and goes nowhere.
              </p>
            )}
          </div>
        </section>

        {/* Hold and the two counters that change often enough to watch. */}
        <section className="flex flex-col gap-3 @max-[1180px]:order-2 @max-[1180px]:w-full @max-[1180px]:max-w-[334px] @max-[1180px]:flex-row @max-[1180px]:items-end @max-[1180px]:justify-between">
          <div className="@max-[1180px]:w-[92px]">
            <Label>Hold</Label>
            <div className="mt-2">
              <Slot className="@max-[1180px]:h-[58px]">
                {heldPiece ? <Mini kind={heldPiece} /> : null}
              </Slot>
            </div>
          </div>
          <Stat label="Level" value={level} />
          <Stat label="Rows" value={lines} />
        </section>

        {/* The well */}
        <section className="relative @max-[1180px]:order-1">
          <div
            role="img"
            aria-label={`Tetris. Score ${score}, level ${level}, ${lines} rows cleared.`}
          >
            <Well board={board} current={current} />
          </div>
          <Overlay interactive={interactive} />
          {/* Fixed height whether or not there's anything to say, so starting a
            game doesn't shift the board up by a line. */}
          <p className="flex h-7 items-center justify-center font-mono text-[12px] text-ink-faint">
            {mode === "attract" &&
              (interactive ? "press ↵ to play" : "click this screen to play")}
          </p>
          {variant === "flat" && <TouchPad />}
        </section>

        {/* Queue. Five deep is the guideline; the last two go when space does. */}
        <section className="@max-[1180px]:order-3 @max-[1180px]:w-full @max-[1180px]:max-w-[334px]">
          <Label>Next</Label>
          <div className="mt-2 flex flex-col gap-2 @max-[1180px]:flex-row">
            {queue.slice(0, 5).map((kind, i) => (
              <Slot
                key={`${kind}-${i}`}
                className="@max-[1180px]:h-[58px] @max-[1180px]:flex-1"
              >
                <Mini kind={kind} cell={i === 0 ? 13 : 10} />
              </Slot>
            ))}
          </div>
        </section>

        {/* Score and controls */}
        <section className="flex h-full w-full max-w-[300px] flex-col justify-center gap-7 @max-[1180px]:order-4 @max-[1180px]:h-auto @max-[1180px]:max-w-[334px]">
          <div>
            <Label>Score</Label>
            <p className="mt-1 font-mono text-[42px] leading-none text-ink tabular-nums">
              {score.toLocaleString("en-GB")}
            </p>
          </div>
          <div>
            <Label>Controls</Label>
            {/* Filled rows, like the leaderboard opposite. Two outer columns of
              the same weight is what keeps the board looking centred rather
              than shoved left by a heavier neighbour. */}
            <dl className="mt-3 space-y-1.5 font-mono text-[12px]">
              {KEYS.map(([key, what]) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-row bg-screen-raised px-3 py-1.5"
                >
                  <dt className="min-w-[58px] text-ink-dim">{key}</dt>
                  <dd className="ml-auto text-ink-faint">{what}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
