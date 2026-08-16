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
 * The large one: a white 911, in profile, on a dark poster.
 *
 * Drawn as a silhouette with the glass and wheels knocked out, because that
 * shape is doing all of the work. A 911 is one of about five cars recognisable
 * from its outline alone — the round wing tops, the fast screen, the roof
 * peaking ahead of the rear axle and the long fastback falling away to a
 * ducktail — and at the size this hangs, outline is all there is. Any attempt
 * at panel detail would turn to mush.
 *
 * Dark ground, white car. A white car on white paper needs an outline to exist
 * at all, and an outlined car reads as a diagram; against charcoal the body
 * separates on its own, which is also why every car poster ever printed does
 * this.
 */
export function porschePrint(): CanvasTexture {
  const W = 512;
  const H = 690;
  const { canvas, ctx } = surface(W, H);

  const PAPER = "#1d2024";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  /*
   * The car is laid out in its own 1000-unit-long space and then mapped into
   * the poster, so the profile can be written in round numbers and the framing
   * changed without redrawing it.
   */
  const carW = W * 0.86;
  const s = carW / 1000;
  const ox = (W - carW) / 2;
  const oy = H * 0.44;
  const X = (v: number) => ox + v * s;
  const Y = (v: number) => oy + v * s;

  const GROUND = 270;
  const WHEEL_R = 62;
  const ARCH_R = 82;
  const FRONT_X = 232;
  const REAR_X = 770;

  // Body.
  ctx.fillStyle = "#f4f3f0";
  ctx.beginPath();
  ctx.moveTo(X(30), Y(236));
  ctx.quadraticCurveTo(X(14), Y(216), X(26), Y(190));
  // Front wings rise over the headlights — the 911's defining front view cue,
  // and in profile the reason the nose has a shoulder rather than a wedge.
  ctx.quadraticCurveTo(X(52), Y(166), X(104), Y(160));
  ctx.quadraticCurveTo(X(170), Y(158), X(232), Y(160));
  ctx.lineTo(X(330), Y(156));
  // Windscreen, raked hard.
  ctx.quadraticCurveTo(X(392), Y(150), X(468), Y(84));
  // Roof, with a slight crown.
  ctx.quadraticCurveTo(X(534), Y(74), X(602), Y(82));
  // The fastback: one long unbroken fall from the roof to the tail.
  ctx.bezierCurveTo(X(700), Y(96), X(800), Y(126), X(892), Y(156));
  // Ducktail.
  ctx.quadraticCurveTo(X(936), Y(168), X(940), Y(148));
  ctx.quadraticCurveTo(X(958), Y(150), X(962), Y(176));
  ctx.quadraticCurveTo(X(978), Y(196), X(972), Y(224));
  ctx.quadraticCurveTo(X(966), Y(240), X(936), Y(240));
  ctx.lineTo(X(30), Y(236));
  ctx.closePath();
  ctx.fill();

  // Punch the wheel arches back out to the paper.
  ctx.fillStyle = PAPER;
  for (const cx of [FRONT_X, REAR_X]) {
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), ARCH_R * s, Math.PI, Math.PI * 2);
    ctx.rect(X(cx) - ARCH_R * s, Y(GROUND - 8), ARCH_R * 2 * s, 60 * s);
    ctx.fill();
  }

  // Glass. One shape: screen, side window and the wrap into the rear quarter.
  ctx.fillStyle = "#3d474f";
  ctx.beginPath();
  ctx.moveTo(X(352), Y(152));
  ctx.quadraticCurveTo(X(404), Y(146), X(474), Y(94));
  ctx.quadraticCurveTo(X(536), Y(86), X(596), Y(93));
  ctx.quadraticCurveTo(X(628), Y(112), X(648), Y(146));
  ctx.closePath();
  ctx.fill();

  // Door shut line and the mirror — two marks, and the body stops being a blob.
  ctx.strokeStyle = "rgba(40,44,48,0.55)";
  ctx.lineWidth = Math.max(1, 2.4 * s);
  ctx.beginPath();
  ctx.moveTo(X(352), Y(158));
  ctx.lineTo(X(348), Y(228));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X(524), Y(150));
  ctx.lineTo(X(524), Y(226));
  ctx.stroke();

  ctx.fillStyle = "#f4f3f0";
  ctx.beginPath();
  ctx.ellipse(X(360), Y(146), 16 * s, 9 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Engine lid louvres.
  ctx.strokeStyle = "rgba(70,76,82,0.5)";
  ctx.lineWidth = Math.max(1, 2 * s);
  for (let i = 0; i < 5; i++) {
    const y = 150 + i * 11;
    ctx.beginPath();
    ctx.moveTo(X(748 + i * 4), Y(y));
    ctx.lineTo(X(862 + i * 3), Y(y + 14));
    ctx.stroke();
  }

  // Wheels: tyre, dish, centre. Fuchs-ish, which is to say five spokes implied
  // by a ring rather than drawn.
  for (const cx of [FRONT_X, REAR_X]) {
    ctx.fillStyle = "#14171a";
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), WHEEL_R * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8e9499";
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), WHEEL_R * 0.66 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1d2024";
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), WHEEL_R * 0.5 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#c9ced2";
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), WHEEL_R * 0.16 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Contact shadow, so the car sits on something.
  const shade = ctx.createLinearGradient(0, Y(GROUND + 46), 0, Y(GROUND + 92));
  shade.addColorStop(0, "rgba(0,0,0,0.55)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(X(10), Y(GROUND + 46), carW * 0.98, 46 * s);

  // Caption.
  ctx.fillStyle = "#f4f3f0";
  ctx.textAlign = "center";
  ctx.font = `700 ${W * 0.12}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${W * 0.03}px`;
  ctx.fillText("911", W / 2, H * 0.79);

  ctx.font = `500 ${W * 0.031}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${W * 0.022}px`;
  ctx.globalAlpha = 0.6;
  ctx.fillText("CARRERA", W / 2, H * 0.845);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = "0px";

  // A thin rule, because posters have one.
  ctx.strokeStyle = "rgba(244,243,240,0.22)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(W * 0.07, H * 0.05, W * 0.86, H * 0.9);

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
