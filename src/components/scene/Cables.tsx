"use client";

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";

import { DESK } from "@/lib/layout";

import * as M from "./materials";

/**
 * The cables, down the back right leg.
 *
 * Every monitor, the lamp and the arm's clamp all live on the right half of
 * this desk, and until now not one of them was plugged into anything. That
 * absence is the sort of thing nobody points at and everybody registers: a desk
 * with four powered devices and no cable is a product render, and the whole
 * project is trying not to be one.
 *
 * They also do something for the frame. The space under the desk is the largest
 * empty area in the shot — a flat dark rectangle from the top to the bottom
 * edge — and a bundle running down one leg gives that area a vertical line and
 * a reason to exist.
 */

/** Where the leg is, so the bundle can be strapped to it rather than near it. */
const LEG_X = DESK.width / 2 - 0.08;
const LEG_Z = DESK.frontZ - DESK.depth + 0.08;
/** Underside of the desk top, where the cables come from. */
const UNDER = DESK.surfaceY - DESK.thickness;

/**
 * A cable texture: lengthwise sheen, faint extrusion marks across it.
 *
 * A tube lays u along its length and v around it, so a stripe of constant v
 * runs the whole cable and a stripe of constant u is a ring round it. Both are
 * needed. The lengthwise band is the specular highlight PVC has down one side
 * whatever it's lying on, and it's the single thing that says "flexible cable"
 * rather than "black rod"; the rings are the marks a cable picks up from being
 * coiled, and they stop the highlight reading as a painted line.
 */
function cableTexture(): CanvasTexture {
  const W = 64;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Around the cable: dark at the edges of the visible side, bright in the
  // middle. Painted rather than lit, because at 4 mm across the real specular
  // is a single pixel that flickers as the camera drifts.
  const round = ctx.createLinearGradient(0, 0, 0, H);
  round.addColorStop(0, "#6a6a6a");
  round.addColorStop(0.28, "#ffffff");
  round.addColorStop(0.42, "#c8c8c8");
  round.addColorStop(1, "#555555");
  ctx.fillStyle = round;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let x = 0; x < W; x += 7) ctx.fillRect(x, 0, 2, H);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  // Repeat along the length only — around the cable it has to stay a single
  // wrap or the highlight appears four times and the tube looks fluted.
  tex.repeat.set(26, 1);
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

/**
 * One run: out from under the desk, down past the strap, and onto the floor.
 *
 * The last two points matter more than the rest. A cable that meets the carpet
 * and stops reads as a rod stuck in the ground; a real one lands, turns, and
 * lies along the floor for a while under its own weight, and that turn is what
 * gives the whole bundle its slack.
 */
function cablePath(i: number, count: number): CatmullRomCurve3 {
  /** −1 to 1 across the bundle, so the runs fan out rather than stack. */
  const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
  const spread = 0.016;

  return new CatmullRomCurve3([
    // Under the desk, heading back toward the leg.
    new Vector3(LEG_X + t * 0.05 - 0.06, UNDER - 0.01, LEG_Z + 0.11),
    new Vector3(LEG_X + t * spread * 0.6, UNDER - 0.045, LEG_Z + 0.05),
    // Gathered tight where the strap is.
    new Vector3(LEG_X + t * spread * 0.35, UNDER - 0.12, LEG_Z + 0.032),
    new Vector3(LEG_X + t * spread * 0.35, UNDER - 0.3, LEG_Z + 0.031),
    // Below the strap they separate again and start to bow outward.
    new Vector3(LEG_X + t * spread * 1.3, UNDER - 0.46, LEG_Z + 0.04 + t * 0.01),
    new Vector3(LEG_X + t * spread * 2, 0.075, LEG_Z + 0.075 + t * 0.02),
    // Onto the floor, turning toward the front.
    new Vector3(LEG_X + t * spread * 2.4, 0.008, LEG_Z + 0.16 + t * 0.03),
    new Vector3(LEG_X - 0.02 + t * 0.06, 0.006, LEG_Z + 0.3 + t * 0.05),
  ]);
}

/** Radius and colour per run. Real bundles are never one gauge. */
const RUNS: { radius: number; colour: string }[] = [
  { radius: 0.0038, colour: "#141618" },
  { radius: 0.0031, colour: "#1d2023" },
  { radius: 0.0044, colour: "#101214" },
  // One pale one. A bundle of five blacks is a shadow; one light cable is what
  // makes the others read as separate objects.
  { radius: 0.0029, colour: "#b9b5ad" },
  { radius: 0.0034, colour: "#191c1f" },
];

export function Cables() {
  const skin = useMemo(() => cableTexture(), []);
  const tubes = useMemo(
    () =>
      RUNS.map(
        (run, i) =>
          new TubeGeometry(
            cablePath(i, RUNS.length),
            48,
            run.radius,
            8,
            false,
          ) as BufferGeometry,
      ),
    [],
  );

  useEffect(
    () => () => {
      skin.dispose();
      tubes.forEach((t) => t.dispose());
    },
    [skin, tubes],
  );

  return (
    <group>
      {tubes.map((geo, i) => (
        <mesh key={i} geometry={geo} castShadow>
          <meshStandardMaterial
            {...M.CABLE}
            color={RUNS[i].colour}
            map={skin}
          />
        </mesh>
      ))}

      {/*
        The velcro strap.

        The one part of this that isn't cable, and the part that makes the rest
        look deliberate: five runs falling loose down a leg is a mess, five runs
        pinched together at one point and falling loose below it is a tidy desk.
      */}
      <mesh position={[LEG_X, UNDER - 0.21, LEG_Z + 0.032]} castShadow>
        <cylinderGeometry args={[0.019, 0.019, 0.022, 16]} />
        <meshStandardMaterial {...M.VELCRO} />
      </mesh>
    </group>
  );
}
