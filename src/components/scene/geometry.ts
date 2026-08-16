import {
  ExtrudeGeometry,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
} from "three";

/**
 * Shared geometry helpers, all of which exist because drei's `RoundedBox` caps
 * its radius at half the *smallest* dimension. On a 4 mm desk mat that is 2 mm,
 * so the corners stay square. Extruding a rounded outline rounds them in plan,
 * which is the axis that shows.
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

/** A rounded rectangle standing in XY, extruded toward the viewer. */
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
 * A flat rounded rectangle facing +Z. ShapeGeometry writes each vertex's raw
 * x/y as its UV rather than normalising, so a shape a few centimetres across
 * renders any texture as one stretched pixel until they're rewritten.
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
 * For objects whose *face* wants to be nearly a stadium while their edges stay
 * soft — an ear cup being the case in point. Rounding the outline and bevelling
 * the extrusion separates the two.
 */
export function roundedPillow(
  w: number,
  h: number,
  d: number,
  r: number,
  bevel: number,
): BufferGeometry {
  const geo = new ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth: Math.max(0.0001, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelOffset: 0,
    bevelSegments: 5,
    curveSegments: 14,
  });
  geo.translate(0, 0, -d / 2 + bevel);
  geo.computeVertexNormals();
  return geo;
}

/**
 * A slab with a rounded hole through it, lying in XZ with its underside at
 * y = 0. Extruding a shape with a hole gives the inner walls for free, where
 * four separate rails leave four mitre joints that catch the light wrong.
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
    // The chamfer that catches a line of light all the way round the lip.
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
