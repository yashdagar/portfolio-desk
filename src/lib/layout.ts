/**
 * Scene layout, in metres. Real-world measurements throughout.
 *
 * Axes: +X right, +Y up, +Z toward the viewer. The wall is at negative Z, so the
 * seated camera looks down -Z.
 */

export const DESK = {
  surfaceY: 0.74,
  width: 2.5,
  depth: 0.78,
  thickness: 0.032,
  /** Front edge, nearest the viewer. */
  frontZ: 0.4,
} as const;

export const WALL = {
  z: -0.44,
  width: 4.4,
  height: 2.7,
} as const;

/** A real opening: the wall is four slabs around this, so the sun passes through. */
export const WINDOW = {
  x: 1.24,
  y: 1.36,
  w: 0.86,
  h: 1.24,
  /** Depth of the reveal, i.e. how thick the wall is. */
  reveal: 0.11,
} as const;

/**
 * CSS pixels per metre for anything mounted on a panel. One density for every
 * surface, so a 13px label is the same physical size on all of them.
 */
const PX_PER_M = 1840;

/** A 40" 5K2K ultrawide. The 21:9 proportion is not negotiable. */
export const MAIN = {
  panelW: 0.935,
  panelH: 0.395,
} as const;

/** A 27" 16:9 panel with a thin bezel. */
export const MONITOR = {
  panelW: 0.598,
  panelH: 0.336,
  bezel: 0.007,
  depth: 0.018,
  /** Bigger than a real 3 mm, which is sub-pixel here. Much bigger and the
   *  portrait panel reads as a phone. */
  corner: 0.009,
  /** Bottom of the panel above the desk, i.e. the stand's height. */
  liftY: 0.115,
} as const;

export type ScreenId = "commits" | "about" | "music";

export interface ScreenPlacement {
  id: ScreenId;
  position: [number, number, number];
  rotationY: number;
  /** Not shared: one of these is on its side. */
  panelW: number;
  panelH: number;
  /** CSS pixel size the DOM mounted on it is authored at. */
  design: { w: number; h: number };
  stand: "foot" | "riser" | "arm";
}

/**
 * Toe-in for the outer two screens. A real array's 24° sheared the text on
 * screens whose legibility is the whole point; dead flat looked like a shop
 * display.
 */
const TOE = 0.16;
/** Air between two chassis, edge to edge. */
const GAP = 0.014;

/** Centre-to-centre spacing per neighbour. There is no single pitch. */
const beside = (halfWidth: number) =>
  MAIN.panelW / 2 + MONITOR.bezel * 2 + GAP + halfWidth;

const TOE_Z = (MONITOR.panelW / 2) * Math.sin(TOE);

const WIDE = {
  panelW: MAIN.panelW,
  panelH: MAIN.panelH,
  design: {
    w: Math.round(MAIN.panelW * PX_PER_M),
    h: Math.round(MAIN.panelH * PX_PER_M),
  },
} as const;

const LANDSCAPE = {
  panelW: MONITOR.panelW,
  panelH: MONITOR.panelH,
  design: {
    w: Math.round(MONITOR.panelW * PX_PER_M),
    h: Math.round(MONITOR.panelH * PX_PER_M),
  },
} as const;

const PORTRAIT = {
  panelW: MONITOR.panelH,
  panelH: MONITOR.panelW,
  design: {
    w: Math.round(MONITOR.panelH * PX_PER_M),
    h: Math.round(MONITOR.panelW * PX_PER_M),
  },
} as const;

const panelCentreY = DESK.surfaceY + MONITOR.liftY + MONITOR.panelH / 2;
/** Whatever puts the ultrawide's centre on the same line as its neighbours. */
const MAIN_LIFT = MONITOR.liftY + MONITOR.panelH / 2 - MAIN.panelH / 2;
const mainCentreY = DESK.surfaceY + MAIN_LIFT + MAIN.panelH / 2;
/** A portrait panel is 60 cm tall; a normal stand puts it out of frame. */
const TALL_LIFT = 0.1;
const tallCentreY = DESK.surfaceY + TALL_LIFT + PORTRAIT.panelH / 2;

const COMMITS_X = beside(MONITOR.panelW / 2);
const MUSIC_X = beside(PORTRAIT.panelW / 2);

export const SCREENS: ScreenPlacement[] = [
  {
    id: "commits",
    position: [-COMMITS_X, panelCentreY, -0.29 + TOE_Z],
    rotationY: TOE,
    stand: "foot",
    ...LANDSCAPE,
  },
  {
    id: "about",
    position: [0, mainCentreY, -0.29],
    rotationY: 0,
    stand: "riser",
    ...WIDE,
  },
  {
    id: "music",
    position: [
      MUSIC_X,
      tallCentreY,
      -0.29 + (PORTRAIT.panelW / 2) * Math.sin(TOE),
    ],
    rotationY: -TOE,
    stand: "arm",
    ...PORTRAIT,
  },
];

export const CAMERA = {
  /** Seated, leaned back. A true 0.6 m working distance fills the frame with
   *  the centre monitor and loses the room; leaning in is what focus is for. */
  eye: [0, 1.3, 1.74] as [number, number, number],
  target: [0, panelCentreY + 0.03, -0.29] as [number, number, number],
  fov: 44,
} as const;

/**
 * Dimmer positions, as multipliers on whatever the time of day asks for.
 * Clicking the lamp steps through them in order, ending at off.
 */
export const LAMP_LEVELS = [0.55, 1, 1.55, 0] as const;

/** Left-hand side, opposite the window: a warm key and a cool fill from the
 *  same side collapse the contrast the art direction rests on. */
export const LAMP = {
  x: -1.14,
  /** Forward of the back edge, or the base's far rim lands on the desk's own
   *  edge and the lamp reads as standing in a hole. */
  z: -0.18,
  /** Must fit between the monitors' tops (1.14) and the shelf's underside (1.37). */
  poleHeight: 0.52,
  /** How far the arm reaches in from the pole, toward +X. */
  reach: 0.4,
  barLength: 0.3,
} as const;

/** So the light and the geometry can't drift apart. */
export const LAMP_EMITTER: [number, number, number] = [
  LAMP.x + LAMP.reach,
  DESK.surfaceY + LAMP.poleHeight - 0.03,
  LAMP.z,
];

export const SHELF = {
  /** Low enough that a box standing on it (295 mm) stays in frame. */
  y: 1.38,
  z: WALL.z + 0.13,
  width: 0.82,
  depth: 0.21,
  thickness: 0.03,
  x: -0.62,
} as const;

/** Board game boxes are a real, recognisable size. */
export const BOX = {
  w: 0.295,
  h: 0.075,
  d: 0.295,
} as const;

export const PLANT = {
  x: SHELF.x + SHELF.width / 2 - 0.11,
  y: SHELF.y + SHELF.thickness / 2,
  z: SHELF.z + 0.01,
  potR: 0.05,
  potH: 0.072,
  /** The tallest blade; everything else is a fraction of it. Frame top is 1.93. */
  leafHeight: 0.3,
  leafWidth: 0.011,
} as const;

/** Height is set by the monstera, which covers everything left of x = −0.87 and
 *  below y ≈ 1.75 — anything hung there at eye level is behind a leaf. */
export const CLOCK = {
  x: -1.24,
  y: 1.74,
  radius: 0.115,
} as const;

export const TRIPTYCH = {
  x: 0.24,
  /** Clear of the portrait monitor, whose top edge is at 1.40. */
  y: 1.63,
  /** Per panel. The height is derived from the artwork's own aspect. */
  w: 0.25,
  gap: 0.016,
  frame: 0.014,
} as const;

export const CURTAIN = {
  x: 0.86,
  /** This window's sill is at desk height, so the curtain is cut to the sill. */
  hemY: 0.755,
  height: 1.3,
  /** Gathered at the rings, open at the hem. */
  topHalfW: 0.062,
  hemHalfW: 0.09,
  topDepth: 0.022,
  hemDepth: 0.028,
  /** Clear of the plaster, in the gap behind the desk. */
  standoff: 0.042,
  overhang: 0.12,
  /** Above the window's head, which also crops the pole out of the resting shot. */
  poleY: 2.08,
} as const;

export const MAT = {
  w: 0.95,
  d: 0.46,
  thickness: 0.004,
  /** Centred on the keyboard-and-mouse pair, not on the desk. */
  x: -0.05,
  z: 0.13,
} as const;

/** A 65% board on the standard 19 mm keycap pitch, which everything else falls
 *  out of — people have a precise, unconscious sense of how big a key is. */
export const KEYBOARD = {
  unit: 0.019,
  /** Between adjacent caps, so each cap is unit - gap wide. */
  gap: 0.0035,
  capHeight: 0.0115,
  border: 0.0105,
  /** 5 mm above the plate, so half of each cap sits down inside the tray. */
  caseHeight: 0.017,
  /** Where the keycaps' feet land, recessed inside the case. */
  plateY: 0.012,
  /** Front-to-back tilt, in radians. */
  tilt: 0.045,
  x: -0.12,
  z: 0.17,
} as const;

export const MOUSE = {
  w: 0.067,
  d: 0.125,
  /** Low: seen almost end-on, the length foreshortens to nothing and a true
   *  38 mm silhouette comes out round. */
  h: 0.031,
  x: 0.14,
  z: 0.145,
} as const;

/**
 * Cup dimensions only — the hang point is deliberately absent. It used to be a
 * world position derived by hand from the monitor's pitch, width and toe-in,
 * which stopped agreeing with the monitor's actual transform. Parented now.
 */
export const HEADPHONES = {
  cupW: 0.074,
  cupH: 0.09,
  cupD: 0.038,
  /** Nearly half the width, making the face a stadium rather than a rounded
   *  rectangle — which is what makes these readable from across the room. */
  cupR: 0.031,
} as const;

export const MAIN_SCREEN_DESIGN = {
  w: Math.round(MAIN.panelW * PX_PER_M),
  h: Math.round(MAIN.panelH * PX_PER_M),
} as const;
export const SCREEN_DESIGN = {
  w: Math.round(MONITOR.panelW * PX_PER_M),
  h: Math.round(MONITOR.panelH * PX_PER_M),
} as const;
export const TALL_SCREEN_DESIGN = {
  w: Math.round(MONITOR.panelH * PX_PER_M),
  h: Math.round(MONITOR.panelW * PX_PER_M),
} as const;

export const BOX_DESIGN = { w: 860, h: 860 } as const;

/** 56 mm, the competition size. A Rubik's-brand cube is 57. */
export const CUBE = {
  /** One cubie's edge. Three of these plus two gaps make the 56 mm cube. */
  cubie: 0.0186,
  /**
   * The hairline of shadow between two facelets. Not zero: at 0.2 mm the two
   * shoulders met in a mathematical V, and a V has no shadow in it.
   */
  gap: 0.0003,
  /**
   * Deliberately small. A rounded box loses its flat top for one radius on every
   * side, so a large bevel eats the face — at 3.6 mm the shoulder plus gap was
   * 42% of it and the tiles came apart into separate blocks. `SQUARENESS` in
   * Cube.tsx carries the in-plane roundness instead.
   */
  bevel: 0.0022,
  /** Only about 1.9 m of a 2.5 m desk is ever in frame. */
  x: 0.58,
  z: 0.28,
} as const;

/**
 * Deliberately half out of frame, and in *front* of the desk rather than beside
 * it — every square metre of floor to the left is outside the picture, whereas
 * forward of it perspective doubles the plant's size on screen.
 */
export const PLANTER = {
  x: -0.88,
  z: 0.66,
  /** Turned, so the leaves don't fan symmetrically about the camera axis. */
  spin: 0.7,
} as const;
