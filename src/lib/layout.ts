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
   * The array is 1.80 m across now that the middle screen is an ultrawide, and
   * it needs more than its own width: the lamp stands outboard of the left
   * monitor and there has to be desk to the right of the portrait one. At 2.2 m
   * the lamp's base finished 67 mm from the edge, which reads as a lamp about
   * to fall off.
   *
   * Nothing is lost by going wider. The desk's front edge is 1.34 m from the
   * eye and only ±0.86 m of it is inside the frame at all, so the extra 150 mm
   * a side is off-camera — it exists to give the things standing on it room,
   * not to be seen.
   */
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

/**
 * CSS pixels per metre for anything mounted on a panel.
 *
 * One density for every surface, so a 13px label is the same physical size on
 * the portrait screen as on the landscape ones. Chosen so a focused 27" panel
 * lands near 1:1 on a typical laptop — render much smaller and the text is soft
 * when leaned in, much larger and every font size has to be inflated to stay
 * legible from the rest pose.
 */
const PX_PER_M = 1840;

/**
 * The middle screen: a 34" ultrawide.
 *
 * Two thirds wider than the panels either side of it, and the same height, so
 * the three tops stay on one line. That last part is what stops the array
 * reading as a mistake — an ultrawide flanked by two shorter screens is a
 * setup, an ultrawide flanked by two screens at a different height is a pile of
 * monitors.
 *
 * It also earns its width by what's on it. The centre panel carries a profile
 * page — a column of identity beside a column of numbers — and at 598 mm those
 * two columns were fighting over the same forty characters.
 */
export const MAIN = {
  panelW: 0.8,
  panelH: 0.336,
} as const;

/** A 27" 16:9 panel with a thin bezel. */
export const MONITOR = {
  panelW: 0.598,
  panelH: 0.336,
  bezel: 0.007,
  depth: 0.018,
  /**
   * Bezel corner radius.
   *
   * Bigger than a real monitor's 3 mm, which at this distance is sub-pixel and
   * leaves the chassis with the perfect right angles of a primitive. But not
   * *much* bigger — 20 mm on the portrait panel turned it into a phone, because
   * a tall rectangle with generously rounded corners is a phone and nothing
   * else. A monitor is a rounded chassis around a square-cornered panel, so the
   * glass inside this ends up almost sharp, which is correct.
   */
  corner: 0.009,
  /** Bottom of the panel above the desk surface, i.e. the stand's height. */
  liftY: 0.115,
} as const;

export type ScreenId = "commits" | "about" | "music";

export interface ScreenPlacement {
  id: ScreenId;
  position: [number, number, number];
  /** Y rotation in radians. Kept in the type so the rig stays general. */
  rotationY: number;
  /** Panel size in metres. Not shared: one of these is on its side. */
  panelW: number;
  panelH: number;
  /** CSS pixel size the DOM mounted on it is authored at. */
  design: { w: number; h: number };
  /**
   * What holds it up.
   *
   * `foot` is the moulded stand a monitor ships with — a short neck on a flat
   * plate. `riser` is the ultrawide's: a wide flat blade on a long low foot,
   * which is what a 34" panel needs because a single central neck can't stop
   * 80 cm of screen wobbling. `arm` is what a screen hangs off once it's been
   * turned portrait: a
   * clamp on the back edge of the desk, a post, and a boom out to the VESA
   * plate. A 60 cm panel on its side won't balance on a shipped foot, the foot
   * can't rotate anyway, and an arm hands back the desk space underneath.
   */
  stand: "foot" | "riser" | "arm";
}

/**
 * Three monitors, the outer two toed in, and the right-hand one on its side.
 *
 * **The angle** has been to both extremes. At 24° — which is how a real
 * three-monitor array is actually set up — the two outer screens were angled
 * steeply enough that their text sheared, and those screens are real DOM whose
 * legibility is the entire point of the build. Dead flat fixed that and looked
 * like a shop display: nobody arranges three monitors in a perfectly straight
 * line. 9° is where both hold. Focusing solves the camera against the panel's
 * own normal anyway, so leaning in is square to the glass at any angle.
 *
 * **The portrait screen** is the same 27" panel rotated a quarter turn, because
 * that's what a vertical monitor is — you buy one monitor and turn it. It earns
 * its place: a music client is a list, and a list wants height. It also breaks
 * up a row of three identical rectangles, which was the most render-like thing
 * left about the desk.
 */
const TOE = 0.16;
/** Air between two chassis, edge to edge. */
const GAP = 0.014;

/**
 * Centre-to-centre spacing, derived per neighbour rather than from one pitch.
 *
 * With three identical panels a single pitch was enough. With a wide one in
 * the middle each side screen has to be pushed out by half of *its* width plus
 * half of the middle one's, and the portrait screen is a different width again
 * — so there are two different numbers here and there is no pitch.
 */
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
/**
 * The ultrawide sits on a wider, lower base, so its own lift differs — but its
 * panel centre has to land on the same line as the others, because they're all
 * the same height and the whole point is that the tops agree.
 */
const MAIN_LIFT = MONITOR.liftY + MONITOR.panelH / 2 - MAIN.panelH / 2;
const mainCentreY = DESK.surfaceY + MAIN_LIFT + MAIN.panelH / 2;
/**
 * A portrait panel is 60 cm tall, so its stand has to be shorter or the thing
 * ends up towering over the array — and over the top of the frame.
 */
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
  x: -1.14,
  /*
   * Forward of the back edge, with desk visible behind it.
   *
   * At −0.24 the 188 mm base finished 46 mm from the back of the desk, and 46
   * mm of walnut seen at this angle is about four pixels — so the base's far
   * rim and the desk's back edge landed on the same line and the lamp read as
   * standing in a hole. Foreshortening is the whole problem: a flat disc lying
   * on a surface you're looking almost along has almost no height on screen,
   * and the only thing telling you it's on the desk rather than through it is
   * the strip of desk behind it.
   */
  z: -0.18,
  /*
   * Short enough to pass under the shelf.
   *
   * At 660 mm the arm swung out at exactly shelf height and the head ended up
   * tucked into the underside of it, throwing a hard pool of light onto the
   * wall and lighting the shelf's belly instead of the desk. The gap between
   * the top of the monitors (1.14 m) and the underside of the shelf (1.37 m) is
   * the only place this arm can live.
   */
  poleHeight: 0.52,
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
  /*
   * Low enough that a box standing on it stays inside the frame.
   *
   * It was at 1.56 when both boxes lay flat and only their spines showed. One
   * of them stands up now, which is 295 mm rather than 75 mm, and at the old
   * height its lid ran off the top of the shot.
   */
  y: 1.38,
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

/**
 * A snake plant, at the far end of the shelf from the boxes.
 *
 * The only object in the room that isn't a manufactured rectangle, which is
 * exactly what it's for.
 */
export const PLANT = {
  x: SHELF.x + SHELF.width / 2 - 0.11,
  y: SHELF.y + SHELF.thickness / 2,
  z: SHELF.z + 0.01,
  potR: 0.05,
  potH: 0.072,
  /*
   * Short for a sansevieria, on purpose. At a realistic 30 cm the blades ran
   * straight out of the top of the frame, and a plant cropped by the edge of
   * the shot reads as a mistake rather than as a composition.
   */
  leafHeight: 0.2,
  leafWidth: 0.011,
} as const;

/**
 * The wall clock, on the left-hand wall above the desk.
 *
 * It started in the middle of the big empty stretch of plaster, which was the
 * right instinct and the wrong spot — that stretch is the only wall in the room
 * wide enough for a three-panel print, and a clock hung in the middle of it
 * meant the triptych had nowhere to go. Over here it's the top of a small
 * left-hand group with a framed print under it, and the biggest wall stays
 * whole.
 */
export const CLOCK = {
  x: -1.24,
  y: 1.36,
  radius: 0.115,
} as const;

/**
 * A three-panel print, filling the widest free wall in the room.
 *
 * The gaps between the frames are physical rather than drawn, because the
 * artwork is one picture sliced three ways — the car runs through the frames
 * and the wordmark is cut mid-letter twice, which is the entire reason a
 * triptych looks like a triptych and not like three posters hung near each
 * other.
 */
export const TRIPTYCH = {
  x: 0.3,
  /*
   * High enough to clear the portrait monitor, whose top edge is at 1.40. The
   * frames sat lower and the right-hand one had its bottom corner cut off by a
   * screen standing in front of it.
   */
  y: 1.63,
  /** Per panel. The height is derived from the artwork's own aspect. */
  w: 0.25,
  gap: 0.016,
  frame: 0.014,
} as const;

/** The desk mat. Big — it runs under the keyboard and the mouse both. */
export const MAT = {
  w: 0.95,
  d: 0.46,
  thickness: 0.004,
  /** Centred on the keyboard-and-mouse pair, not on the desk. */
  x: -0.05,
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
  capHeight: 0.0115,
  /** Chassis border around the key field. */
  border: 0.0105,
  /**
   * Top of the case rim.
   *
   * Sits 5 mm above the plate the caps stand on, so roughly half of each cap is
   * down inside the tray. That relationship — rim above plate — is what makes a
   * keyboard read as a keyboard rather than as caps balanced on a closed box.
   */
  caseHeight: 0.017,
  /** Where the keycaps' feet land, recessed inside the case. */
  plateY: 0.012,
  /** Front-to-back tilt, in radians. Every real board has some. */
  tilt: 0.045,
  x: -0.12,
  z: 0.17,
} as const;

/** Mouse, to the right of the keyboard on the same mat. */
export const MOUSE = {
  w: 0.067,
  d: 0.125,
  /*
   * Low. From the seat you see this thing almost end-on, so its length is
   * foreshortened into nearly nothing and the height is the only dimension
   * reading at full value — at a true 38 mm the silhouette came out round.
   */
  h: 0.031,
  /*
   * A hand's width right of the board, which is where a mouse actually lives.
   * It used to sit 29 cm away — far enough that the two objects read as
   * unrelated props placed on the same surface rather than as one workstation.
   */
  x: 0.14,
  z: 0.145,
} as const;

/**
 * Headphones, hung over the outer top corner of the right-hand monitor.
 *
 * Only the cup dimensions live here. The hang point does not, and that's the
 * fix for a real bug: it used to be a world position derived by hand from the
 * monitor's pitch, its panel width and its toe-in angle, and the moment the
 * monitors were toed in the trigonometry stopped agreeing with the monitor's
 * actual transform. The headphones ended up nine centimetres behind the panel,
 * with both cups hidden behind the screen and only the band showing — which
 * read as a hook screwed to the top of the monitor.
 *
 * They're parented to the monitor now. Its own matrix does the work, and no
 * amount of moving or rotating that monitor can separate them again.
 */
export const HEADPHONES = {
  cupW: 0.074,
  cupH: 0.09,
  cupD: 0.038,
  /**
   * Cup corner radius — nearly half its own width, which makes the face a
   * stadium rather than a rounded rectangle. That silhouette is the whole
   * reason these are recognisable from across the room.
   */
  cupR: 0.031,
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
/**
 * The landscape design size, for the two 16:9 screens and the flat page.
 *
 * Derived from the panel rather than hardcoded, so it can't drift away from the
 * portrait screen's density — a 13px label has to be the same physical size on
 * all three or the room looks like it has three different DPIs on one desk.
 */
/** The ultrawide's design size. */
export const MAIN_SCREEN_DESIGN = {
  w: Math.round(MAIN.panelW * PX_PER_M),
  h: Math.round(MAIN.panelH * PX_PER_M),
} as const;
export const SCREEN_DESIGN = {
  w: Math.round(MONITOR.panelW * PX_PER_M),
  h: Math.round(MONITOR.panelH * PX_PER_M),
} as const;
/** The portrait screen's design size. Same panel, quarter turn. */
export const TALL_SCREEN_DESIGN = {
  w: Math.round(MONITOR.panelH * PX_PER_M),
  h: Math.round(MONITOR.panelW * PX_PER_M),
} as const;

export const BOX_DESIGN = { w: 860, h: 860 } as const;

/**
 * The speedcube, on the right-hand end of the desk.
 *
 * 56 mm, which is the competition size — a Rubik's-brand cube is 57 and feels
 * noticeably bigger in a photograph of a desk. The tile inset and the cubie
 * bevel are the two numbers that matter: together they decide how much black
 * plastic shows between the colours, and that grid of black is what stops the
 * whole thing reading as a painted block.
 */
export const CUBE = {
  /** One cubie's edge. Three of these plus two gaps make the 56 mm cube. */
  cubie: 0.0182,
  /** The hairline of shadow between two facelets. All the border there is. */
  gap: 0.0009,
  /**
   * Chamfer on every cubie edge.
   *
   * Heavy — a fifth of the cubie — the way a cube built to be turned under load
   * is. It's also most of what you see: it rounds the eight corners of the whole
   * cube, and a speedcube with square corners looks like a stack of dice.
   */
  bevel: 0.0036,
  /*
   * Between the mat and the notebook, well forward, where a hand reaches
   * without looking.
   *
   * It started at x = 0.98, which is on the desk and off the screen: the desk
   * is 2.5 m wide and only about 1.9 m of it is ever inside the frame, so
   * anything past roughly ±0.95 exists for the geometry and for nobody else.
   */
  x: 0.58,
  z: 0.28,
} as const;

/**
 * The floor planter, front left.
 *
 * Deliberately half out of frame. The room is full of desk-sized objects and
 * had no foreground at all — nothing between the camera and the monitors to
 * say how far away they are. A 1.4 m plant standing this close reads as being
 * in the room with you, and the crop is what makes it read that way rather than
 * as an object arranged for the shot.
 *
 * In front of the desk rather than beside it, because there is no beside: the
 * desk is 2.5 m wide and the frame only shows about ±1.3 m at the wall, so
 * every square metre of floor to the left of the desk is outside the picture.
 * Forward of it, perspective does the work — the same plant is twice the size
 * on screen and lands in the one part of the frame nothing else uses.
 */
export const PLANTER = {
  x: -0.88,
  z: 0.66,
  /** Turned, so the leaves don't fan symmetrically about the camera axis. */
  spin: 0.7,
} as const;
