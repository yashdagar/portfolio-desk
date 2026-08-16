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
 * The third version had the geometry right and the paint wrong, which took a
 * photograph of a real cube to see. Every chamfer facing a gap was faded to the
 * black core, so each tile ended up as a field of colour with a dark border
 * drawn around it — which is a *sticker*, the exact thing two paragraphs above
 * say this cube doesn't have. Look at a stickerless cube and the gaps on the
 * white face are white and the gaps on the green face are green: the shell of
 * each piece is coloured plastic all the way over the shoulder and down into
 * the slot, and the only truly black part is the deep interior, turned away
 * from every facelet. So the shoulder keeps its colour and the slot wall is the
 * same colour with no light on it, which is `SHADOW` below.
 *
 * The fourth version was still being judged in the wrong place. Magnified, it
 * was plainly round; on the desk it was a mosaic of flat squares — and the desk
 * is where this object is, about 60 px across, with each tile ~18 px of which
 * the entire rounded shoulder is three. Rounding three pixels does nothing for
 * the other fifteen. What fixed it was `DOME` below, which crowns each facelet
 * so the whole tile carries a gradient, plus enough gloss for the lamp to lay a
 * specular streak along that crown. At this size the streak *is* the roundness;
 * the geometry only decides where it falls.
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
/*
 * Brighter than the previous set, and the red/orange pair is the reason.
 *
 * Every one of these goes through convertSRGBToLinear, a dim room, and ACES
 * tonemapping before it reaches the screen, and all three of those pull toward
 * the middle. A #d92d20 red and a #f28c28 orange are a clear pair on a colour
 * picker and arrived at the renderer close enough that the two faces read as
 * one — which is the single worst thing that can happen to a cube, since
 * telling red from orange at a glance is what the colour scheme is *for*.
 *
 * So the orange is pushed well up and warm rather than sitting between red and
 * yellow, and the green and blue are lifted out of the near-black they were
 * landing in. The white stays a touch off, because a pure #ffffff facelet next
 * to the desk's brightest highlight blows out.
 */
const FACE_COLOURS: Record<string, string> = {
  "1,0,0": "#ee1b2e", // R — red
  "-1,0,0": "#ff7a17", // L — orange
  "0,1,0": "#f6f6f3", // U — white
  "0,-1,0": "#ffd21e", // D — yellow
  "0,0,1": "#00cf66", // F — green
  "0,0,-1": "#1157cc", // B — blue
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

/**
 * How far each cubie is blended toward a sphere through its face centres.
 *
 * A facelet is not flat. Every version of this cube before now assumed it was,
 * and that assumption survived four rounds of adjusting the radius because a
 * flat tile with rounded edges genuinely does look round when you magnify it —
 * the shoulder is right there, curving. It doesn't survive being looked at from
 * across a desk, which is where this object actually lives: at about 60 px the
 * whole shoulder is three pixels and the eleven pixels of tile between two
 * shoulders are a single flat colour. Eighteen pixels of unshaded colour is a
 * square, and no amount of rounding three of them fixes that.
 *
 * Real mouldings are pillowed, and the reason is manufacturing rather than
 * design — a perfectly flat face sinks as the plastic cools, so it's tooled
 * with a slight crown so it comes out flat-ish. Look at a photograph and you
 * can see it: each tile carries its own soft gradient, brightest where it faces
 * the light, and that gradient is what says "moulded" at any size at all.
 */
const DOME = 0.2;

/**
 * Bulge each face outward, by blending every vertex toward the sphere that
 * passes through the face centres.
 *
 * The centre of a face already sits at that radius so it doesn't move; the
 * further out toward an edge a vertex is, the further it has to come in, which
 * leaves the face crowned. Normals are recomputed afterwards — they're the
 * whole point, since they're what both the shading and the vertex colouring
 * below read.
 */
function dome(geo: BufferGeometry) {
  const half = CUBE.cubie / 2;
  const position = geo.attributes.position;
  const v = new Vector3();
  const onSphere = new Vector3();

  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    onSphere.copy(v).normalize().multiplyScalar(half);
    v.lerp(onSphere, DOME);
    position.setXYZ(i, v.x, v.y, v.z);
  }

  position.needsUpdate = true;
  geo.computeVertexNormals();
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** The unpainted plastic, seen in the gaps between cubies. */
const CORE_BLACK = "#0b0c0e";
/** The same, kept as a Color so the chamfer can be mixed toward it per vertex. */
const CORE = new Color(CORE_BLACK);

/**
 * How much light reaches the wall of a slot, relative to the facelet beside it.
 *
 * Baked into the vertex colour rather than left to the renderer because the
 * slot is 0.3 mm wide: nothing in the lighting rig resolves a shadow at that
 * scale, and there's no ambient occlusion pass to do it either. Without this
 * the walls render at full brightness and the grooves disappear entirely.
 */
const SHADOW = 0.46;

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
  /** Scratch, for the shadowed version of whichever facelet is in play. */
  const shade = new Color();

  for (const c of cubies) {
    // Eight segments across the chamfer. At a 1.2 mm radius four was plenty and
    // the difference was invisible; at 3.2 mm the shoulder is a third of the
    // piece and every step in it shows as a facet, which breaks the highlight
    // that runs along the edge into dashes. That highlight is most of what says
    // "moulded" rather than "printed", so it has to be continuous.
    const geo = new RoundedBoxGeometry(
      CUBE.cubie,
      CUBE.cubie,
      CUBE.cubie,
      8,
      CUBE.bevel,
    );

    dome(geo);

    const normals = geo.attributes.normal;
    const colours = new Float32Array(normals.count * 3);
    const faces = faceColours(c);

    for (let v = 0; v < normals.count; v++) {
      const n = [normals.getX(v), normals.getY(v), normals.getZ(v)];
      // The dominant axis of the normal is the face this vertex belongs to,
      // and the runner-up is whichever face the chamfer is heading toward.
      const order = [0, 1, 2].sort((a, b) => Math.abs(n[b]) - Math.abs(n[a]));
      const [axis, next] = order;

      const faceAt = (a: number) => {
        const key = [0, 0, 0];
        key[a] = n[a] > 0 ? 1 : -1;
        return faces.get(key.join(",")) ?? CORE_BLACK;
      };

      const dominant = faceAt(axis);
      const toward = faceAt(next);
      /*
       * How far round the shoulder this vertex is: 1 where the surface has
       * turned 45° from the dominant face, 0 on the flat.
       */
      const turned = Math.min(1, Math.abs(n[next]) / Math.SQRT1_2);

      /*
       * Where the chamfer runs into a gap, take the colour down with it.
       *
       * Every cubie is one rounded solid painted by whichever face each normal
       * points most nearly toward, which splits each chamfer down the middle
       * between its two neighbours. On the cube's *outer* edges that's exactly
       * right — two facelets on the same piece meet colour to colour, with no
       * black line, which is what a stickerless cube does.
       *
       * On the edges facing the gaps between pieces it was wrong, and visibly:
       * the far half of the chamfer took the black core's colour but the near
       * half stayed fully saturated, so looking into a groove showed the
       * neighbouring facelet's colour instead of shadow. Reported as "the
       * insides of the cube have the same colour as the adjacent side", which
       * is precisely what it was.
       *
       * The fix is to ask what the chamfer is heading toward rather than to
       * darken every chamfer: if the runner-up face is core plastic, fade to it
       * across the chamfer; if it's another facelet, leave the colour alone.
       *
       * Where the fade *starts* is the whole difference between a speedcube and
       * a stickered one, and every version of this until now started it far too
       * early. Look at a photograph of a stickerless cube and the gaps on the
       * white face are *white*: the plastic is coloured all the way through the
       * piece's outer shell, so the colour wraps over the shoulder and carries
       * on down into the groove, and the only genuinely dark part is the thin
       * line at the very bottom where two pieces almost touch. Ramp from the
       * moment the surface begins to turn and you have painted a black border
       * around a flat square, which is a sticker — precisely the thing this
       * cube isn't.
       *
       * So the colour holds across almost the whole turn and gives up only in
       * the last of it — and it gives up to its own colour in shadow, not to
       * black. Smoothstep rather than a power curve because both ends have to
       * be soft: a hard start puts a visible ring around every tile, and a hard
       * finish puts a drawn line in the bottom of every groove.
       *
       * The three cases below are one continuous surface, and they're written
       * so they agree at the joins. At 45° the shoulder has reached exactly
       * `colour × SHADOW`, which is where the wall case starts; the wall then
       * runs down to the core's black as it turns away from its facelet. Get
       * that wrong and there's a visible ring at 45° on every edge of every
       * piece.
       */
      if (dominant !== CORE_BLACK) {
        colour.set(dominant);
        if (toward === CORE_BLACK) {
          shade.set(dominant).multiplyScalar(SHADOW);
          colour.lerp(shade, smoothstep(0.08, 1, turned));
        }
      } else if (toward !== CORE_BLACK) {
        /*
         * A wall of the slot between two pieces.
         *
         * This is the part that was black, and painting it black is what kept
         * the cube looking stickered: it drew a channel round every tile. The
         * shell of a moulded piece is coloured, so the wall beside a white
         * facelet is white plastic with no light on it — which is why the gaps
         * on the white face of a real cube are white and the gaps on the green
         * face are green. Only the deep interior, turned right away from any
         * facelet, is actually the black core.
         */
        shade.set(toward).multiplyScalar(SHADOW);
        colour.copy(CORE).lerp(shade, turned);
      } else {
        colour.set(CORE_BLACK);
      }

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
