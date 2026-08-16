"use client";

import { RoundedBox } from "@react-three/drei";

import { HEADPHONES as H } from "@/lib/layout";

import * as M from "./materials";

/** Half the gap between the two cups, i.e. the headband's radius. */
const SPAN = 0.036;

/**
 * Over-ear headphones, hung on the corner of a monitor.
 *
 * Draped rather than placed. Sitting on top of a monitor they'd read as a
 * product shot; hooked over the outer top corner with the cups hanging either
 * side of the panel is where they actually end up, and the asymmetry it puts
 * into the right-hand third of the frame is worth more than the object itself.
 *
 * The shape language is deliberate: anodised aluminium cups with a rounded
 * rectangle profile rather than the usual circle, a slim frame, and a fabric
 * canopy slung under it. That silhouette is recognisable from across the room,
 * which is the only place most people will see it from.
 */
export function Headphones() {
  return (
    <group position={[H.x, H.y, H.z]}>
      {/*
        Frame. A half torus turned into the ZY plane, so it arches front to back
        over the top edge of the panel, and squashed along X into a flat band —
        a circular tube would read as wire.
      */}
      <mesh rotation={[0, Math.PI / 2, 0]} scale={[2.1, 1, 1]} castShadow>
        <torusGeometry args={[SPAN, 0.0055, 12, 40, Math.PI]} />
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/* The canopy: fabric mesh slung under the frame, taking the weight. */}
      <mesh rotation={[0, Math.PI / 2, 0]} scale={[5.2, 1, 1]}>
        <torusGeometry args={[SPAN - 0.007, 0.0028, 10, 36, Math.PI]} />
        <meshStandardMaterial {...M.MESH_FABRIC} />
      </mesh>

      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * SPAN]}>
          {/* Telescoping arm, from the end of the frame down to the cup. */}
          <RoundedBox
            args={[0.011, 0.036, 0.007]}
            radius={0.003}
            smoothness={3}
            position={[0, -0.016, 0]}
            castShadow
          >
            <meshStandardMaterial {...M.ALUMINIUM} />
          </RoundedBox>

          {/* The cup itself. */}
          <RoundedBox
            args={[H.cupW, H.cupH, H.cupD]}
            radius={0.015}
            smoothness={5}
            position={[0, -0.032 - H.cupH / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.EARCUP} />
          </RoundedBox>

          {/*
            Ear cushion, on the face turned toward the panel. Memory foam under
            a knit — the softest material anywhere in the room, and it needs to
            read that way against the anodising it's attached to.
          */}
          <RoundedBox
            args={[H.cupW - 0.008, H.cupH - 0.008, 0.014]}
            radius={0.006}
            smoothness={4}
            position={[0, -0.032 - H.cupH / 2, -s * (H.cupD / 2 + 0.004)]}
          >
            <meshStandardMaterial {...M.CUSHION} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}
