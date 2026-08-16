"use client";

import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

import { HEADPHONES as H } from "@/lib/layout";

import { roundedPillow } from "./geometry";
import * as M from "./materials";

/**
 * The band is a swept tube, not a scaled torus. three composes a mesh's matrix
 * as scale-rotation-translation, so a mesh scale happens in the geometry's own
 * axes before any rotation reaches it — and on a torus stood up by a quarter
 * turn, the local X meant to widen the strap is the axis the arch spans. It
 * stretched the arch instead.
 *
 * Sweeping along an explicit curve in ZY and scaling the *geometry* sidesteps
 * it: X can only ever fatten the cross-section.
 */

/** Half the gap between the cups, i.e. the arch's radius. */
const SPAN = 0.042;

function bandGeometry(radius: number, tube: number, width: number) {
  // Sampled rather than parametric so the ends can be pinched: a real band
  // narrows where it meets the arms.
  const points: Vector3[] = [];
  const STEPS = 24;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const a = Math.PI * t;
    const pinch = 1 - Math.sin(a) * 0.06;
    points.push(new Vector3(0, Math.sin(a) * radius, -Math.cos(a) * radius * pinch));
  }

  const geo = new TubeGeometry(new CatmullRomCurve3(points), 40, tube, 10, false);
  // Safe: the curve has no X extent at all, so this only fattens the strap.
  geo.scale(width / tube / 2, 1, 1);
  return geo;
}

export function Headphones() {
  const frame = useMemo(() => bandGeometry(SPAN, 0.0055, 0.026), []);
  const canopy = useMemo(() => bandGeometry(SPAN - 0.008, 0.0035, 0.034), []);

  // Pillows, not rounded boxes: a rounded box caps its radius at half the
  // smallest dimension, so a 38 mm-deep cup can only round its 90 mm face by
  // 19 mm and reads as a box with its edges knocked off.
  const cup = useMemo(
    () => roundedPillow(H.cupW, H.cupH, H.cupD, H.cupR, 0.009),
    [],
  );
  const cushion = useMemo(
    () =>
      roundedPillow(H.cupW - 0.008, H.cupH - 0.008, 0.016, H.cupR - 0.004, 0.006),
    [],
  );

  useEffect(() => {
    return () => {
      frame.dispose();
      canopy.dispose();
      cup.dispose();
      cushion.dispose();
    };
  }, [frame, canopy, cup, cushion]);

  return (
    <group>
      {/* The frame: a flat aluminium strap arching over the panel's top edge. */}
      <mesh geometry={frame} castShadow>
        <meshStandardMaterial {...M.ALUMINIUM} />
      </mesh>

      {/* The canopy: knit mesh slung underneath, taking the weight. */}
      <mesh geometry={canopy}>
        <meshStandardMaterial {...M.MESH_FABRIC} />
      </mesh>

      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * SPAN]}>
          {/*
            Yoke: a short fork bridging the end of the band to the top of the
            cup. Without it the band ends in mid-air a centimetre above the cup,
            which is exactly what made the old one read as a handle.
          */}
          <RoundedBox
            args={[0.02, 0.03, 0.008]}
            radius={0.0035}
            smoothness={4}
            position={[0, -0.014, 0]}
            castShadow
          >
            <meshStandardMaterial {...M.ALUMINIUM} />
          </RoundedBox>

          {/* Telescoping arm, sliding down into the cup. */}
          <RoundedBox
            args={[0.013, 0.026, 0.0075]}
            radius={0.003}
            smoothness={4}
            position={[0, -0.033, 0]}
            castShadow
          >
            <meshStandardMaterial {...M.EARCUP} />
          </RoundedBox>

          {/* The cup itself. */}
          <mesh
            geometry={cup}
            position={[0, -0.044 - H.cupH / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.EARCUP} />
          </mesh>

          {/*
            Ear cushion, on the face turned toward the panel. Memory foam under
            a knit — the softest material anywhere in the room, and it needs to
            read that way against the anodising it's attached to.
          */}
          <mesh
            geometry={cushion}
            position={[0, -0.044 - H.cupH / 2, -s * (H.cupD / 2 + 0.002)]}
          >
            <meshStandardMaterial {...M.CUSHION} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
