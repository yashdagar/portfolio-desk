"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { MathUtils, Vector3 } from "three";

import { CAMERA, DESK } from "@/lib/layout";

/** How much of the desk's width to keep in frame, with a little air. */
const TARGET_WIDTH = DESK.width * 1.35;

/**
 * Frames the desk regardless of viewport shape.
 *
 * The resting camera is composed for a wide desktop window. Dropped into a
 * phone-shaped hero — taller than it is wide — the same lens crops to a strip
 * of desk surface with no monitors, no shelf and no lamp, which is worse than
 * showing nothing.
 *
 * Rather than hand-tuning a second camera, this keeps the composed direction
 * and solves for the distance at which the desk actually fits the current
 * aspect. The framing then stays correct on every phone rather than on the one
 * that happened to be tested.
 */
export function HeroCamera() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    if (!("fov" in camera)) return;

    const eye = new Vector3(...CAMERA.eye);
    const target = new Vector3(...CAMERA.target);
    const dir = eye.clone().sub(target).normalize();

    const aspect = size.width / size.height;
    const vFov = MathUtils.degToRad(CAMERA.fov);
    // Horizontal half-angle: on a portrait viewport this is the binding
    // constraint, which is exactly why the default framing failed there.
    const tanH = Math.tan(vFov / 2) * aspect;
    const needed = TARGET_WIDTH / 2 / tanH;

    // Never closer than the composed distance — a very wide window shouldn't
    // shove the camera into the desk.
    const composed = eye.distanceTo(target);
    const distance = Math.max(composed, needed);

    camera.position.copy(target).addScaledVector(dir, distance);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}
