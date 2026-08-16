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
 * glass rather than in front of it.
 *
 * The skyline itself went through a version made of blocks at random widths and
 * random heights, which is the obvious way to draw one and produces a row of
 * grey cubes. The reason is proportion: pick width and height independently and
 * roughly half of them come out about as wide as they are tall, and a shape
 * that's as wide as it is tall is not a building — it's a box, whatever you put
 * on top of it. Here every tower's height is drawn as a *multiple of its own
 * width*, so a wide one is also a tall one and none of them can be square. On
 * top of that they get the things that actually say "office tower" from two
 * kilometres away: setbacks, parapets, roof masts, floor lines, and a couple of
 * tower cranes, because this is Gurugram and there is always a crane.
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
 * A seeded generator rather than Math.random, so the skyline is the same city
 * every reload. One that silently rearranges itself between visits is the kind
 * of thing nobody consciously notices and everybody feels.
 */
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
 * The city, generated once and shared.
 *
 * Both textures need it: the day one draws the silhouettes, the night one puts
 * lights in their windows. Generating it twice from the same seed would work
 * until the day someone edits one of the two loops, at which point the lights
 * start floating beside the buildings they belong to.
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
      // Height as a multiple of width. This one line is the whole difference
      // between a skyline and a row of boxes.
      const h = w * (spec.lo + rand() * (spec.hi - spec.lo));
      const top = spec.base - h;

      /*
       * A setback on about a third of them: the upper third narrower than the
       * shaft below it. It costs one rectangle and it's the single cheapest way
       * to stop a silhouette reading as extruded — a building with a step in it
       * has a front and a top, where a plain rectangle has neither.
       */
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
        // Masts on the far ranks only. Near enough to resolve, a hairline
        // aerial just aliases into a flickering dotted line.
        mast: i < 2 && rand() < 0.4 ? 14 + rand() * 26 : 0,
        floor: 5 + rand() * 3,
      });

      // Overlapping is the point: a city is buildings behind buildings, and a
      // row with daylight between every pair reads as a fence.
      x += w * (0.62 + rand() * 0.5) + spec.gap * rand();
    }

    return { base: spec.base, alpha: spec.alpha, towers };
  });
}

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

  const ranks = skyline();

  for (const [i, rank] of ranks.entries()) {
    const ink = `rgba(40,48,54,${rank.alpha})`;
    // The floor lines are glass catching the sky, so they're *lighter* than the
    // building — and barely. At this distance they should read as a texture on
    // the tower, never as individual windows.
    const glass = `rgba(255,255,255,${0.055 + i * 0.02})`;

    for (const t of rank.towers) {
      ctx.fillStyle = ink;
      ctx.fillRect(t.x, t.top, t.w, rank.base - t.top + 60);

      if (t.setback) {
        ctx.fillRect(t.setback.x, t.setback.top, t.setback.w, t.top - t.setback.top);
      }

      // Parapet: a hair wider than the shaft and a few pixels deep. Real roofs
      // have one, and without it every tower ends in the same clean line.
      ctx.fillRect(t.x - 1, t.top - 2, t.w + 2, 3);

      if (t.mast > 0) {
        ctx.fillRect(t.x + t.w / 2 - 0.75, t.top - t.mast, 1.5, t.mast);
      }

      ctx.fillStyle = glass;
      const head = t.setback ? t.setback.top : t.top;
      for (let y = head + t.floor * 2; y < rank.base + 40; y += t.floor) {
        const inSetback = t.setback && y < t.top;
        const x = inSetback ? t.setback!.x : t.x;
        const w = inSetback ? t.setback!.w : t.w;
        ctx.fillRect(x + 2, y, w - 4, 1.4);
      }
    }
  }

  /*
   * Two tower cranes.
   *
   * The one piece of the view that isn't a building, and the reason it's worth
   * the eight rectangles: a skyline of finished towers is a postcard, and a
   * skyline with a crane in it is a place where something is being built this
   * week. It is also, specifically and unavoidably, what Gurugram looks like.
   */
  ctx.fillStyle = "rgba(40,48,54,0.3)";
  for (const [cx, mastH, jib] of [
    [96, 132, 78],
    [372, 108, 62],
  ]) {
    const top = HORIZON + 10 - mastH;
    ctx.fillRect(cx - 1.5, top, 3, mastH);
    // Jib one way, counter-jib the other and shorter, which is the shape that
    // makes a crane a crane rather than a telegraph pole.
    ctx.fillRect(cx, top + 6, jib, 2.5);
    ctx.fillRect(cx - jib * 0.34, top + 6, jib * 0.34, 2.5);
    // The hoist, hanging off the jib.
    ctx.fillRect(cx + jib * 0.72, top + 8, 1.5, 26);
  }

  /*
   * A treeline at the base, softening where the city meets the sill.
   *
   * Without it the towers stand on a hard horizontal line and the whole view
   * reads as two flat layers. Trees are the one thing out there with an
   * irregular edge.
   */
  const trees = rng(5501);
  ctx.fillStyle = "rgba(46,54,48,0.34)";
  for (let x = -10; x < W + 10; x += 9 + trees() * 12) {
    const r = 11 + trees() * 15;
    ctx.beginPath();
    ctx.arc(x, HORIZON + 96 + trees() * 10, r, 0, Math.PI * 2);
    ctx.fill();
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
 *
 * Lit on the same floor pitch as the day texture's glass lines and inside the
 * same silhouettes, which is the entire improvement over the version this
 * replaces. That one scattered dots across a band near the horizon; they landed
 * in the sky as often as on a building, and none of them lined up with anything.
 * Rows and columns are what makes a lit tower read as a lit tower — offices
 * come on a floor at a time, not a pixel at a time.
 */
export function nightLightsTexture(): CanvasTexture {
  const { canvas, ctx } = surface();
  const rand = rng(4211);

  for (const [i, rank] of skyline().entries()) {
    /** Column pitch, from the floor pitch — offices are roughly square in bay. */
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
