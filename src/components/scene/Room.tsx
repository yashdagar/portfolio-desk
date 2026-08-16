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

import { catanArt, chessArt, type BoxArt } from "./boxArt";
import { matTexture } from "./matArt";
import { roundedPanel, roundedPlate } from "./geometry";
import { Headphones } from "./Headphones";
import { Keyboard } from "./Keyboard";
import { Lamp } from "./Lamp";
import * as M from "./materials";
import { Mouse } from "./Mouse";
import { Mug } from "./Mug";
import { Plant } from "./Plant";
import { contourPrint } from "./printArt";
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
  if (id === "about") return <About initial={activity} />;
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

      {placement.stand === "pole" ? (
        <PoleStand panelH={panelH} lift={lift} />
      ) : (
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
 * The stand a portrait monitor actually sits on.
 *
 * The shipped foot was wrong here and wrong in a way that's obvious once seen:
 * a 60 cm panel stood on its side can't balance on a 21 cm plate, and the
 * moulded stand it came with doesn't rotate anyway. Turning a monitor portrait
 * means putting it on a pole — a weighted base, a tall steel column, and a VESA
 * head clamped part way up that can be raised, tilted and spun through ninety
 * degrees.
 *
 * The detail that makes it read is the column continuing past the top of the
 * panel. Every one of these stands is built for a range of screens, so the pole
 * is always longer than any single monitor needs and there's always a length of
 * it standing proud above the screen.
 */
function PoleStand({ panelH, lift }: { panelH: number; lift: number }) {
  /** The desk, in this monitor's own local frame. */
  const deskY = -panelH / 2 - lift;
  /** Behind the panel, where the column has room to run. */
  const z = -0.062;

  const top = panelH / 2 + 0.055;
  const bottom = deskY + 0.014;
  const poleH = top - bottom;

  const base = useMemo(() => roundedPlate(0.22, 0.25, 0.045, 0.014), []);
  useEffect(() => () => base.dispose(), [base]);

  return (
    <group>
      {/* Weighted base. Deeper than it is wide, because all the leverage is
          front to back. */}
      <mesh geometry={base} position={[0, deskY, z + 0.03]} castShadow receiveShadow>
        <meshStandardMaterial {...M.POWDER_COAT} />
      </mesh>

      {/* Column. */}
      <RoundedBox
        args={[0.034, poleH, 0.034]}
        radius={0.012}
        smoothness={5}
        position={[0, (top + bottom) / 2, z]}
        castShadow
      >
        <meshStandardMaterial {...M.ALUMINIUM} />
      </RoundedBox>

      {/* The clamp that rides the column. */}
      <RoundedBox
        args={[0.056, 0.075, 0.056]}
        radius={0.016}
        smoothness={5}
        position={[0, 0, z]}
        castShadow
      >
        <meshStandardMaterial {...M.POWDER_COAT} />
      </RoundedBox>

      {/* VESA arm, reaching forward to the back of the panel. */}
      <RoundedBox
        args={[0.05, 0.05, 0.058]}
        radius={0.014}
        smoothness={5}
        position={[0, 0, z / 2 - 0.004]}
        castShadow
      >
        <meshStandardMaterial {...M.ALUMINIUM} />
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
        <planeGeometry args={[BOX.w - 0.014, BOX.d - 0.014]} />
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
          <planeGeometry args={[f.w - 0.014, BOX.h - 0.008]} />
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

function Shelf() {
  const art = useMemo(() => ({ catan: catanArt(), chess: chessArt() }), []);
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
      <GameBox id="chess" x={SHELF.x + 0.07} upright={false} art={art.chess} />
      <Plant />
    </group>
  );
}

/**
 * A framed print, low on the left-hand wall.
 *
 * There were two here — a large one and a small one — until the large one grew
 * into a triptych and moved to the wall that could actually hold it. What's
 * left is a single small print sitting under the clock, which is a tidier group
 * than two prints of different sizes stacked in a corner ever was.
 */
function Prints() {
  const art = useMemo(() => contourPrint(), []);
  useEffect(() => () => art.dispose(), [art]);

  const w = 0.24;
  const h = 0.3;

  return (
    <group position={[-1.26, 0.95, WALL.z + 0.006]}>
      <RoundedBox
        args={[w, h, 0.014]}
        radius={0.005}
        smoothness={5}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.POWDER_COAT} />
      </RoundedBox>
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[w - 0.03, h - 0.03]} />
        <meshStandardMaterial {...M.PAPER} color="#ffffff" map={art} />
      </mesh>
    </group>
  );
}

/**
 * The triptych.
 *
 * Three thin black frames in a row, each showing its own third of one wide
 * artwork. The slicing is done with texture offsets rather than by drawing
 * three pictures, so the car and the wordmark line up across the gaps exactly —
 * by construction, not by hand.
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
      {SCREENS.map((s) => (
        <Monitor key={s.id} placement={s} hero={hero} activity={activity} />
      ))}
      <Shelf />
      <Prints />
      <Triptych />
      <WallClock />
      <Lamp day={day} />
      <Clutter />
      <HeldLight />
    </group>
  );
}
