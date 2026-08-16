/**
 * Artwork for the framed print on the left-hand wall.
 *
 * It existed as blank paper first, and a blank rectangle inside a dark frame
 * reads as a hole in the wall rather than as a picture — especially on the side
 * of the room the lamp is behind, where the paper never catches enough light to
 * declare itself as a surface.
 *
 * Drawn to the same constraint the game boxes have: it sits a metre and a half
 * away at the edge of frame, so it gets one strong shape and nothing that needs
 * to be resolved. The Porsche print that used to live beside it has grown into
 * a triptych and moved to the wall that could hold it — see triptych.ts.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

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

/**
 * The small one: a contour field.
 *
 * Chosen because nested lines read as texture at any distance — it never
 * collapses into a flat patch the way a figurative image would.
 */
export function contourPrint(): CanvasTexture {
  const W = 380;
  const H = 476;
  const { canvas, ctx } = surface(W, H);

  ctx.fillStyle = "#1e2a30";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#7fa8a4";
  ctx.lineWidth = W * 0.008;

  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    ctx.globalAlpha = 0.25 + t * 0.55;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      // Two incommensurate waves, phase-shifted per line, so the contours
      // wander rather than sitting parallel.
      const y =
        H * 0.16 +
        t * H * 0.7 +
        Math.sin(x / 46 + i * 0.7) * (10 + i * 1.6) +
        Math.sin(x / 19 + i * 1.9) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return texture(canvas);
}
