"use client";

import { RoundedBox, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, Vector3, type Group } from "three";

import { CentreScreen } from "@/components/screens/CentreScreen";
import { BoxBack } from "@/components/screens/BoxBack";
import { CommitFeed } from "@/components/screens/CommitFeed";
import { NowPlaying } from "@/components/screens/NowPlaying";
import type { ActivityFeed } from "@/lib/activity";
import type { Daylight } from "@/lib/daylight";
import { isWet, type Weather } from "@/lib/weather";
import {
  BOX,
  BOX_DESIGN,
  CAMERA,
  DESK,
  MAT,
  MONITOR,
  SCREENS,
  SHELF,
  TRIPTYCH,
  WALL,
  WINDOW,
  type ScreenId,
} from "@/lib/layout";
import { useScene, type BoxId } from "@/lib/store";

import { catanArt, type BoxArt } from "./boxArt";
import { chessBoardTexture, chessCaseSideTexture } from "./chessCase";
import { matTexture } from "./matArt";
import { roundedPanel, roundedPlate } from "./geometry";
import { Headphones } from "./Headphones";
import { Keyboard } from "./Keyboard";
import { Lamp } from "./Lamp";
import * as M from "./materials";
import { Mouse } from "./Mouse";
import { Cables } from "./Cables";
import { Cube } from "./Cube";
import { Mug } from "./Mug";
import { Plant } from "./Plant";
import { Planter } from "./Planter";
import { RainGlass } from "./RainGlass";
import { Surface } from "./Surface";
import { PANEL_ASPECT, PANELS, triptychPanels } from "./triptych";
import { WallClock } from "./WallClock";
import { shelfTexture, woodTexture } from "./woodGrain";
import { nightLightsTexture, outsideTexture } from "./windowView";

function Desk() {
  const midZ = DESK.frontZ - DESK.depth / 2;
  const legInset = 0.08;
  const legH = DESK.surfaceY - DESK.thickness;

  /*
   * The desk is the largest object in the frame by a wide margin, and it was a
   * flat brown. Two square metres of unbroken tone reads as plastic however
   * good the lighting is — this is the one surface in the room where a texture
   * is not optional.
   */
  const grain = useMemo(() => woodTexture(), []);
  useEffect(() => () => grain.dispose(), [grain]);

  return (
    <group>
      <RoundedBox
        args={[DESK.width, DESK.thickness, DESK.depth]}
        // Capped by half the thickness, which on a 32 mm top is 16 mm — so this
        // is a full bullnose, the roundest a slab this thin can be.
        radius={DESK.thickness / 2 - 0.001}
        smoothness={6}
        position={[0, DESK.surfaceY - DESK.thickness / 2, midZ]}
        castShadow
        receiveShadow
      >
        {/* White base colour: the map already carries the walnut, and tinting
            it again would darken the whole top by the same amount twice. */}
        <meshStandardMaterial {...M.WALNUT} color="#ffffff" map={grain} />
      </RoundedBox>

      {[
        [-DESK.width / 2 + legInset, DESK.frontZ - legInset],
        [DESK.width / 2 - legInset, DESK.frontZ - legInset],
        [-DESK.width / 2 + legInset, DESK.frontZ - DESK.depth + legInset],
        [DESK.width / 2 - legInset, DESK.frontZ - DESK.depth + legInset],
      ].map(([x, z], i) => (
        <RoundedBox
          key={i}
          args={[0.05, legH, 0.05]}
          radius={0.018}
          smoothness={5}
          position={[x, legH / 2, z]}
          castShadow
        >
          <meshStandardMaterial {...M.POWDER_COAT} />
        </RoundedBox>
      ))}
    </group>
  );
}

/**
 * The wall, built as four slabs around a hole.
 *
 * It used to be one plane with a bright rectangle stuck to it, which gave the
 * cool fill an origin but no consequence — the light source was visible and its
 * light was not. A real opening means the sun passes through it and lays a
 * window-shaped patch across the floor and the desk, and that patch is worth
 * more to the frame than the window is. It also gives the wall a thickness,
 * which is the reveal you see down the side of the opening and the thing that
 * stops a window reading as a sticker.
 */
function Walls() {
  const left = WINDOW.x - WINDOW.w / 2;
  const right = WINDOW.x + WINDOW.w / 2;
  const bottom = WINDOW.y - WINDOW.h / 2;
  const top = WINDOW.y + WINDOW.h / 2;
  const half = WALL.width / 2;
  const z = WALL.z - WINDOW.reveal / 2;

  /** [width, height, centre x, centre y] for each slab around the opening. */
  const slabs: [number, number, number, number][] = [
    [left + half, WALL.height, (-half + left) / 2, WALL.height / 2],
    [half - right, WALL.height, (right + half) / 2, WALL.height / 2],
    [WINDOW.w, WALL.height - top, WINDOW.x, (top + WALL.height) / 2],
    [WINDOW.w, bottom, WINDOW.x, bottom / 2],
  ];

  return (
    <group>
      {slabs.map(([w, h, cx, cy], i) => (
        <mesh key={i} position={[cx, cy, z]} castShadow receiveShadow>
          <boxGeometry args={[w, h, WINDOW.reveal]} />
          <meshStandardMaterial {...M.PLASTER} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WALL.width, 7]} />
        <meshStandardMaterial {...M.FLOOR} />
      </mesh>
    </group>
  );
}

/**
 * What's on the other side of the glass.
 *
 * Not a photograph and not a skybox: a vertical gradient, sky over haze, at
 * whatever colour the daylight model says the sky is right now. It's only ever
 * seen through a 90 cm opening at the edge of frame, and anything more detailed
 * would pull the eye straight out of the room.
 */
function Outside({ day }: { day: Daylight }) {
  const view = useMemo(() => outsideTexture(), []);
  const lights = useMemo(() => nightLightsTexture(), []);

  useEffect(
    () => () => {
      view.dispose();
      lights.dispose();
    },
    [view, lights],
  );

  return (
    <group position={[WINDOW.x, WINDOW.y, WALL.z - WINDOW.reveal - 0.06]}>
      {/*
        The view is a luminance ramp multiplied by the daylight colour, so one
        texture carries every hour of the day. Basic and untonemapped: whatever
        is outside a window is brighter than anything a room's exposure is set
        for, and rolling it off with the rest of the scene is what makes a
        window look like a picture of a window.
      */}
      <mesh>
        <planeGeometry args={[WINDOW.w * 1.5, WINDOW.h * 1.35]} />
        <meshBasicMaterial map={view} color={day.windowColor} toneMapped={false} />
      </mesh>

      {/* Lit windows across the city, fading up as the daylight goes. */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[WINDOW.w * 1.5, WINDOW.h * 1.35]} />
        <meshBasicMaterial
          map={lights}
          toneMapped={false}
          transparent
          opacity={Math.max(0, 1 - day.level * 1.6)}
        />
      </mesh>
    </group>
  );
}

/**
 * Frame and glazing bars.
 *
 * A grid, not a single opening. Two things follow from it: a divided window is
 * instantly legible as a window at any size, where a bare rectangle of sky is
 * ambiguous until you find its edges; and the bars are the only dark shapes on
 * the bright side of the room, which is what stops that corner going to a
 * featureless blown-out block.
 *
 * The bars are also deliberately chunky. They started at 24 mm, which is right
 * for a real casement and disappeared completely — at this distance a
 * correctly-scaled glazing bar is under two pixels wide.
 */
function WindowFrame() {
  const z = WALL.z - WINDOW.reveal / 2;
  const outer = 0.042;
  const glazing = 0.026;
  const depth = WINDOW.reveal * 0.5;

  /** Two panes across, three up. */
  const mullions = [0];
  const transoms = [WINDOW.h * 0.5 - WINDOW.h / 2, WINDOW.h * 0.82 - WINDOW.h / 2];

  return (
    <group position={[WINDOW.x, WINDOW.y, z]}>
      {[-1, 1].map((s) => (
        <mesh key={`v${s}`} position={[(s * WINDOW.w) / 2, 0, 0]} castShadow>
          <boxGeometry args={[outer, WINDOW.h + outer, depth]} />
          <meshStandardMaterial {...M.WINDOW_FRAME} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`h${s}`} position={[0, (s * WINDOW.h) / 2, 0]} castShadow>
          <boxGeometry args={[WINDOW.w + outer, outer, depth]} />
          <meshStandardMaterial {...M.WINDOW_FRAME} />
        </mesh>
      ))}

      {mullions.map((x) => (
        <mesh key={`m${x}`} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[glazing, WINDOW.h, depth * 0.85]} />
          <meshStandardMaterial {...M.WINDOW_FRAME} />
        </mesh>
      ))}
      {transoms.map((y) => (
        <mesh key={`t${y}`} position={[0, y, 0]} castShadow>
          <boxGeometry args={[WINDOW.w, glazing, depth * 0.85]} />
          <meshStandardMaterial {...M.WINDOW_FRAME} />
        </mesh>
      ))}

      {/* A handle on the lower right pane, because casements have one. */}
      <mesh position={[WINDOW.w * 0.34, -WINDOW.h * 0.32, depth * 0.6]} castShadow>
        <boxGeometry args={[0.014, 0.055, 0.014]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/* Sill, projecting into the room. */}
      <RoundedBox
        args={[WINDOW.w + 0.1, 0.032, WINDOW.reveal + 0.08]}
        radius={0.014}
        smoothness={5}
        position={[0, -WINDOW.h / 2 - 0.024, WINDOW.reveal / 2 + 0.035]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.PLASTER} />
      </RoundedBox>
    </group>
  );
}

function ScreenContent({
  id,
  activity,
}: {
  id: ScreenId;
  activity: ActivityFeed | null;
}) {
  if (id === "commits") return <CommitFeed initial={activity} />;
  if (id === "about") return <CentreScreen initial={activity} />;
  // The music screen is the portrait one, so it gets the portrait client.
  return <NowPlaying variant="tall" />;
}

function Monitor({
  placement,
  hero,
  activity,
}: {
  placement: (typeof SCREENS)[number];
  hero: boolean;
  activity: ActivityFeed | null;
}) {
  const focusScreen = useScene((s) => s.focusScreen);
  const focus = useScene((s) => s.focus);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const focused = focus.kind === "screen" && focus.id === placement.id;

  const { panelW, panelH, design } = placement;
  const outerW = panelW + MONITOR.bezel * 2;
  const outerH = panelH + MONITOR.bezel * 2;
  /** Distance from the panel's bottom edge down to the desk. */
  const lift = placement.position[1] - DESK.surfaceY - panelH / 2;

  // The glass is inset by the bezel, so its corner has to be tighter by the
  // same amount or the black panel cuts across the chassis fillet.
  const glass = useMemo(
    () =>
      roundedPanel(
        panelW,
        panelH,
        MONITOR.corner - MONITOR.bezel,
      ),
    [panelW, panelH],
  );
  const foot = useMemo(() => roundedPlate(0.22, 0.15, 0.045, 0.014), []);

  useEffect(() => {
    return () => {
      glass.dispose();
      foot.dispose();
    };
  }, [glass, foot]);

  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]}>
      <RoundedBox
        args={[outerW, outerH, MONITOR.depth]}
        radius={MONITOR.corner}
        smoothness={6}
        castShadow
      >
        <meshStandardMaterial {...M.SOFT_PLASTIC} />
      </RoundedBox>

      <mesh
        geometry={glass}
        position={[0, 0, MONITOR.depth / 2 + 0.0005]}
        onClick={(e) => {
          e.stopPropagation();
          focusScreen(placement.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          {...M.SCREEN_GLASS}
          emissiveIntensity={hovered ? 2.2 : 1}
        />
      </mesh>

      {/*
        Not mounted in hero mode. Three full React trees transformed into CSS 3D
        is the single most expensive thing in the scene, and on a phone the
        panels are a few hundred pixels wide — the text would be unreadable at
        that size anyway, and the same content sits in the DOM below.
      */}
      {!hero && (
        <Surface
          designW={design.w}
          designH={design.h}
          worldW={panelW}
          focused={focused}
          // The glass's own corner, converted to design pixels, so the DOM is
          // clipped to exactly the shape it's sitting on.
          radiusPx={
            ((MONITOR.corner - MONITOR.bezel) * design.w) / panelW
          }
          position={[0, 0, MONITOR.depth / 2 + 0.001]}
        >
          <ScreenContent id={placement.id} activity={activity} />
        </Surface>
      )}

      {/*
        Hung on this monitor's own outer corner, in its local frame. Placing
        them in world space meant re-deriving the corner from the panel size and
        the toe-in by hand, and getting it wrong put them behind the screen.

        On the portrait monitor's right-hand edge, which took some finding. The
        wide left-hand screen looked like the safer home and wasn't: a 74 mm ear
        cup landed squarely on the commit feed's header and swallowed the word
        "commits". Here the player keeps its artwork at eighty per cent of the
        column, so the strip the cup covers is margin — and everything the cup
        hangs past is empty wall between the desk and the window.

        Tilted out a few degrees as well. A pair hooked over a corner hangs
        askew; a pair hanging perfectly plumb has been placed by someone.
      */}
      {placement.id === "music" && (
        <group
          position={[
            panelW / 2 - 0.004,
            panelH / 2 + MONITOR.bezel + 0.008,
            0,
          ]}
          rotation={[0, 0, 0.17]}
        >
          <Headphones />
        </group>
      )}

      {/*
        Three screens, three different things holding them up.

        Not variety for its own sake — it's what a desk assembled over time
        actually looks like, and each one is the answer to a different problem.
        The 27" keeps the neck and plate it shipped with. The ultrawide can't:
        80 cm of panel on a single central neck visibly twists, so it gets a
        flat blade on a long low foot. And the portrait screen can't use either,
        because a shipped foot won't rotate.
      */}
      {placement.stand === "arm" && <MonitorArm panelH={panelH} lift={lift} />}

      {placement.stand === "riser" && <Riser panelH={panelH} lift={lift} />}

      {placement.stand === "foot" && (
        <>
          {/* Neck and foot. Aluminium, so they catch the lamp and read as
              hardware. */}
          <RoundedBox
            args={[0.046, lift + 0.02, 0.026]}
            radius={0.011}
            smoothness={5}
            position={[0, -panelH / 2 - lift / 2, -0.026]}
            castShadow
          >
            <meshStandardMaterial {...M.ALUMINIUM} />
          </RoundedBox>
          {/*
            A properly rounded foot rather than a rounded box: at 13 mm thick,
            RoundedBox can only put a 6 mm fillet on it and the corners in plan
            — the ones you actually see from above — stay square.
          */}
          <mesh
            geometry={foot}
            position={[0, -panelH / 2 - lift, -0.026]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.ALUMINIUM} />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * The ultrawide's stand: a blade on a bar.
 *
 * What an 80 cm panel actually ships with, and for a reason that shows up the
 * moment you use one. A monitor stand resists two things: the panel falling
 * forward, and the panel twisting about the neck. A round neck on a small plate
 * handles the first and nothing at all about the second, which is why a wide
 * screen on one wobbles every time you type. The answer both LG and Dell arrive
 * at is a flat vertical blade — deep front to back, wide side to side, so it's
 * stiff in torsion — standing on a bar long enough to plant its feet outside
 * the panel's centre of mass.
 *
 * It's also the right-looking object here. The neck-and-plate stand next to it
 * is a small dark shape; this is a long horizontal line under a long horizontal
 * screen, and repeating the panel's proportion under the panel is most of why
 * the middle of the desk reads as deliberate.
 */
function Riser({ panelH, lift }: { panelH: number; lift: number }) {
  const deskY = -panelH / 2 - lift;
  const z = -0.03;

  const bar = useMemo(() => roundedPlate(0.5, 0.13, 0.03, 0.013), []);
  useEffect(() => () => bar.dispose(), [bar]);

  return (
    <group>
      {/* The bar. Long, low, and shallow — it has to stay clear of a keyboard
          pushed back against it. */}
      <mesh geometry={bar} position={[0, deskY, z]} castShadow receiveShadow>
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>
      {/* Feet, so the bar bridges rather than lies flat. The gap under it is
          the detail that says the thing is machined. */}
      {[-0.21, 0.21].map((x) => (
        <mesh key={x} position={[x, deskY + 0.002, z]}>
          <boxGeometry args={[0.05, 0.004, 0.11]} />
          <meshStandardMaterial {...M.POWDER_COAT} />
        </mesh>
      ))}

      {/* The blade. Wide across, thin front to back — the whole point. */}
      <RoundedBox
        args={[0.078, lift + 0.02, 0.02]}
        radius={0.008}
        smoothness={5}
        position={[0, deskY + (lift + 0.02) / 2, z]}
        castShadow
      >
        <meshStandardMaterial {...M.ALUMINIUM} />
      </RoundedBox>

      {/* Cable pass-through, punched near the top of the blade. Every one of
          these has one, and it's the fastest way to say which object this is. */}
      <mesh position={[0, deskY + lift * 0.62, z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.022, 20]} />
        <meshStandardMaterial {...M.POWDER_COAT} />
      </mesh>
    </group>
  );
}

/**
 * A segment of the monitor arm, laid between two points in the XY plane.
 *
 * A rounded box runs along its own +Y, so pointing it at an arbitrary angle is
 * a rotation about Z of whatever the segment's direction is off vertical. Worth
 * the helper: an articulated arm is defined by where its joints are, and
 * writing the joints down and letting the maths place the links is the only
 * version where moving one joint doesn't leave a gap somewhere else.
 */
function Link({
  from,
  to,
  width,
  z,
  depth = 0.03,
}: {
  from: [number, number];
  to: [number, number];
  width: number;
  z: number;
  depth?: number;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);

  return (
    <RoundedBox
      args={[width, len, depth]}
      radius={Math.min(width, depth) / 2 - 0.001}
      smoothness={5}
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z]}
      // atan2(dy, dx) is the angle off +X; a box's length runs along +Y, so the
      // rotation is that angle minus a quarter turn.
      rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}
      castShadow
    >
      <meshStandardMaterial {...M.ALUMINIUM} />
    </RoundedBox>
  );
}

/**
 * The mount a portrait monitor actually hangs off.
 *
 * Three wrong answers preceded this one. The shipped foot, because a 60 cm
 * panel on its side won't balance on a 21 cm plate and the foot doesn't rotate.
 * A weighted pole, because freestanding poles are display-stand furniture and
 * nobody with a portrait screen on a desk uses one. And then a clamp with a
 * straight boom running back to the panel — right in principle, invisible in
 * practice: everything it was made of sat directly behind an 80 cm-tall screen,
 * so all that ever showed was a stub of clamp under the bottom edge.
 *
 * This one puts the articulation where it can be seen. The clamp goes on the
 * back edge *outboard* of the panel, the arm rises beside the screen rather
 * than behind it, and the elbow is folded hard — which is not styling, it's
 * what a gas-spring arm does when the screen it carries is 30 cm from the
 * clamp. There is nowhere else for that much link length to go, so it doubles
 * back on itself, and the resulting tight V is the single most recognisable
 * thing about these.
 *
 * Built in the monitor's own frame, so it inherits the toe-in for free — a
 * clamp squared to the world holding a panel turned nine degrees is the kind of
 * thing you can't see until you can't stop seeing it.
 */
function MonitorArm({ panelH, lift }: { panelH: number; lift: number }) {
  /** The desk surface, in this monitor's local frame. */
  const deskY = -panelH / 2 - lift;
  /** The desk's back edge, likewise local. */
  const edgeZ = -0.118;
  /** Outboard of the panel's right edge, where the arm has room to be seen. */
  const x = 0.3;
  /** The plane the linkage swings in, just behind the panel. */
  const armZ = -0.062;

  /** Post top, elbow, and the VESA end — the three joints. */
  const post: [number, number] = [x, deskY + 0.17];
  const elbow: [number, number] = [x + 0.035, deskY + 0.55];
  const vesa: [number, number] = [0.045, deskY + 0.335];

  return (
    <group>
      {/*
        The clamp: a C around the back edge of the desk.

        Three parts, because a C-clamp is three parts — a pad on top, a spine
        dropping behind the edge, and a screw plate underneath pulling up. Built
        as one block it reads as a lump; built as three it reads as something
        tightened onto the desk, and the gap between the top pad and the bottom
        plate is where the desk actually is.
      */}
      <RoundedBox
        args={[0.072, 0.014, 0.076]}
        radius={0.005}
        smoothness={4}
        position={[x, deskY + 0.007, edgeZ + 0.03]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.POWDER_COAT} />
      </RoundedBox>
      <RoundedBox
        args={[0.05, 0.086, 0.02]}
        radius={0.006}
        smoothness={4}
        position={[x, deskY - 0.026, edgeZ - 0.012]}
        castShadow
      >
        <meshStandardMaterial {...M.POWDER_COAT} />
      </RoundedBox>
      <RoundedBox
        args={[0.058, 0.013, 0.05]}
        radius={0.005}
        smoothness={4}
        position={[x, deskY - 0.062, edgeZ + 0.016]}
        castShadow
      >
        <meshStandardMaterial {...M.POWDER_COAT} />
      </RoundedBox>
      {/* The screw that does the tightening, standing proud underneath. */}
      <mesh position={[x, deskY - 0.073, edgeZ + 0.016]} castShadow>
        <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/* The post, rising out of the clamp and canted forward to the arm's
          plane, which is where the linkage lives. */}
      <RoundedBox
        args={[0.036, 0.19, 0.036]}
        radius={0.013}
        smoothness={5}
        position={[x, deskY + 0.085, (edgeZ + 0.03 + armZ) / 2]}
        rotation={[0.18, 0, 0]}
        castShadow
      >
        <meshStandardMaterial {...M.ALUMINIUM} />
      </RoundedBox>

      {/* Lower link, upper link, folded back over it. */}
      <Link from={post} to={elbow} width={0.036} z={armZ} />
      <Link from={elbow} to={vesa} width={0.03} z={armZ + 0.026} depth={0.026} />

      {/* The three joints, as collars standing proud of the links they pin.
          Without them the arm is two sticks that happen to touch. */}
      {(
        [
          [post, 0.023, armZ],
          [elbow, 0.021, armZ + 0.013],
          [vesa, 0.019, armZ + 0.026],
        ] as [[number, number], number, number][]
      ).map(([p, r, jz], i) => (
        <mesh
          key={i}
          position={[p[0], p[1], jz]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[r, r, 0.04, 20]} />
          <meshStandardMaterial {...M.POWDER_COAT} />
        </mesh>
      ))}

      {/* Tilt knuckle and the VESA plate bolted to the back of the panel. */}
      <RoundedBox
        args={[0.078, 0.078, 0.016]}
        radius={0.006}
        smoothness={4}
        position={[0.006, vesa[1], -0.018]}
        castShadow
      >
        <meshStandardMaterial {...M.POWDER_COAT} />
      </RoundedBox>
    </group>
  );
}

const HELD = (() => {
  const eye = new Vector3(...CAMERA.eye);
  const dir = new Vector3(...CAMERA.target).sub(eye).normalize();
  return eye.clone().addScaledVector(dir, 0.74);
})();

/**
 * Fill light for a held box.
 *
 * Every light in the room is behind or above the shelf, so a box turned to face
 * the viewer presents its one unlit side and renders as a black rectangle. This
 * sits just off the viewer's shoulder and only exists while something is held,
 * which is also how it reads: light falling on an object you've picked up.
 */
function HeldLight() {
  const focus = useScene((s) => s.focus);
  const on = focus.kind === "box";
  const eye = useMemo(() => new Vector3(...CAMERA.eye), []);

  return (
    <pointLight
      position={[eye.x - 0.25, eye.y + 0.2, eye.z - 0.1]}
      intensity={on ? 1.4 : 0}
      distance={2.2}
      decay={2}
      color="#ffeeda"
    />
  );
}

function GameBox({
  id,
  x,
  upright,
  art,
  wooden = false,
}: {
  id: BoxId;
  x: number;
  /**
   * Stood on its edge, leaning back against the wall, lid facing the seat.
   *
   * The lids carry the real artwork and, laid flat on a shelf above eye level,
   * not one pixel of either was ever visible — the camera sits at 1.3 m and the
   * shelf is above it, so a flat box shows you its spine and its underside and
   * nothing else. Standing one up is also just what people do with the box
   * they're proud of.
   */
  upright: boolean;
  art: BoxArt;
  /**
   * A folding wooden case rather than a printed carton.
   *
   * Everything about how the object behaves is the same — it's picked up the
   * same way and turns over to the same case study — so this is a skin, not a
   * second component. What changes is what it's made of: crisp chamfered edges
   * instead of a soft cardboard fillet, wood instead of coated board, and brass
   * hardware, because a case that opens has to have something holding it shut.
   */
  wooden?: boolean;
}) {
  const focusBox = useScene((s) => s.focusBox);
  const focus = useScene((s) => s.focus);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const ref = useRef<Group>(null);

  const held = focus.kind === "box" && focus.id === id;

  /*
   * Upright, the box's local Z becomes its height and its local Y becomes its
   * depth — so it stands 295 mm tall and only 75 mm thick, and it needs to sit
   * back against the wall rather than centred on the shelf.
   */
  const shelved = useMemo(
    () =>
      new Vector3(
        x,
        SHELF.y + SHELF.thickness / 2 + (upright ? BOX.d / 2 : BOX.h / 2),
        upright ? SHELF.z - SHELF.depth / 2 + BOX.h : SHELF.z,
      ),
    [x, upright],
  );

  // Leaning back a few degrees, because nothing stands perfectly plumb on a
  // shelf and a box that does reads as glued there.
  const restRotationX = upright ? Math.PI / 2 - 0.07 : 0;

  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.1);
    const k = 1 - Math.exp(-5 * dt);

    mesh.position.lerp(held ? HELD : shelved, k);

    /*
     * Held, the box turns its *back* to you — which is where the case study is
     * printed, and which is the −Y face.
     *
     * A rotation of −90° about X maps −Y onto +Z, i.e. straight at the camera;
     * +90° would present the lid instead. The 0.14 tips the top edge back so it
     * isn't a flat rectangle pasted on the frame. For the box that already
     * stands upright this reads as a full flip, which is exactly what turning a
     * box over looks like.
     */
    const targetX = held ? -Math.PI / 2 + 0.14 : restRotationX;
    mesh.rotation.x = MathUtils.lerp(mesh.rotation.x, targetX, k);
  });

  /*
   * Cardboard takes a warm tint; wood does not.
   *
   * The tint exists to lift a printed box on hover and to knock the base card
   * back to something off-white. Applied to a wood texture it multiplies a
   * colour into a colour that's already there, and the case comes out muddy —
   * so the wooden one stays at full white and lets its map do the work.
   */
  const body = wooden ? M.BOARD_WOOD : M.BOX_CARD;
  /*
   * Two tints, because the body and the printed faces want different things.
   *
   * The overlay planes carry a map and have to be left at white or the texture
   * gets multiplied by a colour on its way to the screen. The body underneath
   * carries no map at all — it's only ever seen at the chamfers, in the sliver
   * the planes don't cover — so it needs its material's own colour. Setting
   * both to white left a bright unpainted rim running round the wooden case,
   * which is a very convincing impression of a box made of paper.
   */
  const tint = hovered && !held ? "#ffffff" : "#dcd6cb";
  const bodyTint = wooden ? body.color : tint;
  const printTint = wooden ? "#ffffff" : tint;

  /*
   * A rounded body with the artwork applied on top of it.
   *
   * It used to be a box geometry with six materials, one per face, which is the
   * tidy way to print a cube and gives you a cube — six flat faces meeting at
   * perfect right angles, the most primitive-looking object in the room. A
   * rounded box can't do per-face materials, because it's one extruded shell
   * with no face groups, so the print becomes separate panels floating a
   * fraction proud of each side.
   *
   * That turns out to be closer to how a real box is made anyway: the board is
   * one object and the printed wrap is another, and the reason a game box has
   * soft edges at all is that paper can't fold around a sharp one.
   */
  const spineFaces: {
    key: string;
    position: [number, number, number];
    rotation: [number, number, number];
    w: number;
  }[] = [
    { key: "front", position: [0, 0, BOX.d / 2], rotation: [0, 0, 0], w: BOX.w },
    {
      key: "back",
      position: [0, 0, -BOX.d / 2],
      rotation: [0, Math.PI, 0],
      w: BOX.w,
    },
    {
      key: "right",
      position: [BOX.w / 2, 0, 0],
      rotation: [0, Math.PI / 2, 0],
      w: BOX.d,
    },
    {
      key: "left",
      position: [-BOX.w / 2, 0, 0],
      rotation: [0, -Math.PI / 2, 0],
      w: BOX.d,
    },
  ];

  return (
    <group ref={ref} position={shelved}>
      <RoundedBox
        args={[BOX.w, BOX.h, BOX.d]}
        /*
         * A third of the box's own depth on the carton, and a chamfer on the
         * wood. Cardboard is soft because paper cannot fold around a sharp
         * corner; a hardwood case is machined, and its edges are broken by a
         * couple of millimetres and no more. Rounding them the same amount is
         * how two objects made of different things end up looking made of the
         * same thing.
         */
        radius={wooden ? 0.005 : 0.022}
        smoothness={6}
        castShadow
        receiveShadow
        // A held box must not intercept the click that puts it back.
        raycast={held ? () => null : undefined}
        onClick={(e) => {
          e.stopPropagation();
          focusBox(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial {...body} color={bodyTint} />
      </RoundedBox>

      {/* Lid. Inset so the fillet stays visible all the way round the print. */}
      <mesh position={[0, BOX.h / 2 + 0.0004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={
            wooden
              ? // A chamfer is 5 mm, not 14, so the wooden lid runs almost to
                // the edge — the board's frame is meant to reach the corner.
                [BOX.w - 0.006, BOX.d - 0.006]
              : [BOX.w - 0.014, BOX.d - 0.014]
          }
        />
        <meshStandardMaterial {...body} color={printTint} map={art.lid} />
      </mesh>

      {wooden && <CaseHardware />}

      {/*
        Spines, on all four sides. Stacked on a shelf this is the only part of a
        board game box anybody ever sees.
      */}
      {spineFaces.map((f) => (
        <mesh
          key={f.key}
          position={[
            f.position[0] * 1.004,
            f.position[1],
            f.position[2] * 1.004,
          ]}
          rotation={f.rotation}
        >
          <planeGeometry
            args={
              wooden
                ? [f.w - 0.006, BOX.h - 0.003]
                : [f.w - 0.014, BOX.h - 0.008]
            }
          />
          <meshStandardMaterial {...body} color={printTint} map={art.spine} />
        </mesh>
      ))}

      {held && (
        <Surface
          designW={BOX_DESIGN.w}
          designH={BOX_DESIGN.h}
          // Inset from the lid. Printed exactly edge to edge the surface covers
          // the whole face and the thing reads as a floating card; leaving a
          // sliver of box visible is what makes it read as an object with depth.
          worldW={BOX.w * 0.9}
          focused
          radiusPx={(0.016 * BOX_DESIGN.w) / (BOX.w * 0.9)}
          // The back of the box, not the lid. The lid has artwork printed on it
          // now, and mounting the case study on top of that would cover the one
          // face worth looking at.
          position={[0, -BOX.h / 2 - 0.002, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <BoxBack id={id} />
        </Surface>
      )}
    </group>
  );
}

/**
 * Clasps and hinges, in brass.
 *
 * A case that opens needs something holding it shut, and this is the part that
 * finishes the argument the parting line starts. Two hooked clasps on the front
 * edge, two barrel hinges on the back, all of them the only warm metal anywhere
 * in the room — which is also why they read at this distance when nothing else
 * that small does.
 */
function CaseHardware() {
  /** A whisker proud of the face, so each catches its own highlight. */
  const out = BOX.w / 2 + 0.0015;

  /*
   * On the left and right faces, not the front and back.
   *
   * The case stands on its edge with the board facing the seat, so the only
   * faces anyone can see are the four narrow ones around it. Hardware on the
   * front and back would be on the two faces pointing at the wall and at the
   * ceiling — correct for a box lying flat, invisible for one stood up.
   */
  return (
    <group>
      {[-0.075, 0.075].map((z) => (
        <group key={z}>
          {/* Clasps down one edge. The plate spans the parting line, which is
              the whole point of a clasp. */}
          <RoundedBox
            args={[0.004, 0.03, 0.024]}
            radius={0.0015}
            smoothness={3}
            position={[out, 0, z]}
            castShadow
          >
            <meshStandardMaterial {...M.BRASS} />
          </RoundedBox>
          {/* The hook itself, standing off the plate. */}
          <mesh position={[out + 0.004, -0.006, z]} castShadow>
            <boxGeometry args={[0.005, 0.013, 0.011]} />
            <meshStandardMaterial {...M.BRASS} />
          </mesh>

          {/* Hinge barrels down the other, lying along the parting line. */}
          <mesh position={[-out, 0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.0055, 0.0055, 0.042, 14]} />
            <meshStandardMaterial {...M.BRASS} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Shelf() {
  const art = useMemo(
    () => ({
      catan: catanArt(),
      // The chess set is a wooden case, so its "lid" is the playing surface and
      // its "spine" is the side of the box with the parting line down it.
      chess: { lid: chessBoardTexture(), spine: chessCaseSideTexture() },
    }),
    [],
  );
  const grain = useMemo(() => shelfTexture(), []);

  useEffect(
    () => () => {
      Object.values(art).forEach((a) => {
        a.lid.dispose();
        a.spine.dispose();
      });
      grain.dispose();
    },
    [art, grain],
  );

  return (
    <group>
      <RoundedBox
        args={[SHELF.width, SHELF.thickness, SHELF.depth]}
        // Full bullnose, same reasoning as the desk: a shelf this thin can't be
        // rounder than half its thickness, so take all of it.
        radius={SHELF.thickness / 2 - 0.001}
        smoothness={6}
        position={[SHELF.x, SHELF.y, SHELF.z]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.SHELF_WOOD} color="#ffffff" map={grain} />
      </RoundedBox>
      {/* Brackets, so the shelf isn't floating. */}
      {[-SHELF.width / 2 + 0.09, SHELF.width / 2 - 0.09].map((dx, i) => (
        <RoundedBox
          key={i}
          args={[0.016, 0.085, 0.095]}
          radius={0.007}
          smoothness={4}
          position={[SHELF.x + dx, SHELF.y - 0.048, SHELF.z - SHELF.depth / 4]}
          castShadow
        >
          <meshStandardMaterial {...M.POWDER_COAT} />
        </RoundedBox>
      ))}
      {/*
        One up, one flat. Two boxes stacked was a block; a box stood against the
        wall with another lying beside it is a shelf — and it shows one lid and
        one spine, which is the pair of things worth showing.
      */}
      <GameBox id="catan" x={SHELF.x - 0.23} upright art={art.catan} />
      <GameBox id="chess" x={SHELF.x + 0.07} upright art={art.chess} wooden />
      <Plant />
    </group>
  );
}

/**
 * The triptych.
 *
 * Three thin black frames in a row, each showing its own third of one wide
 * photograph. The slicing is done with texture offsets rather than by cutting
 * three images, so the car lines up across the gaps exactly — by construction,
 * not by hand.
 */
function Triptych() {
  const panels = useMemo(() => triptychPanels(), []);
  useEffect(() => () => panels.forEach((t) => t.dispose()), [panels]);

  const pitch = TRIPTYCH.w + TRIPTYCH.gap;
  const span = pitch * (PANELS - 1);

  /*
   * Height comes from the artwork, not from a hand-picked number.
   *
   * The picture is one wide canvas sliced into thirds, so each panel's art has
   * a fixed aspect — pick the frame height independently and the car comes out
   * stretched, which on a shape this recognisable is immediately obvious and
   * impossible to un-see.
   */
  const artW = TRIPTYCH.w - TRIPTYCH.frame * 2;
  const artH = artW / PANEL_ASPECT;
  const frameH = artH + TRIPTYCH.frame * 2;

  return (
    <group position={[TRIPTYCH.x, TRIPTYCH.y, WALL.z + 0.006]}>
      {panels.map((tex, i) => (
        <group key={i} position={[i * pitch - span / 2, 0, 0]}>
          {/* Frame: thin, black, square-cornered. Gallery frames have no
              fillet, and adding one here would make them read as tablets. */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[TRIPTYCH.w, frameH, 0.016]} />
            <meshStandardMaterial {...M.FRAME} />
          </mesh>
          <mesh position={[0, 0, 0.009]}>
            <planeGeometry args={[artW, artH]} />
            <meshStandardMaterial {...M.PAPER} color="#ffffff" map={tex} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The desk mat.
 *
 * Big — it runs the full width of the working area, under the keyboard and the
 * mouse both, because that's what a mat that size is for and because a small
 * pad under only the mouse leaves the keyboard sitting on bare wood looking
 * unplaced. Rounded in plan rather than as a box: drei's rounded box caps its
 * radius at half the smallest dimension, and on something four millimetres
 * thick that's no rounding at all.
 */
function DeskMat() {
  const top = useMemo(
    () => roundedPlate(MAT.w, MAT.d, 0.02, MAT.thickness),
    [],
  );
  const edge = useMemo(
    () => roundedPlate(MAT.w + 0.008, MAT.d + 0.008, 0.024, MAT.thickness * 0.6),
    [],
  );

  const print = useMemo(() => matTexture(), []);

  useEffect(
    () => () => {
      top.dispose();
      edge.dispose();
      print.dispose();
    },
    [top, edge, print],
  );

  return (
    <group position={[MAT.x, DESK.surfaceY, MAT.z]}>
      {/* Stitched edging, a whisker proud of the mat all the way round. */}
      <mesh geometry={edge} receiveShadow>
        <meshStandardMaterial {...M.MAT_EDGE} />
      </mesh>
      <mesh geometry={top} position={[0, 0.0002, 0]} receiveShadow>
        <meshStandardMaterial {...M.FABRIC} color="#ffffff" map={print} />
      </mesh>
    </group>
  );
}

function Clutter() {
  const top = DESK.surfaceY;

  return (
    <group>
      <DeskMat />
      <group position={[0, top + MAT.thickness, 0]}>
        <Keyboard />
      </group>
      <Mouse top={top + MAT.thickness} />
      <Cube top={top} />

      {/*
        Coaster. Cork, and the only warm-brown object on the desk that isn't the
        desk — which is exactly why it works: a white mug standing directly on
        an oiled walnut top is a ring waiting to happen, and everyone who owns
        a wooden desk knows it.
      */}
      <group position={[-0.66, top, 0.2]}>
        <mesh position={[0, 0.0025, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.058, 0.056, 0.005, 40]} />
          <meshStandardMaterial {...M.CORK} />
        </mesh>
        <Mug position={[0, 0.005, 0]} />
      </group>

      {/*
        A notebook and a pen, at the right-hand edge. Not decoration: the right
        third of the frame is where the lamp used to stand and it's empty
        without something in it, and a flat rectangle there catches the window
        light and gives that side of the desk a highlight to sit on.
      */}
      <group position={[0.74, top, 0.19]} rotation={[0, -0.22, 0]}>
        <RoundedBox
          args={[0.15, 0.014, 0.21]}
          radius={0.006}
          smoothness={5}
          position={[0, 0.006, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...M.NOTEBOOK} />
        </RoundedBox>
        <mesh
          position={[0.01, 0.016, 0.01]}
          rotation={[0, 0.34, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.0045, 0.0045, 0.13, 12]} />
          <meshStandardMaterial {...M.ALUMINIUM} />
        </mesh>
      </group>
    </group>
  );
}

export function Room({
  day,
  hero = false,
  activity = null,
  weather = null,
}: {
  day: Daylight;
  hero?: boolean;
  activity?: ActivityFeed | null;
  weather?: Weather | null;
}) {
  const clearFocus = useScene((s) => s.clearFocus);

  return (
    <group>
      {/* Clicking anything that isn't a target leans back out. */}
      <mesh
        position={[0, 1.2, WALL.z - WINDOW.reveal - 0.2]}
        onClick={clearFocus}
        visible={false}
      >
        <planeGeometry args={[WALL.width * 2, WALL.height * 2]} />
      </mesh>

      <Outside day={day} />
      <Walls />
      <WindowFrame />
      {/* Only mounted when it's actually raining in Gurugram. */}
      {isWet(weather) && <RainGlass storm={weather?.condition === "storm"} />}
      <Desk />
      <Cables />
      {SCREENS.map((s) => (
        <Monitor key={s.id} placement={s} hero={hero} activity={activity} />
      ))}
      <Shelf />
      <Triptych />
      <WallClock />
      <Lamp day={day} />
      <Clutter />
      <Planter />
      <HeldLight />
    </group>
  );
}
