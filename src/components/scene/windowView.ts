/**
 * What you can see out of the window.
 *
 * The goal is depth, not detail — anything sharp out there pulls the eye out of
 * the room, which is the opposite of what the window is for.
 *
 * Drawn in colour and multiplied by the daylight colour at render time, so one
 * texture covers dawn to midnight. Greyscale doesn't work: one tint cannot make
 * the trees green and the buildings grey at the same time.
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

/** Seeded, so the skyline is the same city every reload. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const HORIZON = H * 0.7;

interface Tower {
  x: number;
  w: number;
  /** Y of the roof. The building runs from here down past the horizon. */
  top: number;
  /** The upper, narrower section, on towers that have one. */
  setback: { x: number; w: number; top: number } | null;
  /** Height of the roof mast, or 0 for none. */
  mast: number;
  /** Vertical pitch of the floor lines. */
  floor: number;
}

interface Rank {
  /** Where this rank's buildings stand, i.e. the bottom of the roofline. */
  base: number;
  /** How dark against the sky — the only depth cue that survives the haze. */
  alpha: number;
  towers: Tower[];
}

/**
 * Shared by both textures — the day one draws silhouettes, the night one puts
 * lights in their windows. Generating it twice would work until someone edits
 * one loop and the lights start floating beside their buildings.
 */
function skyline(): Rank[] {
  const specs = [
    // Far, mid, near. Narrower and taller as they recede, which is what
    // distance does to a tower — and lighter, which is what haze does.
    { base: HORIZON + 6, alpha: 0.14, minW: 14, maxW: 26, lo: 2.6, hi: 5.4, gap: 10 },
    { base: HORIZON + 30, alpha: 0.24, minW: 20, maxW: 38, lo: 2.0, hi: 4.2, gap: 13 },
    { base: HORIZON + 62, alpha: 0.36, minW: 28, maxW: 54, lo: 1.5, hi: 3.2, gap: 17 },
  ];

  return specs.map((spec, i) => {
    const rand = rng(9007 + i * 331);
    const towers: Tower[] = [];

    let x = -24;
    while (x < W + 24) {
      const w = spec.minW + rand() * (spec.maxW - spec.minW);
      // Height as a multiple of width, so a wide tower is also a tall one and
      // none can come out square. The difference between a skyline and boxes.
      const h = w * (spec.lo + rand() * (spec.hi - spec.lo));
      const top = spec.base - h;

      // A step stops the silhouette reading as extruded: it gives the building
      // a front and a top, where a plain rectangle has neither.
      const stepped = rand() < 0.34 && h > w * 2.4;
      const setback = stepped
        ? (() => {
            const sw = w * (0.5 + rand() * 0.2);
            return {
              x: x + (w - sw) * (0.2 + rand() * 0.6),
              w: sw,
              top: top - h * (0.16 + rand() * 0.22),
            };
          })()
        : null;

      towers.push({
        x,
        w,
        top,
        setback,
        // Far ranks only: nearer, a hairline aerial aliases into dashes.
        mast: i < 2 && rand() < 0.4 ? 14 + rand() * 26 : 0,
        floor: 5 + rand() * 3,
      });

      // Overlapping: a row with daylight between every pair reads as a fence.
      x += w * (0.62 + rand() * 0.5) + spec.gap * rand();
    }

    return { base: spec.base, alpha: spec.alpha, towers };
  });
}

export function outsideTexture(): CanvasTexture {
  const { canvas, ctx } = surface();

  // Deepest overhead, washing out toward the horizon, which is what makes a
  // flat gradient read as distance.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#a9cdec");
  sky.addColorStop(0.55, "#d3e5f4");
  sky.addColorStop(1, "#eceee8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);

  // Deliberately soft and barely lighter than the sky: clouds with defined
  // edges pull the eye out of the room.
  const clouds = rng(2207);
  for (let i = 0; i < 7; i++) {
    const cx = clouds() * W;
    const cy = HORIZON * (0.08 + clouds() * 0.4);
    const scale = 26 + clouds() * 44;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + clouds() * 0.35})`;
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const r = scale * (0.5 + clouds() * 0.6);
      const x = cx + (j - 2) * scale * 0.62;
      const y = cy - clouds() * scale * 0.3;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Middle distance: a wash of ground, lower and duller than the sky.
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, "#b6bfbc");
  ground.addColorStop(0.55, "#7f8f6e");
  ground.addColorStop(1, "#55663f");
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  /*
   * Each rank drawn opaque on its own canvas, then composited once at the rank's
   * alpha. Drawn straight onto the sky, every tower shows through the one behind
   * it and two overlapping buildings make a third, darker shape. What fades a
   * distant skyline is the air in front of all of it, not each building being
   * individually see-through.
   */
  for (const [i, rank] of skyline().entries()) {
    const layer = surface();
    const lc = layer.ctx;

    lc.fillStyle = "#5a6874";
    // Glass catching the sky, so lighter than the building — and barely, or it
    // reads as individual windows rather than as texture.
    const glass = `rgba(255,255,255,${0.06 + i * 0.025})`;

    for (const t of rank.towers) {
      lc.fillStyle = "#5a6874";
      lc.fillRect(t.x, t.top, t.w, rank.base - t.top + 60);

      if (t.setback) {
        lc.fillRect(t.setback.x, t.setback.top, t.setback.w, t.top - t.setback.top);
      }

      // Parapet, or every tower ends in the same clean line.
      lc.fillRect(t.x - 1, t.top - 2, t.w + 2, 3);

      if (t.mast > 0) {
        lc.fillRect(t.x + t.w / 2 - 0.75, t.top - t.mast, 1.5, t.mast);
      }

      lc.fillStyle = glass;
      const head = t.setback ? t.setback.top : t.top;
      for (let y = head + t.floor * 2; y < rank.base + 40; y += t.floor) {
        const inSetback = t.setback && y < t.top;
        const x = inSetback ? t.setback!.x : t.x;
        const w = inSetback ? t.setback!.w : t.w;
        lc.fillRect(x + 2, y, w - 4, 1.4);
      }
    }

    // Cranes, in the same layer so they sit properly behind the nearer ranks. A
    // skyline of finished towers is a postcard; this is Gurugram.
    if (i === 0) {
      lc.fillStyle = "#5a6874";
      for (const [cx, mastH, jib] of [
        [96, 132, 78],
        [372, 108, 62],
      ]) {
        const top = HORIZON + 10 - mastH;
        lc.fillRect(cx - 1.5, top, 3, mastH);
        // Jib one way, shorter counter-jib the other, or it's a telegraph pole.
        lc.fillRect(cx, top + 6, jib, 2.5);
        lc.fillRect(cx - jib * 0.34, top + 6, jib * 0.34, 2.5);
        // The hoist, hanging off the jib.
        lc.fillRect(cx + jib * 0.72, top + 8, 1.5, 26);
      }
    }

    ctx.globalAlpha = rank.alpha;
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  /*
   * A treeline, so the towers don't stand on a hard horizontal rule.
   *
   * Every crown goes into one path filled once, as a union. Filled individually
   * they are translucent circles and each overlap compounds into a dark lens,
   * so the row comes out as a string of beads.
   */
  for (const [seed, y0, spread, radius, colour] of [
    [5501, 74, 8, [9, 12], "rgba(104,126,84,0.5)"],
    [7717, 100, 12, [13, 18], "rgba(58,80,48,0.62)"],
  ] as [number, number, number, [number, number], string][]) {
    const trees = rng(seed);
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let x = -14; x < W + 14; x += 9 + trees() * 13) {
      const y = HORIZON + y0 + trees() * spread;
      const r = radius[0] + trees() * radius[1];
      // Or each arc is joined to the last by a line and the union grows chords.
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Haze at the base, or the buildings look like they're standing in the room.
  const haze = ctx.createLinearGradient(0, HORIZON - 70, 0, HORIZON + 40);
  haze.addColorStop(0, "rgba(236,240,236,0)");
  haze.addColorStop(0.6, "rgba(236,240,236,0.5)");
  haze.addColorStop(1, "rgba(236,240,236,0.14)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, HORIZON - 70, W, 110);

  return texture(canvas);
}

/**
 * A separate layer faded in as the daylight goes, because the base texture is
 * multiplied by the sky colour and anything drawn into it can only be darker
 * than the sky. Lit windows have to be added, not multiplied.
 *
 * On the same floor pitch and inside the same silhouettes: offices come on a
 * floor at a time, and scattered dots land in the sky as often as on a tower.
 */
export function nightLightsTexture(): CanvasTexture {
  const { canvas, ctx } = surface();
  const rand = rng(4211);

  for (const [i, rank] of skyline().entries()) {
    /** Offices are roughly square in bay, so column pitch follows floor pitch. */
    const lit = 0.13 + i * 0.05;

    for (const t of rank.towers) {
      const head = t.setback ? t.setback.top : t.top;

      for (let y = head + t.floor * 2; y < rank.base + 24; y += t.floor) {
        const inSetback = t.setback && y < t.top;
        const x0 = inSetback ? t.setback!.x : t.x;
        const w = inSetback ? t.setback!.w : t.w;

        for (let x = x0 + 2.5; x < x0 + w - 2.5; x += t.floor * 1.15) {
          if (rand() > lit) continue;
          ctx.globalAlpha = 0.4 + rand() * 0.55;
          // Mostly cool office fluorescent, occasionally a warm apartment.
          ctx.fillStyle = rand() > 0.78 ? "#ffd9a0" : "#fff2da";
          ctx.fillRect(x, y - t.floor * 0.5, t.floor * 0.5, t.floor * 0.45);
        }
      }

      // Aircraft warning light on anything with a mast.
      if (t.mast > 0 && rand() < 0.55) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#ff6b5e";
        ctx.fillRect(t.x + t.w / 2 - 1, t.top - t.mast - 1, 2, 2);
      }
    }
  }

  // Streetlights below the skyline, warmer and softer, in a rough line the way
  // they'd run along a road rather than scattered across a field.
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * 58 + rand() * 22;
    const y = HORIZON + 74 + rand() * 26;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 20);
    glow.addColorStop(0, "rgba(255,196,120,0.7)");
    glow.addColorStop(1, "rgba(255,196,120,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  return texture(canvas);
}
