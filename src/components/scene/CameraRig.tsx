"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { MathUtils, Vector3 } from "three";

import { CAMERA, SCREENS } from "@/lib/layout";
import { useScene } from "@/lib/store";

/** Frame-rate independent: converges at the same rate at 30 and 144 fps. */
function dampVec(current: Vector3, target: Vector3, lambda: number, dt: number) {
  const t = 1 - Math.exp(-lambda * dt);
  current.lerp(target, t);
}

/**
 * Seated camera, locked square to the desk. Deliberately not mouse-look: the
 * screens are real text, and text that shears every time the mouse moves is text
 * nobody reads.
 *
 * On focus it flies to a position computed from the panel's own size and angle
 * rather than a hand-placed waypoint, so the fit is right at any viewport aspect
 * and survives the layout changing.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const focus = useScene((s) => s.focus);
  const clearFocus = useScene((s) => s.clearFocus);

  const rest = useMemo(() => new Vector3(...CAMERA.eye), []);
  const restTarget = useMemo(() => new Vector3(...CAMERA.target), []);

  // Reused every frame: allocating in useFrame is how R3F scenes develop stutter.
  const desiredPos = useMemo(() => new Vector3(), []);
  const desiredLook = useMemo(() => new Vector3(), []);
  const currentLook = useMemo(() => new Vector3().copy(restTarget), [restTarget]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearFocus]);

  useFrame((state, rawDelta) => {
    // A backgrounded tab resumes with a huge delta and would teleport.
    const dt = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;

    if (focus.kind === "screen") {
      const screen = SCREENS.find((s) => s.id === focus.id)!;
      const [px, py, pz] = screen.position;

      const vFov = MathUtils.degToRad(CAMERA.fov);
      const aspect = size.width / size.height;
      // Per-panel: one screen is on its side, and solving against landscape
      // dimensions parks the camera far too close to it.
      const forHeight = screen.panelH / 2 / Math.tan(vFov / 2);
      const forWidth = screen.panelW / 2 / Math.tan(vFov / 2) / aspect;
      const dist = Math.max(forHeight, forWidth) * 1.12;

      const nx = Math.sin(screen.rotationY);
      const nz = Math.cos(screen.rotationY);
      desiredPos.set(px + nx * dist, py, pz + nz * dist);
      desiredLook.set(px, py, pz);
    } else {
      // Incommensurate periods so it never reads as a loop, at about three
      // millimetres — under what disturbs reading, over what looks frozen.
      const driftX = Math.sin(t * 0.21) * 0.0022 + Math.sin(t * 0.13) * 0.0014;
      const driftY = Math.cos(t * 0.17) * 0.0018;

      desiredPos.set(rest.x + driftX, rest.y + driftY, rest.z);
      desiredLook.copy(restTarget);
    }

    // Arriving fast reads as responsive, leaving slow reads as considered.
    const lambda = focus.kind === "none" ? 3.2 : 4.5;
    dampVec(camera.position, desiredPos, lambda, dt);
    dampVec(currentLook, desiredLook, lambda, dt);
    camera.lookAt(currentLook);

    // Lets screenshot tooling wait for the move to finish rather than guess.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __cameraProbe: { x: number; y: number; z: number } })
        .__cameraProbe = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };
    }
  });

  useEffect(() => {
    camera.position.set(...CAMERA.eye);
    camera.lookAt(restTarget);
  }, [camera, restTarget]);

  useEffect(() => {
    if ("fov" in camera) {
      camera.fov = CAMERA.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  return null;
}
