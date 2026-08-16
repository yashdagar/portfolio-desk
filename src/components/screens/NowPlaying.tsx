"use client";

import { useEffect, useState } from "react";

import { formatDuration, livePosition, useSpotify } from "@/lib/useSpotify";

/**
 * The right monitor: what's playing.
 *
 * Has three real states and all of them have to look deliberate — this screen
 * is blank far more often than it's full, since Yash is asleep for a third of
 * every day and the site is public the whole time.
 */
export function NowPlaying() {
  const { track, measuredAt } = useSpotify();
  const [, tick] = useState(0);

  // Re-render for the progress bar. 500ms is imperceptibly coarse for a bar
  // that moves 1% every two seconds, and costs almost nothing.
  useEffect(() => {
    if (!track?.playing) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [track?.playing]);

  if (!track) {
    return (
      <Shell>
        <p className="animate-pulse font-mono text-[13px] text-ink-faint">
          connecting…
        </p>
      </Shell>
    );
  }

  if (!track.title) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Bars playing={false} />
          <p className="font-mono text-[13px] text-ink-faint">nothing playing</p>
        </div>
      </Shell>
    );
  }

  const position = livePosition(track, measuredAt.current);
  const pct = track.durationMs ? (position / track.durationMs) * 100 : 0;

  return (
    <Shell>
      <header className="mb-5 flex items-center gap-2">
        <Bars playing={!!track.playing} />
        <span className="font-mono text-[12px] uppercase tracking-wider text-ink-faint">
          {track.playing ? "now playing" : "last played"}
        </span>
      </header>

      {track.albumArt && (
        // Deliberately not next/image: this is a remote host with a short-lived
        // URL, and the optimiser would cache a link that expires.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.albumArt}
          alt=""
          className="mb-5 aspect-square w-[42%] rounded-sm object-cover shadow-lg shadow-black/40"
        />
      )}

      <a
        href={track.url}
        target="_blank"
        rel="noreferrer"
        className="group block focus-visible:outline-none"
      >
        <h2 className="text-[19px] font-medium leading-snug text-ink underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-accent group-focus-visible:decoration-accent">
          {track.title}
        </h2>
        <p className="mt-1 text-[15px] text-ink-dim">{track.artist}</p>
        {track.album && (
          <p className="mt-0.5 text-[13px] text-ink-faint">{track.album}</p>
        )}
      </a>

      {track.playing && track.durationMs ? (
        <div className="mt-auto pt-6">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-screen-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-faint tabular-nums">
            <span>{formatDuration(position)}</span>
            <span>{formatDuration(track.durationMs)}</span>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

/** Three bars that bounce while playing and rest flat when not. */
function Bars({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${playing ? "bg-accent" : "bg-ink-faint"}`}
          style={
            playing
              ? {
                  animation: `eq 900ms ease-in-out ${i * 140}ms infinite alternate`,
                  height: "40%",
                }
              : { height: "18%" }
          }
        />
      ))}
      <style>{`@keyframes eq { from { height: 18% } to { height: 100% } }`}</style>
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col bg-screen px-7 py-6 font-sans text-ink-dim">
      {children}
    </div>
  );
}
