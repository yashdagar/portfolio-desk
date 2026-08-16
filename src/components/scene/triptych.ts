/**
 * One photograph, three frames. What makes three frames a triptych rather than
 * three pictures is the subject running *through* the gaps, so it's sliced by
 * texture offsets off a single canvas and the alignment is exact by
 * construction.
 *
 * Source: "White porsche 911 on white background" by Idzard Schiphof, via
 * Unsplash, used under the Unsplash License. See public/art/CREDITS.md.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

export const PANELS = 3;

/** Matches the asset exactly, so the photograph is never resampled twice. */
const W = 1800;
const H = 945;

const SRC = "/art/porsche-911.jpg";

const INK = "#15161a";

/** The frames are sized from this, so the car is never stretched. */
export const PANEL_ASPECT = W / PANELS / H;

/** A caption and a vignette, and no more. */
function overlay(ctx: CanvasRenderingContext2D) {
  // Bottom left, the one part of the frame with nothing in it — which also
  // keeps the caption inside the left panel rather than straddling a gap.
  const size = H * 0.032;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${size * 0.34}px`;
  ctx.fillText("911 CARRERA", W * 0.045, H * 0.935);
  ctx.letterSpacing = "0px";

  // Weak enough never to read as an effect: it only has to stop the corners
  // matching the highlight on the car, which flattens white-on-white.
  const vign = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.3,
    W / 2,
    H / 2,
    W * 0.62,
  );
  vign.addColorStop(0, "rgba(30,28,26,0)");
  vign.addColorStop(1, "rgba(30,28,26,0.16)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Drawn twice, because the photograph arrives asynchronously: once with the
 * paper and caption, again when the image lands. Awaiting it instead leaves
 * three black rectangles on the wall for the length of the decode.
 */
function triptychCanvas(onReady: () => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#e8e5df";
  ctx.fillRect(0, 0, W, H);
  overlay(ctx);

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, W, H);
    overlay(ctx);
    onReady();
  };
  img.src = SRC;

  return canvas;
}

/** One texture per frame, each showing its own third of the artwork. */
export function triptychPanels(): CanvasTexture[] {
  const textures: CanvasTexture[] = [];

  const canvas = triptychCanvas(() => {
    // All three share one canvas, and a CanvasTexture caches its upload.
    for (const t of textures) t.needsUpdate = true;
  });

  for (let i = 0; i < PANELS; i++) {
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    tex.minFilter = LinearFilter;
    tex.repeat.set(1 / PANELS, 1);
    tex.offset.set(i / PANELS, 0);
    textures.push(tex);
  }

  return textures;
}
