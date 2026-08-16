/**
 * The Porsche triptych: one photograph, three frames.
 *
 * The picture used to be drawn here — a 911 built out of bezier curves, which
 * was a decent silhouette and unmistakably an illustration. It's a real
 * photograph now: a 991 Carrera on a white cyclorama, shot side-on and cropped
 * to a wide band.
 *
 * The photograph earns the triptych in a way the drawing couldn't. What makes
 * three frames a triptych rather than three pictures is the subject running
 * *through* the gaps, and a real car has continuous detail — a shut line, a
 * tyre wall, a reflection running along a flank — crossing every cut. Sliced by
 * texture offsets off a single canvas, the alignment is exact by construction:
 * the rear bumper lands in the left frame, the wheel and ducktail in the
 * middle, the door and roofline in the right.
 *
 * Source: "White porsche 911 on white background" by Idzard Schiphof, via
 * Unsplash, used under the Unsplash License. See public/art/CREDITS.md.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

/** Three panels wide. The gaps between frames are physical, not in the art. */
export const PANELS = 3;

/** Matches the asset exactly, so the photograph is never resampled twice. */
const W = 1800;
const H = 945;

const SRC = "/art/porsche-911.jpg";

const INK = "#15161a";

/**
 * One panel's aspect. The frames are sized from this rather than the other way
 * round, so the car is never stretched however the physical panels are tuned.
 */
export const PANEL_ASPECT = W / PANELS / H;

/**
 * Everything drawn on top of the photograph.
 *
 * Two marks and no more. A caption, because a print of a car with no caption is
 * a screenshot; and a vignette, because the studio background is very nearly
 * paper white and against a dark wall an unmodified frame of it reads as a lit
 * panel rather than as paper.
 */
function overlay(ctx: CanvasRenderingContext2D) {
  /*
   * Caption, in the empty floor at bottom left.
   *
   * That corner is the one part of the frame with nothing in it — the car
   * starts about a fifth of the way across — so it's where a printer would set
   * the type, and it keeps the caption inside the left panel instead of
   * straddling a gap. Small, wide-tracked, and the same near-black as the
   * tyres, so it belongs to the picture rather than sitting on it.
   */
  const size = H * 0.032;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${size * 0.34}px`;
  ctx.fillText("911 CARRERA", W * 0.045, H * 0.935);
  ctx.letterSpacing = "0px";

  /*
   * Vignette, from the corners in.
   *
   * Weak enough that it never reads as an effect. All it has to do is stop the
   * outermost few centimetres of each panel being the same value as the
   * highlight on the car, which is what flattens a white-on-white photograph
   * when it's small in frame.
   */
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
 * One canvas holding the whole artwork, sliced into panels at render time.
 *
 * The photograph arrives asynchronously, so the canvas is drawn twice: once
 * immediately with the paper and the caption, and again when the image lands.
 * The alternative — making this async and awaiting it in the component — would
 * leave three black rectangles hanging on the wall for however long the decode
 * takes, which is the one thing worse than a plain paper panel.
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
    // The three textures share one canvas, so all three have to be told the
    // pixels moved — a CanvasTexture caches its upload and will happily keep
    // showing the blank paper otherwise.
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
