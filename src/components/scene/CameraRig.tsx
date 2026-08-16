"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Vector3 } from "three";

import { CAMERA, MONITOR, SCREENS } from "@/lib/layout";
import { useScene } from "@/lib/store";

/** Frame-rate independent approach: converges at the same rate at 30 and 144fps. */
function dampVec(current: Vector3, target: Vector3, lambda: number, dt: number) {
  const t = 1 - Math.exp(-lambda * dt);
  current.lerp(target, t);
}

/**
 * Seated first-person camera.
 *
 * At rest the head turns with the pointer, clamped hard enough that you can
 * look around the desk but never away from it — an unbounded first-person look
 * in a room this small just finds the back of the wall.
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

  /** Pointer in normalised device coords, -1..1. */
  const pointer = useRef({ x: 0, y: 0 });

  const rest = useMemo(() => new Vector3(...CAMERA.eye), []);
  const restTarget = useMemo(() => new Vector3(...CAMERA.target), []);

  // Scratch vectors, reused every frame — allocating in useFrame is how R3F
  // scenes quietly develop GC stutter.
  const desiredPos = useMemo(() => new Vector3(), []);
  const desiredLook = useMemo(() => new Vector3(), []);
  const currentLook = useMemo(() => new Vector3().copy(restTarget), [restTarget]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

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
      const forHeight = MONITOR.panelH / 2 / Math.tan(vFov / 2);
      const forWidth = MONITOR.panelW / 2 / Math.tan(vFov / 2) / aspect;
      const dist = Math.max(forHeight, forWidth) * 1.12;

      // Out along the panel's normal, which is where a reader would sit.
      const nx = Math.sin(screen.rotationY);
      const nz = Math.cos(screen.rotationY);
      desiredPos.set(px + nx * dist, py, pz + nz * dist);
      desiredLook.set(px, py, pz);
    } else {
      // Rest: the head turns, the body doesn't. Yaw and pitch are applied to
      // the look target rather than the camera's rotation so the motion reads
      // as looking around rather than the whole room swinging.
      const yaw = -pointer.current.x * CAMERA.yawLimit;
      const pitch = -pointer.current.y * CAMERA.pitchLimit;

      // A slow, tiny drift so the frame is never perfectly dead. Two
      // incommensurate periods keep it from reading as a loop.
      const driftX = Math.sin(t * 0.21) * 0.004 + Math.sin(t * 0.13) * 0.003;
      const driftY = Math.cos(t * 0.17) * 0.003;

      desiredPos.set(rest.x + driftX, rest.y + driftY, rest.z);

      const reach = 1.2;
      desiredLook.set(
        restTarget.x + Math.sin(yaw) * reach,
        restTarget.y + Math.sin(pitch) * reach,
        restTarget.z + (1 - Math.cos(yaw)) * reach,
      );
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
