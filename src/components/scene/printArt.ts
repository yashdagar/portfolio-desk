/**
 * Artwork for the two framed prints on the left-hand wall.
 *
 * They existed as blank paper first, and a blank rectangle inside a dark frame
 * reads as a hole in the wall rather than as a picture — especially on the side
 * of the room the lamp is behind, where the paper never catches enough light to
 * declare itself as a surface.
 *
 * Both are drawn to fit the same constraint the game boxes have: they sit a
 * metre and a half away at the edge of frame, so they get one strong shape each
 * and nothing that needs to be resolved. Colours come out of the room's own
 * palette rather than being decorative, because two saturated posters would
 * immediately become the brightest thing in a deliberately restrained frame.
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
 * The large one: an arc rising out of a horizon.
 *
 * Two flat fields and one circle. It's the simplest composition that still has
 * a subject, and at the size it's actually seen that's the entire budget.
 */
export function arcPrint(): CanvasTexture {
  const W = 512;
  const H = 690;
  const { canvas, ctx } = surface(W, H);

  ctx.fillStyle = "#e6ddcd";
  ctx.fillRect(0, 0, W, H);

  const horizon = H * 0.68;

  ctx.fillStyle = "#c2643f";
  ctx.beginPath();
  ctx.arc(W * 0.5, horizon, W * 0.29, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2f4a52";
  ctx.fillRect(0, horizon, W, H - horizon);

  // A single band across the sun, the way a screen-printed poster registers
  // slightly off and leaves a lighter stripe.
  ctx.fillStyle = "rgba(230,221,205,0.34)";
  ctx.fillRect(0, horizon - W * 0.12, W, W * 0.035);

  ctx.fillStyle = "#e6ddcd";
  ctx.font = `500 ${W * 0.042}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${W * 0.02}px`;
  ctx.textAlign = "center";
  ctx.fillText("GURUGRAM", W / 2, horizon + (H - horizon) * 0.46);
  ctx.letterSpacing = "0px";

  return texture(canvas);
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
