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
import { useLampLevel } from "@/lib/store";
import { useWeather } from "@/lib/useWeather";
import { withWeather } from "@/lib/weather";
import {
  CAMERA,
  DESK,
  LAMP_EMITTER,
  SCREENS,
  SHELF,
  WALL,
  WINDOW,
} from "@/lib/layout";

import * as M from "./materials";
import { CameraRig } from "./CameraRig";
import { HeroCamera } from "./HeroCamera";
import { Room } from "./Room";

/**
 * A warm ~2700K lamp as key, the window as cool ~6500K fill, the screens as
 * practical rim. The warm/cool opposition does most of the work. All of it is
 * driven by real Gurugram time, so the balance inverts across the day.
 */
function Lighting({ day }: { day: Daylight }) {
  // Targets are real Object3Ds in the scene because three resolves a spot's
  // direction from `target.matrixWorld` — one that was never added silently
  // leaves the light aimed at the origin.
  const [lampTarget] = useState(() => new Object3D());
  const [sunTarget] = useState(() => new Object3D());
  const [shelfTarget] = useState(() => new Object3D());
  const lampLevel = useLampLevel();

  /** Panel centre of the ultrawide, which is where its bias strip is stuck. */
  const biasY =
    SCREENS.find((s) => s.id === "about")?.position[1] ?? DESK.surfaceY + 0.28;

  return (
    <>
      {/* A hemisphere, not a flat ambient: flat adds the same value whichever
          way a surface faces, which is exactly how a render goes shapeless. */}
      <hemisphereLight
        args={[day.bounceColor, "#241d18", day.bounceIntensity]}
      />

      {/* Aimed left of centre, so the pool lands over the keyboard and mug
          rather than across the desk toward the window. */}
      <primitive object={lampTarget} position={[-0.2, DESK.surfaceY, 0.08]} />
      <spotLight
        position={LAMP_EMITTER}
        target={lampTarget}
        /*
         * Inverse-square is unforgiving about the emitter being moved: a quarter
         * further at decay 2 is a third less light arriving. Multiplying back up
         * is the honest fix; softening the decay lights the room from one lamp.
         *
         * The dimmer scales this rather than replacing it, so the lamp still
         * tracks the time of day at every setting.
         */
        intensity={day.lampIntensity * 5.6 * lampLevel}
        // Wide and entirely gradient: a bar-shaped emitter has no cone edge, and
        // a hard-edged ellipse across the desk was the most artificial thing here.
        angle={1.15}
        penumbra={1}
        distance={4.2}
        decay={2}
        color="#ffb877"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0015}
        shadow-normalBias={0.04}
        shadow-camera-near={0.15}
      />

      {/* Shadow-casting through a solid wall, so the only daylight reaching the
          desk came through the opening — which is what puts the patch on it. */}
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

      {/* Shadowless sky fill: the sun gives direction, this gives the broad soft
          daylight a 90 cm opening actually throws. */}
      <directionalLight
        position={[WINDOW.x + 1.4, WINDOW.y + 0.9, WALL.z + 1.4]}
        intensity={day.skyIntensity}
        color={day.windowColor}
      />

      {/* Short range on purpose: the falloff down the reveal, not room light. */}
      <pointLight
        position={[WINDOW.x - 0.12, WINDOW.y - 0.12, WALL.z + 0.2]}
        intensity={day.windowIntensity}
        distance={2.4}
        decay={1.9}
        color={day.windowColor}
      />

      {/*
        Screen spill, behind the panel — in front they paint a hotspot on the
        surface they're meant to be emitted by. Weak on purpose: their job is a
        rim on the monitor backs, and stronger sprays cyan over every warm
        surface in the room.
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

      {/*
        Bias lighting, which stops the wall above the desk going to pure black
        after dark. Three sources rather than one because a strip is a metre long
        and a single point behind it paints a bullseye.
      */}
      {[-0.34, 0, 0.34].map((x) => (
        <pointLight
          key={x}
          position={[x, biasY, WALL.z + 0.06]}
          // Very low. It only has to beat black, and the moment it beats the
          // desk lamp the room stops having a key light.
          intensity={day.nightIntensity * 0.42}
          distance={1.05}
          decay={2}
          color={M.ACCENT_HEX}
        />
      ))}

      {/*
        The one light with no visible source, on only at night — nothing else
        reaches the shelf. The alternatives were a second lamp in shot, or
        lifting the ambient, which would undo every shadow the desk lamp casts.
      */}
      <primitive object={shelfTarget} position={[SHELF.x, SHELF.y, SHELF.z]} />
      <spotLight
        position={[SHELF.x + 0.1, 2.42, SHELF.z + 0.62]}
        target={shelfTarget}
        // Tightened until the pool ends roughly where the shelf does; wider and
        // it washes the whole upper wall and nothing looks picked out.
        intensity={day.nightIntensity * 4.2}
        angle={0.4}
        penumbra={1}
        distance={2.6}
        decay={2}
        color="#ffd2a4"
      />
    </>
  );
}

/**
 * Reflections without an HDRI download. Brushed aluminium and glazed ceramic
 * render as flat grey with no environment, so these lightformers stand in for
 * the room's own bright surfaces and the highlights point at real things.
 */
function Reflections({ day }: { day: Daylight }) {
  // The lamp is a reflected source as well as a light: switched off, the metal
  // must lose its warm highlight too.
  const lampLevel = useLampLevel();

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
        intensity={day.lampIntensity * 0.3 * lampLevel}
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
 * Client-only: computing this during SSR bakes the build machine's clock into
 * the markup, and the room arrives at whatever time the deploy ran.
 */
function useDaylight(): Daylight {
  const [day, setDay] = useState<Daylight>(() => daylight());

  useEffect(() => {
    setDay(daylight(sceneNow()));
    // Pinned by ?t= — nothing to tick.
    if (isPinned()) return;

    // Finer than the light changes, so dawn and dusk move while someone watches.
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
  const clock = useDaylight();
  const weather = useWeather();

  // Weather modifies the clock, never replaces it: `withWeather` returns its
  // input unchanged when there's nothing to apply, so a failed lookup is a clear
  // day rather than a dark room.
  const day = withWeather(clock, weather);

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
        // Under 1: at exposure 1 the daylit wall clips to near-white and the
        // whole room flattens.
        toneMappingExposure: 0.92,
      }}
      camera={{ position: CAMERA.eye, fov: CAMERA.fov, near: 0.05, far: 30 }}
      /*
        R3F defaults to `offsetX/offsetY`, which the DOM reports relative to the
        event *target* — and the screens mount real DOM through drei's `<Html>`,
        so a click landing on one of its wrappers is measured from that wrapper's
        corner. On the left monitor that is ~90px across and ~375px down, enough
        that the ray misses the screen entirely and it never focuses.

        `client` is only safe because this canvas is the viewport. Hero mode sits
        partway down a scrolling page, and takes no clicks at all, so it keeps
        the default.
      */
      eventPrefix={hero ? undefined : "client"}
    >
      <color attach="background" args={["#08090b"]} />

      <Reflections day={day} />
      <Lighting day={day} />
      <Room day={day} hero={hero} activity={activity} weather={weather} />
      {hero ? <HeroCamera /> : <CameraRig />}

      <EffectComposer>
        {/* Threshold above every lit surface, so only true emissives bloom. */}
        <Bloom
          intensity={0.34}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
        {/* Overlay, not soft-light: soft light against bloom's HDR values swings
            the hue and paints a speckled disc around the lamp. */}
        <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.06} />
        <Vignette eskil={false} offset={0.28} darkness={0.62} />
      </EffectComposer>
    </Canvas>
  );
}

