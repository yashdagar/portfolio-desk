/**
 * The chess set: a folding wooden board, shut.
 *
 * It was a printed cardboard box in the same idiom as the Catan one, and two
 * printed boxes side by side on a shelf is one object repeated. A chess set
 * isn't sold as a box anyway — the board *is* the box. It folds shut on its
 * hinge, the pieces live in the hollow, and the outside is the playing surface.
 * One wooden object next to one printed one gives the shelf two materials, and
 * it gives the chess project something the printed version never had: you can
 * tell what it is without reading it.
 *
 * The squares go on the *outside*, which is not artistic licence — a chess box
 * board is exactly that, and it's the only version that reads as chess from
 * across the room. A folding case with a plain lid is a wooden tray.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

/** Maple and walnut, which is what these are actually made of. */
const LIGHT = "#c8a878";
const DARK = "#513425";
/** The frame around the squares, a shade off the dark ones. */
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

/** Deterministic, so the board is the same board every reload. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Grain, drawn over whatever is already there.
 *
 * The one detail that separates wood from brown plastic, and it has to run in a
 * *direction*: real grain is parallel lines with occasional figure, and a
 * random speckle reads as noise on a surface rather than as the surface. Drawn
 * over the squares rather than under them, because on an inlaid board the grain
 * is in the veneer itself and crosses the joints.
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
 * The playing surface: eight by eight, in a frame.
 *
 * Board convention is load-bearing enough to be worth getting right — a light
 * square goes in the near-right corner, which is the one thing every chess
 * player checks without meaning to. `(file + rank) % 2` with the origin at the
 * top left gives exactly that.
 */
export function chessBoardTexture(): CanvasTexture {
  const S = 1024;
  const { canvas, ctx } = surface(S, S);

  ctx.fillStyle = FRAME;
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 3301, 0.09);

  /** The frame's width. Wide enough to carry the algebraic labels a real one has. */
  const inset = S * 0.105;
  const play = S - inset * 2;
  const cell = play / 8;

  // A hairline stringing inlay between the frame and the squares — two strips
  // of pale veneer, which is how these are actually edged and the detail that
  // makes the frame look joined rather than painted on.
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

  // Grain again, at half strength, running across the squares.
  grain(ctx, S, S, 8821, 0.05);

  /*
   * Algebraic notation around the frame, in a light stamped ink.
   *
   * Small enough to be texture rather than text at any distance the room ever
   * shows this at — but it's there, and it's the difference between a
   * chequered pattern and a chess board.
   */
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

  // Wear at the corners, where a case gets picked up.
  const wear = ctx.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.75);
  wear.addColorStop(0, "rgba(0,0,0,0)");
  wear.addColorStop(1, "rgba(20,10,4,0.3)");
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, S, S);

  return texture(canvas);
}

/**
 * The sides of the closed case.
 *
 * One texture for all four, and the whole job is the seam. A folding board shut
 * is two halves face to face, so there's a parting line running right around it
 * at exactly half its height — and that line is the entire reason the object
 * reads as *closed* rather than as a solid plank. Without it this is a block of
 * wood; with it, it's a box that opens.
 */
export function chessCaseSideTexture(): CanvasTexture {
  const W = 1024;
  const H = 256;
  const { canvas, ctx } = surface(W, H);

  ctx.fillStyle = "#4a2f20";
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H, 5507, 0.08);

  // The parting line: a dark groove with a lit lip on the lower half, because
  // light coming from above catches the top edge of the bottom shell.
  ctx.fillStyle = "rgba(12,6,2,0.92)";
  ctx.fillRect(0, H / 2 - 5, W, 9);
  ctx.fillStyle = "rgba(240,216,182,0.4)";
  ctx.fillRect(0, H / 2 + 4, W, 4);

  // Chamfers top and bottom, catching a line of light along the whole length.
  ctx.fillStyle = "rgba(240,214,178,0.16)";
  ctx.fillRect(0, 0, W, 7);
  ctx.fillStyle = "rgba(16,9,4,0.3)";
  ctx.fillRect(0, H - 7, W, 7);

  return texture(canvas);
}
