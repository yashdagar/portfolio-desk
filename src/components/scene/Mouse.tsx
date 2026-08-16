"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

import { MOUSE } from "@/lib/layout";

import * as M from "./materials";

/**
 * The mouse.
 *
 * A hemisphere rather than a rounded box: a mouse is a dome with a flat bottom,
 * and that's exactly what a half sphere is. Scaling it non-uniformly gives the
 * long, low, slightly narrow shell without needing a modelled asset, and the
 * open flat side never shows because it's face down on the mat.
 *
 * The parts that make it read as a mouse rather than as a pebble are the panel
 * gaps — the split between the two buttons and the line across to the palm
 * rest. Those started life as thin boxes sunk into the shell, which failed for
 * a reason that's obvious in hindsight: a box is straight and the shell isn't,
 * so near the flanks the dome falls away and the box stands proud of it as a
 * black rectangle floating above the mouse.
 *
 * Drawn into the shell's texture instead. A sphere's UVs run u around the
 * azimuth and v from pole to equator, so a seam is a straight line in texture
 * space no matter how curved it is in world space — which is the whole reason
 * to put it there.
 */

/**
 * Where the front of the mouse lands in UV.
 *
 * three lays out a sphere with u = 0 at −X, 0.25 at +Z, 0.5 at +X and 0.75 at
 * −Z, and the nose of the mouse points at −Z, away from the seat.
 */
const NOSE_U = 0.75;
/** How far down the dome the buttons reach, as a fraction of pole-to-equator. */
const BUTTON_V = 0.52;

function shellTexture(): CanvasTexture {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Flanks, at ±X. Slightly darker: a rubberised grip panel, which is a
  // material change with no shape change — most of what makes a moulded
  // product look moulded.
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, H * 0.45, W * 0.05, H * 0.55);
  ctx.fillRect(W * 0.45, H * 0.45, W * 0.1, H * 0.55);
  ctx.fillRect(W * 0.95, H * 0.45, W * 0.05, H * 0.55);

  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = W * 0.004;

  // Split between the two buttons, running from the top of the dome forward.
  ctx.beginPath();
  ctx.moveTo(NOSE_U * W, 0);
  ctx.lineTo(NOSE_U * W, BUTTON_V * H);
  ctx.stroke();

  // The line across, separating both buttons from the palm rest. Only across
  // the front half of the shell, which is where the buttons are.
  ctx.beginPath();
  ctx.moveTo(W * 0.5, BUTTON_V * H);
  ctx.lineTo(W, BUTTON_V * H);
  ctx.stroke();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

export function Mouse({ top }: { top: number }) {
  const shell = useMemo(() => shellTexture(), []);
  useEffect(() => () => shell.dispose(), [shell]);

  return (
    <group position={[MOUSE.x, top, MOUSE.z]}>
      {/*
        Shell. The texture is a greyscale mask multiplied by the material
        colour, so the seams darken the shell rather than replacing its
        material — the whole thing stays one piece of plastic.
      */}
      <mesh scale={[MOUSE.w / 2, MOUSE.h, MOUSE.d / 2]} castShadow receiveShadow>
        <sphereGeometry args={[1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...M.MOUSE_SHELL} map={shell} />
      </mesh>

      {/* A thin base disc, so the shell doesn't read as hollow from the side. */}
      <mesh position={[0, 0.0015, 0]} scale={[MOUSE.w / 2, 1, MOUSE.d / 2]}>
        <cylinderGeometry args={[0.995, 0.995, 0.003, 40]} />
        <meshStandardMaterial {...M.SOFT_PLASTIC} />
      </mesh>

      {/*
        Scroll wheel, sitting proud in the split between the buttons.
        Positioned where the dome is still about nine tenths of full height, so
        it clears the shell by a couple of millimetres the way a real one does.
      */}
      <mesh
        position={[0, MOUSE.h * 0.9, -MOUSE.d * 0.19]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0058, 0.0058, 0.0052, 20]} />
        <meshStandardMaterial {...M.WHEEL} />
      </mesh>

      {/* Status light on the tail — the one saturated pixel on the object. */}
      <mesh position={[0, MOUSE.h * 0.5, MOUSE.d * 0.36]}>
        <sphereGeometry args={[0.0022, 10, 10]} />
        <meshBasicMaterial color={M.ACCENT_HEX} toneMapped={false} />
      </mesh>
    </group>
  );
}
