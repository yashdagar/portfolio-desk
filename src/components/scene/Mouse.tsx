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

  /*
   * Grip panels on the flanks, and only just.
   *
   * These were solid grey blocks covering half the height of the shell. From
   * the seat you look at this mouse almost end-on, so those two blocks landed
   * on the left and right of the silhouette and turned it into a shaded onion —
   * the exact opposite of the "moulded from several parts" read they were
   * supposed to give. Barely-there is the right amount here.
   */
  ctx.fillStyle = "rgba(176,171,164,0.35)";
  ctx.fillRect(0, H * 0.62, W * 0.035, H * 0.38);
  ctx.fillRect(W * 0.465, H * 0.62, W * 0.07, H * 0.38);
  ctx.fillRect(W * 0.965, H * 0.62, W * 0.035, H * 0.38);

  /*
   * The seams, drawn as a dark line with a light one beside it.
   *
   * On the old dark shell a single dark line was plenty. On a white one it
   * vanished: a 2-pixel grey line on a bright diffuse surface is gone the
   * moment any light falls on it. A real panel gap on a white product doesn't
   * read as a dark line either — it reads as a dark line with a lit edge above
   * it, because the lip on the far side catches light the recess doesn't. Two
   * strokes, and the gap has depth.
   */
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

  // The line across, separating both buttons from the palm rest. Only across
  // the front half of the shell, which is where the buttons are.
  seam(W * 0.5, BUTTON_V * H, W, BUTTON_V * H, 0, H * 0.012);

  // A whisper of contact shading right at the bottom edge, and nothing higher.
  // Painted shading up the sides fights the actual lighting and wins, which is
  // how a white object ends up looking like it's made of two different whites.
  const shade = ctx.createLinearGradient(0, H * 0.86, 0, H);
  shade.addColorStop(0, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(130,126,120,0.3)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, H * 0.86, W, H * 0.14);

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
 * The shell, sculpted out of a hemisphere.
 *
 * A plain scaled half-sphere is symmetric front to back, so its crown lands
 * exactly in the middle — and a mouse whose highest point is halfway along
 * reads as an egg. Every real one peaks under the heel of your palm, about two
 * thirds of the way back, and falls to a low narrow nose so the buttons sit
 * under your fingertips rather than on a ridge.
 *
 * Two profile curves applied per vertex: one for height, one for width. Cheaper
 * and more controllable than modelling it, and the UVs survive untouched, which
 * matters because the button seams are drawn in texture space.
 */
function shellGeometry(): SphereGeometry {
  const geo = new SphereGeometry(1, 48, 26, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // 0 at the nose (−Z, pointing away from the seat), 1 at the tail.
    const t = (z + 1) / 2;

    // Rises quickly out of the nose, crowns around two thirds back, then eases
    // down over the tail.
    const height =
      0.5 + 0.5 * smoothstep(0, 0.66, t) - 0.16 * smoothstep(0.78, 1, t);
    // Narrow at the nose, widest at the waist where your thumb and ring finger
    // sit, tucked back in at the tail.
    const width =
      0.66 + 0.34 * smoothstep(0, 0.42, t) - 0.14 * smoothstep(0.68, 1, t);

    pos.setXYZ(i, x * width, y * height, z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
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
    <group position={[MOUSE.x, top, MOUSE.z]}>
      {/*
        Shell. The texture is a greyscale mask multiplied by the material
        colour, so the seams darken the shell rather than replacing its
        material — the whole thing stays one piece of plastic.
      */}
      <mesh
        geometry={body}
        scale={[MOUSE.w / 2, MOUSE.h, MOUSE.d / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...M.MOUSE_SHELL} map={shell} />
      </mesh>

      {/*
        Base. Darker than the shell and slightly inset, so the mouse reads as
        two mouldings clipped together rather than as one solid lump — and so
        there's a dark line at the bottom separating it from the mat it's
        sitting on.
      */}
      <mesh position={[0, 0.002, 0]} scale={[MOUSE.w / 2, 1, MOUSE.d / 2]}>
        <cylinderGeometry args={[0.9, 0.9, 0.004, 44]} />
        <meshStandardMaterial {...M.GRIP} />
      </mesh>

      {/*
        The wheel sits in a slot, not on the surface.

        A cylinder resting on the dome reads as a bead stuck to the mouse. The
        recess under it — a dark box sunk into the shell, only its opening
        showing — is what makes the wheel look like it goes somewhere, and it's
        the detail the eye uses to find the front of the object.
      */}
      <mesh position={[0, MOUSE.h * 0.83, -MOUSE.d * 0.19]}>
        <boxGeometry args={[0.0095, 0.008, 0.017]} />
        <meshStandardMaterial {...M.PANEL_GAP} />
      </mesh>
      <mesh
        position={[0, MOUSE.h * 0.87, -MOUSE.d * 0.19]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0062, 0.0062, 0.0055, 24]} />
        <meshStandardMaterial {...M.WHEEL} />
      </mesh>
      {/* Knurling: three rings, which at this size is all that's needed to say
          the wheel is grippy rather than smooth. */}
      {[-0.0018, 0, 0.0018].map((dx) => (
        <mesh
          key={dx}
          position={[dx, MOUSE.h * 0.87, -MOUSE.d * 0.19]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.0064, 0.0064, 0.0006, 24]} />
          <meshStandardMaterial {...M.PANEL_GAP} />
        </mesh>
      ))}

      {/* Status light on the tail — the one saturated pixel on the object. */}
      <mesh position={[0, MOUSE.h * 0.5, MOUSE.d * 0.36]}>
        <sphereGeometry args={[0.0022, 10, 10]} />
        <meshBasicMaterial color={M.ACCENT_HEX} toneMapped={false} />
      </mesh>
    </group>
  );
}
