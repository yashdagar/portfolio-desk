"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  LinearFilter,
  RepeatWrapping,
  type MeshBasicMaterial,
  type Texture,
} from "three";

import { WALL, WINDOW } from "@/lib/layout";

/**
 * Rain on the window.
 *
 * Two scrolling sheets of streaks rather than particles. Particles are the
 * obvious way to do rain and the wrong one here: the window is a 90 cm opening
 * at the edge of the frame, so anything with individual physics is invisible
 * detail running every frame. Two textures moving at different speeds give the
 * same read — water sliding down glass, with depth — for two draw calls and no
 * simulation.
 *
 * Additive, because rain on a lit window is a *highlight*: each rivulet is a
 * lens bending the sky toward you, which is brighter than the glass around it,
 * not darker. Multiplied it looks like dirt.
 */

function streakTexture(seed: number, count: number, reach = 1): CanvasTexture {
  const W = 256;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const h = (30 + rand() * 120) * reach;
    const w = 1 + rand() * 1.8;

    // Each streak fades in and out along its length, so it reads as a rivulet
    // rather than as a scratch. A hard-ended line is the tell that separates
    // "rain" from "someone drew on the glass".
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.35, `rgba(255,255,255,${0.25 + rand() * 0.4})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // A brighter bead at the head, where the water pools before it runs.
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h, w * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.minFilter = LinearFilter;
  return tex;
}

interface Sheet {
  tex: Texture;
  /** Metres per second down the glass. */
  speed: number;
  opacity: number;
  repeat: number;
}

export function RainGlass({ storm }: { storm: boolean }) {
  const sheets = useMemo<Sheet[]>(
    () => [
      // Far sheet: denser, slower, dimmer. Reads as the far side of the glass.
      { tex: streakTexture(1337, 90, 0.7), speed: 0.55, opacity: 0.5, repeat: 2 },
      // Near sheet: sparser, faster, brighter.
      { tex: streakTexture(90210, 44, 1.3), speed: 1.15, opacity: 0.85, repeat: 1 },
    ],
    [],
  );

  useEffect(() => {
    sheets.forEach((s) => s.tex.repeat.set(s.repeat, s.repeat));
    return () => sheets.forEach((s) => s.tex.dispose());
  }, [sheets]);

  /*
   * Scrolled through material refs rather than by touching the memoised
   * textures directly.
   *
   * Same objects either way, but a ref is the thing React sanctions writing to
   * every frame — reaching into a `useMemo` result and mutating it is exactly
   * the pattern the compiler rules exist to catch, and here it would be
   * indistinguishable from a real bug.
   */
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  const elapsed = useRef(0);

  useFrame((_, rawDelta) => {
    elapsed.current += Math.min(rawDelta, 0.1);
    mats.current.forEach((mat, i) => {
      const map = mat?.map;
      if (map) map.offset.y = (elapsed.current * sheets[i].speed) % 1;
    });
  });

  return (
    <group position={[WINDOW.x, WINDOW.y, WALL.z - WINDOW.reveal * 0.35]}>
      {sheets.map((s, i) => (
        <mesh key={i} position={[0, 0, i * 0.004]}>
          <planeGeometry args={[WINDOW.w, WINDOW.h]} />
          <meshBasicMaterial
            ref={(mat) => {
              mats.current[i] = mat;
            }}
            map={s.tex}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
            opacity={s.opacity * (storm ? 1.25 : 1)}
          />
        </mesh>
      ))}
    </group>
  );
}
