"use client";

import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";

/**
 * Placeholder canvas. This exists to prove the R3F stack renders under
 * Next 16 / React 19; the real greybox replaces its contents.
 *
 * Tone mapping and colour space are set here rather than per-material because
 * every later lighting decision depends on rendering in ACES from the start —
 * retrofitting it makes every previously-tuned light wrong.
 */
export function Scene() {
  return (
    <Canvas
      className="h-dvh w-full"
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
      camera={{ position: [0, 0.15, 1.1], fov: 35 }}
    >
      <color attach="background" args={["#1a1918"]} />
      <ambientLight intensity={0.4} />
      {/* Stands in for the 2700K desk lamp that becomes the key light. */}
      <pointLight position={[1.2, 1.4, 0.8]} intensity={12} color="#ffb86b" />
      {/* Stands in for the cool window fill. */}
      <directionalLight position={[-2, 1.5, 1]} intensity={0.8} color="#9dc4ff" />

      <mesh rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#4ecdc4" roughness={0.4} metalness={0.1} />
      </mesh>
    </Canvas>
  );
}
