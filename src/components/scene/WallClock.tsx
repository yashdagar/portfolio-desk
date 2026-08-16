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
  /** Width of the black rim, as seen face on. */
  const rim = 0.013;
  const faceR = r - rim;

  return (
    <group position={[CLOCK.x, CLOCK.y, WALL.z + 0.005]}>
      {/*
        A deep matte black case, and nothing on the dial at all.

        No numerals and no tick marks — not even the four compass marks this had
        before. A dial with four ticks looks like a dial that couldn't afford
        twelve; a dial with none is a decision, and it's the whole reason this
        style of clock reads as expensive. The only things on it are three hands
        and the shadow they throw.
      */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, 0.046, 64]} />
        <meshStandardMaterial {...M.CLOCK_CASE} />
      </mesh>

      {/*
        The dial, in *front* of the case.
        
        It used to sit at z = 0.016 while the case was a solid 46 mm cylinder
        whose front face lands at 0.023 — so the white dial was seven
        millimetres behind an opaque black disc and never rendered at all. From
        the seat the clock was a black circle on a dark wall, which looked
        deliberate enough that it took a screenshot to notice.
      */}
      <mesh position={[0, 0, 0.0235]}>
        <circleGeometry args={[faceR, 64]} />
        <meshStandardMaterial {...M.CLOCK_FACE} />
      </mesh>

      {/*
        The rim, standing proud of the dial as a separate ring.
        
        This is what the recess was for: a lip that catches light on top and
        drops a crescent of shadow across the face. A ring rather than a deeper
        case, so the dial can stay in front where it's visible.
      */}
      <mesh position={[0, 0, 0.0295]}>
        <ringGeometry args={[faceR - 0.001, r, 64]} />
        <meshStandardMaterial {...M.CLOCK_CASE} />
      </mesh>

      {/* Hands. Thin, black, and tapered to nothing — needles, not batons. */}
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

      {/*
        The second hand used to be the room's accent teal — the only saturated
        object here that wasn't a screen. It's black now, because on a dial this
        bare a single coloured needle is the entire design and it turns a quiet
        object into a loud one. It's still the one thing in the room that moves,
        which was always the point; it just doesn't have to shout about it.
      */}
      <group ref={second} position={[0, 0, 0.0278]}>
        <mesh position={[0, faceR * 0.42, 0]}>
          <boxGeometry args={[0.0018, faceR * 1.06, 0.002]} />
          <meshStandardMaterial {...M.CLOCK_MARK} />
        </mesh>
        {/* Counterweight, so it pivots rather than merely points. */}
        <mesh position={[0, -faceR * 0.15, 0]}>
          <boxGeometry args={[0.0018, faceR * 0.22, 0.002]} />
          <meshStandardMaterial {...M.CLOCK_MARK} />
        </mesh>
      </group>

      {/* Centre cap, hiding where three hands meet. */}
      <mesh position={[0, 0, 0.0292]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.004, 24]} />
        <meshStandardMaterial {...M.CLOCK_MARK} />
      </mesh>
    </group>
  );
}
