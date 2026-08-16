"use client";

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  LinearFilter,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";

import { PLANT } from "@/lib/layout";

import * as M from "./materials";

/**
 * A snake plant, on the free end of the shelf.
 *
 * It's the only thing in the room that didn't come out of a factory. Every
 * other object here is a rectangle or a cylinder with a fillet on it — desk,
 * monitors, shelf, boxes, keyboard — and a frame made entirely of manufactured
 * edges reads as a product render no matter how well it's lit. One irregular
 * organic silhouette is enough to break that, which is why this plant is on
 * every desk photograph ever taken.
 *
 * Sansevieria specifically, and not because it's fashionable: its leaves are
 * stiff, flat and near-vertical, so they can be built as swept tubes with a
 * squashed cross-section and still look right. A plant with a canopy — a
 * monstera, a fern — needs real leaf geometry or it reads as green blobs.
 */

/** How many leaves, and how they're arranged around the pot. */
const LEAVES = 9;

/**
 * How tall each blade is, as a fraction of the tallest.
 *
 * A sansevieria doesn't grow its leaves together. It throws them one at a time
 * off a rhizome over months, so at any moment a pot holds one or two mature
 * blades at full height, a middle group, and a couple of young ones barely out
 * of the soil. The clump this replaces was generated from `(i * 7) % 5`, which
 * spread the nine leaves over a range of 1.5× — mathematically varied and
 * visually a hedge, because nine blades within half a step of each other read
 * as one flat top edge however the individual heights differ.
 *
 * Written out rather than computed, because the shape of the list is the point.
 * The leader stands a clear quarter above the next tallest, which is what makes
 * it read as *the* tall one instead of as the top of a gradient, and the range
 * runs almost 3:1 top to bottom so the silhouette has a real profile.
 *
 * The order is deliberately not sorted. These index into the fan around the
 * pot, and a run of heights that climbs as it goes round makes a spiral
 * staircase — the tall ones have to be scattered among the short ones the way
 * a rhizome puts them.
 */
const HEIGHTS = [0.55, 0.8, 0.44, 1.0, 0.68, 0.36, 0.74, 0.6, 0.5];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The banding, which is most of what makes this plant this plant.
 *
 * A sansevieria's leaf is not a green blade — it's a dark green blade crossed
 * by irregular pale zigzag bands, and that pattern is the reason the thing is
 * called a snake plant. Left flat, nine identical green spears read as a
 * plastic pot plant however carefully they're shaped, because a real leaf is
 * never one colour anywhere along its length.
 *
 * TubeGeometry lays u along the length of the tube and v around it, so a band
 * across the leaf is a stripe of constant u — a vertical line in this canvas,
 * running the full height. That's the whole reason the pattern can be painted
 * rather than modelled.
 *
 * Seeded arithmetic rather than randomness, so every reload draws the same
 * plant. A pot that silently reshuffles between visits is the kind of thing
 * nobody notices consciously and everybody feels.
 */
function leafTexture(): CanvasTexture {
  const W = 512;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#375438";
  ctx.fillRect(0, 0, W, H);

  /*
   * The bands. Each is a chevron rather than a straight stripe: the pale
   * marking on a real leaf sweeps toward the tip in the middle of the blade and
   * lags at the margins, so a band drawn as a rectangle looks printed and one
   * drawn as a shallow V looks grown.
   */
  for (let i = 0; i < 34; i++) {
    const t = i / 34;
    // Two incommensurate turns, so the spacing never falls into a rhythm.
    const x = t * W + Math.sin(i * 2.7) * 5;
    const width = 5 + ((i * 5) % 7) + Math.sin(i * 1.3) * 3;
    const sweep = 16 + ((i * 3) % 9);

    // Bands crowd together and fade out toward the tip, which is where the
    // blade's colour goes flat on a real plant.
    ctx.globalAlpha = 0.5 - 0.28 * t + Math.sin(i * 0.9) * 0.09;
    ctx.fillStyle = "#9fb277";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + sweep, H / 2);
    ctx.lineTo(x, H);
    ctx.lineTo(x + width, H);
    ctx.lineTo(x + width + sweep, H / 2);
    ctx.lineTo(x + width, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /*
   * The margin. Sansevieria trifasciata 'Laurentii' — the one everybody owns —
   * has a yellow edge running the length of every leaf, and it's the single
   * detail that identifies the plant from across a room. v = 0 and v = 1 are
   * opposite sides of the tube, which after flattening are the two edges of the
   * blade, so the stripe goes at the top and bottom of the canvas.
   */
  ctx.fillStyle = "#b9ad52";
  ctx.fillRect(0, 0, W, H * 0.055);
  ctx.fillRect(0, H * 0.945, W, H * 0.055);

  // The base of every blade is paler and less marked, where it comes out of
  // the soil still half-furled.
  const foot = ctx.createLinearGradient(0, 0, W * 0.12, 0);
  foot.addColorStop(0, "rgba(150,163,110,0.55)");
  foot.addColorStop(1, "rgba(150,163,110,0)");
  ctx.fillStyle = foot;
  ctx.fillRect(0, 0, W * 0.12, H);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

/**
 * One leaf: a tube swept along a gently leaning curve, flattened into a blade.
 *
 * The lean and the twist are seeded off the leaf's index rather than random, so
 * the plant is the same plant on every reload. A pot that silently rearranges
 * itself between visits is the kind of thing nobody notices consciously and
 * everybody feels.
 */
function leafGeometry(i: number): BufferGeometry {
  const t = i / LEAVES;
  // Two incommensurate turns, so the leaves fan out rather than sitting in a
  // ring at even intervals.
  const angle = t * Math.PI * 2 + Math.sin(i * 2.4) * 0.35;
  const height = PLANT.leafHeight * HEIGHTS[i];

  /*
   * Lean, and very little of it.
   *
   * This was five to eighteen centimetres of sideways travel over fifteen of
   * height, which is a lean of sixty degrees — and sixty degrees of lean on a
   * blade this wide is an agave. A sansevieria is architectural: the blades go
   * almost straight up and only the last few centimetres drift. That near-
   * vertical bundle is the entire silhouette, and it's the reason the plant
   * reads at a glance from across the room.
   *
   * Scaled by the leaf's own height, and by slightly more than proportionally.
   * A fixed 30 mm of drift is barely a tilt on a 300 mm leader and a visible
   * flop on a 110 mm youngster, which is backwards: a long blade carries its
   * weight further from the base and arches, a short one is stiff and stands
   * straight up. The exponent is what turns "same angle at every height" into
   * "the tall ones bend".
   */
  const grown = height / PLANT.leafHeight;
  const lean = (0.014 + (((i * 3) % 4) / 4) * 0.032) * Math.pow(grown, 1.5);

  const dx = Math.cos(angle);
  const dz = Math.sin(angle);

  const curve = new CatmullRomCurve3([
    new Vector3(dx * 0.011, 0, dz * 0.011),
    new Vector3(dx * lean * 0.4, height * 0.36, dz * lean * 0.4),
    new Vector3(dx * lean * 0.85, height * 0.74, dz * lean * 0.85),
    // The tip drifts out a little, which is what stops the clump looking like a
    // bundle of sticks.
    new Vector3(dx * lean * 1.6, height, dz * lean * 1.6),
  ]);

  const TUBULAR = 22;
  const RADIAL = 6;
  /*
   * Narrower when shorter, but not proportionally.
   *
   * A young sansevieria blade is a *narrow* spear that then broadens as it
   * extends, so scaling the width by the full height ratio makes the short ones
   * into threads and the leader into a paddle. Three quarters of a fixed width
   * plus a quarter that grows is about what the plant does.
   */
  const blade = PLANT.leafWidth * (0.74 + 0.26 * grown);
  const geo = new TubeGeometry(curve, TUBULAR, blade / 2, RADIAL, false);

  /*
   * Taper the blade to a point.
   *
   * A tube has one radius from end to end, so untapered every leaf finished in
   * a blunt cylinder — which is the single wrongest thing about it, because a
   * sansevieria leaf is a spear. It swells out of the soil, is widest around a
   * third of the way up, and narrows to an actual point.
   *
   * Done by hand because TubeGeometry has no taper: for each ring of vertices,
   * push them toward or away from the centreline at that position along the
   * curve. The vertices come out in tubular-major order, so a vertex's index
   * gives away which ring it belongs to.
   */
  const pos = geo.attributes.position;
  const centre = new Vector3();
  const v = new Vector3();

  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / (RADIAL + 1));
    const t = ring / TUBULAR;

    // Swells fast out of the base, then falls away as a square root — which
    // keeps the blade broad most of its length and only sharpens near the end.
    const width = 0.03 + 1.15 * smoothstep(0, 0.16, t) * Math.pow(1 - t, 0.55);

    curve.getPointAt(Math.min(1, t), centre);
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(centre).multiplyScalar(width);
    pos.setXYZ(i, centre.x + v.x, centre.y + v.y, centre.z + v.z);
  }
  pos.needsUpdate = true;

  /*
   * Flatten across the leaf's own axis.
   *
   * A round tube is a stem; a blade is a tube squashed flat. The widening runs
   * perpendicular to the direction the leaf points — so a leaf facing along X
   * gets widened along Z and vice versa — which is why the two factors are
   * crossed. Kept modest: at the old 3.4× the blades were four centimetres
   * across and looked like leather straps.
   */
  const flat = 2.4;
  geo.scale(1 + Math.abs(dz) * flat, 1, 1 + Math.abs(dx) * flat);
  geo.computeVertexNormals();
  return geo;
}

export function Plant() {
  const leaves = useMemo(
    () => Array.from({ length: LEAVES }, (_, i) => leafGeometry(i)),
    [],
  );
  const skin = useMemo(() => leafTexture(), []);

  useEffect(() => () => leaves.forEach((g) => g.dispose()), [leaves]);
  useEffect(() => () => skin.dispose(), [skin]);

  return (
    <group position={[PLANT.x, PLANT.y, PLANT.z]}>
      {/* Pot: a straight-sided cylinder, tapering slightly, matte glaze. */}
      <mesh position={[0, PLANT.potH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[PLANT.potR, PLANT.potR * 0.82, PLANT.potH, 28]} />
        <meshStandardMaterial {...M.POT} />
      </mesh>
      {/* A raised lip, so the pot has a rim rather than an edge. */}
      <mesh position={[0, PLANT.potH - 0.004, 0]} castShadow>
        <cylinderGeometry
          args={[PLANT.potR * 1.06, PLANT.potR * 1.06, 0.012, 28]}
        />
        <meshStandardMaterial {...M.POT} />
      </mesh>
      {/* Soil, just below the rim. */}
      <mesh position={[0, PLANT.potH - 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[PLANT.potR * 0.98, 28]} />
        <meshStandardMaterial {...M.SOIL} />
      </mesh>

      <group position={[0, PLANT.potH - 0.012, 0]}>
        {leaves.map((geo, i) => (
          <mesh key={i} geometry={geo} castShadow receiveShadow>
            {/*
              One banded texture, tinted slightly differently per blade.

              The tints are near-white on purpose: the map carries the colour
              now, so a saturated base would be multiplied into a green that's
              already there and drag the whole clump toward black. All the tint
              has to do is stop nine blades cut from one texture reading as nine
              copies of the same blade.
            */}
            <meshStandardMaterial
              {...M.LEAF}
              color={i % 3 === 0 ? "#e4eed6" : "#ffffff"}
              map={skin}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
