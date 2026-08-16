/**
 * A folding wooden board, shut: the board *is* the box, the pieces live in the
 * hollow, and the squares go on the outside — which is what a real chess case
 * does and the only version that reads as chess from across the room.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

const LIGHT = "#c8a878";
const DARK = "#513425";
const FRAME = "#3f2719";

function surface(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

/** Deterministic, so it's the same board every reload. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Grain has to run in a *direction* — a random speckle reads as noise on a
 * surface rather than as the surface. Drawn over the squares rather than under,
 * because on an inlaid board the grain is in the veneer and crosses the joints.
 */
function grain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  strength = 0.055,
) {
  const rand = rng(seed);
  ctx.save();
  ctx.lineWidth = 1.4;

  for (let i = 0; i < 220; i++) {
    const y = rand() * h;
    const wobble = 3 + rand() * 9;
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? "255,244,226" : "26,15,8"},${
      strength * (0.4 + rand() * 0.8)
    })`;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 26) {
      const yy = y + Math.sin(x / 90 + i) * wobble;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A light square goes in the near-right corner, which every chess player checks
 * without meaning to. `(file + rank) % 2` from the top left gives that.
 */
export function chessBoardTexture(): CanvasTexture {
  const S = 1024;
  const { canvas, ctx } = surface(S, S);

  ctx.fillStyle = FRAME;
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 3301, 0.09);

  /** Wide enough to carry the algebraic labels. */
  const inset = S * 0.105;
  const play = S - inset * 2;
  const cell = play / 8;

  // Stringing inlay, which makes the frame look joined rather than painted on.
  ctx.strokeStyle = "rgba(226,204,168,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(inset - 9, inset - 9, play + 18, play + 18);
  ctx.strokeStyle = "rgba(30,18,10,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(inset - 4, inset - 4, play + 8, play + 8);

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      ctx.fillStyle = (file + rank) % 2 === 0 ? LIGHT : DARK;
      ctx.fillRect(inset + file * cell, inset + rank * cell, cell, cell);
    }
  }

  grain(ctx, S, S, 8821, 0.05);

  // Texture rather than text at this distance, but it's the difference between
  // a chequered pattern and a chess board.
  ctx.fillStyle = "rgba(226,204,168,0.5)";
  ctx.font = `600 ${cell * 0.3}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 8; i++) {
    const file = "abcdefgh"[i];
    const rank = String(8 - i);
    const at = inset + i * cell + cell / 2;
    ctx.fillText(file, at, S - inset / 2);
    ctx.fillText(file, at, inset / 2);
    ctx.fillText(rank, inset / 2, at);
    ctx.fillText(rank, S - inset / 2, at);
  }

  const wear = ctx.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.75);
  wear.addColorStop(0, "rgba(0,0,0,0)");
  wear.addColorStop(1, "rgba(20,10,4,0.3)");
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, S, S);

  return texture(canvas);
}

/**
 * One texture for all four sides, and the whole job is the parting line at half
 * height. Without it this is a block of wood; with it, a box that opens.
 */
export function chessCaseSideTexture(): CanvasTexture {
  const W = 1024;
  const H = 256;
  const { canvas, ctx } = surface(W, H);

  ctx.fillStyle = "#4a2f20";
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H, 5507, 0.08);

  // A dark groove with a lit lip below it, where light from above catches the
  // top edge of the bottom shell.
  ctx.fillStyle = "rgba(12,6,2,0.92)";
  ctx.fillRect(0, H / 2 - 5, W, 9);
  ctx.fillStyle = "rgba(240,216,182,0.4)";
  ctx.fillRect(0, H / 2 + 4, W, 4);

  ctx.fillStyle = "rgba(240,214,178,0.16)";
  ctx.fillRect(0, 0, W, 7);
  ctx.fillStyle = "rgba(16,9,4,0.3)";
  ctx.fillRect(0, H - 7, W, 7);

  return texture(canvas);
}
