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

/**
 * Anodised headphone cup, in grey.
 *
 * It was a near-black blue-grey, which on a monitor that is itself near-black
 * meant the headphones hanging off it had no silhouette at all — they read as a
 * lump in the bezel until the lamp caught them. Grey gives them an edge against
 * both the panel behind and the pale wall above.
 *
 * Metalness comes almost all the way down, and it has to. A metal takes its
 * colour from what it reflects rather than from its own albedo, so at the old
 * 0.75 the grey barely mattered — the cup's flat outer face is turned at the
 * camera, everything behind the camera is unlit room, and it rendered as a
 * dark disc inside a bright rim however light the colour was set. Dropping
 * metalness lets the albedo do the work; a little is left so the anodising
 * still catches the lamp along the roll of the edge.
 */
export const EARCUP: Mat = {
  color: "#a2a6a9",
  roughness: 0.44,
  metalness: 0.16,
};

/**
 * Knit over memory foam. The softest surface anywhere in the scene.
 *
 * A step darker than the cup it sits in, so the two still separate now that
 * both are grey — on the real ones the pad is a different material and reads
 * as one.
 */
export const CUSHION: Mat = {
  color: "#71767a",
  roughness: 0.98,
  metalness: 0,
};

/** The headband's fabric canopy. */
export const MESH_FABRIC: Mat = {
  color: "#82878b",
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

/**
 * Gallery frame: painted black timber, flat and slightly satin.
 *
 * Deliberately not the powder coat the desk legs use. A frame is finished, not
 * coated — it has a faint sheen along its edge that a matte texture kills, and
 * that sheen is the only thing separating three black rectangles from three
 * black holes in the wall.
 */
export const FRAME: Mat = {
  color: "#121316",
  roughness: 0.42,
  metalness: 0.05,
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

type PhysicalMat = ThreeElements["meshPhysicalMaterial"];

/**
 * Borosilicate, for the mug.
 *
 * The only transmissive material in the room, and the reason it earns the cost:
 * a clear cup turns the coffee into a *shape* rather than a disc — you see the
 * column of it through the wall, the meniscus where it meets the glass, and the
 * handle refracting the desk behind it. None of that is available to a ceramic
 * mug, which from a seated camera is a white cylinder with a dark lid.
 *
 * `thickness` is the important number. It's how far light is assumed to travel
 * inside the solid, and at 0 the material renders as a soap bubble — perfectly
 * clear, weightless, and completely unconvincing. 3 mm is roughly the wall of a
 * real double-glazed cup, and it's what gives the rim and the handle their
 * density.
 */
export const GLASS: PhysicalMat = {
  color: "#ffffff",
  transmission: 1,
  thickness: 0.003,
  roughness: 0.06,
  ior: 1.52,
  metalness: 0,
  // Slightly reflective at grazing angles, which is where a glass edge picks up
  // the window and stops the silhouette dissolving into the desk behind it.
  clearcoat: 0.4,
  clearcoatRoughness: 0.1,
  transparent: true,
  opacity: 1,
};

/**
 * The crema: the pale head that sits on top of the coffee.
 *
 * Not decoration. In a clear cup the coffee is a dark column, and a dark column
 * against a dark desk has no top — the eye can't find the surface. The crema is
 * the horizontal line that says "this is where the liquid stops", and it's the
 * single detail that makes the cup read as full rather than as tinted glass.
 */
export const CREMA: Mat = {
  color: "#c8a173",
  roughness: 0.62,
  metalness: 0,
};

/**
 * The chess case: rosewood, oiled rather than lacquered.
 *
 * Rougher than any of the plastics and rougher than the desk, because the desk
 * is a finished worktop and this is a hand-oiled game board. The two woods in
 * the room need to be different woods or the case reads as a piece of the
 * shelf.
 */
export const BOARD_WOOD: Mat = {
  // The body's own colour, seen only along the chamfers. The faces that carry
  // the board and the parting line are mapped and override it with white.
  color: "#43291b",
  roughness: 0.58,
  metalness: 0,
};

/**
 * Brass, for the case's clasps and hinges.
 *
 * The only warm metal in the room — everything else that shines is anodised
 * aluminium, which is cool and grey. That contrast is why four pieces of
 * hardware five millimetres across are visible at all from two metres.
 */
export const BRASS: Mat = {
  color: "#b98f4a",
  roughness: 0.31,
  metalness: 0.92,
};

/**
 * Speedcube plastic: the black body every cubie is moulded from.
 *
 * Matte, and darker than anything else on the desk. Everything about how this
 * object reads depends on the tiles standing out against the grid of plastic
 * between them, so the plastic has to be genuinely dark — a mid grey here and
 * the whole cube goes soft.
 */
export const CUBE_PLASTIC: Mat = {
  // White, because the colour arrives per-vertex and gets multiplied by this.
  color: "#ffffff",
  /*
   * Semi-matte, not glossy. Stickerless cubes are moulded in a frosted ABS with
   * a very soft sheen — the giveaway is that you can read all nine tiles of a
   * face at once under a single lamp, which you can't on a glossy surface
   * because two of them are always carrying a blown highlight. At 0.34 that's
   * what was happening here: the top face had a hotspot across it and the
   * tiles under it lost their colour.
   */
  roughness: 0.46,
  metalness: 0,
};


/**
 * Cable sheath: PVC.
 *
 * Glossier than anything else under the desk and far glossier than it looks
 * like it should be. A cable's whole visual signature is the hard specular line
 * running down one side of it — take that away and a 4 mm tube in a dark room
 * is a black line, indistinguishable from a shadow. Colour arrives per cable,
 * so this only carries the finish.
 */
export const CABLE: Mat = {
  color: "#ffffff",
  roughness: 0.29,
  metalness: 0.05,
};

/** The velcro strap gathering the bundle. Fuzzy, so completely matte. */
export const VELCRO: Mat = {
  color: "#232629",
  roughness: 0.98,
  metalness: 0,
};

/**
 * The floor planter: unglazed stoneware.
 *
 * Chalky and completely matte, which is the opposite of the mug two metres
 * behind it — the two are both ceramic and they should not look like the same
 * ceramic. It's also the palest large object in the room, so it has to be a
 * warm off-white rather than a true one or it reads as plastic under the lamp.
 */
export const PLANTER_POT: Mat = {
  color: "#b9ac9c",
  roughness: 0.93,
  metalness: 0,
};

/**
 * Monstera leaf.
 *
 * White, because the colour and the veining arrive in the map. Waxier than the
 * snake plant — a monstera leaf has a real sheen, and that sheen catching the
 * window is most of what makes the foreground read as being nearer the light
 * than the desk is.
 */
export const MONSTERA: Mat = {
  color: "#ffffff",
  roughness: 0.38,
  metalness: 0,
};

/** The petiole: matte, and a shade yellower than the blade it carries. */
export const PETIOLE: Mat = {
  color: "#4c6b34",
  roughness: 0.66,
  metalness: 0,
};

/**
 * Unlined linen, in the curtain beside the window.
 *
 * White, because the weave and the colour both arrive in the map — and rough
 * almost to the limit, since linen is the least specular thing in the room by
 * some distance. Every other pale surface here is a glaze or a paint with a
 * sheen on it; the point of this one is that it has none.
 *
 * It's also the only object standing directly in the window's light, which is
 * what earns it a place at all. A curtain doesn't just occlude — unlined cloth
 * lit from behind goes luminous at the edge, and that bright fringe against the
 * cool daylight is the strongest piece of contrast the right-hand side of the
 * frame has.
 */
export const LINEN: Mat = {
  color: "#ffffff",
  roughness: 0.96,
  metalness: 0,
};

/** The curtain pole and its rings: dark oiled steel, not the desk's black. */
export const CURTAIN_POLE: Mat = {
  color: "#2c2622",
  roughness: 0.44,
  metalness: 0.72,
};
