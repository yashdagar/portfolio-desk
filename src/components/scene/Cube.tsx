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
 * the other fifteen. What fixed it was crowning each facelet — `PAD_CROWN`
 * below — so the whole tile carries a gradient, plus enough gloss for the lamp
 * to lay a specular streak along that crown. At this size the streak *is* the
 * roundness; the geometry only decides where it falls.
 *
 * The fifth version was missing the one feature no rounded box can produce: the
 * centre facelet of a real cube is a *disc*, and the four pieces around it are
 * cut back to arcs that follow it. Drawing that as a texture was the sixth
 * mistake — a picture of the right thing on the wrong shape. A circle painted
 * on a square tile reads as a decal, because the silhouette, the rim highlight
 * and the shadow in the seam all still belong to the square, and none of those
 * come from paint. So each facelet is now its own moulded pad with the outline
 * it actually has, standing proud of a piece that shows around it.
 *
 * The seventh version had one number where it needed three. Every pad was
 * rounded by the same amount, and a single amount can only ever be wrong: round
 * them enough and the *cube* stops being a cube, because a face's outer tiles
 * are also its silhouette and a row of pebbles has a chewed edge. Keep the
 * silhouette and every tile is a square with the corners knocked off. Look at
 * a real face and it is plainly both at once — the cube's edges are straight
 * lines, and the same tiles are semicircles on the ends that point at the
 * middle. That isn't a compromise between the two, it's the actual rule: a
 * tile's outer side *is* the cube's edge and has to stay one, and nothing else
 * about the tile does. So `SQUARENESS` is chosen per corner from how many of
 * its two sides face out of the cube — which is the entire shape of this
 * object, and it needs no cut, no second outline and no per-piece special case.
 * A corner piece keeps a hard corner at the cube's corner; an edge piece
 * presents a broad tongue at the centre; the centre is a disc; and where four
 * round ends meet they leave the open void a real face has there.
 *
 * The eighth version got that right and still rendered as nine rounded squares,
 * because the shape being judged wasn't the pad. A piece is a square box and a
 * pad is not square, so a strip of box showed past every edge of every pad —
 * lit, coloured, and with the box's corner, not the pad's. It didn't matter how
 * round the pad was; the eye measured the strip. The piece's face is now taken
 * to the black core wherever the pad isn't, measured against `padRadius` so the
 * two agree exactly. Along the axes nothing is ever far enough out for that to
 * bite and the seam between two facelets stays coloured plastic, which is what
 * paragraph three is about; at the diagonals it goes black, because that is a
 * hole and you are looking into the mechanism.
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

/*
 * ---------------------------------------------------------------------------
 * The pads
 * ---------------------------------------------------------------------------
 *
 * A facelet is a moulded pad, and its outline is not a square. The centre one is
 * a disc, and the eight around it are shaped for it — each presenting a round
 * end where it points at the middle of the face and a straight one where it
 * forms the cube's own edge. An early version drew that as a texture, which is a
 * picture of the right thing on the wrong shape — a circle painted on a square
 * tile reads as a decal, because the silhouette, the rim highlight and the
 * shadow in the seam all still belong to the square. None of those come from
 * paint. They come from an outline, so the pads are built as geometry with the
 * outline they actually have.
 *
 * The first attempt at that built them as flat lozenges standing on top of the
 * piece, and it was worse than the texture. A piece is a *rounded* box: its flat
 * top is only 14 mm of an 18.6 mm face, so a pad wide enough to nearly fill the
 * cell hangs its whole rim out over the shoulder, floating, with shadow under
 * it. Twenty-six rounded blocks with fifty-four buttons stuck to them.
 *
 * So a pad isn't *on* the piece's face, it *is* the piece's face. Its rim sits
 * exactly on the surface the piece already has — `bodyHeight` below is that
 * surface, solved rather than guessed — and it lifts from there by a fraction of
 * a millimetre before crowning. Near the edge of a cell it therefore wraps down
 * over the shoulder the way the colour did two versions ago, which was the one
 * thing that version had right.
 */

/** Centre-to-centre spacing of two pieces. */
const PITCH = CUBE.cubie + CUBE.gap;
/** Gap between a pad and the edge of the piece it's moulded into. */
const SEAM = 0.0006;
const PAD_HALF = CUBE.cubie / 2 - SEAM;
/**
 * How square each corner of a pad is, indexed by how many of the two sides
 * meeting there lie on the outside of the cube.
 *
 * This is the whole shape of the cube, in three numbers.
 *
 * A superellipse exponent is a rounded square expressed as one value instead of
 * four arcs and four lines: at 2 it's a circle, at infinity a square. Every
 * version of this cube until now used one exponent for the whole pad, and one
 * exponent cannot be right — a tile's outer side is also the cube's silhouette
 * and wants to stay a straight line, while the side facing the middle of the
 * face wants to be a semicircle. Pick either and half the cube is wrong: round
 * everything and the silhouette comes out chewed, square everything and you
 * have nine tiles that were never made for the disc in the middle of them.
 *
 * So the exponent is chosen per corner, from how many of the two sides meeting
 * there face out of the cube. Nothing else is needed — no cut, no second
 * outline, no per-piece special case. A corner piece keeps a hard corner where
 * it forms the cube's own corner and turns into a semicircle where it points at
 * the centre; an edge piece presents a broad tongue at the centre and straight
 * shoulders at the cube's edge; the centre is a disc. Where four of them meet
 * their round ends leave an open void, which is exactly what a real face does.
 *
 * Continuous by construction, with no blending needed: a superellipse passes
 * through exactly PAD_HALF on both axes for *any* exponent, so quadrants built
 * with different exponents still meet. Only the tangent kinks, at four points
 * where the outline is a straight run anyway.
 */
const SQUARENESS = [2.05, 5.0, 9.0];
/**
 * And the centre, which has no outward side at all.
 *
 * Just off a circle rather than exactly one — a 1% bulge at the diagonals,
 * invisible as a shape, and enough that the centre is built by the same rule as
 * everything around it rather than being a separate object dropped on top.
 */
const CENTRE_SQUARENESS = 2.05;
/**
 * How far a pad's rim stands proud of the piece's own surface.
 *
 * 0.18 mm was below what the lighting resolves — no rig in this scene puts a
 * highlight or a shadow on a step that small, so the pads read as painted on.
 */
const PAD_LIP = 0.00035;
/** And how much higher its middle is than its rim. */
const PAD_CROWN = 0.0008;
/**
 * Rings across a pad, and points around its outline.
 *
 * The rings bunch toward the rim rather than spacing evenly, which is where
 * they're needed: the outer quarter of a pad's radius is where it turns down
 * over the piece's shoulder, and an evenly spaced set puts one ring across all
 * of that and eight across the nearly flat middle.
 */
const PAD_RINGS = 9;
const PAD_RING_BIAS = 1.7;
/*
 * Forty was enough for a near-square, where the outline barely curves. The
 * scallop and the pebbled corners *are* the curvature, and they're the one
 * thing the eye is now being pointed at, so forty facets across them shows as a
 * chain of flats along exactly the wrong edge.
 */
const PAD_STEPS = 64;
/** How dark the piece is where it shows around and between the pads. */
const BODY_DIM = 0.7;

/**
 * The height of a piece's own surface at a point on its face.
 *
 * A rounded box, solved rather than sampled: flat across the middle, then a
 * quarter-round of `bevel` toward each edge. The pads need it because their rims
 * have to land *on* this and not above it — the difference between a facelet and
 * a button is about a millimetre of daylight.
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
 * `cu`/`cv` are where the pad's centre falls on the cube's face, and that is
 * the only thing the shape is read from — a pad in the `+u` column has its `+u`
 * side on the outside of the cube, one in the middle column has neither, and
 * counting the outward sides meeting at the corner this direction points into
 * picks the exponent. So a pad never has to know which piece it belongs to,
 * which is also why the pattern survives a scramble: it never depended on which
 * piece was where, only on where the pad landed.
 *
 * Used twice — once to build the pad's outline, and once to decide where the
 * piece underneath stops being the pad and starts being the hole between pads.
 * Both have to agree exactly, or a bright crescent of plastic appears along one
 * edge of every tile.
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

/** The outline of one pad, in the plane of the face it sits on. */
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
 * Built as rings scaled in toward the middle rather than extruded, because an
 * extrusion's cap is flat — and a flat cap is the thing four rounds of this
 * cube already established doesn't read as moulded. The profile is a spherical
 * cap, so it leaves the rim vertically and flattens toward the middle, which
 * puts the highlight in a line around the edge of the pad instead of a blob in
 * the centre of it.
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

  /*
   * Rings, from the foot of the rim up and in to the crown.
   *
   * Every height is measured from the piece's own surface rather than from a
   * plane, so the pad follows the shoulder instead of hanging over it. The foot
   * ring sits exactly on that surface and the next one is a lip above it, which
   * is the whole of the step you see around a facelet.
   */
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

  /** Lift a point out of the face's plane and into the cubie's frame. */
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
   * Which way round to wind each triangle.
   *
   * Two things flip it, and they can cancel. Taking the two in-plane axes in
   * ascending order gives a right-handed frame for X and Z but a left-handed
   * one for Y — (x, z, y) is a swap, not a rotation — and pointing the pad down
   * a negative axis flips it again. Get this wrong and the normals face into
   * the cube: the pad still has the right silhouette, so it looks like a
   * lighting bug rather than a winding one, which is exactly how it presented.
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
    const b = r === 0 ? colour : colour;

    for (let i = 0; i < PAD_STEPS; i++) {
      const j = (i + 1) % PAD_STEPS;
      tri(lower[i], upper[j], upper[i], a, b);
      tri(lower[i], lower[j], upper[j], a, a);
    }
  }

  // Cap the middle, which the innermost ring has scaled almost to a point.
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

  const parts: BufferGeometry[] = [];
  const colour = new Color();
  /** Scratch, for the shadowed version of whichever facelet is in play. */
  const shade = new Color();

  for (const c of cubies) {
    /*
     * Eighteen segments, which is far more than the shape needs and exactly
     * what the *paint* needs.
     *
     * Eight was plenty for the chamfer: at a 1.2 mm radius four was invisible,
     * and at 3.2 mm the shoulder is a third of the piece so every step in it
     * shows as a facet and breaks the highlight along the edge into dashes.
     * That highlight is most of what says "moulded" rather than "printed".
     *
     * But the box is now also carrying where the pad ends, as a vertex colour,
     * and a vertex colour is only as sharp as the mesh under it. At eight
     * segments the samples are 2.3 mm apart on an 18.6 mm face and the edge of
     * every tile came out speckled — the boundary landing between vertices and
     * getting interpolated into a dither. Eighteen puts them at 1 mm, which is
     * under the seam's own width, and the edges come out clean.
     */
    const geo = new RoundedBoxGeometry(
      CUBE.cubie,
      CUBE.cubie,
      CUBE.cubie,
      18,
      CUBE.bevel,
    );

    /*
     * Left as the rounded box it is, with no crown of its own.
     *
     * The crown moved to the pads, and it has to be only there: `bodyHeight`
     * solves this exact shape to land each pad's rim on it, so bulging the box
     * after the fact would put the surface somewhere the pads don't know about
     * and float every one of them again.
     */

    const normals = geo.attributes.normal;
    const points = geo.attributes.position;
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
        /*
         * Dimmed, because this is no longer the facelet — the pad above it is.
         * What's left of the piece's own face is the frame around and between
         * the pads, and on a real cube that frame is the same plastic sitting
         * a little lower with less light on it.
         */
        colour.set(dominant).multiplyScalar(BODY_DIM);
        if (toward === CORE_BLACK) {
          shade.set(dominant).multiplyScalar(SHADOW * BODY_DIM);
          colour.lerp(shade, smoothstep(0.08, 1, turned));
        }

        /*
         * Outside the pad, the piece stops being a facelet and becomes a hole.
         *
         * A piece is a square box and its pad is not square, so a strip of the
         * box shows past every edge of every pad — and that strip is what four
         * versions of this cube were actually being judged on. It is bright, it
         * is the piece's own colour, and it is square, so no matter how round
         * the pad was the tile still read as a rounded square: the corner the
         * eye measures belonged to the box, not the pad.
         *
         * How wide that strip is varies enormously, and that is the whole
         * subtlety. Along the axes it is 0.6 mm of seam — the hairline between
         * two facelets, which on a real stickerless cube is *coloured plastic*
         * and must stay coloured, because painting it dark is what drew a
         * border round every tile back in version three. At the diagonals it is
         * up to 4.5 mm, an open void where four pieces don't quite meet, and on
         * a real cube you are looking into the mechanism there.
         *
         * So the fade is measured from the pad's own rim in that direction —
         * `padRadius`, the same function the outline is built from — and starts
         * a seam's width out. Near the axes nothing ever gets that far and the
         * seam keeps its colour; at the diagonals everything past it goes to
         * black. One rule, and it replaces the special case the centre piece
         * used to need.
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
    geo.deleteAttribute("uv");
    geo.translate(c.pos.x * PITCH, c.pos.y * PITCH, c.pos.z * PITCH);
    parts.push(geo.index ? geo.toNonIndexed() : geo);

    /*
     * A pad on each face this piece actually shows.
     *
     * Which shape it gets is decided by where the piece sits on that face, not
     * by what kind of piece it is: dead centre gets the disc, and everything
     * else gets a rounded square that the disc's arc may or may not reach. It
     * comes out the same either way, and it means a scrambled cube reassembles
     * the pattern correctly without anything having to track it.
     */
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
