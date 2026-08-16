import { ImageResponse } from "next/og";

import { readActivity } from "@/lib/activity.server";
import { PROFILE } from "@/lib/profile";

export const alt = "Yash Dagar — a desk whose monitors show live activity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card.
 *
 * Typographic rather than a render of the room: ImageResponse has no WebGL, and
 * a screenshot baked at build time would freeze the one thing the site is about
 * — it would still claim yesterday's numbers next week. Reading the feed here
 * means the card carries the real commit count and streak at the moment it's
 * generated, which is the same argument the site itself makes.
 */
export default async function Image() {
  const feed = await readActivity();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#141618",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          color: "#e6e9ea",
        }}
      >
        {/* A bar of light across the top, standing in for the screens. */}
        <div style={{ display: "flex", gap: 14 }}>
          {[0.9, 0.55, 0.3].map((o, i) => (
            <div
              key={i}
              style={{
                width: 128,
                height: 6,
                borderRadius: 3,
                background: "#4ecdc4",
                opacity: o,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, letterSpacing: -2, lineHeight: 1 }}>
            {PROFILE.name}
          </div>
          <div style={{ fontSize: 30, color: "#4ecdc4", marginTop: 20 }}>
            {`${PROFILE.role} · ${PROFILE.location}`}
          </div>
          <div
            style={{
              fontSize: 27,
              color: "#8b9499",
              marginTop: 28,
              maxWidth: 880,
              lineHeight: 1.45,
            }}
          >
            {/*
              One expression, not text plus an entity. Satori requires an
              explicit display on any element with more than one child, and
              `&apos;` in JSX splits a sentence into three text nodes.
            */}
            {"Sit at my desk. The monitors show what I'm actually working on."}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 40,
            fontSize: 22,
            color: "#5a6367",
            borderTop: "1px solid #232a2e",
            paddingTop: 24,
          }}
        >
          {feed && <span>{`${feed.totals.year} commits this year`}</span>}
          {feed && feed.totals.streak > 0 && (
            <span>{`${feed.totals.streak} day streak`}</span>
          )}
          <span>{`github.com/${PROFILE.links[0].handle}`}</span>
        </div>
      </div>
    ),
    size,
  );
}
