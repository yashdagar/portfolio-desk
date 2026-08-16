"use client";

import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

import { CURTAIN, WALL, WINDOW } from "@/lib/layout";

import * as M from "./materials";

/**
 * The curtain, drawn back to the left of the window.
 *
 * Left side only: the right-hand half of the opening is already outside the
 * shot, so a matching panel would be geometry nobody sees. The pole spans the
 * whole window regardless, because leaning in moves the camera.
 */

/** Six is a gathered curtain; three is a shower curtain. */
const FOLDS = 6;
const SEGMENTS = 64;
const RINGS = 28;

/**
 * A corrugated column, not a wavy plane: a displaced plane has no thickness, so
 * its silhouette against the bright window is a hard edge with nothing behind it.
 *
 * Written out as vertices because the two things that make it read as cloth are
 * both functions of height — the folds open toward the hem and the column widens
 * as it falls — and neither is available on a lathe or an extrusion.
 */
function panelGeometry(): BufferGeometry {
  const positions = new Float32Array((RINGS + 1) * (SEGMENTS + 1) * 3);
  const uvs = new Float32Array((RINGS + 1) * (SEGMENTS + 1) * 2);
  const indices: number[] = [];

  for (let r = 0; r <= RINGS; r++) {
    /** 0 at the hem, 1 at the pole. */
    const v = r / RINGS;

    // Narrower where it's held than where it isn't. Constant is a plank.
    const half = CURTAIN.hemHalfW + (CURTAIN.topHalfW - CURTAIN.hemHalfW) * v;
    const depth = CURTAIN.hemDepth + (CURTAIN.topDepth - CURTAIN.hemDepth) * v;
    /** Folds are pinched at the rings and swing wider as they fall. */
    const amp = 0.34 - 0.16 * v;

    for (let s = 0; s <= SEGMENTS; s++) {
      const around = (s / SEGMENTS) * Math.PI * 2;
      /*
       * Two harmonics: a single cosine gives folds of identical depth at
       * identical spacing, which is a radiator. Both terms drift with height as
       * well, so the creases wander rather than running dead vertical.
       */
      const wave =
        1 +
        amp *
          (Math.cos(FOLDS * around + (1 - v) * 0.55) +
            0.38 * Math.cos(2 * FOLDS * around + 1.1 + (1 - v) * 0.9)) *
          0.78;

      const i = r * (SEGMENTS + 1) + s;
      positions[i * 3] = Math.cos(around) * half * wave;
      positions[i * 3 + 1] = v * CURTAIN.height;
      positions[i * 3 + 2] = Math.sin(around) * depth * wave;

      // u runs around the folds so the weave crosses them, v up the drop.
      uvs[i * 2] = s / SEGMENTS;
      uvs[i * 2 + 1] = v;
    }
  }

  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < SEGMENTS; s++) {
      const a = r * (SEGMENTS + 1) + s;
      const b = a + SEGMENTS + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * The slubs matter more than the weave: linen thread is spun unevenly, and a
 * perfectly regular grid reads as a printed pattern.
 */
function linenTexture(): CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  // Not white: next to an off-white wall that is two versions of the same
  // non-colour, and neither reads as a material.
  ctx.fillStyle = "#d8cdb9";
  ctx.fillRect(0, 0, S, S);

  // One pixel, so the weave disappears into a tone rather than a pattern.
  ctx.fillStyle = "rgba(255,250,240,0.42)";
  for (let x = 0; x < S; x += 3) ctx.fillRect(x, 0, 1, S);
  ctx.fillStyle = "rgba(120,106,86,0.3)";
  for (let y = 0; y < S; y += 3) ctx.fillRect(0, y, S, 1);

  // Seeded, so the cloth is the same cloth every reload.
  let seed = 90210;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 260; i++) {
    const horizontal = rand() > 0.5;
    const len = 3 + rand() * 11;
    // Faint: this tiles thirty-odd times, and the eye finds the repeat the
    // moment a mark is dark enough to recognise.
    ctx.fillStyle =
      rand() > 0.5 ? "rgba(255,252,244,0.26)" : "rgba(112,98,78,0.17)";
    ctx.fillRect(
      rand() * S,
      rand() * S,
      horizontal ? len : 1.6,
      horizontal ? 1.6 : len,
    );
  }

  // Deliberately no shading baked in: anything that varies over the length of
  // the object cannot live in a texture that repeats along it. A top-to-bottom
  // gradient here came out as six evenly spaced bands.
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 11);
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

export function Curtain() {
  const panel = useMemo(() => panelGeometry(), []);
  const linen = useMemo(() => linenTexture(), []);

  useEffect(
    () => () => {
      panel.dispose();
      linen.dispose();
    },
    [panel, linen],
  );

  /** Where the pole runs: past both jambs, the way one is actually fitted. */
  const poleLeft = WINDOW.x - WINDOW.w / 2 - CURTAIN.overhang;
  const poleRight = WINDOW.x + WINDOW.w / 2 + CURTAIN.overhang;
  const poleLength = poleRight - poleLeft;

  return (
    <group position={[0, 0, WALL.z + CURTAIN.standoff]}>
      <mesh
        position={[(poleLeft + poleRight) / 2, CURTAIN.poleY, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.009, 0.009, poleLength, 14]} />
        <meshStandardMaterial {...M.CURTAIN_POLE} />
      </mesh>
      {[poleLeft, poleRight].map((x) => (
        <mesh key={x} position={[x, CURTAIN.poleY, 0]} castShadow>
          <sphereGeometry args={[0.019, 16, 12]} />
          <meshStandardMaterial {...M.CURTAIN_POLE} />
        </mesh>
      ))}

      {/* Spread across the panel's top width, not the pole's length: an open
          curtain's rings pile up against the end stop. */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh
          key={i}
          position={[
            CURTAIN.x - CURTAIN.topHalfW + (i / 6) * CURTAIN.topHalfW * 2,
            CURTAIN.poleY,
            0,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[0.016, 0.0028, 8, 20]} />
          <meshStandardMaterial {...M.CURTAIN_POLE} />
        </mesh>
      ))}

      {/* Double-sided only for the hem, which a seated eye looks up into. */}
      <mesh
        geometry={panel}
        position={[CURTAIN.x, CURTAIN.hemY, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.LINEN} map={linen} side={2} />
      </mesh>
    </group>
  );
}
