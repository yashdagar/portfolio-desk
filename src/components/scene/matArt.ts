/**
 * Real contour lines, not drawn squiggles: a field of gaussian bumps, contoured
 * with marching squares. More code than noisy beziers, and the only way to get
 * what makes a contour map read as one — the lines nest, never cross, and crowd
 * where the slope is steep.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

const W = 2048;
const H = 990;

/** Field resolution. Fine enough that the contours are smooth at print size. */
const COLS = 150;
const ROWS = 74;
const LEVELS = 26;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A height field: several gaussian hills plus two long swells. */
function buildField(rand: () => number): number[][] {
  const bumps = Array.from({ length: 16 }, () => ({
    x: rand() * 1.3 - 0.15,
    y: rand() * 1.3 - 0.15,
    a: (rand() > 0.42 ? 1 : -1) * (0.5 + rand() * 1),
    s: 0.045 + rand() * 0.16,
  }));

  const field: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    const v = r / (ROWS - 1);
    for (let c = 0; c < COLS; c++) {
      const u = c / (COLS - 1);
      let h =
        Math.sin(u * 5.1 + v * 1.7) * 0.32 + Math.sin(v * 4.3 - u * 2.2) * 0.26;
      for (const b of bumps) {
        const dx = u - b.x;
        const dy = (v - b.y) * 0.62; // squash, so features run along the mat
        h += b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s));
      }
      row.push(h);
    }
    field.push(row);
  }
  return field;
}

/**
 * The standard 16-case lookup, collapsed. The two ambiguous saddle cases (5 and
 * 10) are resolved arbitrarily — getting them wrong only swaps which of two
 * valid connections is drawn.
 */
function marchingSquares(
  field: number[][],
  level: number,
  emit: (x0: number, y0: number, x1: number, y1: number) => void,
) {
  const lerp = (a: number, b: number) => (level - a) / (b - a);

  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const tl = field[r][c];
      const tr = field[r][c + 1];
      const br = field[r + 1][c + 1];
      const bl = field[r + 1][c];

      const idx =
        (tl > level ? 8 : 0) |
        (tr > level ? 4 : 0) |
        (br > level ? 2 : 0) |
        (bl > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;

      // Crossing points on each edge, in cell-local 0..1 coordinates.
      const top: [number, number] = [c + lerp(tl, tr), r];
      const right: [number, number] = [c + 1, r + lerp(tr, br)];
      const bottom: [number, number] = [c + lerp(bl, br), r + 1];
      const left: [number, number] = [c, r + lerp(tl, bl)];

      const link = (a: [number, number], b: [number, number]) =>
        emit(a[0], a[1], b[0], b[1]);

      switch (idx) {
        case 1:
        case 14:
          link(left, bottom);
          break;
        case 2:
        case 13:
          link(bottom, right);
          break;
        case 3:
        case 12:
          link(left, right);
          break;
        case 4:
        case 11:
          link(top, right);
          break;
        case 6:
        case 9:
          link(top, bottom);
          break;
        case 7:
        case 8:
          link(left, top);
          break;
        case 5:
          link(left, top);
          link(bottom, right);
          break;
        case 10:
          link(left, bottom);
          link(top, right);
          break;
      }
    }
  }
}

export function matTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const rand = rng(31415926);

  ctx.fillStyle = "#333b46";
  ctx.fillRect(0, 0, W, H);

  const field = buildField(rand);
  let min = Infinity;
  let max = -Infinity;
  for (const row of field) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const sx = W / (COLS - 1);
  const sy = H / (ROWS - 1);

  ctx.lineCap = "round";
  for (let i = 1; i < LEVELS; i++) {
    const level = min + ((max - min) * i) / LEVELS;
    // Every fifth contour is an index line, drawn heavier — which is what real
    // topographic maps do, and what stops the field reading as uniform noise.
    const index = i % 5 === 0;
    ctx.strokeStyle = index
      ? "rgba(226,232,238,0.72)"
      : "rgba(200,210,222,0.42)";
    ctx.lineWidth = index ? 2.4 : 1.5;

    ctx.beginPath();
    marchingSquares(field, level, (x0, y0, x1, y1) => {
      ctx.moveTo(x0 * sx, y0 * sy);
      ctx.lineTo(x1 * sx, y1 * sy);
    });
    ctx.stroke();
  }

  // The mat has real geometry for its edge, but a two-millimetre stitch is a
  // printed-scale detail that geometry at this budget can't carry.
  const inset = 26;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#232a33";
  ctx.lineWidth = inset * 2;
  ctx.strokeRect(0, 0, W, H);

  ctx.setLineDash([9, 7]);
  ctx.strokeStyle = "rgba(150,163,178,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(inset + 9, inset + 9, W - (inset + 9) * 2, H - (inset + 9) * 2);
  ctx.setLineDash([]);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 16;
  tex.minFilter = LinearFilter;
  return tex;
}
