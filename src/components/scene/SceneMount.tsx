"use client";

import dynamic from "next/dynamic";

import type { ActivityFeed } from "@/lib/activity";
import { useCapabilities } from "@/lib/capabilities";
import { BOXES } from "@/lib/profile";
import { useScene } from "@/lib/store";

import { Hud } from "./Hud";

/**
 * Chooses how much of the room to serve, and never loads three.js if the answer
 * is "none". The dynamic import matters as much as the branch: `ssr: false` is
 * only legal in a Client Component, and keeping it here means a phone never
 * downloads half a megabyte of renderer it was never going to use.
 */
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
  // Without this the swap from flat to scene leaves a blank rectangle for as
  // long as three.js takes to fetch and parse, which looks like a failure.
  loading: () => <Booting />,
});

/** The same shape as the thing arriving, so the load reads as the room
 *  assembling rather than as a spinner standing in for it. */
function Booting() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-graphite">
      <div className="flex items-end gap-3" aria-label="Loading the room">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 w-28 rounded-sm bg-screen-raised"
            style={{
              animation: `boot 1.6s ease-in-out ${i * 180}ms infinite alternate`,
            }}
          />
        ))}
      </div>
      <style>{`@keyframes boot {
        from { opacity: .25 }
        to   { opacity: .8; background: #16303a }
      }`}</style>
    </div>
  );
}

export function SceneMount({
  children,
  activity,
}: {
  children: React.ReactNode;
  activity: ActivityFeed | null;
}) {
  const { mode, ready } = useCapabilities();
  const forceFlat = useScene((s) => s.forceFlat);

  // Before measuring, render the flat content. It's server-rendered anyway, so
  // this is what's already on screen — swapping to it would be a flash, and
  // rendering nothing would be a blank first paint.
  if (!ready || mode === "flat" || forceFlat) {
    return <>{children}</>;
  }

  if (mode === "hero") {
    return (
      <>
        {/* Phones get the room as a header and the content as scrollable DOM:
            no hover and no mouse-look, which the seated camera is built on. */}
        <div className="pointer-events-none relative h-[46vh] max-h-[420px] w-full overflow-hidden">
          <Scene hero activity={activity} />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-graphite to-transparent" />
        </div>
        <div className="-mt-8">{children}</div>
      </>
    );
  }

  // The definite height is load-bearing: R3F sizes its container with
  // `height: 100%`, which resolves to zero against a parent that only has
  // `min-height` — which the page needs so flat mode can scroll.
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Scene activity={activity} />
      <Hud />
      {/* The mounted screens are real DOM and already in the accessibility
          tree, so the flat page would duplicate them. The board game copy is the
          exception: a box back only mounts while its box is held. */}
      <ShelfText />
    </div>
  );
}

/** The two boxes' copy, for readers that can't pick a box up. */
function ShelfText() {
  return (
    <div className="sr-only">
      <h2>On the shelf</h2>
      {(["catan", "chess"] as const).map((id) => {
        const box = BOXES[id];
        return (
          <article key={id}>
            <h3>{box.title}</h3>
            <p>{box.tagline}</p>
            {box.blurb.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <ul>
              {box.components.map((c) => (
                <li key={c.slice(0, 20)}>{c}</li>
              ))}
            </ul>
            {box.playHref && <a href={box.playHref}>Play {box.title}</a>}
            {box.repoHref && <a href={box.repoHref}>{box.title} source</a>}
          </article>
        );
      })}
    </div>
  );
}
