"use client";

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  LinearFilter,
  SphereGeometry,
  SRGBColorSpace,
} from "three";

import { MOUSE } from "@/lib/layout";

import * as M from "./materials";

/**
 * A sculpted hemisphere, with every seam and slot drawn into its texture rather
 * than modelled. A box sunk into the dome to cut a recess stands proud of it
 * near the flanks; in UV space a seam is a straight line however curved the
 * surface is.
 */

/** three puts u = 0.75 at −Z, and the nose points at −Z, away from the seat. */
const NOSE_U = 0.75;
/** How far down the dome the buttons reach, as a fraction of pole-to-equator. */
const BUTTON_V = 0.52;

/**
 * Where the wheel sits along the shell, in the sphere's own z: −1 is the nose,
 * +1 the tail. Just forward of the crown, under where a fingertip lands.
 */
const WHEEL_ZN = -0.42;
/** Wheel radius, in metres. Real wheels are around 16 mm across. */
const WHEEL_R = 0.008;

/**
 * Latitude of a point at z = zn on the nose meridian. v runs 0 at the pole to 1
 * at the equator over a quarter turn, so it falls out of asin.
 */
const HALF_PI = Math.PI / 2;
const vAt = (zn: number) => Math.asin(Math.abs(zn)) / HALF_PI;

function shellTexture(): CanvasTexture {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Faded up from nothing: a hard horizontal edge on a curved surface is the
  // signature of a sticker, because it doesn't follow the form.
  const grip = ctx.createLinearGradient(0, H * 0.6, 0, H);
  grip.addColorStop(0, "rgba(176,171,164,0)");
  grip.addColorStop(1, "rgba(176,171,164,0.3)");
  ctx.fillStyle = grip;
  ctx.fillRect(0, H * 0.6, W * 0.035, H * 0.4);
  ctx.fillRect(W * 0.465, H * 0.6, W * 0.07, H * 0.4);
  ctx.fillRect(W * 0.965, H * 0.6, W * 0.035, H * 0.4);

  // A dark line with a lit one beside it. On a white shell a single dark stroke
  // vanishes under any light; the lip on the far side of a real gap catches
  // light the recess doesn't, and two strokes give the gap depth.
  const seam = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    nx: number,
    ny: number,
  ) => {
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = W * 0.005;
    ctx.beginPath();
    ctx.moveTo(x0 + nx, y0 + ny);
    ctx.lineTo(x1 + nx, y1 + ny);
    ctx.stroke();

    ctx.strokeStyle = "#3f3c38";
    ctx.lineWidth = W * 0.0055;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // Split between the two buttons, running from the top of the dome forward.
  seam(NOSE_U * W, 0, NOSE_U * W, BUTTON_V * H, W * 0.006, 0);

  // No lit lip on this one, unlike the seams: near the top of the dome the
  // rings are tiny, so the shape covers a seventh of the texture's width and a
  // pale rectangle that large lands on the flank as a sticker.
  const top = vAt(WHEEL_ZN + WHEEL_R / (MOUSE.d / 2)) * H;
  const bottom = vAt(WHEEL_ZN - WHEEL_R / (MOUSE.d / 2)) * H;
  const halfW = W * 0.072;
  const cx = NOSE_U * W;

  ctx.fillStyle = "#3b3733";
  ctx.beginPath();
  ctx.roundRect(cx - halfW, top, halfW * 2, bottom - top, halfW);
  ctx.fill();

  // The line across, separating both buttons from the palm rest. Only across
  // the front half of the shell, which is where the buttons are.
  seam(W * 0.5, BUTTON_V * H, W, BUTTON_V * H, 0, H * 0.012);

  // Contact shading at the bottom edge only. Painted shading up the sides fights
  // the real lighting and wins, and the object ends up two different whites.
  const shade = ctx.createLinearGradient(0, H * 0.86, 0, H);
  shade.addColorStop(0, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(130,126,120,0.3)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, H * 0.86, W, H * 0.14);

  /*
   * The parting line. From the seat you see the mouse's back, which has no
   * buttons, wheel or seams on it, so without this the silhouette is an
   * unbroken dome and reads as an egg.
   *
   * Kept clear of the very bottom edge: down at v = 0.95 the shell is nearly
   * edge-on and a line sampled there breaks into dashes.
   */
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(0, H * 0.9, W, H * 0.012);
  ctx.fillStyle = "rgba(52,49,45,0.9)";
  ctx.fillRect(0, H * 0.912, W, H * 0.02);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Two profile curves sculpt the hemisphere, since a scaled half-sphere crowns in
 * the middle and reads as an egg. Applied per vertex so the UVs survive, which
 * matters because every seam is drawn in texture space.
 *
 * Height: rises out of the nose, crowns two thirds back, eases down over the
 * tail. `t` is 0 at the nose, 1 at the tail. Exported from the loop because the
 * wheel has to ask the same curve where the shell is.
 */
const heightAt = (t: number) =>
  0.5 + 0.5 * smoothstep(0, 0.62, t) - 0.34 * smoothstep(0.68, 1, t);

/** Narrow at the nose, widest at the waist, tucked in at the tail. */
const widthAt = (t: number) =>
  0.66 + 0.34 * smoothstep(0, 0.42, t) - 0.28 * smoothstep(0.64, 1, t);

function shellGeometry(): SphereGeometry {
  const geo = new SphereGeometry(1, 48, 26, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // 0 at the nose (−Z, pointing away from the seat), 1 at the tail.
    const t = (z + 1) / 2;

    pos.setXYZ(i, x * widthAt(t), y * heightAt(t), z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Sunk into the shell, which is therefore its own housing. */
function Wheel() {
  /** The wheel's centre, in metres along the mouse's own length. */
  const z = (WHEEL_ZN * MOUSE.d) / 2;
  // Both terms matter: `heightAt` is a *scale* on the sphere's own y, and that y
  // is already below 1 here because the wheel sits forward of the pole. The
  // scale alone put the axle two millimetres high.
  const crown =
    MOUSE.h * Math.sqrt(1 - WHEEL_ZN ** 2) * heightAt((WHEEL_ZN + 1) / 2);
  /** Under a millimetre. The wheel is on the far side from the seat, so any
   *  more reads as a dark nub on the skyline rather than a wheel in a slot. */
  const proud = 0.0008;
  const y = crown + proud - WHEEL_R;

  return (
    <group position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.0062, 28]} />
        <meshStandardMaterial {...M.WHEEL} />
      </mesh>

      {/* Rings rather than a texture: at 1.5 mm of visible arc a printed
          pattern is two pixels of noise, where an edge still catches light. */}
      {[-0.0021, 0, 0.0021].map((dy) => (
        <mesh key={dy} position={[0, dy, 0]}>
          <cylinderGeometry args={[WHEEL_R + 0.0003, WHEEL_R + 0.0003, 0.0007, 28]} />
          <meshStandardMaterial {...M.PANEL_GAP} />
        </mesh>
      ))}
    </group>
  );
}

export function Mouse({ top }: { top: number }) {
  const shell = useMemo(() => shellTexture(), []);
  const body = useMemo(() => shellGeometry(), []);

  useEffect(() => {
    return () => {
      shell.dispose();
      body.dispose();
    };
  }, [shell, body]);

  return (
    // Turned off square, which swings the flank, the button split and the wheel
    // slot into view. Set straight, the tail faces the camera and it has none of
    // them on it.
    <group position={[MOUSE.x, top, MOUSE.z]} rotation={[0, -0.46, 0]}>
      {/* The texture is a greyscale mask multiplied by the material colour, so
          seams darken the shell rather than replacing it. */}
      <mesh
        geometry={body}
        scale={[MOUSE.w / 2, MOUSE.h, MOUSE.d / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.MOUSE_SHELL} map={shell} />
      </mesh>

      {/* Darker and inset, so the mouse reads as two mouldings clipped together
          and has a dark line separating it from the mat. */}
      <mesh position={[0, 0.002, 0]} scale={[MOUSE.w / 2, 1, MOUSE.d / 2]}>
        <cylinderGeometry args={[0.9, 0.9, 0.004, 44]} />
        <meshStandardMaterial {...M.GRIP} />
      </mesh>

      <Wheel />

      {/* Low on the flank, not the palm: a saturated dot in the middle of a
          pale dome reads as a laser pointer aimed at you. */}
      <mesh position={[MOUSE.w * 0.32, MOUSE.h * 0.16, MOUSE.d * 0.2]}>
        <sphereGeometry args={[0.0018, 10, 10]} />
        <meshBasicMaterial color={M.ACCENT_HEX} toneMapped={false} />
      </mesh>
    </group>
  );
}
