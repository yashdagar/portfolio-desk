"use client";

import { useEffect, useMemo } from "react";
import { LatheGeometry, Vector2 } from "three";

import * as M from "./materials";

/**
 * Clear glass, so the coffee becomes the object: from a seated camera an opaque
 * cup shows a white cylinder with a small dark ellipse on top.
 *
 * Three stacked lathes — glass, coffee, crema — so the coffee has a real surface
 * at a real height rather than a disc floating at a guessed one. Deliberately
 * stout, because a correctly proportioned mug looks thin next to everything else
 * in this room.
 */

/**
 * Revolved about Y; X is radius. Up the outside, over the rim, back down the
 * inside — a closed profile, which gives a real 3 mm wall. Thickness is the
 * difference between glass and cling film once transmission is on.
 */
const GLASS: [number, number][] = [
  [0.0, 0.0],
  [0.039, 0.0],
  [0.047, 0.006],
  [0.0525, 0.024],
  [0.0555, 0.056],
  [0.0545, 0.09],
  [0.0535, 0.1],
  [0.0505, 0.1025], // over the rim
  [0.0475, 0.1],
  [0.0485, 0.086],
  [0.0475, 0.05],
  [0.0455, 0.022],
  [0.038, 0.011],
  [0.0, 0.0098], // floor of the cavity
];

/** Where the coffee stops and the crema starts. */
const CREMA_Y = 0.0695;
/** Where the crema stops. Roughly a centimetre below the rim. */
const SURFACE_Y = 0.0785;

/**
 * A hair inside the glass. Coincident surfaces between a transmissive material
 * and an opaque one behind it z-fight *through* the refraction, which reads as
 * the coffee boiling.
 */
const COFFEE: [number, number][] = [
  [0.0, 0.0104],
  [0.035, 0.0114],
  [0.0428, 0.0205],
  [0.0448, 0.05],
  [0.0462, CREMA_Y],
];

/** The head, and the flat top that tells you where the liquid stops. */
const CREMA: [number, number][] = [
  [0.0462, CREMA_Y],
  [0.0468, SURFACE_Y],
  [0.0, SURFACE_Y],
];

export function Mug({ position }: { position: [number, number, number] }) {
  const glass = useMemo(
    () => new LatheGeometry(GLASS.map(([x, y]) => new Vector2(x, y)), 56),
    [],
  );
  const coffee = useMemo(
    () => new LatheGeometry(COFFEE.map(([x, y]) => new Vector2(x, y)), 48),
    [],
  );
  const crema = useMemo(
    () => new LatheGeometry(CREMA.map(([x, y]) => new Vector2(x, y)), 48),
    [],
  );

  useEffect(
    () => () => {
      glass.dispose();
      coffee.dispose();
      crema.dispose();
    },
    [glass, coffee, crema],
  );

  return (
    <group position={position}>
      {/*
        The coffee goes down first so it's behind the glass in the transmission
        pass. Not shadow-casting: a transmissive cup that throws an opaque black
        shadow of its contents is the fastest way to make glass look like paint.
      */}
      <mesh geometry={coffee}>
        <meshStandardMaterial {...M.COFFEE} />
      </mesh>
      <mesh geometry={crema}>
        <meshStandardMaterial {...M.CREMA} />
      </mesh>

      <mesh geometry={glass} castShadow>
        <meshPhysicalMaterial {...M.GLASS} />
      </mesh>

      {/*
        Handle. Glass too, and the one part of this object that shows what
        transmission is for — a solid loop of it standing away from the cup,
        with the desk visible through the gap and bent by the bar.

        A partial torus always starts its arc at +X and sweeps toward +Y, so a
        half torus is the *top* half. Rolling it back a quarter turn is what
        puts the opening against the cup and the bulge out to the side.
      */}
      <mesh
        position={[0.052, 0.05, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        castShadow
      >
        <torusGeometry args={[0.032, 0.0088, 18, 32, Math.PI]} />
        <meshPhysicalMaterial {...M.GLASS} />
      </mesh>
    </group>
  );
}
