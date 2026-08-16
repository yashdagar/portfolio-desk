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
 * A wall clock, on Gurugram time.
 *
 * Two jobs. It fills what was the emptiest square metre in the frame — a bare
 * stretch of plaster between the shelf and the window that nothing was doing
 * anything with — and it moves. Until now the only thing in the room that
 * changed was the light, on a scale of hours; a second hand is the one element
 * a visitor can watch and know the scene is live rather than a render.
 *
 * It also states the conceit without the HUD having to. The clock in the corner
 * of the page is chrome and reads as a caption; a clock on the wall reads as
 * *his* clock, which is the whole point of putting the room on his time.
 *
 * Deliberately minimal: no numerals, four tick marks, two hands, one accent
 * sweep. A clock face is an enormous amount of information for something 26 cm
 * across seen at two metres, and the version with numbers is unreadable at that
 * size while looking busy — so it gets the version that reads as a silhouette.
 */
export function WallClock() {
  const hour = useRef<Group>(null);
  const minute = useRef<Group>(null);
  const second = useRef<Group>(null);

  useFrame(() => {
    // Read the shared scene clock, not the wall clock of whoever's looking, so
    // `?t=` moves the hands along with the light. A room lit for midnight with
    // a clock reading 3pm is worse than having no clock at all.
    const h = istHours(sceneNow());

    /*
     * Clockwise is negative about Z.
     *
     * Each hand's group sits at the centre with its geometry pointing at +Y, so
     * a rotation of zero is twelve o'clock and the sign is the only thing that
     * decides whether time runs forwards.
     */
    if (hour.current) hour.current.rotation.z = -((h % 12) / 12) * Math.PI * 2;
    if (minute.current) minute.current.rotation.z = -((h % 1) * Math.PI * 2);
    if (second.current) {
      // Quartz movements step. A smoothly sweeping second hand is a mechanical
      // movement, and a mechanical wall clock is a different — and much more
      // expensive-looking — object than the one this is meant to be.
      const s = Math.floor(h * 3600) % 60;
      second.current.rotation.z = -(s / 60) * Math.PI * 2;
    }
  });

  const r = CLOCK.radius;

  return (
    <group position={[CLOCK.x, CLOCK.y, WALL.z + 0.005]}>
      {/* Case, seen edge-on as a thin dark ring around the face. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, 0.032, 48]} />
        <meshStandardMaterial {...M.CLOCK_CASE} />
      </mesh>

      {/* Face. */}
      <mesh position={[0, 0, 0.0165]}>
        <circleGeometry args={[r - 0.006, 48]} />
        <meshStandardMaterial {...M.CLOCK_FACE} />
      </mesh>

      {/* Four ticks. Twelve is fussy at this size; four is a compass. */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <mesh position={[0, r - 0.026, 0.018]}>
            <boxGeometry args={[0.0055, 0.026, 0.001]} />
            <meshStandardMaterial {...M.CLOCK_MARK} />
          </mesh>
        </group>
      ))}

      <group ref={hour} position={[0, 0, 0.019]}>
        <RoundedBox
          args={[0.011, r * 0.56, 0.004]}
          radius={0.0018}
          smoothness={4}
          position={[0, r * 0.22, 0]}
        >
          <meshStandardMaterial {...M.CLOCK_MARK} />
        </RoundedBox>
      </group>

      <group ref={minute} position={[0, 0, 0.0205]}>
        <RoundedBox
          args={[0.0075, r * 0.84, 0.004]}
          radius={0.0015}
          smoothness={4}
          position={[0, r * 0.34, 0]}
        >
          <meshStandardMaterial {...M.CLOCK_MARK} />
        </RoundedBox>
      </group>

      {/*
        The second hand is the only accent-coloured object anywhere in the room
        that isn't a screen. It gets to be, because it's the one thing moving.
      */}
      <group ref={second} position={[0, 0, 0.022]}>
        <mesh position={[0, r * 0.34, 0]}>
          <boxGeometry args={[0.0028, r * 0.92, 0.003]} />
          <meshStandardMaterial
            color={M.ACCENT_HEX}
            roughness={0.4}
            metalness={0}
          />
        </mesh>
        {/* Counterweight, so it pivots rather than pointing. */}
        <mesh position={[0, -r * 0.14, 0]}>
          <boxGeometry args={[0.0028, r * 0.2, 0.003]} />
          <meshStandardMaterial
            color={M.ACCENT_HEX}
            roughness={0.4}
            metalness={0}
          />
        </mesh>
      </group>

      {/* Centre cap, hiding where three hands meet. */}
      <mesh position={[0, 0, 0.0235]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0075, 0.0075, 0.004, 20]} />
        <meshStandardMaterial {...M.CLOCK_MARK} />
      </mesh>
    </group>
  );
}
