"use client";

import { RoundedBox, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, Vector3, type Group } from "three";

import { About } from "@/components/screens/About";
import { BoxBack } from "@/components/screens/BoxBack";
import { NowPlaying } from "@/components/screens/NowPlaying";
import { Tetris } from "@/components/screens/Tetris";
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
import { Curtain } from "./Curtain";
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

  // Two square metres of unbroken tone reads as plastic however good the
  // lighting is. This is the one surface where a texture isn't optional.
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
 * The wall, built as four slabs around a hole rather than one plane with a
 * bright rectangle stuck to it. A real opening lets the sun through to lay a
 * window-shaped patch across the floor and desk, which is worth more to the
 * frame than the window is, and gives the wall the reveal that stops a window
 * reading as a sticker.
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
 * What's on the other side of the glass: a vertical gradient, sky over haze, at
 * whatever colour the daylight model says. It's only ever seen through a 90 cm
 * opening at the edge of frame, and anything more detailed would pull the eye
 * straight out of the room.
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
        A luminance ramp multiplied by the daylight colour, so one texture
        carries every hour. Untonemapped, because whatever is outside a window
        is brighter than the room's exposure is set for, and rolling it off with
        the rest of the scene makes a window look like a picture of one.
      */}
      <mesh>
        <planeGeometry args={[WINDOW.w * 1.5, WINDOW.h * 1.35]} />
        <meshBasicMaterial map={view} color={day.windowColor} toneMapped={false} />
      </mesh>

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
 * Frame and glazing bars — a grid, not a single opening. A divided window is
 * legible as a window at any size where a bare rectangle of sky is ambiguous,
 * and the bars are the only dark shapes on the bright side of the room, which
 * stops that corner blowing out to a featureless block.
 *
 * Deliberately chunky: at a real casement's 24 mm they vanished, being under two
 * pixels wide at this distance.
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

      <mesh position={[WINDOW.w * 0.34, -WINDOW.h * 0.32, depth * 0.6]} castShadow>
        <boxGeometry args={[0.014, 0.055, 0.014]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

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
  // The ids are the placements, not the contents: "commits" is the left 27" and
  // "about" is the ultrawide, whatever each is currently showing.
  if (id === "commits") return <About initial={activity} />;
  if (id === "about") return <Tetris />;
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

      {/*
        The bias strip. Never seen directly — it faces the wall — but it gives
        the glow on the wall an origin with an edge, and it's what bloom has to
        bite on. Only on the ultrawide: nobody buys three.
      */}
      {placement.stand === "riser" && (
        <mesh position={[0, -panelH * 0.16, -MONITOR.depth / 2 - 0.004]}>
          <boxGeometry args={[panelW * 0.86, 0.007, 0.004]} />
          <meshStandardMaterial
            color={M.ACCENT_HEX}
            emissive={M.ACCENT_HEX}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      )}

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
        Not mounted in hero mode. Three React trees transformed into CSS 3D is
        the most expensive thing in the scene, and at phone size the text would
        be unreadable anyway — the same content sits in the DOM below.
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
        In the monitor's local frame: deriving the corner from panel size and
        toe-in by hand is what once put these behind the screen.

        On the portrait monitor because a 74 mm cup on the left-hand screen
        landed on the commit feed's header. Here it only covers margin. Tilted,
        because a pair hanging perfectly plumb has been placed by someone.
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
 * The ultrawide's stand: a blade on a bar, which is what an 80 cm panel actually
 * ships with. A stand resists the panel falling forward and the panel twisting
 * about the neck; a round neck on a small plate handles the first and nothing at
 * all about the second, which is why a wide screen on one wobbles as you type. A
 * flat vertical blade is stiff in torsion, and the bar has to span enough of the
 * screen to plant its feet outside the centre of mass — a third reads as a
 * stand, a fifth as a pedestal about to go over.
 */
function Riser({ panelH, lift }: { panelH: number; lift: number }) {
  const deskY = -panelH / 2 - lift;
  const z = -0.03;

  const bar = useMemo(() => roundedPlate(0.58, 0.14, 0.03, 0.013), []);
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
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} position={[x, deskY + 0.002, z]}>
          <boxGeometry args={[0.05, 0.004, 0.12]} />
          <meshStandardMaterial {...M.POWDER_COAT} />
        </mesh>
      ))}

      <RoundedBox
        args={[0.086, lift + 0.02, 0.02]}
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
 * Worth the helper: an articulated arm is defined by where its joints are, and
 * writing down the joints and letting the maths place the links is the only
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
 * The mount a portrait monitor hangs off.
 *
 * The articulation is placed where it can be *seen*: a straight boom back to the
 * panel is right in principle and invisible in practice, since all of it sits
 * behind an 80 cm screen and only a stub of clamp ever shows. So the clamp goes
 * outboard of the panel and the arm rises beside the screen.
 *
 * The hard-folded elbow isn't styling — it's what a gas-spring arm does when the
 * screen is 30 cm from the clamp and there is nowhere else for that much link
 * length to go. The tight V is the most recognisable thing about these.
 *
 * Built in the monitor's own frame, so it inherits the toe-in for free.
 */
function MonitorArm({ panelH, lift }: { panelH: number; lift: number }) {
  const deskY = -panelH / 2 - lift;
  const edgeZ = -0.118;
  /** Outboard of the panel's right edge, where the arm has room to be seen. */
  const x = 0.3;
  const armZ = -0.062;

  /** Post top, elbow, and the VESA end — the three joints. */
  const post: [number, number] = [x, deskY + 0.17];
  const elbow: [number, number] = [x + 0.035, deskY + 0.55];
  const vesa: [number, number] = [0.045, deskY + 0.335];

  return (
    <group>
      {/*
        The clamp, as three parts: a pad on top, a spine behind the edge, a screw
        plate underneath. As one block it reads as a lump; as three it reads as
        tightened onto the desk, and the gap between pad and plate is where the
        desk actually is.
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
   * Stood on its edge, lid facing the seat. The camera is at 1.3 m and the shelf
   * is above it, so a box lying flat shows its spine and underside and not one
   * pixel of the artwork.
   */
  upright: boolean;
  art: BoxArt;
  /**
   * A folding wooden case rather than a printed carton — a skin, not a second
   * component. Crisp chamfers instead of a soft cardboard fillet, wood instead
   * of coated board, and brass hardware, because a case that opens has to have
   * something holding it shut.
   */
  wooden?: boolean;
}) {
  const focusBox = useScene((s) => s.focusBox);
  const focus = useScene((s) => s.focus);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const ref = useRef<Group>(null);

  const held = focus.kind === "box" && focus.id === id;

  // Upright, the box's local Z becomes its height and its local Y its depth, so
  // it sits back against the wall rather than centred on the shelf.
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

    // Held, the box turns its −Y face to the camera, which is where the case
    // study is printed; +90° would present the lid instead. The 0.14 tips the
    // top edge back so it isn't a flat rectangle pasted on the frame.
    const targetX = held ? -Math.PI / 2 + 0.14 : restRotationX;
    mesh.rotation.x = MathUtils.lerp(mesh.rotation.x, targetX, k);
  });

  const body = wooden ? M.BOARD_WOOD : M.BOX_CARD;
  /*
   * Two tints. The overlay planes carry a map and must stay white or the texture
   * gets multiplied by a colour on its way to the screen; the body carries no
   * map and is only seen at the chamfers, so it needs its material's own colour.
   * Both white left a bright unpainted rim round the wooden case — a convincing
   * impression of a box made of paper.
   */
  const tint = hovered && !held ? "#ffffff" : "#dcd6cb";
  const bodyTint = wooden ? body.color : tint;
  const printTint = wooden ? "#ffffff" : tint;

  /*
   * The artwork goes on as separate panels floating proud of each side, because
   * a rounded box is one extruded shell with no face groups and can't take
   * per-face materials. Closer to how a real box is made anyway: the board is
   * one object and the printed wrap is another.
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
        // Cardboard is soft because paper can't fold around a sharp corner; a
        // hardwood case is machined and its edges broken by a couple of
        // millimetres. Rounding both the same is how two objects made of
        // different things end up looking made of the same thing.
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
 * Clasps and hinges, in brass — what finishes the argument the parting line
 * starts. The only warm metal in the room, which is why five millimetres of
 * hardware reads at this distance when nothing else that small does.
 */
function CaseHardware() {
  /** A whisker proud of the face, so each catches its own highlight. */
  const out = BOX.w / 2 + 0.0015;

  /*
   * On the left and right faces. The case stands on its edge, so those are the
   * only ones visible — front and back point at the wall and the ceiling, which
   * is correct for a box lying flat and invisible for one stood up.
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
          <mesh position={[out + 0.004, -0.006, z]} castShadow>
            <boxGeometry args={[0.005, 0.013, 0.011]} />
            <meshStandardMaterial {...M.BRASS} />
          </mesh>

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
      <GameBox id="catan" x={SHELF.x - 0.23} upright art={art.catan} />
      <GameBox id="chess" x={SHELF.x + 0.07} upright art={art.chess} wooden />
      <Plant />
    </group>
  );
}

/**
 * Three frames each showing a third of one wide photograph, sliced with texture
 * offsets rather than by cutting three images — so the car lines up across the
 * gaps by construction rather than by hand.
 */
function Triptych() {
  const panels = useMemo(() => triptychPanels(), []);
  useEffect(() => () => panels.forEach((t) => t.dispose()), [panels]);

  const pitch = TRIPTYCH.w + TRIPTYCH.gap;
  const span = pitch * (PANELS - 1);

  // Height comes from the artwork's aspect. Pick it independently and the car
  // comes out stretched.
  const artW = TRIPTYCH.w - TRIPTYCH.frame * 2;
  const artH = artW / PANEL_ASPECT;
  const frameH = artH + TRIPTYCH.frame * 2;

  return (
    <group position={[TRIPTYCH.x, TRIPTYCH.y, WALL.z + 0.006]}>
      {panels.map((tex, i) => (
        <group key={i} position={[i * pitch - span / 2, 0, 0]}>
          {/* Square-cornered: a fillet would make these read as tablets. */}
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
 * Rounded in plan rather than as a rounded box: drei caps the radius at half the
 * smallest dimension, which on something 4 mm thick is no rounding at all.
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

      <group position={[-0.66, top, 0.2]}>
        <mesh position={[0, 0.0025, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.058, 0.056, 0.005, 40]} />
          <meshStandardMaterial {...M.CORK} />
        </mesh>
        <Mug position={[0, 0.005, 0]} />
      </group>

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
      <Curtain />
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
