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
 * Cables down the back right leg. A desk with four powered devices and no cable
 * is a product render — and the space under the desk is the largest empty area
 * in the shot, so a bundle down one leg gives it a vertical line.
 */

/** So the bundle is strapped to the leg rather than near it. */
const LEG_X = DESK.width / 2 - 0.08;
const LEG_Z = DESK.frontZ - DESK.depth + 0.08;
/** Underside of the desk top, where the cables come from. */
const UNDER = DESK.surfaceY - DESK.thickness;

/**
 * A tube lays u along its length and v around it. The lengthwise band is the
 * specular PVC has down one side whatever it's lying on, which is what says
 * "cable" rather than "black rod".
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

  // Painted rather than lit: at 4 mm across the real specular is one pixel and
  // it flickers as the camera drifts.
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
  // Length only: repeated around, the highlight appears four times and flutes.
  tex.repeat.set(26, 1);
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

/**
 * The last two points matter most: a cable that meets the carpet and stops reads
 * as a rod stuck in the ground, where a real one lands, turns and lies along the
 * floor — and that turn is what gives the bundle its slack.
 */
function cablePath(i: number, count: number): CatmullRomCurve3 {
  /** −1 to 1 across the bundle, so the runs fan out rather than stack. */
  const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
  const spread = 0.016;

  return new CatmullRomCurve3([
    new Vector3(LEG_X + t * 0.05 - 0.06, UNDER - 0.01, LEG_Z + 0.11),
    new Vector3(LEG_X + t * spread * 0.6, UNDER - 0.045, LEG_Z + 0.05),
    new Vector3(LEG_X + t * spread * 0.35, UNDER - 0.12, LEG_Z + 0.032),
    new Vector3(LEG_X + t * spread * 0.35, UNDER - 0.3, LEG_Z + 0.031),
    new Vector3(LEG_X + t * spread * 1.3, UNDER - 0.46, LEG_Z + 0.04 + t * 0.01),
    new Vector3(LEG_X + t * spread * 2, 0.075, LEG_Z + 0.075 + t * 0.02),
    new Vector3(LEG_X + t * spread * 2.4, 0.008, LEG_Z + 0.16 + t * 0.03),
    new Vector3(LEG_X - 0.02 + t * 0.06, 0.006, LEG_Z + 0.3 + t * 0.05),
  ]);
}

/** Radius and colour per run. Real bundles are never one gauge. */
const RUNS: { radius: number; colour: string }[] = [
  { radius: 0.0038, colour: "#141618" },
  { radius: 0.0031, colour: "#1d2023" },
  { radius: 0.0044, colour: "#101214" },
  // One pale one: five blacks together are a shadow.
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

      {/* Five runs falling loose is a mess; five pinched at one point and loose
          below it is a tidy desk. */}
      <mesh position={[LEG_X, UNDER - 0.21, LEG_Z + 0.032]} castShadow>
        <cylinderGeometry args={[0.019, 0.019, 0.022, 16]} />
        <meshStandardMaterial {...M.VELCRO} />
      </mesh>
    </group>
  );
}
