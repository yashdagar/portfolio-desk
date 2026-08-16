"use client";

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  LatheGeometry,
  LinearFilter,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three";

import { PLANTER } from "@/lib/layout";

import * as M from "./materials";

/**
 * A monstera in a floor planter, at the front left: the room's only foreground,
 * and the only thing giving the middle distance a sense of distance.
 *
 * The fenestrations are why it works at this size. A big leaf is a big flat
 * silhouette, which is what you don't want between the camera and the subject;
 * a holed one lets the desk through.
 */

const LEAVES = 8;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Deterministic, so it's the same plant every reload. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * The blade as one function: how wide is the leaf at each point down its length.
 * An envelope gives the ovate shape and four notches cut it almost to nothing at
 * the sinuses, so sweeping up one side and back down the other produces the
 * fenestrations for free.
 *
 * `notchDepth` varies per leaf, so a young leaf can be nearly entire while the
 * big ones are cut to the midrib.
 */
function halfWidth(t: number, notchDepth: number): number {
  const envelope = Math.sin(Math.PI * Math.pow(t, 0.62)) * 0.54;

  let cut = 1;
  for (const at of [0.2, 0.38, 0.57, 0.77]) {
    const d = Math.abs(t - at);
    cut = Math.min(cut, 1 - notchDepth * (1 - smoothstep(0, 0.045, d)));
  }

  return Math.max(0.012, envelope * cut);
}

/**
 * ShapeGeometry writes each vertex's raw x/y as its UV, so a shape 0.3 across
 * comes out with UVs in 0–0.3 and the texture renders as one stretched pixel.
 * Rewriting them is also what puts the midrib at u = 0.5.
 */
function leafGeometry(length: number, notchDepth: number): BufferGeometry {
  const shape = new Shape();
  const STEPS = 90;

  shape.moveTo(0, 0);
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    shape.lineTo(halfWidth(t, notchDepth) * length, t * length);
  }
  for (let i = STEPS - 1; i >= 0; i--) {
    const t = i / STEPS;
    shape.lineTo(-halfWidth(t, notchDepth) * length, t * length);
  }
  shape.closePath();

  const geo = new ShapeGeometry(shape);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const halfSpan = 0.56 * length;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = y / length;

    uv.setXY(i, x / (halfSpan * 2) + 0.5, t);

    // The cup makes the leaf catch light in two tones instead of one; the droop
    // stops eight leaves standing to attention like cutouts.
    const cup = Math.pow(Math.abs(x) / halfSpan, 1.7) * length * 0.1;
    const droop = -Math.pow(t, 2.1) * length * 0.34;
    pos.setXYZ(i, x, y, cup + droop);
  }

  uv.needsUpdate = true;
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * The veins do the same job as the holes: a 30 cm leaf of one green in the near
 * foreground is the biggest block of flat colour the frame could contain.
 */
function leafTexture(): CanvasTexture {
  const W = 512;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const base = ctx.createLinearGradient(0, H, 0, 0);
  base.addColorStop(0, "#20401f");
  base.addColorStop(0.5, "#2f5b2c");
  base.addColorStop(1, "#3f7136");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(150,190,128,0.24)";
  ctx.lineWidth = 3;
  for (let i = 1; i < 22; i++) {
    const y = H - (i / 22) * H;
    const reach = Math.sin((i / 22) * Math.PI) * W * 0.46;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(W / 2, y);
      ctx.quadraticCurveTo(
        W / 2 + dir * reach * 0.55,
        y - H * 0.03,
        W / 2 + dir * reach,
        y - H * 0.075,
      );
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "rgba(30,52,26,0.55)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(W / 2 + 4, H);
  ctx.lineTo(W / 2 + 4, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(168,204,142,0.42)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 2, H);
  ctx.lineTo(W / 2 - 2, 0);
  ctx.stroke();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

/** The pot: a tapered vessel with a rolled rim, revolved. */
const POT_PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.108, 0.0],
  [0.116, 0.012],
  [0.132, 0.09],
  [0.152, 0.26],
  [0.163, 0.38],
  [0.17, 0.415], // out to the rim
  [0.17, 0.432],
  [0.157, 0.437], // over the top
  [0.153, 0.4],
  [0.14, 0.2],
  [0.118, 0.045],
  [0.0, 0.04], // floor of the pot
];

export function Planter() {
  const pot = useMemo(
    () =>
      new LatheGeometry(
        POT_PROFILE.map(([x, y]) => new Vector2(x, y)),
        48,
      ),
    [],
  );
  const skin = useMemo(() => leafTexture(), []);

  /** Together, because the petiole has to reach the leaf — two lists would
   *  agree until one of them was edited. */
  const foliage = useMemo(() => {
    const rand = rng(20260816);

    return Array.from({ length: LEAVES }, (_, i) => {
      const t = i / (LEAVES - 1);
      // Weighted toward the camera: a plant in a corner grows into the room.
      const angle = -1.1 + t * 4.4 + (rand() - 0.5) * 0.5;
      /** How far out the leaf hangs, and how high the stem carries it. */
      const reach = 0.16 + rand() * 0.16 + t * 0.06;
      const height = 0.42 + rand() * 0.5 + t * 0.16;
      const length = 0.19 + rand() * 0.11;

      const dx = Math.cos(angle);
      const dz = Math.sin(angle);

      // Almost vertical out of the soil, turning only near the top, which is
      // what gives the plant its vase shape. Straight lines make a starburst.
      const stem = new CatmullRomCurve3([
        new Vector3(dx * 0.03, 0.0, dz * 0.03),
        new Vector3(dx * 0.05, height * 0.42, dz * 0.05),
        new Vector3(dx * reach * 0.55, height * 0.82, dz * reach * 0.55),
        new Vector3(dx * reach, height, dz * reach),
      ]);

      return {
        geometry: leafGeometry(length, 0.55 + rand() * 0.33),
        stem: new TubeGeometry(stem, 16, 0.0055, 6, false),
        tip: [dx * reach, height, dz * reach] as [number, number, number],
        // Facing outward along the stem, and tipped over so the blade lies
        // flatter than it stands.
        rotation: [-1.05 - rand() * 0.35, -angle + Math.PI / 2, 0] as [
          number,
          number,
          number,
        ],
      };
    });
  }, []);

  useEffect(
    () => () => {
      pot.dispose();
      skin.dispose();
      foliage.forEach((f) => {
        f.geometry.dispose();
        f.stem.dispose();
      });
    },
    [pot, skin, foliage],
  );

  return (
    <group position={[PLANTER.x, 0, PLANTER.z]} rotation={[0, PLANTER.spin, 0]}>
      <mesh geometry={pot} castShadow receiveShadow>
        <meshStandardMaterial {...M.PLANTER_POT} />
      </mesh>

      {/* Soil, just below the rim, and a scatter of bark over it. */}
      <mesh position={[0, 0.395, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.152, 36]} />
        <meshStandardMaterial {...M.SOIL} />
      </mesh>

      <group position={[0, 0.4, 0]}>
        {foliage.map((f, i) => (
          <group key={i}>
            <mesh geometry={f.stem} castShadow>
              <meshStandardMaterial {...M.PETIOLE} />
            </mesh>
            <mesh
              geometry={f.geometry}
              position={f.tip}
              rotation={f.rotation}
              castShadow
              receiveShadow
            >
              {/* Half of these show their backs. */}
              <meshStandardMaterial {...M.MONSTERA} map={skin} side={2} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
