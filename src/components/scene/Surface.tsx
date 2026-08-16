"use client";

import { Html } from "@react-three/drei";
import type { ReactNode } from "react";

/**
 * Mount real DOM onto a plane in the scene.
 *
 * This is the load-bearing trick of the whole project. The screens are not
 * textures — they're React components rendered as HTML and transformed into 3D,
 * so the commit feed is selectable text with working links that a screen reader
 * can walk and a crawler can index, while still being physically mounted on a
 * monitor in a room.
 *
 * Pointer events are off unless the surface is focused. Otherwise the DOM would
 * swallow the click meant for the mesh behind it, and there'd be no way to
 * focus a screen by clicking it — you'd be clicking the webpage stuck to it.
 */

/**
 * CSS pixels per world unit in drei's `transform` mode.
 *
 * Not 1:1, which is the obvious guess and wrong by this whole factor. drei
 * derives it from `distanceFactor`, which defaults to 10:
 *
 *   ratio = (distanceFactor || 10) / 400   // = 0.025
 *   worldWidth = element.clientWidth * ratio * groupScale
 *
 * so a div of N pixels spans N/40 world units at scale 1 — confirmed by both
 * the occlusion-mesh sizing and the inner CSS matrix, which is built with
 * `1 / ((distanceFactor || 10) / 400)` = 40. Getting this wrong renders every
 * screen either as a few-pixel speck or as text sprawling across the room.
 */
const PX_PER_WORLD_UNIT = 40;
export function Surface({
  designW,
  designH,
  worldW,
  focused,
  radiusPx = 0,
  children,
  ...group
}: {
  designW: number;
  designH: number;
  worldW: number;
  focused: boolean;
  /**
   * Corner radius of the thing this is mounted on, in design pixels.
   *
   * Belongs here rather than on each screen component. The mount is what knows
   * it's stuck to a rounded object, and leaving it to the children means every
   * new surface starts life with square corners overhanging a filleted bezel
   * until someone notices.
   */
  radiusPx?: number;
  children: ReactNode;
} & React.ComponentProps<"group">) {
  return (
    <group {...group}>
      <Html
        transform
        // Depth-buffer occlusion rather than raycast: a held box passes in
        // front of the monitors, and raycast occlusion of a full-screen DOM
        // node costs a ray per frame per surface.
        occlude="blending"
        /*
          drei defaults this to [16777271, 0] and its wrapper spans the whole
          viewport, so at the default any UI over the canvas is buried under a
          transparent div seven million layers up. Capped low enough for normal
          page chrome to sit above it, and still wide enough for drei to depth
          sort the handful of surfaces in the scene against each other.
        */
        zIndexRange={[40, 0]}
        scale={(worldW * PX_PER_WORLD_UNIT) / designW}
        // Slightly forward of the plane it sits on, or it z-fights with it.
        position={[0, 0, 0.001]}
      >
        {/*
          The size lives on a wrapper we own rather than on Html's `style`.
          Passing it to Html leaves the child sizing itself, so a screen built
          with `h-full` collapses to nothing and renders as a speck.
        */}
        <div
          /*
           * Unfocused surfaces are inert.
           *
           * Without this, tabbing from the top of the page walks straight into
           * every link on every screen — a hundred and twenty commit links
           * before you reach the contact details — while the camera is still
           * sitting back and none of them are legible. Inert keeps tab order
           * matching what's actually being read.
           */
          inert={!focused}
          style={{
            width: designW,
            height: designH,
            borderRadius: radiusPx,
            overflow: "hidden",
            pointerEvents: focused ? "auto" : "none",
            userSelect: focused ? "auto" : "none",
          }}
        >
          {children}
        </div>
      </Html>
    </group>
  );
}
