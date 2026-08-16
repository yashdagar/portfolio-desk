"use client";

import { useEffect, useMemo } from "react";
import { LatheGeometry, Vector2 } from "three";

import * as M from "./materials";

/**
 * The mug. Fat, and actually hollow.
 *
 * The old one was a plain capped cylinder with a half torus stuck to its side,
 * and the torus was rotated a quarter turn about X — which lays the handle flat,
 * horizontal, like a saucer welded to the wall of the cup. It read as a
 * mistake because it was one.
 *
 * This is a lathe instead. The profile climbs the outside, turns over the rim
 * and comes back down the inside to the floor of the cup, so a single mesh gives
 * a real wall thickness, a real rim, and a cavity to put coffee in. Anything
 * short of that shows: the inside of a mug is visible from a seated camera
 * looking down at a desk, and a flat disc where the coffee should be is the
 * first thing the eye finds.
 *
 * Proportions are deliberately stout — 112 mm across the belly against 98 mm
 * tall. A correctly proportioned mug looks thin in a room this size, because
 * everything around it (a 27" panel, a 2.2 m desk) is large.
 */

/**
 * Profile in the XY plane, revolved about Y. X is the radius, Y is the height.
 *
 * Up the outside, over the rim, down the inside. The small steps at the foot and
 * the lip are fillets — a mug with a perfectly square base looks like a tube,
 * and ceramic is never that sharp anyway.
 */
const PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.041, 0.0],
  [0.05, 0.007],
  [0.054, 0.026],
  [0.056, 0.058],
  [0.054, 0.09],
  [0.053, 0.098], // outer lip
  [0.0485, 0.1005], // over the rim
  [0.045, 0.098], // inner lip
  [0.0455, 0.06],
  [0.044, 0.024],
  [0.036, 0.013],
  [0.0, 0.012], // floor of the cavity
];

export function Mug({ position }: { position: [number, number, number] }) {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        PROFILE.map(([x, y]) => new Vector2(x, y)),
        48,
      ),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={position}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial {...M.CERAMIC} />
      </mesh>

      {/*
        Handle, in the XY plane where a handle actually lives — the ring stands
        up beside the cup rather than lying flat around it. Thick tube, to match
        a mug this heavy; a delicate handle on a fat body looks broken off.
      */}
      <mesh
        position={[0.05, 0.052, 0]}
        // A partial torus always starts its arc at +X and sweeps toward +Y, so a
        // half torus is the *top* half. Rolling it back a quarter turn is what
        // puts the opening against the cup and the bulge out to the side.
        rotation={[0, 0, -Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <torusGeometry args={[0.031, 0.0105, 14, 28, Math.PI]} />
        <meshStandardMaterial {...M.CERAMIC} />
      </mesh>

      {/*
        Coffee. Sits a centimetre below the rim, dark and glossy so it catches
        the lamp as a small bright ellipse — which is what tells you at a glance
        that the cup isn't empty.
      */}
      <mesh position={[0, 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.0435, 40]} />
        <meshStandardMaterial {...M.COFFEE} />
      </mesh>
    </group>
  );
}
