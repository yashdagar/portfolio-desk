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
import { CAMERA, DESK, LAMP_EMITTER, SCREENS, WALL, WINDOW } from "@/lib/layout";

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
   * A spot rather than a point light, because the emitter is a strip on the
   * underside of a bar and it throws downward. A point light there would put an
   * even disc on the wall behind, which is what a bare bulb does.
   *
   * The target is a real Object3D in the scene because three resolves a spot's
   * direction from `target.matrixWorld`, and a target that was never added to
   * the scene silently leaves the light aimed at the origin.
   */
  const [lampTarget] = useState(() => new Object3D());
  const [sunTarget] = useState(() => new Object3D());

  return (
    <>
      {/*
        Bounce.

        A hemisphere rather than a flat ambient. Flat ambient adds the same value
        to every surface regardless of which way it faces, which is exactly how
        you flatten a render — at noon the old one was contributing 0.43 to the
        ceiling-facing desk and the camera-facing monitor backs alike, and the
        whole room went grey and shapeless. A hemisphere at least distinguishes
        up from down, so the floor stays dark and the desk surface lifts.
      */}
      <hemisphereLight
        args={[day.bounceColor, "#241d18", day.bounceIntensity]}
      />

      <primitive object={lampTarget} position={[0.1, DESK.surfaceY, 0.06]} />
      <spotLight
        position={LAMP_EMITTER}
        target={lampTarget}
        intensity={day.lampIntensity * 3.1}
        /*
          Wide and very soft. The old cone was 0.92 rad at penumbra 0.75, which
          put a visible hard-edged ellipse across the desk and a diagonal cut
          line through the middle of the frame — the single most artificial
          thing in the render. A bar-shaped emitter doesn't have a cone edge at
          all, so the falloff has to be entirely gradient.
        */
        angle={1.15}
        penumbra={1}
        distance={3.6}
        decay={2}
        color="#ffb877"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0015}
        shadow-normalBias={0.04}
        shadow-camera-near={0.15}
      />

      {/*
        The sun, through the window.

        Shadow-casting, and the wall is a solid slab with a hole in it, so the
        only daylight that reaches the desk is the daylight that came through
        the opening. That's what puts a bright window-shaped patch on the floor
        and along the right-hand end of the desk, and it's the difference
        between a room lit by daylight and a room with the daylight parameter
        turned up.
      */}
      <primitive object={sunTarget} position={[-0.15, 0.55, 0.15]} />
      <directionalLight
        position={[WINDOW.x + 1.9, WINDOW.y + 1.35, WALL.z - 2.1]}
        target={sunTarget}
        intensity={day.sunIntensity}
        color={day.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0012}
        shadow-normalBias={0.03}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-2.6}
      />

      {/*
        Sky fill, shadowless, from the window's side of the room.

        The sun gives direction and a hard-edged patch; this is the broad soft
        daylight a 90 cm opening actually throws, and it's what makes midday
        read as midday. Aimed from slightly above and well to the right so it
        still models everything it touches rather than washing it.
      */}
      <directionalLight
        position={[WINDOW.x + 1.4, WINDOW.y + 0.9, WALL.z + 1.4]}
        intensity={day.skyIntensity}
        color={day.windowColor}
      />

      {/*
        The opening's own glow, tight around the sill.

        Short range on purpose: its job is the bright falloff down the reveal
        and across the near end of the desk, not to light the room. That's the
        directional above.
      */}
      <pointLight
        position={[WINDOW.x - 0.12, WINDOW.y - 0.12, WALL.z + 0.2]}
        intensity={day.windowIntensity}
        distance={2.4}
        decay={1.9}
        color={day.windowColor}
      />

      {/*
        Practical: screen spill, one per monitor, placed behind the panel.
        In front they paint a blown-out hotspot on the very surface they're
        meant to be emitted by, which is an artefact no real monitor has.

        Weak on purpose. At the old 0.42 the three of them sprayed cyan across
        the desk and up the wall and every warm surface in the room went green;
        their job is a rim on the monitor backs and the near edge of the desk,
        not to light the scene.
      */}
      {SCREENS.map((s) => (
        <pointLight
          key={s.id}
          position={[s.position[0] * 0.85, s.position[1] - 0.06, s.position[2] - 0.09]}
          intensity={0.2}
          distance={0.85}
          decay={2}
          color="#8fd4dd"
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
      {/* The window, on the right, where the bright side of the room now is. */}
      <Lightformer
        form="rect"
        intensity={0.18 + day.level * 1.6}
        color={day.windowColor}
        position={[2.6, 1.5, 0.2]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[1.6, 2.2, 1]}
      />
      {/* The lamp bar, on the left. */}
      <Lightformer
        form="rect"
        intensity={day.lampIntensity * 0.3}
        color="#ffbe7a"
        position={[-1.5, 1.55, 0.1]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[0.9, 0.5, 1]}
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
        /*
          Under 1 on purpose. ACES already rolls off the highlights, and at
          exposure 1 the daylit wall clips to near-white and the whole room
          flattens.

          Raised from 0.78 once the flat ambient came out. The old value was
          compensating for a scene that was being lifted everywhere at once —
          with contrast coming from the sun and the lamp instead, pulling the
          exposure that far down just crushed the room.
        */
        toneMappingExposure: 0.92,
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

