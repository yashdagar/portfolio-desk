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
 * Drawn in colour and multiplied by the daylight colour at render time, so one
 * texture still covers dawn, noon and midnight. It used to be greyscale, on the
 * theory that the tint could supply everything — which works for a sky and
 * fails for anything that isn't the same hue as the sky. One tint cannot make
 * the trees green and the buildings grey at the same time; it can only make
 * both of them whatever it is. Painting the colour in and letting the tint
 * *modulate* it keeps the single-texture trick and gets a blue sky over green
 * trees at noon, with everything going the same deep blue after dark, which is
 * what actually happens to colour at night.
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
  // Deepest overhead, washing out toward the horizon — which is what haze does
  // to a sky, and the single cue that makes a flat gradient read as distance.
  sky.addColorStop(0, "#a9cdec");
  sky.addColorStop(0.55, "#d3e5f4");
  sky.addColorStop(1, "#eceee8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);

  /*
   * A few flat-bottomed cumulus, high up.
   *
   * The top pane of the window is nothing but sky, and an unbroken gradient
   * there reads as a lightbox rather than as weather. Deliberately soft and
   * barely lighter than the sky behind them: clouds with defined edges pull the
   * eye straight out of the room, which is the one thing the window must not
   * do.
   */
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
   * Each rank is drawn opaque on its own canvas and then composited once, at
   * the rank's alpha. This is not an optimisation — it's the difference
   * between a city and an x-ray of one.
   *
   * Drawn straight onto the sky at 24% alpha, every tower shows through every
   * tower behind it: two overlapping buildings make a third, darker shape where
   * they cross, and the eye reads all three as glass. Real buildings occlude.
   * Compositing a finished, opaque layer means the towers hide each other
   * exactly as they should, and the alpha then applies once to the whole rank —
   * which is the correct model anyway, since what fades a distant skyline is
   * the air in front of all of it, not each building being individually
   * see-through.
   */
  for (const [i, rank] of skyline().entries()) {
    const layer = surface();
    const lc = layer.ctx;

    lc.fillStyle = "#5a6874";
    // The floor lines are glass catching the sky, so they're *lighter* than the
    // building — and barely. At this distance they should read as a texture on
    // the tower, never as individual windows.
    const glass = `rgba(255,255,255,${0.06 + i * 0.025})`;

    for (const t of rank.towers) {
      lc.fillStyle = "#5a6874";
      lc.fillRect(t.x, t.top, t.w, rank.base - t.top + 60);

      if (t.setback) {
        lc.fillRect(t.setback.x, t.setback.top, t.setback.w, t.top - t.setback.top);
      }

      // Parapet: a hair wider than the shaft and a few pixels deep. Real roofs
      // have one, and without it every tower ends in the same clean line.
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

    /*
     * Two tower cranes, on the far rank, in the same layer as the buildings so
     * they're properly behind the nearer ones.
     *
     * The one piece of the view that isn't a building, and the reason it's
     * worth eight rectangles: a skyline of finished towers is a postcard, and a
     * skyline with a crane in it is a place where something is being built this
     * week. It is also, specifically and unavoidably, what Gurugram looks like.
     */
    if (i === 0) {
      lc.fillStyle = "#5a6874";
      for (const [cx, mastH, jib] of [
        [96, 132, 78],
        [372, 108, 62],
      ]) {
        const top = HORIZON + 10 - mastH;
        lc.fillRect(cx - 1.5, top, 3, mastH);
        // Jib one way, counter-jib the other and shorter, which is the shape
        // that makes a crane a crane rather than a telegraph pole.
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
   * A treeline at the base, softening where the city meets the sill.
   *
   * Without it the towers stand on a hard horizontal rule and the whole view
   * reads as two flat layers. Trees are the one thing out there with an
   * irregular edge.
   *
   * Every crown goes into a single path and the path is filled once. Filled one
   * at a time they were translucent circles, so each overlap compounded into a
   * dark lens and the row came out as a string of beads with lozenges between
   * them — which is exactly what a row of trees does not look like. One path
   * fills as a union: the outline is still lumpy, the interior is one flat
   * tone, and the alpha applies to the whole mass once.
   */
  /*
   * Two ranks of them, in two greens.
   *
   * One rank is a hedge; two at different heights and different greens is a
   * park, and a park is what's actually across the road from an office tower in
   * Gurugram. The far rank is hazier and bluer because that's what air does to
   * green over a few hundred metres — the same trick the buildings use, applied
   * to the one thing out there that isn't grey.
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
      // Move to where the arc actually begins. Without this, each arc is joined
      // to the previous one by a straight line and the union grows a chord
      // across every gap.
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Haze band sitting across the base of the skyline, which is what stops the
  // buildings looking like they're standing in the room.
  const haze = ctx.createLinearGradient(0, HORIZON - 70, 0, HORIZON + 40);
  haze.addColorStop(0, "rgba(236,240,236,0)");
  haze.addColorStop(0.6, "rgba(236,240,236,0.5)");
  haze.addColorStop(1, "rgba(236,240,236,0.14)");
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
