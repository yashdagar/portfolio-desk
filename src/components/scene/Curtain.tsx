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
 * The window was a hole in a wall. Everything about it was built — a real
 * opening with a reveal, a frame, a sill, glass with rain on it, a skyline
 * behind — and none of that reads as a *window in a room*, because a room
 * treats its windows. Bare glass in bare plaster is an office. One panel of
 * cloth gathered against the jamb is the single cheapest thing that says
 * somebody lives here.
 *
 * Left side only, and that isn't a corner cut. The window is at x = 1.24 and
 * the frame runs out at roughly 1.58, so the right-hand half of the opening is
 * already outside the shot — a matching panel over there would be geometry
 * nobody ever sees. The pole spans the whole window regardless, since a pole
 * that stops where the frame stops is the kind of detail that's invisible until
 * the camera moves and then obviously wrong.
 *
 * Drawn open rather than closed, for the obvious reason: the window is the
 * room's cool fill light and the only view out, and covering it to prove a
 * curtain exists would trade the best thing in the frame for a rectangle of
 * cloth.
 */

/** Folds around the panel. Six is a gathered curtain; three is a shower curtain. */
const FOLDS = 6;
/** Rings and vertical divisions. Enough that the folds stay smooth in silhouette. */
const SEGMENTS = 64;
const RINGS = 28;

/**
 * The panel: a corrugated column, not a wavy plane.
 *
 * The obvious build is a subdivided plane pushed back and forth in z, and it
 * fails from exactly one angle — this one. A displaced plane has no thickness,
 * so its silhouette against the bright window is a hard edge with nothing
 * behind it, and the fabric reads as a painted flat. A gathered curtain is
 * genuinely a closed tube of cloth squashed against the wall, so it's built as
 * one: every horizontal slice is a closed loop, flattened front to back and
 * pinched into folds around its perimeter.
 *
 * Written out as vertices rather than assembled from primitives because the two
 * things that make it look like cloth are both functions of height — the folds
 * open out toward the hem, and the whole column widens as it falls away from
 * the gather at the pole. Neither is available on a lathe or an extrusion.
 */
function panelGeometry(): BufferGeometry {
  const positions = new Float32Array((RINGS + 1) * (SEGMENTS + 1) * 3);
  const uvs = new Float32Array((RINGS + 1) * (SEGMENTS + 1) * 2);
  const indices: number[] = [];

  for (let r = 0; r <= RINGS; r++) {
    /** 0 at the hem, 1 at the pole. */
    const v = r / RINGS;

    /*
     * Gathered at the top, open at the bottom.
     *
     * The rings hold the fabric to a fixed span at the pole and gravity does
     * the rest, so a hanging panel is always narrower where it's held than
     * where it isn't. Getting this backwards — or leaving it constant — is what
     * makes a curtain look like a plank.
     */
    const half = CURTAIN.hemHalfW + (CURTAIN.topHalfW - CURTAIN.hemHalfW) * v;
    const depth = CURTAIN.hemDepth + (CURTAIN.topDepth - CURTAIN.hemDepth) * v;
    /** Folds are pinched at the rings and swing wider as they fall. */
    const amp = 0.34 - 0.16 * v;

    for (let s = 0; s <= SEGMENTS; s++) {
      const around = (s / SEGMENTS) * Math.PI * 2;
      /*
       * Two harmonics, and the second one is doing the important half.
       *
       * A single cosine gives folds of identical depth at identical spacing,
       * which is a radiator rather than a curtain — cloth gathers unevenly
       * because each ring takes a different amount of it. Adding a half-scale
       * wave at an offset makes every second fold shallower and shifts the
       * creases off the even spacing, and the whole thing stops reading as
       * fluting.
       *
       * Both terms drift with height as well, so the creases wander down the
       * drop instead of running dead vertical. Real cloth hangs off a ring at
       * one point and spreads below it.
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
 * Linen: a weave, some slubs, and a wash of shade down the drop.
 *
 * The weave is the smaller half of the job. What actually separates cloth from
 * a smooth solid at this distance is the *slubs* — linen thread is spun
 * unevenly, so a real panel is crossed by short thick fibres that catch light
 * individually, and a perfectly regular grid reads as a printed pattern. The
 * gradient does the other half: the top of a curtain sits in the shadow of its
 * own gather and the hem picks up bounce off the desk.
 */
function linenTexture(): CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  // Warm oatmeal. Not white — a white curtain next to an off-white wall is two
  // versions of the same non-colour, and neither reads as a material.
  ctx.fillStyle = "#d8cdb9";
  ctx.fillRect(0, 0, S, S);

  // The weave. Warp and weft at one pixel, which at this texel density is about
  // the right thread count and disappears into a tone rather than a pattern.
  ctx.fillStyle = "rgba(255,250,240,0.42)";
  for (let x = 0; x < S; x += 3) ctx.fillRect(x, 0, 1, S);
  ctx.fillStyle = "rgba(120,106,86,0.3)";
  for (let y = 0; y < S; y += 3) ctx.fillRect(0, y, S, 1);

  /*
   * Slubs, seeded so the cloth is the same cloth every reload — the same reason
   * the plant's leaves and the cube's scramble are fixed.
   */
  let seed = 90210;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 260; i++) {
    const horizontal = rand() > 0.5;
    const len = 3 + rand() * 11;
    /*
     * Faint. This texture tiles thirty-odd times across the panel, so anything
     * with real contrast in it stops being a fibre and becomes a *motif* — the
     * eye finds the repeat instantly once a mark is dark enough to recognise,
     * and a curtain with a recognisable repeat is a printed one.
     */
    ctx.fillStyle =
      rand() > 0.5 ? "rgba(255,252,244,0.26)" : "rgba(112,98,78,0.17)";
    ctx.fillRect(
      rand() * S,
      rand() * S,
      horizontal ? len : 1.6,
      horizontal ? 1.6 : len,
    );
  }

  /*
   * No shading baked in, which is the whole point of this note.
   *
   * The first version put a top-to-bottom gradient in here to darken the
   * gather and lighten the hem. It tiles six times down the drop, so what it
   * actually produced was six evenly spaced dark bands — the curtain came out
   * looking like a fluted concrete column. Anything that varies over the length
   * of the *object* cannot live in a texture that repeats along it; the
   * lighting already does this job, and does it from the right direction.
   */
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  // Fine enough that the weave stays a tone rather than a pattern.
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
      {/* The pole. Above the frame's top edge, so it's cropped out of the rest
          pose — but it exists, because leaning in moves the camera. */}
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

      {/*
        Rings, bunched where the panel is gathered.

        Spread across the panel's *top* width rather than the pole's length,
        which is the whole difference between a curtain drawn back and one left
        half-shut — an open curtain's rings pile up against the end stop.
      */}
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

      {/*
        The panel itself.

        Double-sided, and not for the usual reason. It's a closed column, so
        every back face is behind a front face — except at the hem, where you
        look up into the open bottom of it from a seated eye below the window
        sill. Single-sided leaves a hole there.
      */}
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
