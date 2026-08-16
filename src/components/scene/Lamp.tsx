"use client";

import { RoundedBox } from "@react-three/drei";

import type { Daylight } from "@/lib/daylight";
import { DESK, LAMP } from "@/lib/layout";

import * as M from "./materials";

/**
 * The desk lamp, in the Dyson idiom.
 *
 * The shape is the argument: a weighted cylindrical base, one slim vertical
 * stem, a horizontal arm cantilevered off it, and a long thin bar of light at
 * the end. There is no shade, because there's no bulb — the emitter is a strip
 * on the underside of the bar, which is why the whole thing can be that thin.
 *
 * It also solves a problem the old cone lamp had. A cone shade surrounds its
 * own light source, so a double-sided cone three centimetres from a point light
 * shadow-maps onto itself and sprays acne across the wall. A downward-facing
 * strip has nothing between it and the desk.
 */
export function Lamp({ day }: { day: Daylight }) {
  const stemTop = LAMP.poleHeight;
  /** How bright the strip reads, independent of how much light it throws. */
  const glow = Math.min(1, day.lampIntensity / 2.4);

  return (
    /*
      Half a millimetre clear of the desk, not sitting exactly on it.

      The base's underside used to land at precisely DESK.surfaceY, which is
      also where the desk's top face is — two coplanar surfaces, and the
      depth buffer has no way to choose between them. The result was a disc of
      desk grain punching through the lamp's foot and flickering as the camera
      drifted, which reads as the lamp sinking into the desk. Every object that
      stands on this desk needs the same clearance.
    */
    <group position={[LAMP.x, DESK.surfaceY + 0.0005, LAMP.z]}>
      {/*
        Base. Wide and low — it has to counterweight a 40cm cantilever, and it
        looks like it does.
      */}
      <mesh position={[0, 0.008, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.088, 0.094, 0.016, 40]} />
        <meshStandardMaterial {...M.LAMP_BODY} />
      </mesh>
      <mesh position={[0, 0.018, 0]}>
        <cylinderGeometry args={[0.05, 0.072, 0.008, 40]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/* A single control, because there is exactly one on the real thing. */}
      <mesh position={[0, 0.023, 0.055]}>
        <cylinderGeometry args={[0.008, 0.008, 0.002, 16]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/*
        Stem. A slim rounded rectangle rather than a tube: the flat faces are
        what give it a hard vertical highlight down one side instead of the soft
        gradient a cylinder gets, and that highlight is the whole look.
      */}
      <RoundedBox
        args={[0.028, stemTop, 0.028]}
        radius={0.009}
        smoothness={4}
        position={[0, stemTop / 2 + 0.02, 0]}
        castShadow
      >
        <meshStandardMaterial {...M.LAMP_BODY} />
      </RoundedBox>

      {/* The collar the arm slides on. */}
      <RoundedBox
        args={[0.042, 0.058, 0.042]}
        radius={0.012}
        smoothness={4}
        position={[0, stemTop - 0.012, 0]}
        castShadow
      >
        <meshStandardMaterial {...M.ALUMINIUM} />
      </RoundedBox>

      {/* Arm, cantilevered out over the desk. */}
      <RoundedBox
        args={[LAMP.reach, 0.024, 0.024]}
        radius={0.009}
        smoothness={4}
        position={[LAMP.reach / 2, stemTop - 0.012, 0]}
        castShadow
      >
        <meshStandardMaterial {...M.LAMP_BODY} />
      </RoundedBox>

      {/* The knuckle: a short drop joining the arm to the head. Without it the
          bar reads as a second object floating below the lamp. */}
      <mesh position={[LAMP.reach, stemTop - 0.021, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, 0.022, 16]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/*
        The head: a long, thin bar, hung under the end of the arm.

        Deliberately off level. The head is the one part of this lamp that
        articulates, so a perfectly horizontal one says nobody has ever touched
        it — and a task light that has never been adjusted is not a task light,
        it's a prop. A few degrees of droop at the far end and a slight turn
        toward the desk is what someone reaching over to aim it actually leaves
        behind.
      */}
      <group
        position={[LAMP.reach, stemTop - 0.03, 0]}
        rotation={[0, 0.07, -0.1]}
      >
        <RoundedBox
          args={[LAMP.barLength, 0.019, 0.03]}
          radius={0.008}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial {...M.LAMP_BODY} />
        </RoundedBox>

        {/*
          The emitter strip, on the underside and inset from both ends.

          Basic and untonemapped so bloom treats it as a real source: this is the
          only thing in the frame that is genuinely emitting, and it should look
          like it. Its opacity tracks the lamp's intensity, so at noon the strip
          is barely lit and at midnight it's the brightest object in the room.
        */}
        <mesh position={[0, -0.0102, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[LAMP.barLength - 0.03, 0.016]} />
          <meshBasicMaterial
            color="#ffd9a3"
            toneMapped={false}
            transparent
            opacity={0.25 + glow * 0.75}
          />
        </mesh>

        {/* End caps, so the bar reads as machined rather than extruded. */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[(s * LAMP.barLength) / 2, 0, 0]}
            // A cylinder's axis is +Y; the bar runs along X, so the caps have
            // to be laid on their side to face out of its ends.
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.0092, 0.0092, 0.004, 16]} />
            <meshStandardMaterial {...M.ALUMINIUM} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
