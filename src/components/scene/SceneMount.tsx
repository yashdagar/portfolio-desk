"use client";

import dynamic from "next/dynamic";

import type { ActivityFeed } from "@/lib/activity";
import { useCapabilities } from "@/lib/capabilities";

/**
 * Chooses how much of the room to serve, and never loads three.js if the answer
 * is "none".
 *
 * The dynamic import matters as much as the branch does: `ssr: false` is only
 * legal inside a Client Component, and keeping the import inside this file
 * means a phone on a slow connection never downloads half a megabyte of
 * renderer it was never going to use.
 */
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
});

export function SceneMount({
  children,
  activity,
}: {
  children: React.ReactNode;
  activity: ActivityFeed | null;
}) {
  const { mode, ready } = useCapabilities();

  // Before measuring, render the flat content. It's server-rendered anyway, so
  // this is what's already on screen — swapping to it would be a flash, and
  // rendering nothing would be a blank first paint.
  if (!ready || mode === "flat") {
    return <>{children}</>;
  }

  if (mode === "hero") {
    return (
      <>
        {/*
          Phones get the room as a header and the content as ordinary scrollable
          DOM. There's no hover and no mouse-look on a touch screen, which are
          the two things the seated camera is built around, and inventing a
          touch control scheme nobody asked for would serve the concept at the
          expense of the visitor.
        */}
        <div className="pointer-events-none relative h-[46vh] max-h-[420px] w-full overflow-hidden">
          <Scene hero activity={activity} />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-graphite to-transparent" />
        </div>
        <div className="-mt-8">{children}</div>
      </>
    );
  }

  /*
   * The wrapper's definite height is load-bearing.
   *
   * R3F sizes its canvas container with `height: 100%`, which resolves to zero
   * against a parent that only has `min-height`. The page needs min-height so
   * the flat mode can scroll, so scene mode supplies its own fixed-height box —
   * without it the canvas silently renders 150px tall and the room looks like a
   * blank page.
   */
  return (
    <div className="h-dvh w-full overflow-hidden">
      <Scene activity={activity} />
    </div>
  );
}
