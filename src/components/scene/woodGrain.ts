/**
 * Procedural wood for the desk top.
 *
 * Convincing grain isn't stripes — it's a *field* of very slightly different
 * tones with occasional strong lines through it. Three passes: a broad tonal
 * wander, hundreds of faint fibres, and a few dark cathedral figures.
 */

import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from "three";

/** Matches the desk's own aspect, so the grain isn't stretched across it. */
const W = 2048;
const H = 728;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function woodTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const rand = rng(20260816);

  // Base, with a slow gradient across the width — a solid top is glued up from
  // several boards and no two of them are the same colour.
  ctx.fillStyle = "#6b4a33";
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 5; i++) {
    const y = (i / 5) * H;
    ctx.globalAlpha = 0.12 + rand() * 0.16;
    ctx.fillStyle = rand() > 0.5 ? "#7a5639" : "#5c3f2c";
    ctx.fillRect(0, y, W, H / 5);
  }
  ctx.globalAlpha = 1;

  // The joins between boards.
  for (let i = 1; i < 5; i++) {
    const y = (i / 5) * H;
    ctx.strokeStyle = "rgba(38,25,17,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Fibres. Hundreds of them, faint, wandering — this is the pass that stops
  // the surface reading as paint.
  for (let i = 0; i < 620; i++) {
    const y0 = rand() * H;
    const dark = rand() > 0.45;
    ctx.strokeStyle = dark
      ? `rgba(48,32,21,${0.05 + rand() * 0.16})`
      : `rgba(163,124,88,${0.04 + rand() * 0.12})`;
    ctx.lineWidth = 0.6 + rand() * 1.9;

    ctx.beginPath();
    const amp = 2 + rand() * 9;
    const freq = 0.0016 + rand() * 0.004;
    const phase = rand() * Math.PI * 2;
    for (let x = 0; x <= W; x += 16) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // The nested arcs where the saw crosses a growth ring at an angle. A few of
  // these are what make a surface read as a species rather than as "wood".
  for (let i = 0; i < 7; i++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const scale = 0.6 + rand() * 1.5;
    const flip = rand() > 0.5 ? 1 : -1;

    for (let ring = 0; ring < 9; ring++) {
      const rx = (34 + ring * 26) * scale;
      const ry = (110 + ring * 40) * scale;
      ctx.strokeStyle = `rgba(42,28,18,${0.24 - ring * 0.02})`;
      ctx.lineWidth = 1 + rand() * 2.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, flip > 0 ? 0.9 : Math.PI + 0.9, flip > 0 ? Math.PI - 0.9 : Math.PI * 2 - 0.9);
      ctx.stroke();
    }
  }

  // A wipe of oil sheen down the length, so the top isn't uniformly lit even
  // before the room's lights touch it.
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, "rgba(255,236,210,0.06)");
  sheen.addColorStop(0.5, "rgba(0,0,0,0.05)");
  sheen.addColorStop(1, "rgba(255,236,210,0.05)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = LinearFilter;
  // The box's side faces get the same 0..1 UVs as the top, so the 3 cm edge
  // shows a vertically crushed copy of the grain — which is roughly what end
  // grain on a bullnose looks like anyway.
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

/** The shelf: the same idea, drier and lighter, and much smaller. */
export function shelfTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const rand = rng(4711);

  ctx.fillStyle = "#8a6b4c";
  ctx.fillRect(0, 0, 1024, 256);

  for (let i = 0; i < 260; i++) {
    const y0 = rand() * 256;
    ctx.strokeStyle =
      rand() > 0.5
        ? `rgba(72,52,35,${0.06 + rand() * 0.18})`
        : `rgba(186,152,114,${0.05 + rand() * 0.14})`;
    ctx.lineWidth = 0.6 + rand() * 1.6;
    ctx.beginPath();
    const amp = 1 + rand() * 5;
    const freq = 0.003 + rand() * 0.006;
    const phase = rand() * 6.28;
    for (let x = 0; x <= 1024; x += 14) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}
