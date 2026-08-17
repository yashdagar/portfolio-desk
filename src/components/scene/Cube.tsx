"use client";

import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Quaternion,
  Vector3,
} from "three";
import { mergeBufferGeometries, RoundedBoxGeometry } from "three-stdlib";

import { CUBE } from "@/lib/layout";

import * as M from "./materials";

/**
 * A stickerless speedcube, merged into one geometry so it's a single draw call.
 *
 * Stickerless is the constraint everything follows from and it went wrong
 * repeatedly: each facelet is its own coloured plastic and the colour wraps over
 * the chamfer into the slot, so the gaps on the white face are white. Only the
 * deep interior is black. Anything that puts a dark ring round a tile has made
 * it a sticker.
 *
 * Judge it at ~55 px, not magnified — `scripts/shot-cube.mjs` renders both. And
 * note the pad is not the only thing visible: a piece is a square box and a pad
 * isn't, so a strip of box shows past every pad's edge and the eye measures
 * *that* corner unless `carve` takes it out of the way.
 *
 * That strip was painted black for a long time before it was cut away, and paint
 * is not a shape: a flat square face lit across its whole width still reads as a
 * flat square however dark one end of it is. The pockets have to be holes.
 */

/**
 * Keyed by the *local* axis of a cubie, so colours travel with the piece.
 *
 * Brighter than they look on a picker: convertSRGBToLinear, a dim room and ACES
 * all pull toward the middle, and a picker-plausible red and orange arrived
 * close enough to read as one face.
 */
const FACE_COLOURS: Record<string, string> = {
  "1,0,0": "#ee1b2e", // R — red
  "-1,0,0": "#ff7a17", // L — orange
  "0,1,0": "#f6f6f3", // U — white
  "0,-1,0": "#ffd21e", // D — yellow
  "0,0,1": "#00cf66", // F — green
  "0,0,-1": "#1157cc", // B — blue
};

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
 * Turn a layer, moving both where each cubie is and which way it faces. Why the
 * cube is 26 oriented pieces rather than six grids of squares: rotating a
 * position and a quaternion together cannot produce an unreachable state, where
 * hand-written facelet adjacency cycles very easily can.
 */
function turn(cubies: Cubie[], axis: Vector3, layer: number, quarters: number) {
  const angle = (quarters * Math.PI) / 2;
  const rot = new Quaternion().setFromAxisAngle(axis, angle);

  for (const c of cubies) {
    if (Math.round(c.pos.dot(axis)) !== layer) continue;
    c.pos.applyQuaternion(rot);
    // Float drift leaves these at 0.9999999 after four turns, and the render
    // then reads the piece as off-lattice.
    c.pos.set(Math.round(c.pos.x), Math.round(c.pos.y), Math.round(c.pos.z));
    c.quat.premultiply(rot);
  }
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** Fixed, not random: a cube that rearranges itself between visits is something
 *  nobody notices and everybody feels. */
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

/** The two in-plane axes of each face axis, in ascending order. */
const PLANE: [number, number][] = [
  [1, 2],
  [0, 2],
  [0, 1],
];

/** Face slot, so everything per-face can live in a plain six-element array
 *  rather than a map keyed by a joined string built once per vertex. */
function slot(axis: number, sign: number): number {
  return axis * 2 + (sign > 0 ? 0 : 1);
}

/**
 * Which colour each of a cubie's six faces shows, in world axes, by slot.
 * Rotating a world direction back through the inverse asks "which face was this
 * before it was turned". Faces inside the cube are null, not a colour.
 */
function faceColours(c: Cubie): (string | null)[] {
  const inverse = new Quaternion().copy(c.quat).invert();
  const local = new Vector3();
  const out: (string | null)[] = [null, null, null, null, null, null];

  for (const [wx, wy, wz] of AXES) {
    const axis = wx !== 0 ? 0 : wy !== 0 ? 1 : 2;
    const sign = wx + wy + wz;
    if (c.pos.getComponent(axis) !== sign) continue;

    local.set(wx, wy, wz).applyQuaternion(inverse);
    const key = `${Math.round(local.x)},${Math.round(local.y)},${Math.round(
      local.z,
    )}`;
    out[slot(axis, sign)] = FACE_COLOURS[key];
  }

  return out;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const CORE_BLACK = "#0b0c0e";
const CORE = new Color(CORE_BLACK);

/** Slot-wall brightness, baked in because nothing in the rig resolves a shadow
 *  across 0.3 mm and there is no AO pass. Without it the grooves vanish. */
const SHADOW = 0.46;

const PITCH = CUBE.cubie + CUBE.gap;
/** Gap between a pad and the edge of the piece it's moulded into. */
const SEAM = 0.0006;
const PAD_HALF = CUBE.cubie / 2 - SEAM;
/**
 * Superellipse exponent per corner, indexed by how many of the two sides meeting
 * there lie on the outside of the cube. 2 is a circle, infinity a square. This
 * is the shape of the whole object.
 *
 * One exponent for a whole pad can never be right: a tile's outer side is the
 * cube's silhouette and has to stay straight, while the end pointing at the
 * middle of the face wants to be a semicircle. Per corner needs no cut and no
 * per-piece special case, and stays continuous because a superellipse passes
 * through exactly PAD_HALF on both axes for any exponent.
 */
const SQUARENESS = [2.05, 5.0, 9.0];
/** The centre has no outward side. Just off a circle, so it is built by the same
 *  rule rather than being a separate object dropped on top. */
const CENTRE_SQUARENESS = 2.05;
/** Below about 0.3 mm the lip casts nothing the rig can resolve and the pads
 *  read as painted on. */
const PAD_LIP = 0.00035;
const PAD_CROWN = 0.0008;
/** Biased toward the rim, where the pad turns down over the shoulder. */
const PAD_RINGS = 9;
const PAD_RING_BIAS = 1.7;
const PAD_STEPS = 64;
/** How dark the piece is where it shows around and between the pads. */
const BODY_DIM = 0.7;

/**
 * How far the piece falls away where no tile covers it. Under half the bevel, so
 * the rounded corner it eats into stays rounded rather than inverting.
 */
const GROOVE = 0.0011;
/** Flat land outside the rim before the fall, so a tile is seated in the piece
 *  rather than perched on a ridge of it. */
const GROOVE_LIP = 0.0003;
/** Wide, and it has to be: the pockets are the one place the piece is allowed to
 *  be soft, and a step here would alias at the size this is actually seen. */
const GROOVE_RAMP = 0.002;
/**
 * How far onto a face's own half of the piece a vertex must be before that
 * face's tile can shelter it from the carve — a tile can't reach round the back.
 *
 * By height rather than by which way the surface points, which sounds equivalent
 * and is not: a piece's side wall points away from its own top while still being
 * directly under the tile's edge, so a facing test carves the wall out from under
 * every tile and doubles the width of every seam. Ramped, and wide enough that
 * the ramp lands halfway down a wall no camera ever sees between two pieces.
 */
const SIDE = 0.003;

/**
 * The height of a piece's own surface at a point on its face. Solved rather than
 * guessed because the pads' rims have to land *on* it — the difference between a
 * facelet and a button is about a millimetre of daylight.
 */
function bodyHeight(u: number, v: number): number {
  const flat = CUBE.cubie / 2 - CUBE.bevel;
  const du = Math.max(0, Math.abs(u) - flat);
  const dv = Math.max(0, Math.abs(v) - flat);
  return flat + Math.sqrt(Math.max(0, CUBE.bevel ** 2 - du * du - dv * dv));
}

/**
 * How far a pad's rim is from its own middle, in one direction. `cu`/`cv` are
 * where the pad's centre falls on the face, and the shape is read from that
 * alone, so the pattern survives a scramble.
 *
 * Used both to build the outline and to decide where the piece underneath stops
 * being the pad. The two must agree exactly or a bright crescent appears along
 * one edge of every tile.
 */
function padRadius(
  centre: boolean,
  cu: number,
  cv: number,
  cos: number,
  sin: number,
): number {
  const n = centre
    ? CENTRE_SQUARENESS
    : SQUARENESS[
        Number(cos >= 0 ? cu > 0 : cu < 0) + Number(sin >= 0 ? cv > 0 : cv < 0)
      ];

  return PAD_HALF / Math.pow(Math.abs(cos) ** n + Math.abs(sin) ** n, 1 / n);
}

const RIM_STEPS = 48;
/** Direction at parameter t within each octant, as (a + b·t, c + d·t). */
const OCTANT: [number, number, number, number][] = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
];

/**
 * `padRadius` sampled by direction, once per face. The carve asks for the rim a
 * few hundred thousand times and three `pow`s each is most of a second.
 *
 * Indexed by octant and then by the ratio of the smaller in-plane coordinate to
 * the larger, which is one divide and is a bijection with angle inside an
 * octant. Octant boundaries fall on the axes and the diagonals, so the quadrant
 * an exponent belongs to never straddles two rows — the table is smooth wherever
 * the shape is.
 */
function rimTable(centre: boolean, cu: number, cv: number): Float32Array {
  const table = new Float32Array(8 * (RIM_STEPS + 1));

  for (let o = 0; o < 8; o++) {
    const [a, b, cc, d] = OCTANT[o];
    for (let k = 0; k <= RIM_STEPS; k++) {
      const t = k / RIM_STEPS;
      const du = a + b * t;
      const dv = cc + d * t;
      const len = Math.sqrt(du * du + dv * dv);
      table[o * (RIM_STEPS + 1) + k] = padRadius(
        centre,
        cu,
        cv,
        du / len,
        dv / len,
      );
    }
  }

  return table;
}

function rimAt(table: Float32Array, u: number, v: number): number {
  const au = Math.abs(u);
  const av = Math.abs(v);
  const wide = au >= av;
  const t = wide ? (au === 0 ? 0 : av / au) : au / av;

  const o = u >= 0 ? (v >= 0 ? (wide ? 0 : 1) : wide ? 7 : 6) : v >= 0 ? (wide ? 3 : 2) : wide ? 4 : 5;

  const f = t * RIM_STEPS;
  const i = f >= RIM_STEPS ? RIM_STEPS - 1 : f | 0;
  const at = o * (RIM_STEPS + 1) + i;
  return table[at] + (table[at + 1] - table[at]) * (f - i);
}

interface Face {
  axis: number;
  sign: number;
  rim: Float32Array;
}

/**
 * How much of the piece survives at a point: 1 under a tile, 0 out in the open.
 *
 * A max over the faces, not a blend, because a point on the chamfer between two
 * tiles belongs to whichever one still reaches it — blending would sink the
 * shared edge, and that edge is the cube's silhouette. The pads overhang the
 * chamfer by design (`PAD_HALF` is 8.7 mm, the chamfer's midpoint 8.66), so two
 * tiles meeting on an edge shelter it between them with nothing left over.
 */
function shelter(faces: Face[], p: number[]): number {
  let keep = 0;

  for (const f of faces) {
    const side = smoothstep(0, SIDE, p[f.axis] * f.sign);
    if (side <= 0) continue;

    const [across, down] = PLANE[f.axis];
    const u = p[across];
    const v = p[down];
    const rim = rimAt(f.rim, u, v);
    const out = Math.sqrt(u * u + v * v);

    const k =
      (1 - smoothstep(rim + GROOVE_LIP, rim + GROOVE_LIP + GROOVE_RAMP, out)) *
      side;
    if (k > keep) keep = k;
  }

  return keep;
}

function padOutline(centre: boolean, cu: number, cv: number): number[][] {
  const points: number[][] = [];

  for (let i = 0; i < PAD_STEPS; i++) {
    const angle = (i / PAD_STEPS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const r = padRadius(centre, cu, cv, cos, sin);
    points.push([r * cos, r * sin]);
  }

  return points;
}

/**
 * One pad: an outline, crowned, with a short skirt down to the piece.
 *
 * Rings rather than an extrusion, whose cap would be flat — and a flat cap is
 * what stops a tile reading as moulded at desk size. The spherical profile puts
 * the highlight in a line around the pad's edge rather than a blob in the middle.
 */
function padGeometry(
  centre: boolean,
  cu: number,
  cv: number,
  axis: number,
  sign: number,
  colour: Color,
  rim: Color,
): BufferGeometry {
  const outline = padOutline(centre, cu, cv);

  // Every height is measured from the piece's own surface rather than from a
  // plane, so the pad follows the shoulder instead of hanging over it.
  const rings: number[][][] = [
    outline.map(([u, v]) => [u, v, bodyHeight(u, v)]),
  ];
  for (let i = 0; i < PAD_RINGS; i++) {
    const out = 1 - (i / PAD_RINGS) ** PAD_RING_BIAS;
    rings.push(
      outline.map(([u, v]) => {
        const su = u * out;
        const sv = v * out;
        return [
          su,
          sv,
          bodyHeight(su, sv) +
            PAD_LIP +
            PAD_CROWN * Math.sqrt(Math.max(0, 1 - out * out)),
        ];
      }),
    );
  }

  const positions: number[] = [];
  const colours: number[] = [];

  const place = (p: number[]) => {
    const [across, down] = [0, 1, 2].filter((a) => a !== axis);
    const xyz = [0, 0, 0];
    xyz[across] = p[0];
    xyz[down] = p[1];
    xyz[axis] = sign * p[2];
    return xyz;
  };

  const push = (p: number[], c: Color) => {
    const xyz = place(p);
    positions.push(xyz[0], xyz[1], xyz[2]);
    colours.push(c.r, c.g, c.b);
  };

  // Two things flip the winding and they can cancel: (x, z, y) is a swap, not a
  // rotation, so the in-plane axes are left-handed for Y; and a pad down a
  // negative axis flips again. Wrong, the normals face inward — which presents
  // as a lighting bug, because the silhouette stays correct.
  const flip = (axis === 1) !== (sign < 0);
  const tri = (a: number[], b: number[], d: number[], ca: Color, cb: Color) => {
    if (flip) {
      push(d, cb);
      push(b, cb);
      push(a, ca);
    } else {
      push(a, ca);
      push(b, cb);
      push(d, cb);
    }
  };

  for (let r = 0; r < rings.length - 1; r++) {
    const lower = rings[r];
    const upper = rings[r + 1];
    // The skirt is the piece's own plastic in shadow, not the facelet.
    const a = r === 0 ? rim : colour;

    for (let i = 0; i < PAD_STEPS; i++) {
      const j = (i + 1) % PAD_STEPS;
      tri(lower[i], upper[j], upper[i], a, colour);
      tri(lower[i], lower[j], upper[j], a, a);
    }
  }

  const top = rings[rings.length - 1];
  const peak = [0, 0, CUBE.cubie / 2 + PAD_LIP + PAD_CROWN];
  for (let i = 0; i < PAD_STEPS; i++) {
    const j = (i + 1) % PAD_STEPS;
    tri(top[i], top[j], peak, colour, colour);
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Cut the piece back to the shape its colours already claim, so a four-tile
 * pocket is a hole with sides that catch the light rather than a dark patch on a
 * flat block.
 *
 * Displacement is along the vertex's own normal, which keeps a chamfer a chamfer
 * and a corner a corner instead of pushing everything straight down one axis. In
 * exchange the normals have to be rebuilt, and `computeVertexNormals` can't do
 * it: `RoundedBoxGeometry` is non-indexed and analytically smooth, so recomputing
 * from the triangles would facet the whole cube. Two samples of the depth along
 * the surface give the slope instead, which is all a normal is.
 */
function carve(geo: BufferGeometry, faces: Face[]) {
  const positions = geo.attributes.position.array as Float32Array;
  const normals = geo.attributes.normal.array as Float32Array;
  /** Under the mesh's own spacing, so the slope is the carve's and not the box's. */
  const STEP = 0.00035;

  const p = [0, 0, 0];
  const n = [0, 0, 0];
  const at = [0, 0, 0];

  for (let i = 0; i < positions.length; i += 3) {
    p[0] = positions[i];
    p[1] = positions[i + 1];
    p[2] = positions[i + 2];
    n[0] = normals[i];
    n[1] = normals[i + 1];
    n[2] = normals[i + 2];

    const depth = GROOVE * (1 - shelter(faces, p));

    // Any two directions across the surface will do; cross with whichever axis
    // the normal leans on least, or the two come out parallel.
    const ax = Math.abs(n[0]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(n[2]);
    let ux: number, uy: number, uz: number;
    if (ax <= ay && ax <= az) {
      ux = 0;
      uy = n[2];
      uz = -n[1];
    } else if (ay <= az) {
      ux = -n[2];
      uy = 0;
      uz = n[0];
    } else {
      ux = n[1];
      uy = -n[0];
      uz = 0;
    }
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const wx = n[1] * uz - n[2] * uy;
    const wy = n[2] * ux - n[0] * uz;
    const wz = n[0] * uy - n[1] * ux;

    at[0] = p[0] + STEP * ux;
    at[1] = p[1] + STEP * uy;
    at[2] = p[2] + STEP * uz;
    const du = GROOVE * (1 - shelter(faces, at)) - depth;

    at[0] = p[0] + STEP * wx;
    at[1] = p[1] + STEP * wy;
    at[2] = p[2] + STEP * wz;
    const dv = GROOVE * (1 - shelter(faces, at)) - depth;

    const mx = STEP * n[0] + du * ux + dv * wx;
    const my = STEP * n[1] + du * uy + dv * wy;
    const mz = STEP * n[2] + du * uz + dv * wz;
    const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;

    positions[i] = p[0] - n[0] * depth;
    positions[i + 1] = p[1] - n[1] * depth;
    positions[i + 2] = p[2] - n[2] * depth;
    normals[i] = mx / ml;
    normals[i + 1] = my / ml;
    normals[i + 2] = mz / ml;
  }
}

/**
 * Each cubie is one rounded box, not three coloured slabs — those meet at a
 * right angle where they wrap a corner and leave the silhouette square in the
 * eight places you actually look. Vertices take the colour of whichever face
 * their normal points most nearly toward, so a chamfer between two facelets
 * splits down the middle with colour meeting colour and no black line.
 */
function buildCube(): BufferGeometry {
  const cubies: Cubie[] = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = -1; k <= 1; k++) {
        // A real cube's middle is a spindle, not a cubie.
        if (i === 0 && j === 0 && k === 0) continue;
        cubies.push({ pos: new Vector3(i, j, k), quat: new Quaternion() });
      }
    }
  }

  for (const [axis, layer, quarters] of SCRAMBLE) {
    turn(cubies, axis, layer, quarters);
  }

  const parts: BufferGeometry[] = [];
  const colour = new Color();
  const shade = new Color();

  for (const c of cubies) {
    // More segments than a rounded box needs, because this one is also the
    // canvas the carve is cut into and the surface a vertex colour is painted
    // on, and both are only as sharp as the mesh under them. Twelve is 0.74 mm
    // between samples: three across the groove's ramp, and under the width of
    // the colour's own.
    const geo = new RoundedBoxGeometry(
      CUBE.cubie,
      CUBE.cubie,
      CUBE.cubie,
      12,
      CUBE.bevel,
    );

    const normals = geo.attributes.normal.array as Float32Array;
    const points = geo.attributes.position.array as Float32Array;
    const count = geo.attributes.position.count;
    const colours = new Float32Array(count * 3);

    const hues = faceColours(c);
    // Per face rather than per vertex: a million `multiplyScalar`s and a million
    // joined map keys were most of this function's second.
    const tint = (by: number) => (h: string | null) =>
      h ? new Color(h).multiplyScalar(by) : null;
    const lit = hues.map(tint(BODY_DIM));
    const sunk = hues.map(tint(SHADOW * BODY_DIM));
    const walls = hues.map(tint(SHADOW));
    const rims = hues.map((h, s): Float32Array | null => {
      if (!h) return null;
      const [across, down] = PLANE[s >> 1];
      const cu = c.pos.getComponent(across) * PITCH;
      const cv = c.pos.getComponent(down) * PITCH;
      return rimTable(cu === 0 && cv === 0, cu, cv);
    });

    const faces: Face[] = [];
    for (let axis = 0; axis < 3; axis++) {
      const sign = c.pos.getComponent(axis);
      const s = slot(axis, sign);
      if (sign !== 0 && rims[s]) faces.push({ axis, sign, rim: rims[s]! });
    }

    for (let v = 0; v < count; v++) {
      const i = v * 3;
      const nx = normals[i];
      const ny = normals[i + 1];
      const nz = normals[i + 2];
      const ax = Math.abs(nx);
      const ay = Math.abs(ny);
      const az = Math.abs(nz);

      // Dominant axis is the face this vertex belongs to; the runner-up is
      // whichever face the chamfer is heading toward.
      let axis: number, next: number;
      if (ax >= ay && ax >= az) {
        axis = 0;
        next = ay >= az ? 1 : 2;
      } else if (ay >= az) {
        axis = 1;
        next = ax >= az ? 0 : 2;
      } else {
        axis = 2;
        next = ax >= ay ? 0 : 1;
      }

      const nNext = next === 0 ? nx : next === 1 ? ny : nz;
      const here = slot(axis, (axis === 0 ? nx : axis === 1 ? ny : nz) > 0 ? 1 : -1);
      const over = slot(next, nNext > 0 ? 1 : -1);

      const dominant = hues[here];
      const toward = hues[over];
      /** 1 where the surface has turned 45° from the dominant face, 0 on flat. */
      const turned = Math.min(1, Math.abs(nNext) / Math.SQRT1_2);

      /*
       * Three cases that have to agree at the joins: at 45° the shoulder reaches
       * exactly `colour × SHADOW`, which is where the wall case starts, or there
       * is a visible ring at 45° on every edge.
       *
       * The shoulder's colour holds across almost the whole turn and gives up
       * only at the very bottom, to its own colour in shadow rather than black.
       * Ramping from the moment the surface starts to turn paints a border round
       * a flat square, which is a sticker.
       */
      if (dominant) {
        // Dimmed: the facelet is the pad above this, and what's left of the
        // piece's face is the frame around it, sitting a little lower.
        colour.copy(lit[here]!);
        if (!toward) colour.lerp(sunk[here]!, smoothstep(0.08, 1, turned));

        /*
         * Outside the pad the piece stops being a facelet and becomes a hole.
         * How much box shows past the pad varies from 0.6 mm of seam along the
         * axes — which must stay coloured or every tile gets a border — to
         * 4.5 mm of open void at the diagonals. Measuring from the pad's own rim
         * handles both: near the axes nothing ever reaches the ramp.
         */
        const [across, down] = PLANE[axis];
        const bu = points[i + across];
        const bv = points[i + down];
        const out = Math.sqrt(bu * bu + bv * bv);
        if (out > 0) {
          const rim = rimAt(rims[here]!, bu, bv);
          colour.lerp(CORE, smoothstep(rim + 0.0002, rim + 0.001, out));
        }
      } else if (toward) {
        // A slot wall: the same coloured plastic with no light on it, not black.
        colour.copy(CORE).lerp(walls[over]!, turned);
      } else {
        colour.copy(CORE);
      }

      // Vertex colours are read in linear space; the hex strings are sRGB.
      colour.convertSRGBToLinear();
      colours[v * 3] = colour.r;
      colours[v * 3 + 1] = colour.g;
      colours[v * 3 + 2] = colour.b;
    }

    // After the colours, which are read off where the box was, not where it ends
    // up: the two agree on the rim and would drift apart if the carve went first.
    carve(geo, faces);

    geo.setAttribute("color", new BufferAttribute(colours, 3));
    geo.deleteAttribute("uv");
    geo.translate(c.pos.x * PITCH, c.pos.y * PITCH, c.pos.z * PITCH);
    parts.push(geo.index ? geo.toNonIndexed() : geo);

    for (const { axis, sign } of faces) {
      const hue = hues[slot(axis, sign)]!;
      const [across, down] = PLANE[axis];
      const cu = c.pos.getComponent(across) * PITCH;
      const cv = c.pos.getComponent(down) * PITCH;

      colour.set(hue).convertSRGBToLinear();
      shade.set(hue).multiplyScalar(SHADOW * BODY_DIM).convertSRGBToLinear();

      const pad = padGeometry(cu === 0 && cv === 0, cu, cv, axis, sign, colour, shade);
      pad.translate(c.pos.x * PITCH, c.pos.y * PITCH, c.pos.z * PITCH);
      parts.push(pad);
    }
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
      // Turned off square, the way one sits where it was put down.
      rotation={[0, 0.42, 0]}
      castShadow
      receiveShadow
    >
      {/* `vertexColors` multiplies into the base colour, so it has to stay white
          here — anything else tints all six faces and the cube goes muddy. */}
      <meshStandardMaterial {...M.CUBE_PLASTIC} vertexColors />
    </mesh>
  );
}
