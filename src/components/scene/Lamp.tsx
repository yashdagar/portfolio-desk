"use client";

import { RoundedBox } from "@react-three/drei";
import { useEffect, useState } from "react";

import type { Daylight } from "@/lib/daylight";
import { DESK, LAMP } from "@/lib/layout";
import { useLampLevel, useScene } from "@/lib/store";

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
  const level = useLampLevel();
  const cycleLamp = useScene((s) => s.cycleLamp);
  const [hovered, setHovered] = useState(false);

  /**
   * How bright the strip reads, independent of how much light it throws.
   *
   * It has to follow the dimmer as well as the time of day, and it is the only
   * feedback the interaction has. Clicking the lamp changes a spotlight the
   * visitor cannot see the source of — if the strip didn't dim with it, turning
   * the lamp off would look like the room breaking rather than like a switch.
   */
  const glow = Math.min(1, (day.lampIntensity * level) / 2.4);

  /*
   * The cursor.
   *
   * The room has no affordances — nothing here is underlined or outlined, which
   * is the point — so the pointer is the whole of the invitation. Set on the
   * body rather than on the canvas because the canvas is the full viewport and
   * a style left on it survives the component; the cleanup here runs on unmount
   * as well as on pointer-out, so a lamp that disappears while hovered doesn't
   * leave the page stuck in a pointer.
   */
  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

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
    /*
      The whole lamp is the switch.

      Not just the dial, even though the dial is modelled and is the obvious
      target. It's 8 mm across on an object a metre and a half from the camera —
      about four pixels — so making it the only hit area would be a control
      nobody could find and half the people who found it couldn't hit. The dial
      is the *affordance*; the group is the button. Clicking any part of a desk
      lamp to turn it on is also, separately, how touch lamps work.
    */
    <group
      position={[LAMP.x, DESK.surfaceY + 0.0005, LAMP.z]}
      onClick={(e) => {
        e.stopPropagation();
        cycleLamp();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
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

      {/*
        A single control, because there is exactly one on the real thing — and
        now it does something.

        It lights up on hover, which is the only signal in the room that an
        object is interactive. A ring of light under a fingertip is also what
        the control on a dimmable lamp actually does, so the hint costs nothing
        in realism: at rest it's a machined disc, and under the pointer it's a
        dimmer someone is about to turn.
      */}
      <mesh position={[0, 0.023, 0.055]}>
        <cylinderGeometry args={[0.008, 0.008, 0.002, 16]} />
        <meshStandardMaterial
          {...M.ALUMINIUM}
          emissive="#ffd9a3"
          emissiveIntensity={hovered ? 1.6 : glow * 0.35}
        />
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
