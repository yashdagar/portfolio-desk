/**
 * Scene layout, in metres.
 *
 * Everything here is a real-world measurement, because "stylized realism" fails
 * the moment proportions drift — a desk that reads as slightly wrong is more
 * distracting than one that's obviously stylised. A 27" 16:9 panel really is
 * 598 × 336 mm; a desk surface really is 740 mm off the floor; a keycap really
 * is on a 19 mm pitch. Those numbers are load-bearing.
 *
 * Axes: +X right, +Y up, +Z toward the viewer. The wall is at negative Z, so
 * the seated camera looks down -Z.
 */

export const DESK = {
  /** Standard desk height. */
  surfaceY: 0.74,
  /**
   * Wide enough for three panels side by side.
   *
   * The monitors used to be toed in, which let them overlap in plan and fit a
   * narrower desk. Flat, they need their full 1.84 m laid out in a straight
   * line, plus somewhere for the lamp and the mug to stand.
   */
  width: 2.2,
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

/**
 * The window, off to the right.
 *
 * A real opening rather than a bright rectangle painted on the wall: the wall is
 * built as four quads around this hole, so the sun actually passes through it
 * and lays a window-shaped patch across the desk. A painted rectangle gives you
 * the light source with none of the evidence, and evidence is the whole reason
 * to have a window in frame at all.
 */
export const WINDOW = {
  /*
   * Far enough right to be the bright edge of the composition, near enough that
   * the frame and sill are actually in shot. Pushed further out and all you get
   * is a pale band running off the side, which reads as a blown highlight
   * rather than as a window.
   */
  x: 1.24,
  y: 1.36,
  w: 0.86,
  h: 1.24,
  /** Depth of the reveal, i.e. how thick the wall is. */
  reveal: 0.11,
} as const;

/** A 27" 16:9 panel with a thin bezel. */
export const MONITOR = {
  panelW: 0.598,
  panelH: 0.336,
  bezel: 0.007,
  depth: 0.018,
  /** Bottom of the panel above the desk surface, i.e. the stand's height. */
  liftY: 0.115,
} as const;

const panelCentreY = DESK.surfaceY + MONITOR.liftY + MONITOR.panelH / 2;

export type ScreenId = "commits" | "about" | "music";

export interface ScreenPlacement {
  id: ScreenId;
  position: [number, number, number];
  /** Y rotation in radians. Kept in the type so the rig stays general. */
  rotationY: number;
}

/**
 * Three monitors in a straight line, all facing the viewer.
 *
 * They used to be toed in by 24° each, which is how a real three-monitor array
 * is set up and which put the two outer screens at an angle steep enough that
 * their text sheared. Since those screens are real DOM and the point of the
 * whole build is that they're readable, geometry loses to legibility: flat.
 *
 * Spacing is the outer width of a monitor plus a 20 mm gap, so the bezels nearly
 * touch the way a real array does.
 */
const PITCH = MONITOR.panelW + MONITOR.bezel * 2 + 0.02;

export const SCREENS: ScreenPlacement[] = [
  { id: "commits", position: [-PITCH, panelCentreY, -0.29], rotationY: 0 },
  { id: "about", position: [0, panelCentreY, -0.29], rotationY: 0 },
  { id: "music", position: [PITCH, panelCentreY, -0.29], rotationY: 0 },
];

export const CAMERA = {
  /**
   * Eye position: seated, leaned back in the chair.
   *
   * A true working distance is ~0.6 m from eye to panel, and at that range the
   * centre monitor fills three-quarters of the frame — accurate, and a terrible
   * opening shot, since the desk, shelf and wall all fall outside it. Leaning
   * back buys an establishing view of the whole setup while still reading as
   * seated rather than standing over it. Leaning *in* is what focus is for.
   */
  eye: [0, 1.3, 1.74] as [number, number, number],
  /**
   * Resting look target sits essentially at the panel centre. Aiming higher
   * pushes the whole desk into the lower third and leaves a dead expanse of
   * wall above; aiming lower loses the shelf. This is the balance point.
   */
  target: [0, panelCentreY + 0.03, -0.29] as [number, number, number],
  /**
   * Vertical FOV in degrees. Long enough that the outer monitors don't smear
   * the way a wide angle makes them, short enough to still see the room.
   */
  fov: 44,
} as const;

/**
 * The desk lamp: the key light's physical source.
 *
 * Left-hand side, opposite the window, because the warm key and the cool fill
 * arriving from the same side collapses the contrast the whole art direction
 * rests on. The arm reaches back in over the desk, so the light still lands in
 * the middle even though the lamp itself stands out of the way.
 */
export const LAMP = {
  x: -0.98,
  z: -0.24,
  poleHeight: 0.66,
  /** How far the arm reaches in from the pole, toward +X. */
  reach: 0.4,
  /** Length of the light bar hanging off the end of the arm. */
  barLength: 0.3,
} as const;

/** World position of the emitter, so light and geometry can't drift apart. */
export const LAMP_EMITTER: [number, number, number] = [
  LAMP.x + LAMP.reach,
  DESK.surfaceY + LAMP.poleHeight - 0.03,
  LAMP.z,
];

/** The shelf on the wall, holding the board game boxes. */
export const SHELF = {
  y: 1.56,
  /** Offset from the wall plane. */
  z: WALL.z + 0.13,
  width: 0.82,
  depth: 0.21,
  thickness: 0.03,
  /** Shelf sits to one side, so the composition isn't symmetrical. */
  x: -0.62,
} as const;

/** Board game boxes are a real, recognisable size: roughly 295 × 295 × 75 mm. */
export const BOX = {
  w: 0.295,
  h: 0.075,
  d: 0.295,
} as const;

/** The desk mat. Big — it runs under the keyboard and the mouse both. */
export const MAT = {
  w: 1.06,
  d: 0.46,
  thickness: 0.004,
  x: 0.02,
  z: 0.13,
} as const;

/**
 * Keyboard: a 65% board on the standard 19 mm keycap pitch.
 *
 * The pitch is the number everything else falls out of. Getting it right is
 * what makes the board read as a keyboard rather than as a grid of bumps —
 * people have a very precise, entirely unconscious sense of how big a key is.
 */
export const KEYBOARD = {
  /** Standard 19.05 mm key pitch. */
  unit: 0.019,
  /** Gap between adjacent caps, so each cap is unit - gap wide. */
  gap: 0.0035,
  capHeight: 0.0105,
  /** Chassis border around the key field. */
  border: 0.009,
  caseHeight: 0.017,
  /** Front-to-back tilt, in radians. Every real board has some. */
  tilt: 0.045,
  x: -0.09,
  z: 0.17,
} as const;

/** Mouse, to the right of the keyboard on the same mat. */
export const MOUSE = {
  w: 0.064,
  d: 0.115,
  h: 0.038,
  x: 0.39,
  z: 0.15,
} as const;

/** Headphones, hung over the outer top corner of the right-hand monitor. */
export const HEADPHONES = {
  x: PITCH + MONITOR.panelW / 2 - 0.055,
  /** The headband rests on the top edge of the panel. */
  y: DESK.surfaceY + MONITOR.liftY + MONITOR.panelH + 0.012,
  z: -0.29,
  cupW: 0.077,
  cupH: 0.094,
  cupD: 0.034,
} as const;

/*
 * Design sizes for the DOM mounted onto surfaces.
 *
 * These are the CSS pixel dimensions the screen components are authored at; the
 * 3D mount scales them onto the physical plane. Chosen so that a focused
 * surface lands near 1:1 on a typical laptop — render much smaller and the text
 * is soft when leaned in, much larger and every font size has to be inflated to
 * stay legible from the rest pose.
 */
export const SCREEN_DESIGN = {
  w: 1100,
  h: Math.round(1100 * (MONITOR.panelH / MONITOR.panelW)),
} as const;
export const BOX_DESIGN = { w: 860, h: 860 } as const;
