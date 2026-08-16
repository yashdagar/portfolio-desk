"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useEffect, useState } from "react";

import { ACESFilmicToneMapping, Object3D } from "three";

import type { ActivityFeed } from "@/lib/activity";
import { isPinned, sceneNow } from "@/lib/clock";
import { daylight, type Daylight } from "@/lib/daylight";
import { CAMERA, DESK, LAMP, SCREENS, WALL, WINDOW } from "@/lib/layout";

import { CameraRig } from "./CameraRig";
import { HeroCamera } from "./HeroCamera";
import { Room } from "./Room";

/**
 * Three sources, per the art direction: a warm ~2700K desk lamp as key, the
 * window as cool ~6500K fill, and the screens as practical rim light. The
 * warm/cool opposition is doing most of the work — it's the reason a render
 * reads as lit rather than as flat-shaded geometry.
 *
 * All three are driven by real Gurugram time, so the balance inverts across the
 * day: window-dominant at noon, lamp-dominant at midnight.
 */
function Lighting({ day }: { day: Daylight }) {
  /*
   * The lamp aims at the desk.
   *
   * A point light ignores the shade it sits inside and throws a huge even disc
   * onto the wall behind — which is what a bare bulb does, not a desk lamp. A
   * spot pointed down puts the light where the shade is pointing, and the wall
   * only catches the spill it should.
   *
   * The target is a real Object3D in the scene because three resolves a spot's
   * direction from `target.matrixWorld`, and a target that was never added to
   * the scene silently leaves the light aimed at the origin.
   */
  const [lampTarget] = useState(() => new Object3D());

  return (
    <>
      <ambientLight intensity={day.bounceIntensity} color={day.bounceColor} />

      <primitive object={lampTarget} position={[0.16, DESK.surfaceY, 0.02]} />
      <spotLight
        position={LAMP.bulb}
        target={lampTarget}
        intensity={day.lampIntensity * 2.6}
        angle={0.92}
        penumbra={0.75}
        distance={3.4}
        decay={2}
        color="#ffb15e"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.002}
        shadow-normalBias={0.05}
        shadow-camera-near={0.12}
      />

      {/* Fill: daylight through the window, arriving from its actual position. */}
      <directionalLight
        position={[WINDOW.x - 1.2, WINDOW.y + 0.5, WALL.z + 2.2]}
        intensity={day.windowIntensity}
        color={day.windowColor}
      />

      {/*
        Practical: screen spill, one per monitor, placed behind the panel.
        In front they paint a blown-out hotspot on the very surface they're
        meant to be emitted by, which is an artefact no real monitor has.
      */}
      {SCREENS.map((s) => (
        <pointLight
          key={s.id}
          position={[s.position[0] * 0.8, s.position[1] - 0.1, s.position[2] - 0.1]}
          intensity={0.42}
          distance={1.1}
          decay={2}
          color="#6fc9d8"
        />
      ))}
    </>
  );
}

/**
 * Reflections without an HDRI download.
 *
 * Brushed aluminium and glazed ceramic only look like themselves if there's
 * something for them to reflect, and with no environment they render as flat
 * grey. These lightformers stand in for the room's own bright surfaces — the
 * window, the lamp, the screens — so the specular highlights point at things
 * that are actually there.
 */
function Reflections({ day }: { day: Daylight }) {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer
        form="rect"
        intensity={0.18 + day.level * 1.5}
        color={day.windowColor}
        position={[-2.4, 1.5, 0.4]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[1.6, 2, 1]}
      />
      <Lightformer
        form="rect"
        intensity={day.lampIntensity * 0.28}
        color="#ffbe7a"
        position={[1.4, 1.6, 0.2]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[0.8, 0.8, 1]}
      />
      {/* The monitors themselves, as a wide soft source in front of the desk. */}
      <Lightformer
        form="rect"
        intensity={0.22}
        color="#8fdcea"
        position={[0, 1.05, 0.9]}
        scale={[2.2, 0.5, 1]}
      />
    </Environment>
  );
}

/**
 * Re-evaluates the daylight on an interval.
 *
 * Computed on the client only. Doing it during SSR bakes the build machine's
 * clock into the markup, and the room would arrive at whatever time the deploy
 * happened to run.
 */
function useDaylight(): Daylight {
  const [day, setDay] = useState<Daylight>(() => daylight());

  useEffect(() => {
    setDay(daylight(sceneNow()));
    // Pinned by ?t= — nothing to tick.
    if (isPinned()) return;

    // A minute is far finer than the light actually changes; it just means the
    // transition across dawn or dusk happens while someone's watching.
    const id = setInterval(() => setDay(daylight(sceneNow())), 60_000);
    return () => clearInterval(id);
  }, []);

  return day;
}

export function Scene({
  hero = false,
  activity = null,
}: {
  hero?: boolean;
  activity?: ActivityFeed | null;
} = {}) {
  const day = useDaylight();

  return (
    <Canvas
      className={hero ? "h-full w-full" : "h-dvh w-full"}
      shadows={!hero}
      // Hero mode runs on phones, where a second device-pixel of resolution and
      // a shadow map cost far more than they show at that size.
      dpr={hero ? [1, 1.5] : [1, 2]}
      gl={{
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        // Under 1 on purpose. ACES already rolls off the highlights, and at
        // exposure 1 the daylit wall clips to near-white and the whole room
        // flattens. Pulling it down is what buys back the shadows.
        toneMappingExposure: 0.78,
      }}
      camera={{ position: CAMERA.eye, fov: CAMERA.fov, near: 0.05, far: 30 }}
    >
      <color attach="background" args={["#08090b"]} />

      <Reflections day={day} />
      <Lighting day={day} />
      <Room day={day} hero={hero} activity={activity} />
      {hero ? <HeroCamera /> : <CameraRig />}

      <EffectComposer>
        {/*
          Bloom on emissives only. The threshold sits above every lit surface in
          the room so the glow comes from the bulb, the window and the screens —
          the things that actually emit — rather than smearing the whole frame.
        */}
        <Bloom
          intensity={0.34}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
        {/*
          Fine grain, to break up the flat gradients on the wall.

          Overlay rather than soft-light, and much weaker: soft light against
          bloom's HDR values swings the hue hard, which painted a green and blue
          speckled disc around the lamp.
        */}
        <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.06} />
        <Vignette eskil={false} offset={0.28} darkness={0.62} />
      </EffectComposer>
    </Canvas>
  );
}

