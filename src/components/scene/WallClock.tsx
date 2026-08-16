"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { sceneNow } from "@/lib/clock";
import { istHours } from "@/lib/daylight";
import { CLOCK, WALL } from "@/lib/layout";

import * as M from "./materials";

/**
 * A wall clock on Gurugram time, and the one thing in the room a visitor can
 * watch to know the scene is live rather than a render.
 *
 * Deliberately bare: at 26 cm seen from two metres, numerals are unreadable and
 * look busy at the same time, so this reads as a silhouette instead.
 */
export function WallClock() {
  const hour = useRef<Group>(null);
  const minute = useRef<Group>(null);
  const second = useRef<Group>(null);

  useFrame(() => {
    // The scene clock, not the viewer's, so `?t=` moves the hands with the light.
    const h = istHours(sceneNow());

    // Clockwise is negative about Z. Each hand points at +Y at rotation zero.
    if (hour.current) hour.current.rotation.z = -((h % 12) / 12) * Math.PI * 2;
    if (minute.current) minute.current.rotation.z = -((h % 1) * Math.PI * 2);
    if (second.current) {
      // Quartz steps; a smooth sweep is a mechanical movement, which is a
      // different and much more expensive-looking object.
      const s = Math.floor(h * 3600) % 60;
      second.current.rotation.z = -(s / 60) * Math.PI * 2;
    }
  });

  const r = CLOCK.radius;
  /** Width of the black rim, as seen face on. */
  const rim = 0.013;
  const faceR = r - rim;

  return (
    <group position={[CLOCK.x, CLOCK.y, WALL.z + 0.005]}>
      {/* A dial with four ticks looks like one that couldn't afford twelve. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, 0.046, 64]} />
        <meshStandardMaterial {...M.CLOCK_CASE} />
      </mesh>

      {/* In *front* of the case, whose front face lands at z = 0.023. */}
      <mesh position={[0, 0, 0.0235]}>
        <circleGeometry args={[faceR, 64]} />
        <meshStandardMaterial {...M.CLOCK_FACE} />
      </mesh>

      {/* A lip that catches light on top and drops a crescent of shadow across
          the face. A ring, so the dial can stay in front where it's visible. */}
      <mesh position={[0, 0, 0.0295]}>
        <ringGeometry args={[faceR - 0.001, r, 64]} />
        <meshStandardMaterial {...M.CLOCK_CASE} />
      </mesh>

      <group ref={hour} position={[0, 0, 0.0252]}>
        <RoundedBox
          args={[0.0062, faceR * 0.62, 0.0025]}
          radius={0.001}
          smoothness={4}
          position={[0, faceR * 0.24, 0]}
        >
          <meshStandardMaterial {...M.CLOCK_MARK} />
        </RoundedBox>
      </group>

      <group ref={minute} position={[0, 0, 0.0266]}>
        <RoundedBox
          args={[0.005, faceR * 0.94, 0.0025]}
          radius={0.0009}
          smoothness={4}
          position={[0, faceR * 0.4, 0]}
        >
          <meshStandardMaterial {...M.CLOCK_MARK} />
        </RoundedBox>
      </group>

      <group ref={second} position={[0, 0, 0.0278]}>
        <mesh position={[0, faceR * 0.42, 0]}>
          <boxGeometry args={[0.0018, faceR * 1.06, 0.002]} />
          <meshStandardMaterial {...M.CLOCK_MARK} />
        </mesh>
        <mesh position={[0, -faceR * 0.15, 0]}>
          <boxGeometry args={[0.0018, faceR * 0.22, 0.002]} />
          <meshStandardMaterial {...M.CLOCK_MARK} />
        </mesh>
      </group>

      <mesh position={[0, 0, 0.0292]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.004, 24]} />
        <meshStandardMaterial {...M.CLOCK_MARK} />
      </mesh>
    </group>
  );
}
