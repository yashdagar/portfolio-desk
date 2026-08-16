import type { ThreeElements } from "@react-three/fiber";

/**
 * The room's material vocabulary.
 *
 * Material *variety* sells realism far harder than texture resolution does. A
 * scene where everything is 0.5 roughness reads as plastic no matter how good
 * the lighting is; a scene where ceramic, brushed metal, matte plastic, raw
 * wood, woven fabric and paper each respond differently reads as real even
 * untextured. These are the six, plus the ones the screens need.
 *
 * Values are physically plausible rather than eyeballed — roughness is the
 * parameter that carries almost all of the perceived difference, so it's worth
 * getting approximately right rather than picking numbers that look nice on one
 * particular light.
 */

type Mat = ThreeElements["meshStandardMaterial"];

/** Oiled walnut. Open grain, so fairly rough, and never metallic. */
export const WALNUT: Mat = {
  color: "#4a3527",
  roughness: 0.62,
  metalness: 0,
};

/** The desk's steel legs — powder-coated, not bare metal. */
export const POWDER_COAT: Mat = {
  color: "#1b1c1e",
  roughness: 0.78,
  metalness: 0.15,
};

/** Brushed aluminium: metallic, but rough enough to blur its reflections. */
export const ALUMINIUM: Mat = {
  color: "#8d9195",
  roughness: 0.34,
  metalness: 0.92,
};

/** Soft-touch plastic — monitor chassis, keyboard, mouse. Almost no specular. */
export const SOFT_PLASTIC: Mat = {
  color: "#17191b",
  roughness: 0.82,
  metalness: 0,
};

/** Glazed ceramic. The one genuinely shiny thing on the desk. */
export const CERAMIC: Mat = {
  color: "#e6ded1",
  roughness: 0.14,
  metalness: 0,
};

/** Woven desk mat. The roughest surface in the room. */
export const FABRIC: Mat = {
  color: "#1e2126",
  roughness: 0.97,
  metalness: 0,
};

/** Matte emulsion wall. */
export const PLASTER: Mat = {
  color: "#a2988a",
  roughness: 0.95,
  metalness: 0,
};

/** Poster paper — flat, slightly warmer than the wall. */
export const PAPER: Mat = {
  color: "#9c9384",
  roughness: 0.94,
  metalness: 0,
};

/** Coated board, the way a real game box lid is printed. */
export const BOX_CARD: Mat = {
  color: "#cbbfa6",
  roughness: 0.55,
  metalness: 0,
};

/** Carpet — dark, and it never reflects anything. */
export const FLOOR: Mat = {
  color: "#15161a",
  roughness: 1,
  metalness: 0,
};

/**
 * The panel behind the mounted DOM.
 *
 * Near-black with a faint emissive so the glass reads as powered on in the
 * frames before the HTML paints, and so there's some depth behind the text
 * rather than a matte void.
 */
export const SCREEN_GLASS: Mat = {
  color: "#05070a",
  emissive: "#16303a",
  emissiveIntensity: 1,
  roughness: 0.18,
  metalness: 0.1,
};

/** Shelf timber — lighter and drier than the desk, so the two read apart. */
export const SHELF_WOOD: Mat = {
  color: "#6b5540",
  roughness: 0.72,
  metalness: 0,
};
