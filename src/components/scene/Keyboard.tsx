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

import { roundedRectShape } from "./geometry";
import * as M from "./materials";

/**
 * A 65% keyboard, built from the keycap pitch outward.
 *
 * The previous version was a rounded black slab, which is what a keyboard looks
 * like from ten metres away and nothing like one from the seat. Keys are the
 * detail people check, because everyone has spent thousands of hours looking at
 * a keyboard and knows exactly how big a key is and how the light sits on its
 * edge.
 *
 * Two things carry it:
 *
 * - **Bevels.** Each cap is an extruded rounded rectangle with a real bevel, so
 *   the top edge catches a thin highlight from the lamp. That highlight is the
 *   entire difference between a grid of caps and a grid of boxes; a chamfer of
 *   under a millimetre does more here than any texture would.
 * - **Legends.** One canvas texture covering the whole key field, floated a
 *   fraction above the caps. Printing them per-cap would mean an atlas and
 *   custom UVs on instanced geometry; one aligned plane gets the same result
 *   for one extra draw call, and the legends land in exactly the right place
 *   because both the caps and the canvas are laid out from the same table.
 */

interface Key {
  /** Primary legend. Empty renders a blank cap. */
  label: string;
  /** Shifted legend, printed above the primary on the number row. */
  shift?: string;
  /** Width in units. Defaults to 1. */
  w?: number;
  /** Accent-coloured cap. */
  accent?: boolean;
}

/**
 * Rows are 16 units wide each. That constraint is what makes a keyboard layout
 * look right — real boards are built on it, and a row that's a quarter unit out
 * reads as wrong without the viewer being able to say why.
 */
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
    { label: "↑", accent: true },
    { label: "end" },
  ],
  [
    { label: "ctrl", w: 1.25 },
    { label: "opt", w: 1.25 },
    { label: "cmd", w: 1.25 },
    { label: "", w: 6.25 },
    { label: "cmd" },
    { label: "opt" },
    { label: "fn" },
    { label: "←", accent: true },
    { label: "↓", accent: true },
    { label: "→", accent: true },
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

const BEVEL = 0.0011;

/**
 * One keycap.
 *
 * Built per width rather than scaling a single cap, because a non-uniform scale
 * stretches the fillet and the bevel with it — a spacebar would end up with
 * corners six times rounder than a letter key, which is exactly the kind of
 * thing that reads as "3D scene" rather than as "keyboard".
 */
function capGeometry(units: number): BufferGeometry {
  const w = units * KEYBOARD.unit - KEYBOARD.gap;
  const d = KEYBOARD.unit - KEYBOARD.gap;
  const geo = new ExtrudeGeometry(roundedRectShape(w, d, 0.0016), {
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

/**
 * Every legend on one canvas, laid out from the same table as the caps.
 *
 * Drawn at roughly 6700 px per metre, which is about 128 px across a single
 * keycap — enough that the legends are still crisp when the camera leans in and
 * a key is a couple of centimetres on screen.
 */
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

    ctx.fillStyle = key.accent ? "#0b1416" : "#cfd6d8";

    if (key.shift) {
      // Two-line legend: shifted symbol above, base below. This is the detail
      // that stops the number row reading as a row of single characters.
      ctx.font = `600 ${pxPerUnit * 0.3}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(key.shift, cx, cy - pxPerUnit * 0.17);
      ctx.fillText(key.label, cx, cy + pxPerUnit * 0.17);
      continue;
    }

    if (wide || key.label.length > 1) {
      // Word legends sit small and left-ish on real caps; centred reads cleaner
      // at this size and keeps the canvas layout trivially correct.
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

  return (
    <group
      position={[KEYBOARD.x, 0, KEYBOARD.z]}
      // Tilted back, the way every board with feet under its top edge sits.
      rotation={[-KEYBOARD.tilt, 0, 0]}
    >
      {/* Case. Anodised aluminium, so the lamp draws a line down its long edge. */}
      <mesh position={[0, KEYBOARD.caseHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[caseW, KEYBOARD.caseHeight, caseD]} />
        <meshStandardMaterial {...M.KEYBOARD_CASE} />
      </mesh>

      {/*
        Plate: a hair darker and inset, so the caps read as sitting *in* the case
        rather than balanced on top of it. The dark rim around a key field is a
        surprisingly large part of why a keyboard looks like one.
      */}
      <mesh position={[0, KEYBOARD.caseHeight - 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_W + 0.003, FIELD_D + 0.003]} />
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
                position={[k.x, KEYBOARD.caseHeight, k.z]}
                color={k.accent ? M.ACCENT_HEX : M.KEYCAP.color}
              />
            ))}
          </Instances>
        );
      })}

      {/*
        The legends, floating a fifth of a millimetre above the caps.

        Coplanar with the cap tops it z-fights; any further and the print
        detaches visibly at this viewing angle. depthWrite off so the plane
        doesn't occlude the caps it sits on where it's transparent.
      */}
      <mesh
        position={[0, KEYBOARD.caseHeight + KEYBOARD.capHeight + 0.0002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[FIELD_W, FIELD_D]} />
        <meshBasicMaterial map={legends} transparent depthWrite={false} />
      </mesh>

      {/* Rear feet, so the tilt has something holding it up. */}
      {[-caseW / 2 + 0.02, caseW / 2 - 0.02].map((x) => (
        <mesh key={x} position={[x, 0.002, -caseD / 2 + 0.012]}>
          <cylinderGeometry args={[0.005, 0.005, 0.004, 10]} />
          <meshStandardMaterial {...M.POWDER_COAT} />
        </mesh>
      ))}
    </group>
  );
}
