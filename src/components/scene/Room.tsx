"use client";

import { RoundedBox, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, Vector3, type Group } from "three";

import { About } from "@/components/screens/About";
import { BoxBack } from "@/components/screens/BoxBack";
import { CommitFeed } from "@/components/screens/CommitFeed";
import { NowPlaying } from "@/components/screens/NowPlaying";
import type { ActivityFeed } from "@/lib/activity";
import type { Daylight } from "@/lib/daylight";
import {
  BOX,
  BOX_DESIGN,
  CAMERA,
  DESK,
  MAT,
  MONITOR,
  SCREENS,
  SCREEN_DESIGN,
  SHELF,
  WALL,
  WINDOW,
  type ScreenId,
} from "@/lib/layout";
import { useScene, type BoxId } from "@/lib/store";

import { catanArt, chessArt, type BoxArt } from "./boxArt";
import { roundedPanel, roundedPlate } from "./geometry";
import { Headphones } from "./Headphones";
import { Keyboard } from "./Keyboard";
import { Lamp } from "./Lamp";
import * as M from "./materials";
import { Mouse } from "./Mouse";
import { Mug } from "./Mug";
import { arcPrint, contourPrint } from "./printArt";
import { Surface } from "./Surface";
import { nightLightsTexture, outsideTexture } from "./windowView";

function Desk() {
  const midZ = DESK.frontZ - DESK.depth / 2;
  const legInset = 0.08;
  const legH = DESK.surfaceY - DESK.thickness;

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
        <meshStandardMaterial {...M.WALNUT} />
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
  if (id === "about") return <About initial={activity} />;
  return <NowPlaying />;
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

  const outerW = MONITOR.panelW + MONITOR.bezel * 2;
  const outerH = MONITOR.panelH + MONITOR.bezel * 2;

  // The glass is inset by the bezel, so its corner has to be tighter by the
  // same amount or the black panel cuts across the chassis fillet.
  const glass = useMemo(
    () =>
      roundedPanel(
        MONITOR.panelW,
        MONITOR.panelH,
        MONITOR.corner - MONITOR.bezel,
      ),
    [],
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
          designW={SCREEN_DESIGN.w}
          designH={SCREEN_DESIGN.h}
          worldW={MONITOR.panelW}
          focused={focused}
          position={[0, 0, MONITOR.depth / 2 + 0.001]}
        >
          <ScreenContent id={placement.id} activity={activity} />
        </Surface>
      )}

      {/* Neck and foot. Aluminium, so they catch the lamp and read as hardware. */}
      <RoundedBox
        args={[0.046, MONITOR.liftY + 0.02, 0.026]}
        radius={0.011}
        smoothness={5}
        position={[0, -MONITOR.panelH / 2 - MONITOR.liftY / 2, -0.026]}
        castShadow
      >
        <meshStandardMaterial {...M.ALUMINIUM} />
      </RoundedBox>
      {/*
        A properly rounded foot rather than a rounded box: at 13 mm thick,
        RoundedBox can only put a 6 mm fillet on it and the corners in plan —
        the ones you actually see from above — stay square.
      */}
      <mesh
        geometry={foot}
        position={[0, -MONITOR.panelH / 2 - MONITOR.liftY, -0.026]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>
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
  index,
  art,
}: {
  id: BoxId;
  index: number;
  art: BoxArt;
}) {
  const focusBox = useScene((s) => s.focusBox);
  const focus = useScene((s) => s.focus);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const ref = useRef<Group>(null);

  const held = focus.kind === "box" && focus.id === id;

  const shelved = useMemo(
    () =>
      new Vector3(
        SHELF.x,
        SHELF.y + SHELF.thickness / 2 + BOX.h / 2 + index * BOX.h,
        SHELF.z,
      ),
    [index],
  );

  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.1);
    const k = 1 - Math.exp(-5 * dt);

    mesh.position.lerp(held ? HELD : shelved, k);

    // Flat on the shelf the lid points at the ceiling; held, it should point at
    // the viewer, which is a quarter turn about X.
    //
    // Positive, not negative: rotating by -PI/2 maps +Y to -Z and turns the lid
    // *away* from the camera. With a plain material both faces look identical
    // so the greybox couldn't show it; the back cover appearing blank is what
    // finally did. The 0.14 tips the top edge back so it isn't a flat rectangle
    // pasted on the frame.
    const targetX = held ? Math.PI / 2 - 0.14 : 0;
    mesh.rotation.x = MathUtils.lerp(mesh.rotation.x, targetX, k);
  });

  const tint = hovered && !held ? "#ffffff" : "#dcd6cb";

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
        // A third of the box's own depth. Far more than a real one, and it's
        // what turns the stack on the shelf from two cubes into two objects.
        radius={0.022}
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
        <meshStandardMaterial {...M.BOX_CARD} color={tint} />
      </RoundedBox>

      {/* Lid. Inset so the fillet stays visible all the way round the print. */}
      <mesh position={[0, BOX.h / 2 + 0.0004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOX.w - 0.03, BOX.d - 0.03]} />
        <meshStandardMaterial {...M.BOX_CARD} color={tint} map={art.lid} />
      </mesh>

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
          <planeGeometry args={[f.w - 0.03, BOX.h - 0.012]} />
          <meshStandardMaterial {...M.BOX_CARD} color={tint} map={art.spine} />
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
          position={[0, BOX.h / 2 + 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <BoxBack id={id} />
        </Surface>
      )}
    </group>
  );
}

function Shelf() {
  const art = useMemo(() => ({ catan: catanArt(), chess: chessArt() }), []);

  useEffect(
    () => () => {
      Object.values(art).forEach((a) => {
        a.lid.dispose();
        a.spine.dispose();
      });
    },
    [art],
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
        <meshStandardMaterial {...M.SHELF_WOOD} />
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
      <GameBox id="catan" index={0} art={art.catan} />
      <GameBox id="chess" index={1} art={art.chess} />
    </group>
  );
}

/**
 * Framed prints, on the left where the window used to be.
 *
 * Two of them, different sizes, hung off-centre. A single centred print reads as
 * a placeholder; a pair with a deliberate offset reads as someone's wall.
 */
function Prints() {
  const art = useMemo(() => [arcPrint(), contourPrint()], []);
  useEffect(() => () => art.forEach((t) => t.dispose()), [art]);

  return (
    <group>
      {(
        [
          // Left of the shelf, stopping just short of it. Any higher and the
          // top of the frame crops it, which reads as a mistake rather than as
          // a composition running off the edge.
          [-1.24, 1.42, 0.4, 0.54],
          // Low, beside the desk rather than behind it, filling what was
          // otherwise the emptiest corner of the frame.
          [-1.26, 0.96, 0.24, 0.3],
        ] as const
      ).map(([x, y, w, h], i) => (
        <group key={i} position={[x, y, WALL.z + 0.006]}>
          <RoundedBox
            args={[w, h, 0.014]}
            radius={0.006}
            smoothness={5}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.POWDER_COAT} />
          </RoundedBox>
          <mesh position={[0, 0, 0.008]}>
            <planeGeometry args={[w - 0.032, h - 0.032]} />
            <meshStandardMaterial {...M.PAPER} color="#ffffff" map={art[i]} />
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

  useEffect(
    () => () => {
      top.dispose();
      edge.dispose();
    },
    [top, edge],
  );

  return (
    <group position={[MAT.x, DESK.surfaceY, MAT.z]}>
      {/* Stitched edging, a whisker proud of the mat all the way round. */}
      <mesh geometry={edge} receiveShadow>
        <meshStandardMaterial {...M.MAT_EDGE} />
      </mesh>
      <mesh geometry={top} position={[0, 0.0002, 0]} receiveShadow>
        <meshStandardMaterial {...M.FABRIC} />
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

      <Mug position={[-0.66, top, 0.2]} />

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
}: {
  day: Daylight;
  hero?: boolean;
  activity?: ActivityFeed | null;
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
      <Desk />
      {SCREENS.map((s) => (
        <Monitor key={s.id} placement={s} hero={hero} activity={activity} />
      ))}
      <Headphones />
      <Shelf />
      <Prints />
      <Lamp day={day} />
      <Clutter />
      <HeldLight />
    </group>
  );
}
