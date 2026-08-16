/**
 * The Porsche triptych: one artwork, three frames.
 *
 * Drawn as a single wide canvas and then sliced into three by texture offsets,
 * which is the only way to get the thing that makes a triptych a triptych — the
 * subject running *through* the frames rather than being repeated inside each
 * one. The car crosses two gaps, and the wordmark is cut mid-letter twice, so
 * "PORSCHE" reads as PO | RSC | HE. Drawing three separate panels and trying to
 * line them up by hand would be the same picture with three chances to be a
 * pixel out.
 *
 * The car itself is the same silhouette approach as before: a 911 is one of
 * about five cars recognisable from its outline alone — round wing tops, fast
 * screen, roof peaking ahead of the rear axle, long fastback to a ducktail — and
 * at print scale on a wall two metres away the outline is all there is.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

/** Three panels wide. The gaps between frames are physical, not in the art. */
export const PANELS = 3;

const W = 1800;
const H = 940;

/**
 * One panel's aspect. The frames are sized from this rather than the other way
 * round, so the art is never stretched however the physical panels are tuned.
 */
export const PANEL_ASPECT = W / PANELS / H;

const PAPER = "#dcd7cd";
const INK = "#15161a";

function drawCar(ctx: CanvasRenderingContext2D) {
  /*
   * The car is laid out in its own 1000-unit-long space and mapped into the
   * canvas, so the profile can be written in round numbers and the framing
   * changed without redrawing it.
   */
  const carW = W * 0.94;
  const s = carW / 1000;
  const ox = (W - carW) / 2;
  const oy = H * 0.02;
  const X = (v: number) => ox + v * s;
  const Y = (v: number) => oy + v * s;

  const GROUND = 270;
  const WHEEL_R = 62;
  const ARCH_R = 82;
  const FRONT_X = 232;
  const REAR_X = 770;

  // Body.
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(X(30), Y(236));
  ctx.quadraticCurveTo(X(14), Y(216), X(26), Y(190));
  // Front wings rise over the headlights — the 911's defining cue, and in
  // profile the reason the nose has a shoulder rather than a wedge.
  ctx.quadraticCurveTo(X(52), Y(166), X(104), Y(160));
  ctx.quadraticCurveTo(X(170), Y(158), X(232), Y(160));
  ctx.lineTo(X(330), Y(156));
  ctx.quadraticCurveTo(X(392), Y(150), X(468), Y(84));
  ctx.quadraticCurveTo(X(534), Y(74), X(602), Y(82));
  ctx.bezierCurveTo(X(700), Y(96), X(800), Y(126), X(892), Y(156));
  ctx.quadraticCurveTo(X(936), Y(168), X(940), Y(148));
  ctx.quadraticCurveTo(X(958), Y(150), X(962), Y(176));
  ctx.quadraticCurveTo(X(978), Y(196), X(972), Y(224));
  ctx.quadraticCurveTo(X(966), Y(240), X(936), Y(240));
  ctx.lineTo(X(30), Y(236));
  ctx.closePath();
  ctx.fill();

  // A fixed rear wing, because the reference car is a GT3 and the wing is the
  // single most identifiable thing about one.
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, 3 * s);
  ctx.beginPath();
  ctx.moveTo(X(806), Y(74));
  ctx.lineTo(X(986), Y(66));
  ctx.lineTo(X(986), Y(86));
  ctx.lineTo(X(806), Y(94));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Swan-neck uprights.
  for (const x of [836, 950]) {
    ctx.fillStyle = INK;
    ctx.fillRect(X(x), Y(86), 6 * s, 58 * s);
  }

  // Outline the whole body. On a car this pale the line *is* the drawing.
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2.5, 6 * s);
  ctx.beginPath();
  ctx.moveTo(X(30), Y(236));
  ctx.quadraticCurveTo(X(14), Y(216), X(26), Y(190));
  ctx.quadraticCurveTo(X(52), Y(166), X(104), Y(160));
  ctx.quadraticCurveTo(X(170), Y(158), X(232), Y(160));
  ctx.lineTo(X(330), Y(156));
  ctx.quadraticCurveTo(X(392), Y(150), X(468), Y(84));
  ctx.quadraticCurveTo(X(534), Y(74), X(602), Y(82));
  ctx.bezierCurveTo(X(700), Y(96), X(800), Y(126), X(892), Y(156));
  ctx.quadraticCurveTo(X(936), Y(168), X(940), Y(148));
  ctx.quadraticCurveTo(X(958), Y(150), X(962), Y(176));
  ctx.quadraticCurveTo(X(978), Y(196), X(972), Y(224));
  ctx.stroke();

  /*
   * Punch the wheel arches out to transparent.
   *
   * They used to be filled with the flat paper colour, which left two pale
   * rectangles under the car wherever the paper's gradient had moved away from
   * that one value — a flat patch on a graded ground is instantly visible.
   * Erasing instead means the gradient can be laid in underneath afterwards and
   * matches by construction.
   */
  ctx.globalCompositeOperation = "destination-out";
  for (const cx of [FRONT_X, REAR_X]) {
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), ARCH_R * s, Math.PI, Math.PI * 2);
    ctx.rect(X(cx) - ARCH_R * s, Y(GROUND - 8), ARCH_R * 2 * s, 60 * s);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // The arches need their own line, since punching them took the body's off.
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2.5, 6 * s);
  for (const cx of [FRONT_X, REAR_X]) {
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), ARCH_R * s, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  // Glass: screen, side window and the wrap into the rear quarter, in one shape.
  ctx.fillStyle = "#d9dbdd";
  ctx.beginPath();
  ctx.moveTo(X(352), Y(152));
  ctx.quadraticCurveTo(X(404), Y(146), X(474), Y(94));
  ctx.quadraticCurveTo(X(536), Y(86), X(596), Y(93));
  ctx.quadraticCurveTo(X(628), Y(112), X(648), Y(146));
  ctx.closePath();
  ctx.fill();

  // Shut lines and a mirror. Two marks, and the body stops being a blob.
  ctx.strokeStyle = "rgba(21,22,26,0.4)";
  ctx.lineWidth = Math.max(1, 2.4 * s);
  for (const x of [352, 524]) {
    ctx.beginPath();
    ctx.moveTo(X(x), Y(156));
    ctx.lineTo(X(x - 4), Y(228));
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.beginPath();
  ctx.ellipse(X(360), Y(146), 16 * s, 9 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wheels: tyre, dish, centre.
  for (const cx of [FRONT_X, REAR_X]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), WHEEL_R * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f6f5f2";
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), WHEEL_R * 0.68 * s, 0, Math.PI * 2);
    ctx.fill();

    // Spokes, as a rim of wedges. Enough to say "alloy" and no more.
    ctx.fillStyle = "#c9c6c0";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(X(cx), Y(GROUND - 8));
      ctx.arc(
        X(cx),
        Y(GROUND - 8),
        WHEEL_R * 0.62 * s,
        a - 0.13,
        a + 0.13,
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#e8e5df";
    ctx.beginPath();
    ctx.arc(X(cx), Y(GROUND - 8), WHEEL_R * 0.2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  return { s, Y, carW, GROUND };
}

/**
 * One canvas holding the whole artwork, sliced into panels at render time.
 */
function triptychCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // The car goes down first, on a transparent canvas, so its wheel arches can
  // be erased rather than painted over.
  const { s, Y, carW, GROUND } = drawCar(ctx);

  /*
   * A warm grey ground, not white, laid in *behind* everything already drawn.
   *
   * The first version put a white car outlined in black on near-white paper,
   * which is how the reference prints look in a product photo and completely
   * invisible on a dark wall two metres from the camera — the panel collapsed
   * into one pale rectangle with some marks on it. Dropping the paper two stops
   * gives the car something to be white *against*.
   */
  ctx.globalCompositeOperation = "destination-over";
  const paper = ctx.createLinearGradient(0, 0, 0, H);
  paper.addColorStop(0, "#e6e1d7");
  paper.addColorStop(1, "#cfc9bd");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";

  // Contact shadow, so the car sits on the ground rather than floating over it.
  const shade = ctx.createLinearGradient(0, Y(GROUND + 12), 0, Y(GROUND + 56));
  shade.addColorStop(0, "rgba(21,22,26,0.45)");
  shade.addColorStop(1, "rgba(21,22,26,0)");
  ctx.fillStyle = shade;
  ctx.fillRect((W - carW) / 2, Y(GROUND + 12), carW, 44 * s);

  // The solid ground bar the reference prints under the car.
  ctx.fillStyle = INK;
  ctx.fillRect(0, Y(GROUND + 56), W, 20 * s);

  /*
   * The wordmark, set to span the full width.
   *
   * Measured and then scaled to fit rather than guessed, because it has to run
   * exactly edge to edge — the whole effect depends on the frames cutting it
   * mid-letter, and a wordmark that stops short of the edges just looks like
   * three posters that happen to be near each other.
   */
  const target = W * 0.97;
  const baseSize = H * 0.24;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${baseSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${baseSize * 0.16}px`;

  const measured = ctx.measureText("PORSCHE").width;
  const size = baseSize * (target / measured);
  ctx.font = `800 ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${size * 0.16}px`;
  // The trailing letter-space pushes the string right by half of it; pulling
  // back by that much re-centres what's actually drawn.
  ctx.fillText("PORSCHE", W / 2 - size * 0.08, H * 0.965);
  ctx.letterSpacing = "0px";

  return canvas;
}

/** One texture per frame, each showing its own third of the artwork. */
export function triptychPanels(): CanvasTexture[] {
  const canvas = triptychCanvas();

  return Array.from({ length: PANELS }, (_, i) => {
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    tex.minFilter = LinearFilter;
    tex.repeat.set(1 / PANELS, 1);
    tex.offset.set(i / PANELS, 0);
    return tex;
  });
}
