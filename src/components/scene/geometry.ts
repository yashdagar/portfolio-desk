import {
  ExtrudeGeometry,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
} from "three";

/**
 * Shared geometry helpers.
 *
 * Both of these exist because drei's `RoundedBox` can't do them. Its radius is
 * capped at half the *smallest* dimension, which is fine for a cube and useless
 * for anything flat — a 4 mm thick desk mat can only be rounded by 2 mm, so its
 * corners stay effectively square no matter what you ask for. Extruding a
 * rounded outline rounds the corners in plan, which is the axis that actually
 * shows.
 */

/** A rounded rectangle centred on the origin, in the XY plane. */
export function roundedRectShape(w: number, d: number, r: number): Shape {
  const radius = Math.min(r, w / 2, d / 2);
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + radius, y);
  s.lineTo(x + w - radius, y);
  s.quadraticCurveTo(x + w, y, x + w, y + radius);
  s.lineTo(x + w, y + d - radius);
  s.quadraticCurveTo(x + w, y + d, x + w - radius, y + d);
  s.lineTo(x + radius, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

/**
 * A rounded rectangle standing up in the XY plane, extruded toward the viewer.
 *
 * For things that hang on a wall or face the seat — picture frames, the panel
 * behind a screen. Same reason as `roundedPlate`: the axis that needs rounding
 * is the flat one, which is exactly the one `RoundedBox` refuses to round.
 */
export function roundedSlab(
  w: number,
  h: number,
  r: number,
  depth: number,
): BufferGeometry {
  const geo = new ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * A flat rounded rectangle with no thickness, facing +Z.
 *
 * ShapeGeometry writes each vertex's raw x/y as its UV rather than normalising
 * to 0..1, so a shape a few centimetres across comes out with UVs in the range
 * 0.0–0.03 and any texture applied to it renders as a single stretched pixel.
 * Rewriting them is not optional.
 */
export function roundedPanel(w: number, h: number, r: number): BufferGeometry {
  const geo = new ShapeGeometry(roundedRectShape(w, h, r), 8);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * A rounded rectangular frame — a slab with a rounded hole through it — lying
 * in the XZ plane with its underside at y = 0.
 *
 * The hole is what makes it useful. Extruding a shape with a hole gives you the
 * inner walls for free, which is the difference between a keyboard whose keys
 * sit down inside a tray and one whose keys are balanced on top of a closed
 * box. Building the same thing from four separate rails works, but leaves four
 * mitre joints at the corners that catch the light wrong.
 */
export function roundedFrame(
  outerW: number,
  outerD: number,
  outerR: number,
  innerW: number,
  innerD: number,
  innerR: number,
  height: number,
): BufferGeometry {
  const shape = roundedRectShape(outerW, outerD, outerR);
  shape.holes.push(roundedRectShape(innerW, innerD, innerR));

  const geo = new ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    // A small bevel on the top lip. On a case edge this is the chamfer that
    // catches a line of light all the way round, and it's most of why an
    // aluminium tray reads as machined rather than as a hole cut in a slab.
    bevelThickness: 0.0009,
    bevelSize: 0.0009,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.0009, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * A flat slab with rounded corners in plan, lying in the XZ plane with its
 * underside at y = 0.
 */
export function roundedPlate(
  w: number,
  d: number,
  r: number,
  height: number,
): BufferGeometry {
  const geo = new ExtrudeGeometry(roundedRectShape(w, d, r), {
    depth: height,
    bevelEnabled: false,
    curveSegments: 6,
  });
  // Extrusion runs along +Z; a slab on a desk needs it along +Y. The quarter
  // turn maps +Z onto +Y directly, so the slab already sits on the origin.
  geo.rotateX(-Math.PI / 2);

  /*
   * Rewrite the UVs from the plan.
   *
   * ExtrudeGeometry's default UV generator writes raw world x/y onto the caps,
   * so a slab a metre across comes out with UVs running 0 to 1.06 while the
   * side walls get something else entirely. Anything printed on it lands
   * scaled, offset and discontinuous. Projecting straight down from above is
   * both correct for a flat object and trivially predictable.
   */
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getZ(i) / d + 0.5);
  }
  uv.needsUpdate = true;

  geo.computeVertexNormals();
  return geo;
}
