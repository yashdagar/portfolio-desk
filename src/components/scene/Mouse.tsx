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

/**
 * Where the wheel sits along the shell, in the sphere's own z: −1 is the nose,
 * +1 the tail. Just forward of the crown, under where a fingertip lands.
 */
const WHEEL_ZN = -0.42;
/** Wheel radius, in metres. Real wheels are around 16 mm across. */
const WHEEL_R = 0.008;

/**
 * The wheel's slot, in UV rather than in geometry.
 *
 * A box sunk into the dome was the obvious way to cut a recess and it's the
 * same mistake the button seams already made once: a box is straight, the dome
 * isn't, so the ends of the slot lift off the surface. Painting it means the
 * slot follows the curvature exactly, for free.
 *
 * The placement is derived, not guessed. A point on the unit hemisphere at
 * z = zn on the nose meridian sits at polar angle asin(|zn|) from the top, and
 * the sphere's v runs 0 at the pole to 1 at the equator over a quarter turn —
 * so the latitude falls straight out of the wheel's position. The width has to
 * come the same way, because u is azimuth: near the top of the dome the rings
 * are small, so a 11 mm-wide slot wraps a surprisingly large angle and covers
 * far more of the texture than it does of the mouse.
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

  /*
   * Grip panels on the flanks, and only just.
   *
   * These were solid grey blocks covering half the height of the shell, and
   * once the mouse was turned off square one of them swung into view as exactly
   * what it was: a grey rectangle stuck to the side. A flat fill has a hard top
   * edge, and a hard horizontal edge on a curved surface is the signature of a
   * sticker — it doesn't follow the form, so the eye reads it as sitting on top
   * of the object rather than being part of it.
   *
   * Faded up from nothing instead. The panel still darkens the flanks where a
   * grip would be, and has no edge anywhere for the eye to catch.
   */
  const grip = ctx.createLinearGradient(0, H * 0.6, 0, H);
  grip.addColorStop(0, "rgba(176,171,164,0)");
  grip.addColorStop(1, "rgba(176,171,164,0.3)");
  ctx.fillStyle = grip;
  ctx.fillRect(0, H * 0.6, W * 0.035, H * 0.4);
  ctx.fillRect(W * 0.465, H * 0.6, W * 0.07, H * 0.4);
  ctx.fillRect(W * 0.965, H * 0.6, W * 0.035, H * 0.4);

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

  /*
   * The wheel's slot: one dark, round-ended trough, and nothing beside it.
   *
   * The seams each get a lit lip drawn alongside, and the slot had one too
   * until it turned out to be the single most visible defect on the object —
   * near the top of the dome the rings are tiny, so this shape covers about a
   * seventh of the texture's width, and a pale rounded rectangle that large
   * lands on the flank as a grey sticker. The dark trough alone reads as a
   * recess; the highlight the lip was faking is one the lighting already gives.
   */
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

  // A whisper of contact shading right at the bottom edge, and nothing higher.
  // Painted shading up the sides fights the actual lighting and wins, which is
  // how a white object ends up looking like it's made of two different whites.
  const shade = ctx.createLinearGradient(0, H * 0.86, 0, H);
  shade.addColorStop(0, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(130,126,120,0.3)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, H * 0.86, W, H * 0.14);

  /*
   * The parting line where the top shell meets the base, all the way round.
   *
   * From the seat you are looking at the *back* of this mouse, which is the one
   * face with no buttons, no wheel and no seams on it — so without this the
   * silhouette is an unbroken dome and the object reads as an egg. A single
   * dark line following the bottom edge is what says "two mouldings", and it's
   * visible from every angle, which is exactly what the features on the front
   * are not.
   *
   * Painted rather than modelled for the usual reason: a ring of geometry at a
   * fixed radius would sink into the shell at the waist and stand proud of it
   * at the nose, because the shell's width varies along its length and a
   * cylinder's doesn't.
   *
   * Filled rather than stroked, and kept clear of the very bottom edge. Down at
   * v = 0.95 the shell is nearly edge-on to the camera and a thin line sampled
   * there breaks into dashes; a band a little higher up survives the
   * compression.
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

/**
 * Rises quickly out of the nose, crowns around two thirds back, then eases down
 * over the tail. `t` is 0 at the nose and 1 at the tail.
 *
 * Pulled out of the geometry loop because the wheel needs it too: the whole
 * point of a scroll wheel is that it sits *in* the shell, and the only way to
 * know where the shell is at the wheel's position is to ask the same curve that
 * put it there.
 */
const heightAt = (t: number) =>
  0.5 + 0.5 * smoothstep(0, 0.62, t) - 0.34 * smoothstep(0.68, 1, t);

/**
 * Narrow at the nose, widest at the waist where your thumb and ring finger sit,
 * tucked back in at the tail.
 */
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

/**
 * The wheel: a short knurled cylinder sunk into the shell.
 *
 * Only the crown of it clears the plastic — a millimetre and a half, which is
 * genuinely all you see of a real one. The rest is inside the mouse, where the
 * closed dome hides it, so the wheel needs no modelled housing: the shell *is*
 * the housing.
 */
function Wheel() {
  /** The wheel's centre, in metres along the mouse's own length. */
  const z = (WHEEL_ZN * MOUSE.d) / 2;
  /*
   * Height of the shell's surface directly above it.
   *
   * Both terms are needed and the first one is easy to forget. `heightAt` is a
   * *scale* applied to the sphere's own y, not a height — and the sphere's y at
   * this point is already below 1, because the wheel sits well forward of the
   * pole where the dome has started to fall away. Using the scale alone put the
   * axle two millimetres too high, which is the difference between a wheel in a
   * slot and a dark nub on the skyline.
   */
  const crown =
    MOUSE.h * Math.sqrt(1 - WHEEL_ZN ** 2) * heightAt((WHEEL_ZN + 1) / 2);
  /**
   * Drop the axle until only this much of the wheel stands proud.
   *
   * Under a millimetre, which is less than it sounds like it should be. The
   * wheel is on the far side of the mouse from the seat, so anything more than
   * this doesn't read as a wheel emerging from a slot — it reads as a dark nub
   * on the skyline, which is precisely the shape the old one had.
   */
  const proud = 0.0008;
  const y = crown + proud - WHEEL_R;

  return (
    <group position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.0062, 28]} />
        <meshStandardMaterial {...M.WHEEL} />
      </mesh>

      {/*
        Knurling, as three proud rings rather than a texture.

        At 1.5 mm of visible arc a printed pattern would be two pixels of noise;
        rings catch the light along their own edges instead, which survives
        being small in a way a map never does.
      */}
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
    /*
      Turned well off square, and it's not decoration.

      The camera *is* the person using this mouse, so a mouse set straight
      presents its tail — the one part with no buttons, no seams and no wheel on
      it — and everything that makes the object legible ends up on the far side.
      Twenty-six degrees is well within where a mouse actually ends up after an
      afternoon of being pushed around, and it swings the flank, the button
      split and the wheel slot into view.
    */
    <group position={[MOUSE.x, top, MOUSE.z]} rotation={[0, -0.46, 0]}>
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
        The wheel, buried in the shell with a millimetre of its arc showing.

        It used to hang a centimetre clear of the dome on a dark plinth, which
        from any angle read as a stalk growing out of the mouse — the single
        wrongest thing on the object, and the reason the whole shape came across
        as an egg with a stem.

        Its height isn't a hand-tuned number any more. The shell's own profile
        curve gives the surface height at the wheel's position, so the wheel is
        placed relative to the plastic it comes out of and stays put if the
        shell is ever resculpted. The slot it emerges from is painted into the
        texture, which is why nothing has to be modelled around it.
      */}
      <Wheel />

      {/*
        A status light, low on the flank rather than up on the palm.

        It used to sit in the middle of the tail, which from the seat is the
        dead centre of the shape — a single saturated dot in the middle of a
        pale dome doesn't read as an indicator, it reads as a laser pointer
        aimed back at you. Down near the parting line it's a glint at the
        object's edge, which is where these actually are.
      */}
      <mesh position={[MOUSE.w * 0.32, MOUSE.h * 0.16, MOUSE.d * 0.2]}>
        <sphereGeometry args={[0.0018, 10, 10]} />
        <meshBasicMaterial color={M.ACCENT_HEX} toneMapped={false} />
      </mesh>
    </group>
  );
}
