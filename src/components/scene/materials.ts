import type { ThreeElements } from "@react-three/fiber";

/**
 * The room's material vocabulary.
 *
 * Material variety sells realism harder than texture resolution does — a scene
 * where everything is 0.5 roughness reads as plastic however good the lighting.
 * Roughness carries almost all of that difference, so these are physically
 * plausible rather than eyeballed.
 */

type Mat = ThreeElements["meshStandardMaterial"];

export const WALNUT: Mat = {
  color: "#4a3527",
  roughness: 0.62,
  metalness: 0,
};

export const POWDER_COAT: Mat = {
  color: "#1b1c1e",
  roughness: 0.78,
  metalness: 0.15,
};

export const ALUMINIUM: Mat = {
  color: "#8d9195",
  roughness: 0.34,
  metalness: 0.92,
};

/** Soft-touch: monitor chassis, keyboard, mouse. */
export const SOFT_PLASTIC: Mat = {
  color: "#17191b",
  roughness: 0.82,
  metalness: 0,
};

export const CERAMIC: Mat = {
  color: "#e6ded1",
  roughness: 0.14,
  metalness: 0,
};

export const FABRIC: Mat = {
  color: "#1e2126",
  roughness: 0.97,
  metalness: 0,
};

/** Warm rather than neutral, so the wall takes the lamp side gold and the
 *  window side blue. A greige landed between the two and read as concrete. */
export const PLASTER: Mat = {
  color: "#b6a795",
  roughness: 0.95,
  metalness: 0,
};

export const PAPER: Mat = {
  color: "#9c9384",
  roughness: 0.94,
  metalness: 0,
};

export const BOX_CARD: Mat = {
  color: "#cbbfa6",
  roughness: 0.55,
  metalness: 0,
};

export const FLOOR: Mat = {
  color: "#15161a",
  roughness: 1,
  metalness: 0,
};

/** Faintly emissive, so the glass reads as powered on before the HTML paints. */
export const SCREEN_GLASS: Mat = {
  color: "#05070a",
  emissive: "#16303a",
  emissiveIntensity: 1,
  roughness: 0.18,
  metalness: 0.1,
};

/** Lighter and drier than the desk, so the two woods read apart. */
export const SHELF_WOOD: Mat = {
  color: "#6b5540",
  roughness: 0.72,
  metalness: 0,
};

/** As a hex, so instanced meshes and emissives can share it. */
export const ACCENT_HEX = "#4ecdc4";

export const KEYBOARD_CASE: Mat = {
  color: "#dedcd8",
  roughness: 0.4,
  metalness: 0.55,
};

/** Mid grey, not white: the plate is the only thing separating one cap from the
 *  next, and white under white turns the key field into a pale slab. */
export const KEYBOARD_PLATE: Mat = {
  color: "#8e908d",
  roughness: 0.7,
  metalness: 0.15,
};

/** Rougher than it looks like it should be — a glossy cap loses its bevel in a
 *  blown specular, and the bevel is what the geometry exists to produce. */
export const KEYCAP: Mat = {
  color: "#efedea",
  roughness: 0.62,
  metalness: 0.03,
};

/** Space and enter. Not the room's teal, which belongs to the screens. */
export const KEY_ACCENT = "#9ed2ea";

/** Deliberately not the keycaps' white: two objects moulded in different
 *  factories never land on the same one, and the eye knows it. */
export const MOUSE_SHELL: Mat = {
  color: "#e2dfd9",
  roughness: 0.68,
  metalness: 0.04,
};

export const GRIP: Mat = {
  color: "#b8b4ad",
  roughness: 0.95,
  metalness: 0,
};

export const PANEL_GAP: Mat = {
  color: "#050607",
  roughness: 1,
  metalness: 0,
};

export const WHEEL: Mat = {
  color: "#3a3d40",
  roughness: 0.72,
  metalness: 0.35,
};

export const CORK: Mat = {
  color: "#a1794c",
  roughness: 0.96,
  metalness: 0,
};

export const LAMP_BODY: Mat = {
  color: "#3a3e42",
  roughness: 0.5,
  metalness: 0.25,
};

export const COFFEE: Mat = {
  color: "#20120a",
  roughness: 0.08,
  metalness: 0.05,
};

/**
 * Metalness is low and has to be: a metal takes its colour from what it
 * reflects, and with the cup's flat face turned at the camera and unlit room
 * behind it, at 0.75 this rendered as a dark disc however light the colour.
 */
export const EARCUP: Mat = {
  color: "#a2a6a9",
  roughness: 0.44,
  metalness: 0.16,
};

/** A step darker than the cup, so the two still separate. */
export const CUSHION: Mat = {
  color: "#71767a",
  roughness: 0.98,
  metalness: 0,
};

export const MESH_FABRIC: Mat = {
  color: "#82878b",
  roughness: 0.96,
  metalness: 0,
};

export const MAT_EDGE: Mat = {
  color: "#15181c",
  roughness: 0.9,
  metalness: 0,
};

/** Dark, deliberately. Off-white against a bright sky is white on white, and
 *  the opening rendered as one blank rectangle with no structure in it. */
export const WINDOW_FRAME: Mat = {
  color: "#26282a",
  roughness: 0.55,
  metalness: 0.1,
};

/** Not the desk legs' powder coat: a frame's faint edge sheen is the only thing
 *  separating three black rectangles from three holes in the wall. */
export const FRAME: Mat = {
  color: "#121316",
  roughness: 0.42,
  metalness: 0.05,
};

export const NOTEBOOK: Mat = {
  color: "#2c3b45",
  roughness: 0.88,
  metalness: 0,
};

export const CLOCK_CASE: Mat = {
  color: "#1a1c1e",
  roughness: 0.6,
  metalness: 0.2,
};

export const CLOCK_FACE: Mat = {
  color: "#f2efe9",
  roughness: 0.8,
  metalness: 0,
};

export const CLOCK_MARK: Mat = {
  color: "#16181a",
  roughness: 0.55,
  metalness: 0.1,
};

export const POT: Mat = {
  color: "#8a7f74",
  roughness: 0.94,
  metalness: 0,
};

export const SOIL: Mat = {
  color: "#241d18",
  roughness: 1,
  metalness: 0,
};

/** Waxier than any other non-metal here, which stops the clump reading as felt. */
export const LEAF: Mat = {
  color: "#3f6141",
  roughness: 0.45,
  metalness: 0,
};

export const LEAF_PALE: Mat = {
  color: "#6f8a4e",
  roughness: 0.48,
  metalness: 0,
};

type PhysicalMat = ThreeElements["meshPhysicalMaterial"];

/**
 * Borosilicate, for the mug. `thickness` is how far light is assumed to travel
 * inside the solid: at 0 this renders as a weightless soap bubble, and 3 mm is
 * roughly a real double-walled cup.
 */
export const GLASS: PhysicalMat = {
  color: "#ffffff",
  transmission: 1,
  thickness: 0.003,
  roughness: 0.06,
  ior: 1.52,
  metalness: 0,
  // Reflective at grazing angles, where a glass edge picks up the window and
  // stops the silhouette dissolving into the desk behind it.
  clearcoat: 0.4,
  clearcoatRoughness: 0.1,
  transparent: true,
  opacity: 1,
};

/** The line that says where the liquid stops. Without it the coffee is a dark
 *  column against a dark desk with no top, and the cup reads as tinted glass. */
export const CREMA: Mat = {
  color: "#c8a173",
  roughness: 0.62,
  metalness: 0,
};

export const BOARD_WOOD: Mat = {
  // Seen only along the chamfers; the mapped faces override this with white.
  color: "#43291b",
  roughness: 0.58,
  metalness: 0,
};

/** The only warm metal in the room, which is why five millimetres of hardware
 *  is visible at all from two metres. */
export const BRASS: Mat = {
  color: "#b98f4a",
  roughness: 0.31,
  metalness: 0.92,
};

/**
 * Semi-matte rather than either extreme. At ~55 px on the desk a tile's whole
 * shoulder is three pixels, and a shading gradient across three pixels is
 * invisible where a specular streak along the crown is not. Fully glossy blew a
 * highlight across two tiles at once and took their colour with it.
 */
export const CUBE_PLASTIC: Mat = {
  // White, because the colour arrives per-vertex and gets multiplied by this.
  color: "#ffffff",
  roughness: 0.36,
  metalness: 0,
  envMapIntensity: 1.5,
};

/** Glossier than it looks like it should be: a cable's whole signature is the
 *  specular line down one side, without which it is indistinguishable from a
 *  shadow. Colour arrives per cable. */
export const CABLE: Mat = {
  color: "#ffffff",
  roughness: 0.29,
  metalness: 0.05,
};

export const VELCRO: Mat = {
  color: "#232629",
  roughness: 0.98,
  metalness: 0,
};

/** Chalky and matte — the opposite of the mug, which is also ceramic and must
 *  not look like the same ceramic. */
export const PLANTER_POT: Mat = {
  color: "#b9ac9c",
  roughness: 0.93,
  metalness: 0,
};

/** White, because the colour and veining arrive in the map. */
export const MONSTERA: Mat = {
  color: "#ffffff",
  roughness: 0.38,
  metalness: 0,
};

export const PETIOLE: Mat = {
  color: "#4c6b34",
  roughness: 0.66,
  metalness: 0,
};

/** White, because the weave and colour arrive in the map. Rough almost to the
 *  limit: every other pale surface here has a sheen and this one must not. */
export const LINEN: Mat = {
  color: "#ffffff",
  roughness: 0.96,
  metalness: 0,
};

export const CURTAIN_POLE: Mat = {
  color: "#2c2622",
  roughness: 0.44,
  metalness: 0.72,
};
