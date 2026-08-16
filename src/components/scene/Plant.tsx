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
 * Sansevieria, whose leaves are stiff, flat and near-vertical, so they can be
 * built as flattened swept tubes. A plant with a canopy needs real leaf geometry
 * or it reads as green blobs.
 */

const LEAVES = 9;

/**
 * Height per blade, as a fraction of the tallest. Written out rather than
 * computed, because the shape of the list is the point: the leader stands a
 * clear quarter above the next, the range runs almost 3:1, and the order is
 * deliberately unsorted — heights that climb round the fan make a spiral
 * staircase.
 */
const HEIGHTS = [0.55, 0.8, 0.44, 1.0, 0.68, 0.36, 0.74, 0.6, 0.5];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The banding, which is most of what makes this plant this plant.
 *
 * TubeGeometry lays u along the tube and v around it, so a band across the leaf
 * is a vertical line in this canvas — which is why it can be painted rather than
 * modelled. Seeded, so every reload draws the same plant.
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

  // Chevrons rather than stripes: the marking sweeps toward the tip in the
  // middle of the blade and lags at the margins.
  for (let i = 0; i < 34; i++) {
    const t = i / 34;
    // Incommensurate, so the spacing never falls into a rhythm.
    const x = t * W + Math.sin(i * 2.7) * 5;
    const width = 5 + ((i * 5) % 7) + Math.sin(i * 1.3) * 3;
    const sweep = 16 + ((i * 3) % 9);

    // Fading toward the tip, where a real blade's colour goes flat.
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

  // The yellow margin, which identifies the plant across a room. v = 0 and
  // v = 1 are opposite sides of the tube, i.e. the two edges of the blade.
  ctx.fillStyle = "#b9ad52";
  ctx.fillRect(0, 0, W, H * 0.055);
  ctx.fillRect(0, H * 0.945, W, H * 0.055);

  // Paler at the base, where the blade is still half-furled.
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

/** A tube swept along a leaning curve, flattened into a blade. Seeded off `i`. */
function leafGeometry(i: number): BufferGeometry {
  const t = i / LEAVES;
  // Incommensurate, so the leaves fan rather than sitting at even intervals.
  const angle = t * Math.PI * 2 + Math.sin(i * 2.4) * 0.35;
  const height = PLANT.leafHeight * HEIGHTS[i];

  /*
   * Very little lean: a sansevieria is architectural, and the near-vertical
   * bundle is the whole silhouette. Sixty degrees of lean is an agave.
   *
   * The exponent is what turns "same angle at every height" into "the tall ones
   * bend" — a long blade carries its weight further out and arches, a short one
   * is stiff.
   */
  const grown = height / PLANT.leafHeight;
  const lean = (0.014 + (((i * 3) % 4) / 4) * 0.032) * Math.pow(grown, 1.5);

  const dx = Math.cos(angle);
  const dz = Math.sin(angle);

  const curve = new CatmullRomCurve3([
    new Vector3(dx * 0.011, 0, dz * 0.011),
    new Vector3(dx * lean * 0.4, height * 0.36, dz * lean * 0.4),
    new Vector3(dx * lean * 0.85, height * 0.74, dz * lean * 0.85),
    // The tip drifts, or the clump is a bundle of sticks.
    new Vector3(dx * lean * 1.6, height, dz * lean * 1.6),
  ]);

  const TUBULAR = 22;
  const RADIAL = 6;
  // Narrower when shorter but not proportionally: scaling width by the full
  // height ratio makes the short ones threads and the leader a paddle.
  const blade = PLANT.leafWidth * (0.74 + 0.26 * grown);
  const geo = new TubeGeometry(curve, TUBULAR, blade / 2, RADIAL, false);

  /*
   * Taper, by hand because TubeGeometry has none: push each ring of vertices
   * toward or away from the centreline. They come out in tubular-major order, so
   * an index gives away its ring.
   */
  const pos = geo.attributes.position;
  const centre = new Vector3();
  const v = new Vector3();

  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / (RADIAL + 1));
    const t = ring / TUBULAR;

    // Swells fast, then falls as a root, so the blade stays broad and only
    // sharpens near the end.
    const width = 0.03 + 1.15 * smoothstep(0, 0.16, t) * Math.pow(1 - t, 0.55);

    curve.getPointAt(Math.min(1, t), centre);
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(centre).multiplyScalar(width);
    pos.setXYZ(i, centre.x + v.x, centre.y + v.y, centre.z + v.z);
  }
  pos.needsUpdate = true;

  // Widening runs perpendicular to the direction the leaf points, which is why
  // the factors are crossed. Modest: at 3.4x these read as leather straps.
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
            {/* Near-white tints: the map carries the colour, so a saturated
                base multiplies into green already there and blackens the clump. */}
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
