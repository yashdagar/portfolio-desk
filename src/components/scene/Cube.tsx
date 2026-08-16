"use client";

import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  Color,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeBufferGeometries, RoundedBoxGeometry } from "three-stdlib";

import { CUBE } from "@/lib/layout";

import * as M from "./materials";

/**
 * A speedcube, on the right-hand end of the desk.
 *
 * The most saturated object in a room built almost entirely out of greys and
 * warm browns, and that's the point: everything else on this desk is a
 * manufactured neutral, so six flat primaries in one 56 mm object is the only
 * bit of pure colour in the frame. It also does something the notebook beside
 * it can't — it says the desk belongs to someone who fiddles.
 *
 * Modelled as a real speedcube rather than a Rubik's-brand one, which is a
 * different object: 56 mm instead of 57, and heavily chamfered so the layers
 * can be forced round a corner mid-turn. Those bevels are most of what you
 * actually see, because they catch a highlight along every edge, and a cube
 * without them renders as a solid colour block with lines drawn on it.
 *
 * Stickerless, which means there are no black borders. The first version had
 * them — coloured tiles inset into a black body, which is what a *stickered*
 * cube looks like and what everyone pictures when they think of a Rubik's cube.
 * A modern speedcube isn't made that way: each facelet is its own piece of
 * coloured plastic and the colour wraps right over the chamfer to the edge, so
 * all you see between two faces is a hairline of shadow where they meet.
 *
 * The second version got the colour right and the corners wrong. Coloured slabs
 * laid on each outward face are rounded individually, but where three of them
 * meet at a corner of the cube they meet at a right angle — so the cube was
 * rounded everywhere except the eight places you look at, and its silhouette
 * came out square. A cubie is a single rounded solid, and the only honest way
 * to draw it is as one: every cubie here is one rounded box, and its faces are
 * coloured by *vertex*, with each vertex taking the colour of whichever face
 * its normal points most nearly toward. The chamfer between two coloured faces
 * ends up split down the middle, colour meeting colour, which is exactly what
 * the moulding does.
 *
 * All twenty-six merge into one geometry, so the whole cube is a single draw
 * call — cheaper than the version it replaces, and the corners are round.
 */

/**
 * Face colours, in the Western scheme: white opposite yellow, green opposite
 * blue, red opposite orange.
 *
 * Keyed by the *local* axis of a cubie, so a cubie carries its colours with it
 * when a layer turns — which is what makes the scramble below produce a real
 * cube state instead of a randomly repainted one.
 */
const FACE_COLOURS: Record<string, string> = {
  "1,0,0": "#d92d20", // R — red
  "-1,0,0": "#f28c28", // L — orange
  "0,1,0": "#f5f5f2", // U — white
  "0,-1,0": "#f5d90a", // D — yellow
  "0,0,1": "#12a150", // F — green
  "0,0,-1": "#1f6fd4", // B — blue
};

/** The six face normals, as a list. */
const AXES: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

interface Cubie {
  /** Grid position, each component in {−1, 0, 1}. */
  pos: Vector3;
  /** Accumulated rotation, which is what carries the colours around. */
  quat: Quaternion;
}

/**
 * Turn a layer, moving both where each cubie is and which way it faces.
 *
 * This is why the cube is modelled as 26 oriented pieces rather than as six
 * grids of coloured squares. Getting a facelet model right means writing out
 * the adjacency cycles for all six faces by hand and being certain about the
 * orientation each face is indexed in — a well-known source of off-by-one
 * scrambles that look plausible and are illegal. Rotating a position and a
 * quaternion by the same 90° cannot produce a state the cube can't reach,
 * because it's what the cube does.
 */
function turn(cubies: Cubie[], axis: Vector3, layer: number, quarters: number) {
  const angle = (quarters * Math.PI) / 2;
  const rot = new Quaternion().setFromAxisAngle(axis, angle);

  for (const c of cubies) {
    if (Math.round(c.pos.dot(axis)) !== layer) continue;
    c.pos.applyQuaternion(rot);
    // Positions must stay exactly on the grid; floating point after four turns
    // leaves them at 0.9999999, and the render then reads them as off-lattice.
    c.pos.set(Math.round(c.pos.x), Math.round(c.pos.y), Math.round(c.pos.z));
    c.quat.premultiply(rot);
  }
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/**
 * The scramble.
 *
 * Fixed, not random, for the same reason the plant's leaves are: a cube that
 * silently rearranges itself between visits is the kind of thing nobody
 * consciously notices and everybody feels. Eight quarter-turns across all three
 * axes — enough that no face is anywhere near solved, which is what a cube
 * someone actually uses looks like when they put it down.
 */
const SCRAMBLE: [Vector3, number, number][] = [
  [X, 1, 1],
  [Y, 1, -1],
  [Z, 1, 1],
  [X, -1, 1],
  [Y, -1, 2],
  [Z, -1, -1],
  [X, 1, -1],
  [Y, 1, 1],
];

/**
 * Which colour each of a cubie's six faces shows, in world axes.
 *
 * The colours live in the cubie's *local* frame and never move; the cubie does.
 * Rotating a world direction back through the cubie's inverse rotation asks
 * "which face was this before it was turned", which is exactly the question a
 * colour lookup needs to answer. Faces that end up inside the cube get the
 * black plastic instead — they're the mould, not a facelet.
 */
function faceColours(c: Cubie): Map<string, string> {
  const inverse = new Quaternion().copy(c.quat).invert();
  const local = new Vector3();
  const out = new Map<string, string>();

  for (const [wx, wy, wz] of AXES) {
    const onSurface =
      (wx !== 0 && c.pos.x === wx) ||
      (wy !== 0 && c.pos.y === wy) ||
      (wz !== 0 && c.pos.z === wz);

    if (!onSurface) {
      out.set(`${wx},${wy},${wz}`, CORE_BLACK);
      continue;
    }

    local.set(wx, wy, wz).applyQuaternion(inverse);
    const key = `${Math.round(local.x)},${Math.round(local.y)},${Math.round(
      local.z,
    )}`;
    out.set(`${wx},${wy},${wz}`, FACE_COLOURS[key]);
  }

  return out;
}

/** The unpainted plastic, seen in the gaps between cubies. */
const CORE_BLACK = "#0b0c0e";

/**
 * The whole cube as one geometry, coloured per vertex.
 *
 * Each cubie is a rounded box translated into place; its vertices are painted
 * by asking which way each normal points. A normal on a flat face is exactly an
 * axis and picks that face's colour outright; a normal on a chamfer is a blend
 * of two or three, and its dominant component decides — so the chamfer's
 * colour changes over halfway along it, which is where two mouldings meet.
 */
function buildCube(): BufferGeometry {
  const cubies: Cubie[] = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = -1; k <= 1; k++) {
        // The core is never visible, and it's the one piece a real cube doesn't
        // have — the middle is a spindle, not a cubie.
        if (i === 0 && j === 0 && k === 0) continue;
        cubies.push({ pos: new Vector3(i, j, k), quat: new Quaternion() });
      }
    }
  }

  for (const [axis, layer, quarters] of SCRAMBLE) {
    turn(cubies, axis, layer, quarters);
  }

  const pitch = CUBE.cubie + CUBE.gap;
  const parts: BufferGeometry[] = [];
  const colour = new Color();

  for (const c of cubies) {
    const geo = new RoundedBoxGeometry(
      CUBE.cubie,
      CUBE.cubie,
      CUBE.cubie,
      4,
      CUBE.bevel,
    );

    const normals = geo.attributes.normal;
    const colours = new Float32Array(normals.count * 3);
    const faces = faceColours(c);

    for (let v = 0; v < normals.count; v++) {
      const n = [normals.getX(v), normals.getY(v), normals.getZ(v)];
      // The dominant axis of the normal is the face this vertex belongs to.
      let axis = 0;
      for (let a = 1; a < 3; a++) {
        if (Math.abs(n[a]) > Math.abs(n[axis])) axis = a;
      }
      const key = [0, 0, 0];
      key[axis] = n[axis] > 0 ? 1 : -1;

      colour.set(faces.get(key.join(",")) ?? CORE_BLACK);
      // Vertex colours are read in linear space; the hex strings are sRGB.
      colour.convertSRGBToLinear();
      colours[v * 3] = colour.r;
      colours[v * 3 + 1] = colour.g;
      colours[v * 3 + 2] = colour.b;
    }

    geo.setAttribute("color", new BufferAttribute(colours, 3));
    geo.translate(c.pos.x * pitch, c.pos.y * pitch, c.pos.z * pitch);
    parts.push(geo);
  }

  const merged = mergeBufferGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

export function Cube({ top }: { top: number }) {
  const geometry = useMemo(() => buildCube(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[CUBE.x, top + (CUBE.cubie * 3 + CUBE.gap * 2) / 2, CUBE.z]}
      // Turned off square and tipped a few degrees, the way one sits where it
      // was put down rather than where it was placed.
      rotation={[0, 0.42, 0]}
      castShadow
      receiveShadow
    >
      {/*
        One material for fifty-four facelets and the plastic between them.

        `vertexColors` multiplies the attribute into the material's base colour,
        so the colour has to stay white here — anything else tints all six faces
        by the same amount and the whole cube goes muddy.
      */}
      <meshStandardMaterial {...M.CUBE_PLASTIC} vertexColors />
    </mesh>
  );
}
