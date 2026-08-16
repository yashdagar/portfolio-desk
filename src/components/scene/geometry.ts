import { ExtrudeGeometry, Shape, type BufferGeometry } from "three";

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
  geo.computeVertexNormals();
  return geo;
}
