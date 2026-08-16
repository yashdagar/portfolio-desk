"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { MathUtils, Vector3 } from "three";

import { CAMERA, SCREENS } from "@/lib/layout";
import { useScene } from "@/lib/store";

/** Frame-rate independent approach: converges at the same rate at 30 and 144fps. */
function dampVec(current: Vector3, target: Vector3, lambda: number, dt: number) {
  const t = 1 - Math.exp(-lambda * dt);
  current.lerp(target, t);
}

/**
 * Seated camera, locked square to the desk.
 *
 * It used to turn with the pointer. That's the obvious thing to do with a
 * first-person scene and it was wrong here: the screens are real text, and text
 * that slides and shears every time the mouse moves is text nobody reads. The
 * rest pose is now a fixed, composed frame — the room is a photograph until you
 * choose to lean into something.
 *
 * What survives is a few millimetres of positional drift, far too small to
 * disturb reading and just enough that the frame isn't a dead still.
 *
 * On focus the camera flies to a position computed from the panel's own size
 * and angle rather than a hand-placed waypoint, so the screen fills the frame
 * correctly at any viewport aspect and stays correct if the layout changes.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const focus = useScene((s) => s.focus);
  const clearFocus = useScene((s) => s.clearFocus);

  const rest = useMemo(() => new Vector3(...CAMERA.eye), []);
  const restTarget = useMemo(() => new Vector3(...CAMERA.target), []);

  // Scratch vectors, reused every frame — allocating in useFrame is how R3F
  // scenes quietly develop GC stutter.
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
    // A backgrounded tab resumes with a huge delta, which would teleport the
    // camera on the first frame back.
    const dt = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;

    if (focus.kind === "screen") {
      const screen = SCREENS.find((s) => s.id === focus.id)!;
      const [px, py, pz] = screen.position;

      // Distance at which the panel just fills the frame, whichever of width or
      // height is the binding constraint at this viewport aspect.
      const vFov = MathUtils.degToRad(CAMERA.fov);
      const aspect = size.width / size.height;
      // Per-panel, not per-room: one of these screens is on its side, and
      // solving the fit against the landscape dimensions would park the camera
      // far too close to a 60 cm-tall portrait panel.
      const forHeight = screen.panelH / 2 / Math.tan(vFov / 2);
      const forWidth = screen.panelW / 2 / Math.tan(vFov / 2) / aspect;
      const dist = Math.max(forHeight, forWidth) * 1.12;

      // Out along the panel's normal, which is where a reader would sit.
      const nx = Math.sin(screen.rotationY);
      const nz = Math.cos(screen.rotationY);
      desiredPos.set(px + nx * dist, py, pz + nz * dist);
      desiredLook.set(px, py, pz);
    } else {
      /*
       * Rest: a fixed frame, breathing.
       *
       * Two incommensurate periods so it never reads as a loop, and an
       * amplitude of about three millimetres — below the threshold where it
       * disturbs reading, above the threshold where a still frame starts to
       * look like the page has frozen.
       */
      const driftX = Math.sin(t * 0.21) * 0.0022 + Math.sin(t * 0.13) * 0.0014;
      const driftY = Math.cos(t * 0.17) * 0.0018;

      desiredPos.set(rest.x + driftX, rest.y + driftY, rest.z);
      desiredLook.copy(restTarget);
    }

    // Focusing snaps in a little more eagerly than it releases — arriving fast
    // feels responsive, leaving slow feels considered.
    const lambda = focus.kind === "none" ? 3.2 : 4.5;
    dampVec(camera.position, desiredPos, lambda, dt);
    dampVec(currentLook, desiredLook, lambda, dt);
    camera.lookAt(currentLook);

    // Lets the screenshot tooling wait for the move to actually finish rather
    // than guessing a duration. Dev only.
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

  // Keep the FOV in one place; the rig owns the lens.
  useEffect(() => {
    if ("fov" in camera) {
      camera.fov = CAMERA.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  return null;
}
