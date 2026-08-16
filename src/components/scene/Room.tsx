"use client";

import { RoundedBox, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { MathUtils, Vector3, type Mesh } from "three";

import { About } from "@/components/screens/About";
import { BoxBack } from "@/components/screens/BoxBack";
import { CommitFeed } from "@/components/screens/CommitFeed";
import { NowPlaying } from "@/components/screens/NowPlaying";
import type { Daylight } from "@/lib/daylight";
import {
  BOX,
  BOX_DESIGN,
  CAMERA,
  DESK,
  MONITOR,
  SCREENS,
  SCREEN_DESIGN,
  LAMP,
  SHELF,
  WALL,
  WINDOW,
  type ScreenId,
} from "@/lib/layout";
import { useScene, type BoxId } from "@/lib/store";

import * as M from "./materials";
import { Surface } from "./Surface";

/**
 * Rounded everywhere.
 *
 * Real edges are never perfectly sharp — they catch a thin highlight, and that
 * highlight is most of what makes an object read as manufactured rather than as
 * a primitive. It's the cheapest single upgrade from greybox to believable.
 */
const R = { radius: 0.004, smoothness: 3 } as const;

function Desk() {
  const midZ = DESK.frontZ - DESK.depth / 2;
  const legInset = 0.07;

  return (
    <group>
      <RoundedBox
        args={[DESK.width, DESK.thickness, DESK.depth]}
        radius={0.006}
        smoothness={3}
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
        <mesh
          key={i}
          position={[x, (DESK.surfaceY - DESK.thickness) / 2, z]}
          castShadow
        >
          <boxGeometry args={[0.045, DESK.surfaceY - DESK.thickness, 0.045]} />
          <meshStandardMaterial {...M.POWDER_COAT} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The window.
 *
 * Off to the left and mostly out of frame — it exists to be a light source with
 * a visible origin. A cool fill arriving from nowhere reads as a rendering
 * artefact; the same light with a bright rectangle behind it reads as a room.
 */
function Window({ day }: { day: Daylight }) {
  return (
    <group position={[WINDOW.x, WINDOW.y, WALL.z + 0.01]}>
      <mesh>
        <planeGeometry args={[WINDOW.w, WINDOW.h]} />
        <meshBasicMaterial color={day.windowColor} toneMapped={false} />
      </mesh>
      {/* Frame and a single glazing bar, so it reads as a window, not a hole. */}
      <mesh position={[0, 0, 0.004]}>
        <boxGeometry args={[WINDOW.w + 0.04, 0.022, 0.03]} />
        <meshStandardMaterial {...M.SOFT_PLASTIC} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <boxGeometry args={[0.022, WINDOW.h, 0.03]} />
        <meshStandardMaterial {...M.SOFT_PLASTIC} />
      </mesh>
    </group>
  );
}

function Walls({ day }: { day: Daylight }) {
  return (
    <group>
      <mesh position={[0, WALL.height / 2, WALL.z]} receiveShadow>
        <planeGeometry args={[WALL.width, WALL.height]} />
        <meshStandardMaterial {...M.PLASTER} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WALL.width, 6]} />
        <meshStandardMaterial {...M.FLOOR} />
      </mesh>
      <Window day={day} />
    </group>
  );
}

const SCREEN_CONTENT: Record<ScreenId, () => React.ReactElement> = {
  commits: CommitFeed,
  about: About,
  music: NowPlaying,
};

function Monitor({ placement }: { placement: (typeof SCREENS)[number] }) {
  const focusScreen = useScene((s) => s.focusScreen);
  const focus = useScene((s) => s.focus);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const focused = focus.kind === "screen" && focus.id === placement.id;
  const Content = SCREEN_CONTENT[placement.id];

  const outerW = MONITOR.panelW + MONITOR.bezel * 2;
  const outerH = MONITOR.panelH + MONITOR.bezel * 2;

  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]}>
      <RoundedBox
        args={[outerW, outerH, MONITOR.depth]}
        radius={0.003}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial {...M.SOFT_PLASTIC} />
      </RoundedBox>

      <mesh
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
        <planeGeometry args={[MONITOR.panelW, MONITOR.panelH]} />
        <meshStandardMaterial
          {...M.SCREEN_GLASS}
          emissiveIntensity={hovered ? 2.2 : 1}
        />
      </mesh>

      <Surface
        designW={SCREEN_DESIGN.w}
        designH={SCREEN_DESIGN.h}
        worldW={MONITOR.panelW}
        focused={focused}
        position={[0, 0, MONITOR.depth / 2 + 0.001]}
      >
        <Content />
      </Surface>

      {/* Neck and foot. Aluminium, so they catch the lamp and read as hardware. */}
      <mesh position={[0, -MONITOR.panelH / 2 - MONITOR.liftY / 2, -0.025]} castShadow>
        <boxGeometry args={[0.042, MONITOR.liftY + 0.02, 0.022]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>
      <RoundedBox
        args={[0.2, 0.012, 0.13]}
        radius={0.004}
        smoothness={3}
        position={[0, -MONITOR.panelH / 2 - MONITOR.liftY + 0.006, -0.025]}
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

function GameBox({ id, index }: { id: BoxId; index: number }) {
  const focusBox = useScene((s) => s.focusBox);
  const focus = useScene((s) => s.focus);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const ref = useRef<Mesh>(null);

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

  return (
    <mesh
      ref={ref}
      position={shelved}
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
      <boxGeometry args={[BOX.w, BOX.h, BOX.d]} />
      <meshStandardMaterial
        {...M.BOX_CARD}
        color={hovered && !held ? "#e0d3b6" : M.BOX_CARD.color}
      />

      {held && (
        <Surface
          designW={BOX_DESIGN.w}
          designH={BOX_DESIGN.h}
          // Inset from the lid. Printed exactly edge to edge the surface covers
          // the whole face and the thing reads as a floating card; leaving a
          // sliver of box visible is what makes it read as an object with depth.
          worldW={BOX.w * 0.94}
          focused
          position={[0, BOX.h / 2 + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <BoxBack id={id} />
        </Surface>
      )}
    </mesh>
  );
}

function Shelf() {
  return (
    <group>
      <RoundedBox
        args={[SHELF.width, SHELF.thickness, SHELF.depth]}
        radius={0.004}
        smoothness={3}
        position={[SHELF.x, SHELF.y, SHELF.z]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.SHELF_WOOD} />
      </RoundedBox>
      {/* Brackets, so the shelf isn't floating. */}
      {[-SHELF.width / 2 + 0.08, SHELF.width / 2 - 0.08].map((dx, i) => (
        <mesh
          key={i}
          position={[SHELF.x + dx, SHELF.y - 0.045, SHELF.z - SHELF.depth / 4]}
          castShadow
        >
          <boxGeometry args={[0.014, 0.08, 0.09]} />
          <meshStandardMaterial {...M.POWDER_COAT} />
        </mesh>
      ))}
      <GameBox id="catan" index={0} />
      <GameBox id="chess" index={1} />
    </group>
  );
}

function Poster() {
  return (
    <group>
      <mesh position={[0.78, 1.5, WALL.z + 0.004]} castShadow>
        <boxGeometry args={[0.44, 0.6, 0.008]} />
        <meshStandardMaterial {...M.PAPER} />
      </mesh>
      <mesh position={[1.2, 1.28, WALL.z + 0.004]} castShadow>
        <boxGeometry args={[0.27, 0.36, 0.008]} />
        <meshStandardMaterial {...M.PAPER} color="#c4b9a6" />
      </mesh>
    </group>
  );
}

/**
 * The desk lamp.
 *
 * The key light has been coming from this position since the greybox; giving it
 * a physical source is what stops it reading as an arbitrary glow. A visible
 * emissive shade also anchors the brightest part of the frame to an object.
 */
function Lamp({ day }: { day: Daylight }) {
  /*
   * Far right and tall enough to clear the monitor array.
   *
   * Sitting where a lamp naturally would — beside the right-hand monitor —
   * hides it entirely behind that monitor from the resting camera, and a key
   * light whose source you can't see is exactly the thing having a lamp at all
   * was meant to fix. The arm reaches back in over the desk so the light still
   * falls where it did.
   */
  const armLength = 0.3;
  const poleHeight = 0.62;

  return (
    <group position={[LAMP.x, DESK.surfaceY, LAMP.z]}>
      <mesh position={[0, 0.009, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.078, 0.088, 0.018, 28]} />
        <meshStandardMaterial {...M.POWDER_COAT} />
      </mesh>

      <mesh position={[0, poleHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, poleHeight, 12]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/* Arm, reaching back toward the middle of the desk. */}
      <mesh
        position={[-armLength / 2, poleHeight, -0.02]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.008, 0.008, armLength, 12]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/*
        Shade, open end down.

        Deliberately not casting a shadow: it surrounds the light source, so a
        double-sided cone 3cm from a point light shadow-maps onto itself and
        sprays acne across the wall behind it. Nothing is between it and
        anything else anyway.
      */}
      <mesh position={[-armLength, poleHeight - 0.05, -0.02]}>
        <coneGeometry args={[0.082, 0.1, 28, 1, true]} />
        <meshStandardMaterial {...M.POWDER_COAT} side={2} />
      </mesh>

      {/* The bulb: emissive so bloom picks it up as a real highlight. */}
      <mesh position={[-armLength, poleHeight - 0.085, -0.02]}>
        <sphereGeometry args={[0.026, 16, 16]} />
        <meshBasicMaterial
          color="#ffce8f"
          toneMapped={false}
          transparent
          opacity={Math.min(1, day.lampIntensity / 2.6)}
        />
      </mesh>
    </group>
  );
}

function Clutter() {
  const top = DESK.surfaceY;
  return (
    <group>
      {/* Desk mat, under the keyboard and mouse — grounds them both. */}
      <mesh position={[0.02, top + 0.0015, 0.12]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[0.72, 0.3]} />
        <meshStandardMaterial {...M.FABRIC} />
      </mesh>

      <RoundedBox
        args={[0.36, 0.019, 0.125]}
        {...R}
        position={[-0.03, top + 0.011, 0.13]}
        castShadow
      >
        <meshStandardMaterial {...M.SOFT_PLASTIC} />
      </RoundedBox>

      <RoundedBox
        args={[0.058, 0.028, 0.1]}
        radius={0.012}
        smoothness={4}
        position={[0.26, top + 0.015, 0.13]}
        castShadow
      >
        <meshStandardMaterial {...M.SOFT_PLASTIC} />
      </RoundedBox>

      {/* Mug — the near foreground element that gives the frame depth. */}
      <group position={[-0.46, top, 0.17]}>
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.041, 0.036, 0.1, 28]} />
          <meshStandardMaterial {...M.CERAMIC} />
        </mesh>
        <mesh position={[0.05, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.022, 0.006, 12, 24, Math.PI]} />
          <meshStandardMaterial {...M.CERAMIC} />
        </mesh>
      </group>
    </group>
  );
}

export function Room({ day }: { day: Daylight }) {
  const clearFocus = useScene((s) => s.clearFocus);

  return (
    <group>
      {/* Clicking anything that isn't a target leans back out. */}
      <mesh position={[0, 1.2, WALL.z - 0.02]} onClick={clearFocus} visible={false}>
        <planeGeometry args={[WALL.width * 2, WALL.height * 2]} />
      </mesh>

      <Walls day={day} />
      <Desk />
      {SCREENS.map((s) => (
        <Monitor key={s.id} placement={s} />
      ))}
      <Shelf />
      <Poster />
      <Lamp day={day} />
      <Clutter />
      <HeldLight />
    </group>
  );
}
