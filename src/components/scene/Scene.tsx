"use client";

import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";

import { CAMERA } from "@/lib/layout";

import { CameraRig } from "./CameraRig";
import { Room } from "./Room";

/**
 * Greybox lighting.
 *
 * Three sources, matching the art direction: a warm 2700K desk lamp as key, a
 * cool 6500K window as fill, and the screens themselves as practical rim light.
 * The warm/cool opposition is doing most of the work — it's the reason a render
 * reads as lit rather than as flat-shaded geometry.
 *
 * Intensities are physically-ish scaled, so the real lights in the art pass can
 * replace these without every value needing to be re-found from scratch.
 */
function Lighting() {
  return (
    <>
      {/* Bounce. Real rooms are never as black as a renderer's ambient zero. */}
      <ambientLight intensity={0.13} color="#b9c7d6" />

      {/* Key: desk lamp, warm, high and to the right. */}
      <pointLight
        position={[0.85, 1.62, 0.18]}
        intensity={3.4}
        distance={4}
        decay={2}
        color="#ffb26b"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
      />

      {/* Fill: window, cool, low and to the left. */}
      <directionalLight
        position={[-2.4, 1.5, 1.6]}
        intensity={0.55}
        color="#8fb4ff"
      />

      {/*
        Practical: screen spill.

        Placed *behind and below* the panels rather than in front of them — a
        point light sitting in front of a screen paints a blown-out hotspot on
        its own surface, which is exactly the artefact a real monitor never has.
        From behind, it does the useful half of the job: throwing cool light
        onto the wall and the desk without touching the panel it belongs to.
      */}
      <pointLight
        position={[0, 0.92, -0.34]}
        intensity={0.32}
        distance={1.5}
        decay={2}
        color="#6fc9d8"
      />
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      className="h-dvh w-full"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
      camera={{ position: CAMERA.eye, fov: CAMERA.fov, near: 0.05, far: 30 }}
    >
      <color attach="background" args={["#0e0d0c"]} />
      <fog attach="fog" args={["#0e0d0c", 2.5, 7]} />

      <Lighting />
      <Room />
      <CameraRig />
    </Canvas>
  );
}
