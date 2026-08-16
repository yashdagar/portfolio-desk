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

/**
 * Matte emulsion wall.
 *
 * Warmer than it was. The old value was a neutral greige, which under a cool
 * window and a warm lamp landed in the middle and read as bare concrete — the
 * largest surface in the frame contributing nothing. A wall with a little warmth
 * in it takes the lamp side gold and the window side blue, which is the
 * warm/cool split the whole scene is built on, visible across two square metres.
 */
export const PLASTER: Mat = {
  color: "#b6a795",
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

/** The one accent, as a hex so instanced meshes and emissives can share it. */
export const ACCENT_HEX = "#4ecdc4";

/* --------------------------------------------------------------------------
 * Desk objects
 *
 * Below this line the materials get more specific, because the objects do. A
 * keycap and a mouse shell are both "black plastic" and they look nothing alike
 * — one is a hard ABS with a visible sheen on its bevel, the other is a
 * soft-touch coating that swallows highlights. Splitting them is what stops the
 * desk reading as a single injection-moulded lump.
 * ----------------------------------------------------------------------- */

/** Silver-anodised keyboard case. */
export const KEYBOARD_CASE: Mat = {
  color: "#dedcd8",
  roughness: 0.4,
  metalness: 0.55,
};

/**
 * The plate under the caps.
 *
 * Mid grey, not white. On a white board the plate is the only thing separating
 * one cap from the next — a white plate under white caps turns the key field
 * into a single pale slab with faint scratches on it.
 */
export const KEYBOARD_PLATE: Mat = {
  color: "#8e908d",
  roughness: 0.7,
  metalness: 0.15,
};

/**
 * Keycap ABS.
 *
 * Rougher than it looks like it should be. Real caps are matte across the top
 * and only the bevel picks up a highlight, which is precisely the effect the
 * geometry is there to produce — a glossy cap loses the bevel in a blown
 * specular and the whole board goes back to looking like a grid of boxes.
 */
export const KEYCAP: Mat = {
  color: "#efedea",
  roughness: 0.62,
  metalness: 0.03,
};

/**
 * Space and enter.
 *
 * A powder blue rather than the room's teal. The teal accent belongs to the
 * screens and the second hand; borrowing it here would tie the keyboard to the
 * UI, and the keyboard is furniture. Two keys picked out on an otherwise white
 * board is the oldest trick in keycap design and it works because those two are
 * the ones your hands find without looking.
 */
export const KEY_ACCENT = "#9ed2ea";

/**
 * Mouse shell.
 *
 * A shade darker and warmer than the keycaps. Matching them exactly is the
 * thing that makes a desk set look like a render: two objects moulded in
 * different factories from different plastics never land on the same white, and
 * the eye knows it.
 */
export const MOUSE_SHELL: Mat = {
  color: "#e2dfd9",
  roughness: 0.68,
  metalness: 0.04,
};

/** Rubberised side grips. Matte enough to read as a different part. */
export const GRIP: Mat = {
  color: "#b8b4ad",
  roughness: 0.95,
  metalness: 0,
};

/** The dark line in a panel gap. Not a material so much as an absence. */
export const PANEL_GAP: Mat = {
  color: "#050607",
  roughness: 1,
  metalness: 0,
};

/** Scroll wheel — grippy rubber over a metal core. */
export const WHEEL: Mat = {
  color: "#3a3d40",
  roughness: 0.72,
  metalness: 0.35,
};

/** Cork coaster. Fibrous, completely matte, and the warmest thing on the desk. */
export const CORK: Mat = {
  color: "#a1794c",
  roughness: 0.96,
  metalness: 0,
};

/** The lamp's body: a hard matte white-grey, the way the real ones are. */
export const LAMP_BODY: Mat = {
  color: "#3a3e42",
  roughness: 0.5,
  metalness: 0.25,
};

/** Black coffee. Dark, and the glossiest thing in the room. */
export const COFFEE: Mat = {
  color: "#20120a",
  roughness: 0.08,
  metalness: 0.05,
};

/** Anodised headphone cup. */
export const EARCUP: Mat = {
  color: "#3c4147",
  roughness: 0.38,
  metalness: 0.75,
};

/** Knit over memory foam. The softest surface anywhere in the scene. */
export const CUSHION: Mat = {
  color: "#23272b",
  roughness: 0.98,
  metalness: 0,
};

/** The headband's fabric canopy. */
export const MESH_FABRIC: Mat = {
  color: "#2e3338",
  roughness: 0.96,
  metalness: 0,
};

/** Stitched edging around the desk mat. */
export const MAT_EDGE: Mat = {
  color: "#15181c",
  roughness: 0.9,
  metalness: 0,
};

/**
 * Painted timber window frame. Dark, and that's a deliberate reversal.
 *
 * It started off-white, the way most frames are, and vanished: a pale frame in
 * front of a bright sky is white on white, so the opening rendered as a single
 * blank rectangle with no structure in it at all. Dark, the frame reads as a
 * silhouette — which is the only way the transom and the mullions do any work,
 * and they're what makes the bright patch parse as a window rather than as a
 * blown highlight.
 */
export const WINDOW_FRAME: Mat = {
  color: "#26282a",
  roughness: 0.55,
  metalness: 0.1,
};

/** A hardback notebook. Cloth over board. */
export const NOTEBOOK: Mat = {
  color: "#2c3b45",
  roughness: 0.88,
  metalness: 0,
};

/* --------------------------------------------------------------------------
 * The clock and the plant
 * ----------------------------------------------------------------------- */

/** Matte black clock case — a thin dark ring seen edge-on. */
export const CLOCK_CASE: Mat = {
  color: "#1a1c1e",
  roughness: 0.6,
  metalness: 0.2,
};

/**
 * The dial.
 *
 * The brightest surface anywhere in the room that isn't emitting, which is why
 * a 26 cm disc reads clearly from two metres away against warm plaster.
 */
export const CLOCK_FACE: Mat = {
  color: "#f2efe9",
  roughness: 0.8,
  metalness: 0,
};

/** Hands and ticks. */
export const CLOCK_MARK: Mat = {
  color: "#16181a",
  roughness: 0.55,
  metalness: 0.1,
};

/** Unglazed terracotta-grey pot. Porous, so very rough. */
export const POT: Mat = {
  color: "#8a7f74",
  roughness: 0.94,
  metalness: 0,
};

/** Potting compost. Dark and completely matte. */
export const SOIL: Mat = {
  color: "#241d18",
  roughness: 1,
  metalness: 0,
};

/**
 * Sansevieria leaf.
 *
 * Waxier than any other non-metal in the room — a snake plant leaf has a real
 * sheen, and it's what stops the clump reading as felt.
 */
export const LEAF: Mat = {
  color: "#3f6141",
  roughness: 0.45,
  metalness: 0,
};

/** The paler banding on some blades. */
export const LEAF_PALE: Mat = {
  color: "#6f8a4e",
  roughness: 0.48,
  metalness: 0,
};
