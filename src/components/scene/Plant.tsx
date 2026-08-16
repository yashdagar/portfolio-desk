"use client";

import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3, type BufferGeometry } from "three";

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

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
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
  const height = PLANT.leafHeight * (0.68 + (((i * 7) % 5) / 5) * 0.42);

  /*
   * Lean, and very little of it.
   *
   * This was five to eighteen centimetres of sideways travel over fifteen of
   * height, which is a lean of sixty degrees — and sixty degrees of lean on a
   * blade this wide is an agave. A sansevieria is architectural: the blades go
   * almost straight up and only the last few centimetres drift. That near-
   * vertical bundle is the entire silhouette, and it's the reason the plant
   * reads at a glance from across the room.
   */
  const lean = 0.014 + (((i * 3) % 4) / 4) * 0.032;

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
  const geo = new TubeGeometry(curve, TUBULAR, PLANT.leafWidth / 2, RADIAL, false);

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

  useEffect(() => () => leaves.forEach((g) => g.dispose()), [leaves]);

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
              Alternating tones. Real sansevieria leaves are banded and every
              blade catches the light differently; two greens is the cheapest
              version of that and it's enough to stop the clump reading as one
              solid mass.
            */}
            <meshStandardMaterial
              {...(i % 3 === 0 ? M.LEAF_PALE : M.LEAF)}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
