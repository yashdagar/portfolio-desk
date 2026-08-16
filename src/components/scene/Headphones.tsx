"use client";

import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

import { HEADPHONES as H } from "@/lib/layout";

import * as M from "./materials";

/**
 * Over-ear headphones, hung on the corner of a monitor.
 *
 * Draped rather than placed. Sitting on top of a monitor they'd read as a
 * product shot; hooked over the outer top corner with the cups hanging either
 * side of the panel is where they actually end up, and the asymmetry it puts
 * into the right-hand third of the frame is worth more than the object itself.
 *
 * The band is a swept tube, not a scaled torus. The torus version looked like a
 * bent coat hanger for a reason worth writing down: three composes a mesh's
 * matrix as scale, then rotation, then translation, so a scale applied to a
 * mesh happens in the geometry's *own* axes before any rotation reaches it. The
 * band was a torus lying in XY, turned a quarter turn about Y to stand it up in
 * ZY — which means the local X being scaled to widen the strap was, after the
 * rotation, the axis the arch spans. It wasn't widening the band. It was
 * stretching the arch to twice the distance between the cups.
 *
 * Sweeping a tube along an explicit curve and scaling the *geometry* sidesteps
 * the whole problem: the curve lives in ZY, so scaling X can only ever fatten
 * the cross-section.
 */

/** Half the gap between the cups, i.e. the arch's radius. */
const SPAN = 0.042;

function bandGeometry(radius: number, tube: number, width: number) {
  // A semicircle in the ZY plane, from the back cup up over the top and down to
  // the front one. Sampled rather than parametric so the ends can be pulled in
  // slightly — a real band narrows where it meets the arms.
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

  useEffect(() => {
    return () => {
      frame.dispose();
      canopy.dispose();
    };
  }, [frame, canopy]);

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
          <RoundedBox
            args={[H.cupW, H.cupH, H.cupD]}
            radius={0.016}
            smoothness={6}
            position={[0, -0.044 - H.cupH / 2, 0]}
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
            args={[H.cupW - 0.009, H.cupH - 0.009, 0.015]}
            radius={0.007}
            smoothness={5}
            position={[0, -0.044 - H.cupH / 2, -s * (H.cupD / 2 + 0.005)]}
          >
            <meshStandardMaterial {...M.CUSHION} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}
