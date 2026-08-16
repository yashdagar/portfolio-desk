"use client";

import { Html } from "@react-three/drei";
import type { ReactNode } from "react";

/**
 * Mount real DOM onto a plane: the screens are React components transformed
 * into 3D, so the commit feed is selectable text with working links a screen
 * reader can walk, while physically mounted on a monitor.
 */

/**
 * CSS pixels per world unit in drei's `transform` mode. Not 1:1 — drei derives
 * it from `distanceFactor` (default 10) as `(distanceFactor || 10) / 400`, so a
 * div of N pixels spans N/40 world units at scale 1.
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
  /** Corner radius of the thing this is mounted on, in design pixels. Here
   *  rather than on each screen, which would start life square-cornered. */
  radiusPx?: number;
  children: ReactNode;
} & React.ComponentProps<"group">) {
  return (
    <group {...group}>
      <Html
        transform
        /*
          drei's own wrapper divs, not just ours: setting pointer-events on the
          div below leaves the transform wrappers hit-testable, so a click over
          an unfocused screen lands on a div and R3F measures it from that div's
          corner. See the `eventPrefix` note on the canvas for the other half.
        */
        pointerEvents={focused ? "auto" : "none"}
        // Depth-buffer rather than raycast, which costs a ray per frame each.
        occlude="blending"
        // drei defaults to [16777271, 0] over a viewport-spanning wrapper, which
        // buries all page chrome under a transparent div seven million layers up.
        zIndexRange={[40, 0]}
        scale={(worldW * PX_PER_WORLD_UNIT) / designW}
        // Slightly forward of the plane it sits on, or it z-fights with it.
        position={[0, 0, 0.001]}
      >
        {/* Size on a wrapper we own: passed to Html the child sizes itself, and
            a screen built with `h-full` collapses to a speck. */}
        <div
          // Or tabbing walks into a hundred and twenty commit links before
          // reaching the contact details, none of them legible from rest.
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
