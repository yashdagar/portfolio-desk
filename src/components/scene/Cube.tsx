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
 * A speedcube, on the right-hand end of the desk.
 *
 * The only saturated object in a room of greys and warm browns, and the one
 * thing on the desk that says someone fiddles. Modelled as a modern speedcube
 * rather than a Rubik's-brand one: 56 mm, heavily chamfered, and *stickerless*.
 *
 * Stickerless is the constraint everything else follows from, and it went wrong
 * repeatedly, so: each facelet is its own piece of coloured plastic, and the
 * colour wraps over the chamfer and down into the slot. There are no black
 * borders. The gaps on the white face are white and the gaps on the green face
 * are green — only the deep interior, turned away from every facelet, is black.
 * Any change that puts a dark ring around a tile has made it a sticker.
 *
 * Two things this is easy to get wrong, both of which cost several rounds:
 *
 *  - **Judge it on the desk, not magnified.** It is ~55 px across, each tile
 *    ~18 px. Detail that only survives at 8× isn't there. `scripts/shot-cube.mjs`
 *    renders both.
 *  - **The pad is not the only thing you see.** A piece is a square box and a
 *    pad isn't square, so a strip of box shows past every pad's edge and the eye
 *    measures *that* corner. `SQUARENESS` shapes the pad; the fade against
 *    `padRadius` in `buildCube` stops the box behind it being what reads.
 *
 * All twenty-six pieces merge into one geometry, so the cube is a single draw
 * call.
 */

/**
 * Face colours, in the Western scheme, keyed by the *local* axis of a cubie so
 * the colours travel with the piece when a layer turns.
 *
 * Brighter than they look on a picker, because every one goes through
 * convertSRGBToLinear, a dim room and ACES tonemapping, all of which pull toward
 * the middle. A #d92d20 red and a #f28c28 orange arrived close enough to read as
 * one face — the single worst thing that can happen to a cube — so the orange is
 * pushed well up and warm rather than sitting between red and yellow. White is a
 * touch off #ffffff, which would blow out next to the desk's brightest
 * highlight.
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
 * Turn a layer, moving both where each cubie is and which way it faces.
 *
 * This is why the cube is 26 oriented pieces rather than six grids of coloured
 * squares. A facelet model needs the adjacency cycles for all six faces written
 * out by hand, which is a well-known source of scrambles that look plausible and
 * are illegal. Rotating a position and a quaternion by the same 90° cannot
 * produce an unreachable state, because it is what the cube does.
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

/**
 * Fixed, not random, for the same reason the plant's leaves are: a cube that
 * rearranges itself between visits is something nobody notices and everybody
 * feels. Eight quarter-turns, so no face is near solved.
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
 * Rotating a world direction back through the cubie's inverse rotation asks
 * "which face was this before it was turned", which is the question a colour
 * lookup needs answered. Faces that end up inside the cube get the black core.
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const CORE_BLACK = "#0b0c0e";
const CORE = new Color(CORE_BLACK);

/**
 * How much light reaches a slot wall, relative to the facelet beside it.
 *
 * Baked into the vertex colour because the slot is 0.3 mm wide: nothing in the
 * lighting rig resolves a shadow at that scale and there is no AO pass, so
 * without this the walls render at full brightness and the grooves vanish.
 */
const SHADOW = 0.46;

const PITCH = CUBE.cubie + CUBE.gap;
/** Gap between a pad and the edge of the piece it's moulded into. */
const SEAM = 0.0006;
const PAD_HALF = CUBE.cubie / 2 - SEAM;
/**
 * How square each corner of a pad is, indexed by how many of the two sides
 * meeting there lie on the outside of the cube. This is the shape of the whole
 * object, in three numbers.
 *
 * A superellipse exponent is a rounded square as one value: 2 is a circle,
 * infinity a square. One exponent for a whole pad can never be right, because a
 * tile's outer side is also the cube's silhouette and wants to stay a straight
 * line, while the end pointing at the middle of the face wants to be a
 * semicircle. Round everything and the silhouette comes out chewed; square
 * everything and you have nine tiles that were never made for the disc between
 * them.
 *
 * Choosing per corner needs no cut, no second outline and no per-piece special
 * case: a corner piece keeps a hard corner at the cube's corner, an edge piece
 * presents a broad tongue at the centre, the centre is a disc, and where four
 * round ends meet they leave the open void a real face has there.
 *
 * Continuous by construction — a superellipse passes through exactly PAD_HALF
 * on both axes for any exponent, so quadrants built with different exponents
 * still meet. Only the tangent kinks, at four points that are straight runs.
 */
const SQUARENESS = [2.05, 5.0, 9.0];
/**
 * The centre, which has no outward side. Just off a circle rather than exactly
 * one, so it is built by the same rule as everything else rather than being a
 * separate object dropped on top.
 */
const CENTRE_SQUARENESS = 2.05;
/**
 * How far a pad's rim stands proud of the piece, and how much higher its middle
 * is than its rim. Below about 0.3 mm the lip stops casting anything the rig can
 * resolve and the pads read as painted on.
 */
const PAD_LIP = 0.00035;
const PAD_CROWN = 0.0008;
/**
 * Rings across a pad, biased toward the rim — the outer quarter of the radius is
 * where the pad turns down over the shoulder, and even spacing puts one ring
 * across all of that and eight across the nearly flat middle.
 */
const PAD_RINGS = 9;
const PAD_RING_BIAS = 1.7;
const PAD_STEPS = 64;
/** How dark the piece is where it shows around and between the pads. */
const BODY_DIM = 0.7;

/**
 * The height of a piece's own surface at a point on its face: flat across the
 * middle, then a quarter-round of `bevel` toward each edge.
 *
 * Solved rather than sampled because the pads' rims have to land *on* this and
 * not above it — the difference between a facelet and a button is about a
 * millimetre of daylight.
 */
function bodyHeight(u: number, v: number): number {
  const flat = CUBE.cubie / 2 - CUBE.bevel;
  const du = Math.max(0, Math.abs(u) - flat);
  const dv = Math.max(0, Math.abs(v) - flat);
  return flat + Math.sqrt(Math.max(0, CUBE.bevel ** 2 - du * du - dv * dv));
}

/**
 * How far a pad's rim is from its own middle, in one direction.
 *
 * `cu`/`cv` are where the pad's centre falls on the cube's face, and the shape
 * is read from that alone — a pad in the `+u` column has its `+u` side on the
 * outside of the cube — so a pad never has to know which piece it belongs to.
 * Which is why the pattern survives a scramble.
 *
 * Used twice: to build the outline, and to decide where the piece underneath
 * stops being the pad. Both have to agree exactly, or a bright crescent appears
 * along one edge of every tile.
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
 * Rings scaled toward the middle rather than an extrusion, whose cap would be
 * flat — and a flat cap is what stops a tile reading as moulded at desk size.
 * The profile is a spherical cap, leaving the rim vertically and flattening
 * toward the middle, which puts the highlight in a line around the pad's edge
 * rather than a blob in the centre of it.
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

  /*
   * Two things flip the winding and they can cancel: taking the in-plane axes
   * in ascending order gives a right-handed frame for X and Z but a left-handed
   * one for Y — (x, z, y) is a swap, not a rotation — and a pad pointing down a
   * negative axis flips again. Get it wrong and the normals face inward, which
   * presents as a lighting bug because the silhouette is still correct.
   */
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
 * The whole cube as one geometry, coloured per vertex.
 *
 * Each cubie is one rounded box — not three coloured slabs, which meet at a
 * right angle where they wrap a corner and leave the silhouette square in the
 * eight places you actually look. Its vertices are painted by which way each
 * normal points: a normal on a flat face is exactly an axis and takes that
 * face's colour, and one on a chamfer is a blend whose dominant component
 * decides, so a chamfer between two facelets splits down the middle with colour
 * meeting colour and no black line.
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
    /*
     * Eighteen segments is far more than the shape needs and exactly what the
     * paint needs. Eight was plenty for the chamfer, but the box now also
     * carries where the pad ends as a vertex colour, and a vertex colour is only
     * as sharp as the mesh under it: at eight the samples are 2.3 mm apart on an
     * 18.6 mm face and every tile edge came out dithered. Eighteen puts them at
     * 1 mm, under the seam's own width.
     */
    const geo = new RoundedBoxGeometry(
      CUBE.cubie,
      CUBE.cubie,
      CUBE.cubie,
      18,
      CUBE.bevel,
    );

    const normals = geo.attributes.normal;
    const points = geo.attributes.position;
    const colours = new Float32Array(normals.count * 3);
    const faces = faceColours(c);

    for (let v = 0; v < normals.count; v++) {
      const n = [normals.getX(v), normals.getY(v), normals.getZ(v)];
      // Dominant axis is the face this vertex belongs to; the runner-up is
      // whichever face the chamfer is heading toward.
      const order = [0, 1, 2].sort((a, b) => Math.abs(n[b]) - Math.abs(n[a]));
      const [axis, next] = order;

      const faceAt = (a: number) => {
        const key = [0, 0, 0];
        key[a] = n[a] > 0 ? 1 : -1;
        return faces.get(key.join(",")) ?? CORE_BLACK;
      };

      const dominant = faceAt(axis);
      const toward = faceAt(next);
      /** 1 where the surface has turned 45° from the dominant face, 0 on flat. */
      const turned = Math.min(1, Math.abs(n[next]) / Math.SQRT1_2);

      /*
       * Three cases, written to agree at the joins: at 45° the shoulder has
       * reached exactly `colour × SHADOW`, which is where the wall case starts.
       * Get that wrong and there is a visible ring at 45° on every edge.
       *
       * Where the shoulder's fade *starts* is the difference between a speedcube
       * and a stickered one. Coloured plastic wraps over the shoulder and down
       * into the groove, so the colour has to hold across almost the whole turn
       * and give up only at the very bottom, to its own colour in shadow rather
       * than to black. Ramp from the moment the surface begins to turn and you
       * have painted a border around a flat square.
       */
      if (dominant !== CORE_BLACK) {
        // Dimmed, because the facelet is the pad above this. What is left of
        // the piece's face is the frame around it, sitting a little lower.
        colour.set(dominant).multiplyScalar(BODY_DIM);
        if (toward === CORE_BLACK) {
          shade.set(dominant).multiplyScalar(SHADOW * BODY_DIM);
          colour.lerp(shade, smoothstep(0.08, 1, turned));
        }

        /*
         * Outside the pad the piece stops being a facelet and becomes a hole.
         *
         * How much box shows past the pad varies enormously, and that is the
         * whole subtlety. Along the axes it is 0.6 mm of seam, which must stay
         * coloured or every tile gets a border. At the diagonals it is up to
         * 4.5 mm of open void, where a real cube shows its mechanism. Measuring
         * the fade from the pad's own rim in that direction handles both: near
         * the axes nothing ever reaches it, at the diagonals everything past it
         * goes black.
         */
        const [across, down] = [0, 1, 2].filter((a) => a !== axis);
        const bu = points.getComponent(v, across);
        const bv = points.getComponent(v, down);
        const out = Math.hypot(bu, bv);
        if (out > 0) {
          const rim = padRadius(
            c.pos.getComponent(across) === 0 && c.pos.getComponent(down) === 0,
            c.pos.getComponent(across) * PITCH,
            c.pos.getComponent(down) * PITCH,
            bu / out,
            bv / out,
          );
          colour.lerp(CORE, smoothstep(rim + 0.0002, rim + 0.001, out));
        }
      } else if (toward !== CORE_BLACK) {
        // A slot wall: the same coloured plastic with no light on it, not black.
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
    geo.deleteAttribute("uv");
    geo.translate(c.pos.x * PITCH, c.pos.y * PITCH, c.pos.z * PITCH);
    parts.push(geo.index ? geo.toNonIndexed() : geo);

    // A pad on each face this piece shows. Its shape comes from where the piece
    // sits on that face, not from what kind of piece it is, so a scramble
    // reassembles the pattern without anything having to track it.
    for (let axis = 0; axis < 3; axis++) {
      const sign = c.pos.getComponent(axis);
      if (sign === 0) continue;

      const hue = faces.get(
        [0, 1, 2].map((a) => (a === axis ? sign : 0)).join(","),
      );
      if (!hue || hue === CORE_BLACK) continue;

      const [across, down] = [0, 1, 2].filter((a) => a !== axis);
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
