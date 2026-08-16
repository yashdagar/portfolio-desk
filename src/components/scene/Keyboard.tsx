"use client";

import { Instance, Instances } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  ExtrudeGeometry,
  LinearFilter,
  SRGBColorSpace,
  type BufferGeometry,
} from "three";

import { KEYBOARD } from "@/lib/layout";

import { roundedFrame, roundedPlate, roundedRectShape } from "./geometry";
import * as M from "./materials";

/**
 * A 65% keyboard, built from the keycap pitch outward.
 *
 * Legends are one canvas covering the whole key field, floated above the caps.
 * Per-cap printing would need an atlas and custom UVs on instanced geometry;
 * one aligned plane costs a draw call and lands correctly because the caps and
 * the canvas are laid out from the same table.
 */

interface Key {
  /** Primary legend. Empty renders a blank cap. */
  label: string;
  /** Shifted legend, printed above the primary on the number row. */
  shift?: string;
  /** Width in units. Defaults to 1. */
  w?: number;
  /** Picked out in powder blue: space and enter only. */
  accent?: boolean;
}

/** Every row is exactly 16 units wide. A row a quarter unit out reads as wrong
 *  without the viewer being able to say why. */
const ROWS: Key[][] = [
  [
    { label: "`", shift: "~" },
    { label: "1", shift: "!" },
    { label: "2", shift: "@" },
    { label: "3", shift: "#" },
    { label: "4", shift: "$" },
    { label: "5", shift: "%" },
    { label: "6", shift: "^" },
    { label: "7", shift: "&" },
    { label: "8", shift: "*" },
    { label: "9", shift: "(" },
    { label: "0", shift: ")" },
    { label: "-", shift: "_" },
    { label: "=", shift: "+" },
    { label: "delete", w: 2 },
    { label: "del" },
  ],
  [
    { label: "tab", w: 1.5 },
    { label: "Q" },
    { label: "W" },
    { label: "E" },
    { label: "R" },
    { label: "T" },
    { label: "Y" },
    { label: "U" },
    { label: "I" },
    { label: "O" },
    { label: "P" },
    { label: "[", shift: "{" },
    { label: "]", shift: "}" },
    { label: "\\", shift: "|", w: 1.5 },
    { label: "pg↑" },
  ],
  [
    { label: "caps", w: 1.75 },
    { label: "A" },
    { label: "S" },
    { label: "D" },
    { label: "F" },
    { label: "G" },
    { label: "H" },
    { label: "J" },
    { label: "K" },
    { label: "L" },
    { label: ";", shift: ":" },
    { label: "'", shift: '"' },
    { label: "return", w: 2.25, accent: true },
    { label: "pg↓" },
  ],
  [
    { label: "shift", w: 2.25 },
    { label: "Z" },
    { label: "X" },
    { label: "C" },
    { label: "V" },
    { label: "B" },
    { label: "N" },
    { label: "M" },
    { label: ",", shift: "<" },
    { label: ".", shift: ">" },
    { label: "/", shift: "?" },
    { label: "shift", w: 1.75 },
    { label: "↑" },
    { label: "end" },
  ],
  [
    { label: "ctrl", w: 1.25 },
    { label: "opt", w: 1.25 },
    { label: "cmd", w: 1.25 },
    { label: "", w: 6.25, accent: true },
    { label: "cmd" },
    { label: "opt" },
    { label: "fn" },
    { label: "←" },
    { label: "↓" },
    { label: "→" },
  ],
];

const UNITS_WIDE = 16;
const FIELD_W = UNITS_WIDE * KEYBOARD.unit;
const FIELD_D = ROWS.length * KEYBOARD.unit;

/** A key with its resolved position, in metres, relative to the field centre. */
interface Placed extends Key {
  units: number;
  /** Centre of the cap. */
  x: number;
  z: number;
  /** 0..1 across the field, for the legend canvas. */
  u: number;
  v: number;
}

const PLACED: Placed[] = ROWS.flatMap((row, r) => {
  let cursor = 0;
  return row.map((key) => {
    const units = key.w ?? 1;
    const centre = cursor + units / 2;
    cursor += units;
    return {
      ...key,
      units,
      x: (centre - UNITS_WIDE / 2) * KEYBOARD.unit,
      z: (r + 0.5 - ROWS.length / 2) * KEYBOARD.unit,
      u: centre / UNITS_WIDE,
      v: (r + 0.5) / ROWS.length,
    };
  });
});

/** Distinct cap widths, so each gets geometry with an undistorted bevel. */
const WIDTHS = [...new Set(PLACED.map((k) => k.units))].sort((a, b) => a - b);

/** Catches the highlight along each cap's top edge, which is the difference
 *  between a keyboard and a grid of little boxes. */
const BEVEL = 0.0016;

/**
 * Per width rather than scaling one cap: a non-uniform scale stretches the
 * fillet with it, and the spacebar ends up six times rounder than a letter key.
 */
function capGeometry(units: number): BufferGeometry {
  const w = units * KEYBOARD.unit - KEYBOARD.gap;
  const d = KEYBOARD.unit - KEYBOARD.gap;
  const geo = new ExtrudeGeometry(roundedRectShape(w, d, 0.0034), {
    depth: KEYBOARD.capHeight - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: 0.0009,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 3,
  });
  // Extrusion runs along +Z; the board needs it along +Y, with the cap's base
  // sitting exactly at the origin so the plate height is easy to reason about.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, BEVEL, 0);
  geo.computeVertexNormals();
  return geo;
}

/** About 128 px across a keycap, so legends stay crisp when the camera leans in. */
function legendTexture(): CanvasTexture {
  const W = 2048;
  const H = Math.round(W * (FIELD_D / FIELD_W));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const pxPerUnit = W / UNITS_WIDE;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const key of PLACED) {
    if (!key.label) continue;
    const cx = key.u * W;
    const cy = key.v * H;
    const wide = key.units > 1.5;

    ctx.fillStyle = key.accent ? "#1c3a49" : "#3a3e42";

    if (key.shift) {
      ctx.font = `600 ${pxPerUnit * 0.3}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(key.shift, cx, cy - pxPerUnit * 0.17);
      ctx.fillText(key.label, cx, cy + pxPerUnit * 0.17);
      continue;
    }

    if (wide || key.label.length > 1) {
      ctx.font = `500 ${pxPerUnit * 0.26}px ui-sans-serif, system-ui, sans-serif`;
    } else {
      ctx.font = `600 ${pxPerUnit * 0.38}px ui-sans-serif, system-ui, sans-serif`;
    }
    ctx.fillText(key.label, cx, cy);
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

export function Keyboard() {
  const geometries = useMemo(
    () => new Map(WIDTHS.map((w) => [w, capGeometry(w)] as const)),
    [],
  );
  const legends = useMemo(() => legendTexture(), []);

  useEffect(() => {
    const geos = [...geometries.values()];
    return () => {
      geos.forEach((g) => g.dispose());
      legends.dispose();
    };
  }, [geometries, legends]);

  const caseW = FIELD_W + KEYBOARD.border * 2;
  const caseD = FIELD_D + KEYBOARD.border * 2;

  const tray = useMemo(
    () =>
      roundedFrame(
        caseW,
        caseD,
        0.006,
        FIELD_W + 0.004,
        FIELD_D + 0.004,
        0.003,
        KEYBOARD.caseHeight,
      ),
    [caseW, caseD],
  );
  /*
   * Deliberately a whisker smaller than the tray. At the same footprint the two
   * share their outer walls exactly, and the depth buffer has no way to order
   * two coincident surfaces — the case edges broke into a flickering band that
   * read as light leaking out of the keyboard.
   */
  const base = useMemo(
    () =>
      roundedPlate(
        caseW - 0.001,
        caseD - 0.001,
        0.0055,
        KEYBOARD.plateY - 0.0004,
      ),
    [caseW, caseD],
  );

  useEffect(() => {
    return () => {
      tray.dispose();
      base.dispose();
    };
  }, [tray, base]);

  return (
    <group
      position={[KEYBOARD.x, 0, KEYBOARD.z]}
      // Tilted back, the way every board with feet under its top edge sits.
      rotation={[-KEYBOARD.tilt, 0, 0]}
    >
      {/*
        A tray rather than a slab, because a keyboard reads as one partly through
        its keys sitting down inside something with a rim rising past them.

        One extruded frame rather than four rails: extruding a shape with a hole
        in it gives the inner walls for free and skips four mitred corners.
      */}
      <mesh geometry={tray} castShadow receiveShadow>
        <meshStandardMaterial {...M.KEYBOARD_CASE} />
      </mesh>

      {/* The underside, closing the tray off. */}
      <mesh geometry={base} castShadow receiveShadow>
        <meshStandardMaterial {...M.KEYBOARD_CASE} />
      </mesh>

      {/* The only thing separating one white cap from the next. */}
      <mesh position={[0, KEYBOARD.plateY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_W + 0.004, FIELD_D + 0.004]} />
        <meshStandardMaterial {...M.KEYBOARD_PLATE} />
      </mesh>

      {WIDTHS.map((units) => {
        const keys = PLACED.filter((k) => k.units === units);
        return (
          <Instances
            key={units}
            geometry={geometries.get(units)}
            limit={keys.length}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.KEYCAP} />
            {keys.map((k, i) => (
              <Instance
                key={i}
                position={[k.x, KEYBOARD.plateY, k.z]}
                color={k.accent ? M.KEY_ACCENT : M.KEYCAP.color}
              />
            ))}
          </Instances>
        );
      })}

      {/* A fifth of a millimetre above the caps: coplanar it z-fights, further
          and the print visibly detaches. depthWrite off, or the transparent
          parts of the plane occlude the caps under them. */}
      <mesh
        position={[0, KEYBOARD.plateY + KEYBOARD.capHeight + 0.0002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[FIELD_W, FIELD_D]} />
        <meshBasicMaterial map={legends} transparent depthWrite={false} />
      </mesh>

      {/* Rear feet, so the tilt has something holding it up. */}
      {[-caseW / 2 + 0.02, caseW / 2 - 0.02].map((x) => (
        <mesh key={x} position={[x, -0.002, -caseD / 2 + 0.012]}>
          <cylinderGeometry args={[0.005, 0.005, 0.004, 10]} />
          <meshStandardMaterial {...M.POWDER_COAT} />
        </mesh>
      ))}
    </group>
  );
}
