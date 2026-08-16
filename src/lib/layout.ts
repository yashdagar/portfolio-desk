/**
 * Scene layout, in metres.
 *
 * Everything here is a real-world measurement, because "stylized realism" fails
 * the moment proportions drift — a desk that reads as slightly wrong is more
 * distracting than one that's obviously stylised. A 27" 16:9 panel really is
 * 598 × 336 mm; a desk surface really is 740 mm off the floor; a seated adult's
 * eye really is about 1210 mm up. Those numbers are load-bearing.
 *
 * Axes: +X right, +Y up, +Z toward the viewer. The wall is at negative Z, so
 * the seated camera looks down -Z.
 */

export const DESK = {
  /** Standard desk height. */
  surfaceY: 0.74,
  width: 1.7,
  depth: 0.72,
  thickness: 0.03,
  /** Front edge, nearest the viewer. */
  frontZ: 0.36,
} as const;

export const WALL = {
  z: -0.42,
  width: 3.4,
  height: 2.6,
} as const;

/** A 27" 16:9 panel with a thin bezel. */
export const MONITOR = {
  panelW: 0.598,
  panelH: 0.336,
  bezel: 0.007,
  depth: 0.018,
  /** Bottom of the panel above the desk surface, i.e. the stand's height. */
  liftY: 0.11,
} as const;

const panelCentreY = DESK.surfaceY + MONITOR.liftY + MONITOR.panelH / 2;

export type ScreenId = "commits" | "about" | "music";

export interface ScreenPlacement {
  id: ScreenId;
  position: [number, number, number];
  /** Y rotation in radians. Side monitors toe in toward the viewer. */
  rotationY: number;
}

/**
 * Three monitors: one flat in the centre, two toed in by 24°.
 *
 * The side monitors sit slightly forward of the centre one — that's how a real
 * angled array works, since rotating a panel about its own centre swings its
 * inner edge back toward the wall.
 */
export const SCREENS: ScreenPlacement[] = [
  {
    id: "commits",
    position: [-0.6, panelCentreY, -0.14],
    rotationY: 0.42,
  },
  {
    id: "about",
    position: [0, panelCentreY, -0.27],
    rotationY: 0,
  },
  {
    id: "music",
    position: [0.6, panelCentreY, -0.14],
    rotationY: -0.42,
  },
];

export const CAMERA = {
  /**
   * Eye position: seated, but leaned back in the chair.
   *
   * A true working distance is ~0.6 m from eye to panel, and at that range the
   * centre monitor fills three-quarters of the frame — accurate, and a terrible
   * opening shot, since the desk, shelf and wall all fall outside it. Leaning
   * back buys an establishing view of the whole setup while still reading as
   * seated rather than standing over it. Leaning *in* is what focus is for.
   */
  eye: [0, 1.29, 1.62] as [number, number, number],
  /**
   * Resting look target sits essentially at the panel centre. Aiming higher
   * pushes the whole desk into the lower third and leaves a dead expanse of
   * wall above; aiming lower loses the shelf. This is the balance point.
   */
  target: [0, panelCentreY + 0.01, -0.27] as [number, number, number],
  /**
   * Vertical FOV in degrees. Further back means a longer lens is affordable,
   * and ~40° keeps the edge monitors from smearing the way a wide angle does.
   */
  fov: 45,
  /**
   * How far the head may turn from rest, in radians. Clamping is what keeps
   * "first person" from becoming "lost behind the wall" — you can look around
   * the desk but never away from it.
   */
  yawLimit: 0.46,
  pitchLimit: 0.2,
} as const;

/** The shelf on the wall, holding the board game boxes. */
export const SHELF = {
  y: 1.4,
  /** Offset from the wall plane. */
  z: WALL.z + 0.12,
  width: 0.78,
  depth: 0.2,
  thickness: 0.028,
  /** Shelf sits to one side, so the composition isn't symmetrical. */
  x: -0.6,
} as const;

/** Board game boxes are a real, recognisable size: roughly 295 × 295 × 75 mm. */
export const BOX = {
  w: 0.295,
  h: 0.075,
  d: 0.295,
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
export const SCREEN_DESIGN = { w: 1100, h: Math.round(1100 * (MONITOR.panelH / MONITOR.panelW)) } as const;
export const BOX_DESIGN = { w: 860, h: 860 } as const;
