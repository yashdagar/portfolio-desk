/**
 * What you can see out of the window.
 *
 * It was a flat rectangle of colour, and at the size it occupies — roughly a
 * fifth of the frame — a flat rectangle doesn't read as a window. It reads as a
 * light box, because a light box is exactly what it was.
 *
 * The fix is not detail. Anything sharp out there pulls the eye straight out of
 * the room, which is the opposite of what the window is for. What's needed is
 * *depth*: a gradient, a haze layer, and a skyline soft enough to sit behind the
 * glass rather than in front of it. Three flat bands at low contrast, and the
 * opening starts reading as distance.
 *
 * Drawn in greyscale and multiplied by the daylight colour at render time, so
 * one texture covers dawn, noon and midnight instead of three.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

const W = 512;
const H = 740;

function surface() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
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
 * Deterministic pseudo-random.
 *
 * A seeded generator rather than Math.random, so the skyline is the same
 * building every reload. A city that silently rearranges itself between visits
 * is the kind of thing nobody consciously notices and everybody feels.
 */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const HORIZON = H * 0.7;

export function outsideTexture(): CanvasTexture {
  const { canvas, ctx } = surface();

  // Sky: brightest at the top, hazing out toward the horizon. Multiplied by the
  // daylight colour later, so this is purely the luminance ramp.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#ffffff");
  sky.addColorStop(0.62, "#f2f4f6");
  sky.addColorStop(1, "#d8dee2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);

  // Middle distance: a wash of ground, lower and duller than the sky.
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, "#bcc2c4");
  ground.addColorStop(1, "#8f9698");
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // Skyline, in two passes. The far rank sits lighter and higher, the near rank
  // darker and lower — which is the only cue doing the work here, since neither
  // has any detail at all.
  const ranks = [
    { alpha: 0.16, base: HORIZON + 8, min: 60, max: 150, step: 46 },
    { alpha: 0.3, base: HORIZON + 30, min: 34, max: 96, step: 62 },
  ];

  for (const [i, rank] of ranks.entries()) {
    const rand = rng(9007 + i * 331);
    ctx.fillStyle = `rgba(40,48,54,${rank.alpha})`;
    for (let x = -20; x < W + 20; x += rank.step * (0.7 + rand() * 0.6)) {
      const w = rank.step * (0.55 + rand() * 0.7);
      const h = rank.min + rand() * (rank.max - rank.min);
      ctx.fillRect(x, rank.base - h, w, h + 40);
    }
  }

  // Haze band sitting across the base of the skyline, which is what stops the
  // buildings looking like they're standing in the room.
  const haze = ctx.createLinearGradient(0, HORIZON - 70, 0, HORIZON + 40);
  haze.addColorStop(0, "rgba(255,255,255,0)");
  haze.addColorStop(0.6, "rgba(255,255,255,0.55)");
  haze.addColorStop(1, "rgba(255,255,255,0.15)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, HORIZON - 70, W, 110);

  return texture(canvas);
}

/**
 * The same skyline with its lights on.
 *
 * A separate transparent layer faded in as the daylight goes, because the base
 * texture is multiplied by the sky colour and anything drawn into it can only
 * ever be darker than the sky. Lit windows have to be added, not multiplied.
 */
export function nightLightsTexture(): CanvasTexture {
  const { canvas, ctx } = surface();
  const rand = rng(4211);

  for (let i = 0; i < 190; i++) {
    const x = rand() * W;
    const y = HORIZON - rand() * 150 + 20;
    if (y > HORIZON + 30) continue;
    ctx.globalAlpha = 0.25 + rand() * 0.6;
    ctx.fillStyle = rand() > 0.75 ? "#ffd9a0" : "#ffeccd";
    ctx.fillRect(x, y, 2.5 + rand() * 3, 2.5 + rand() * 2);
  }

  // A couple of streetlights below the skyline, warmer and softer.
  for (let i = 0; i < 7; i++) {
    const x = rand() * W;
    const y = HORIZON + 30 + rand() * 60;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 22);
    glow.addColorStop(0, "rgba(255,196,120,0.75)");
    glow.addColorStop(1, "rgba(255,196,120,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  return texture(canvas);
}
