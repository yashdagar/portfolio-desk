"use client";

import { useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { MathUtils, Vector3, type Mesh } from "three";

import { BOX, CAMERA, DESK, MONITOR, SCREENS, SHELF, WALL } from "@/lib/layout";
import { useScene, type BoxId } from "@/lib/store";

/*
 * Greybox.
 *
 * Deliberately untextured and single-material: the point of this pass is to get
 * proportions, camera framing and the focus transition right while nothing can
 * hide behind a nice material. Anything that looks wrong here will look wrong
 * later too, just more expensively.
 */

const GREY = "#6b6b6b";
const GREY_DARK = "#3a3a3a";
const GREY_LIGHT = "#8a8a8a";

function Desk() {
  return (
    <group>
      {/* Surface */}
      <mesh
        position={[0, DESK.surfaceY - DESK.thickness / 2, DESK.frontZ - DESK.depth / 2]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[DESK.width, DESK.thickness, DESK.depth]} />
        <meshStandardMaterial color={GREY} roughness={0.7} />
      </mesh>

      {/* Legs, inset from the corners the way a real desk's are. */}
      {[
        [-DESK.width / 2 + 0.06, DESK.frontZ - 0.06],
        [DESK.width / 2 - 0.06, DESK.frontZ - 0.06],
        [-DESK.width / 2 + 0.06, DESK.frontZ - DESK.depth + 0.06],
        [DESK.width / 2 - 0.06, DESK.frontZ - DESK.depth + 0.06],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, (DESK.surfaceY - DESK.thickness) / 2, z]} castShadow>
          <boxGeometry args={[0.05, DESK.surfaceY - DESK.thickness, 0.05]} />
          <meshStandardMaterial color={GREY_DARK} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Walls() {
  return (
    <group>
      <mesh position={[0, WALL.height / 2, WALL.z]} receiveShadow>
        <planeGeometry args={[WALL.width, WALL.height]} />
        <meshStandardMaterial color={GREY_LIGHT} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WALL.width, 4]} />
        <meshStandardMaterial color={GREY_DARK} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Monitor({
  placement,
}: {
  placement: (typeof SCREENS)[number];
}) {
  const focusScreen = useScene((s) => s.focusScreen);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const outerW = MONITOR.panelW + MONITOR.bezel * 2;
  const outerH = MONITOR.panelH + MONITOR.bezel * 2;

  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]}>
      {/* Chassis */}
      <mesh castShadow>
        <boxGeometry args={[outerW, outerH, MONITOR.depth]} />
        <meshStandardMaterial color={GREY_DARK} roughness={0.5} />
      </mesh>

      {/*
        The screen plane. Emissive in the greybox so it reads as "on" and so
        the three surfaces are legible as distinct targets — this is where the
        real DOM gets mounted in the next pass.
      */}
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
          color={hovered ? "#1d2b30" : "#141b1e"}
          emissive={hovered ? "#2b4d55" : "#1d3339"}
          emissiveIntensity={1}
          roughness={0.35}
        />
      </mesh>

      {/* Stand: a neck down to the desk and a foot. */}
      <mesh position={[0, -MONITOR.panelH / 2 - MONITOR.liftY / 2, -0.02]} castShadow>
        <boxGeometry args={[0.05, MONITOR.liftY, 0.03]} />
        <meshStandardMaterial color={GREY_DARK} roughness={0.5} />
      </mesh>
      <mesh position={[0, -MONITOR.panelH / 2 - MONITOR.liftY + 0.008, -0.02]} castShadow>
        <boxGeometry args={[0.22, 0.016, 0.14]} />
        <meshStandardMaterial color={GREY_DARK} roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Where a focused box sits: held up in front of the resting camera, tilted back
 * so the lid faces the viewer.
 *
 * Derived from the camera's rest pose rather than hard-coded, so moving the eye
 * doesn't silently leave the box floating off to one side.
 */
const HELD = (() => {
  const eye = new Vector3(...CAMERA.eye);
  const dir = new Vector3(...CAMERA.target).sub(eye).normalize();
  return eye.clone().addScaledVector(dir, 0.74);
})();

/**
 * Fill light for a held box.
 *
 * Every light in the room is behind or above the shelf, so a box turned to face
 * the viewer presents its one unlit side — it renders as a black rectangle.
 * This sits just off the viewer's shoulder and only exists while something is
 * held, which is also how it reads: light falling on an object you've picked up.
 */
function HeldLight() {
  const focus = useScene((s) => s.focus);
  const on = focus.kind === "box";
  const eye = useMemo(() => new Vector3(...CAMERA.eye), []);

  return (
    <pointLight
      position={[eye.x - 0.25, eye.y + 0.2, eye.z - 0.1]}
      intensity={on ? 1.6 : 0}
      distance={2}
      decay={2}
      color="#ffe6c9"
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

  // Stacked flat, the way board games actually sit on a shelf.
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
    // the viewer, which is a quarter turn about X. The extra tilt keeps it from
    // reading as a flat rectangle pasted onto the frame.
    const targetX = held ? -Math.PI / 2 + 0.14 : 0;
    const targetY = held ? 0 : 0;
    mesh.rotation.x = MathUtils.lerp(mesh.rotation.x, targetX, k);
    mesh.rotation.y = MathUtils.lerp(mesh.rotation.y, targetY, k);
  });

  return (
    <mesh
      ref={ref}
      position={shelved}
      castShadow
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
        color={hovered ? "#9a8f7a" : "#7d7466"}
        roughness={0.8}
      />
    </mesh>
  );
}

function Shelf() {
  return (
    <group>
      <mesh position={[SHELF.x, SHELF.y, SHELF.z]} castShadow receiveShadow>
        <boxGeometry args={[SHELF.width, SHELF.thickness, SHELF.depth]} />
        <meshStandardMaterial color={GREY} roughness={0.75} />
      </mesh>
      <GameBox id="catan" index={0} />
      <GameBox id="chess" index={1} />
    </group>
  );
}

/**
 * Wall art.
 *
 * Not decoration for its own sake — the wall above the monitors is otherwise a
 * large empty gradient, and an empty upper third makes the whole frame read as
 * bottom-heavy. A poster on the opposite side from the shelf also balances the
 * asymmetry the shelf introduces.
 */
function Poster() {
  return (
    <group>
      <mesh position={[0.72, 1.46, WALL.z + 0.004]}>
        <planeGeometry args={[0.42, 0.58]} />
        <meshStandardMaterial color="#8f8577" roughness={0.95} />
      </mesh>
      {/* A second, smaller one, hung off-axis so it doesn't read as a grid. */}
      <mesh position={[1.14, 1.28, WALL.z + 0.004]}>
        <planeGeometry args={[0.26, 0.34]} />
        <meshStandardMaterial color="#7a7268" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Placeholder desk clutter — establishes foreground occlusion and scale. */
function Clutter() {
  const top = DESK.surfaceY;
  return (
    <group>
      {/* Keyboard */}
      <mesh position={[0, top + 0.011, 0.13]} castShadow>
        <boxGeometry args={[0.36, 0.022, 0.13]} />
        <meshStandardMaterial color={GREY_DARK} roughness={0.6} />
      </mesh>
      {/* Mouse */}
      <mesh position={[0.29, top + 0.016, 0.13]} castShadow>
        <boxGeometry args={[0.06, 0.032, 0.1]} />
        <meshStandardMaterial color={GREY_DARK} roughness={0.5} />
      </mesh>
      {/* Mug — the near foreground element that gives the frame depth. */}
      <mesh position={[-0.42, top + 0.05, 0.16]} castShadow>
        <cylinderGeometry args={[0.042, 0.038, 0.1, 24]} />
        <meshStandardMaterial color={GREY_LIGHT} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function Room() {
  const clearFocus = useScene((s) => s.clearFocus);

  return (
    <group>
      {/* Clicking anything that isn't a target leans back out. */}
      <mesh position={[0, 1.2, WALL.z - 0.01]} onClick={clearFocus} visible={false}>
        <planeGeometry args={[WALL.width * 2, WALL.height * 2]} />
      </mesh>

      <Walls />
      <Desk />
      {SCREENS.map((s) => (
        <Monitor key={s.id} placement={s} />
      ))}
      <Shelf />
      <Poster />
      <Clutter />
      <HeldLight />
    </group>
  );
}
