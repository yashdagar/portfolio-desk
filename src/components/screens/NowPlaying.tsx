"use client";

import { useEffect, useState } from "react";

import type { NowPlaying as Playing, Track } from "@/app/api/spotify/route";
import { formatDuration, livePosition, useSpotify } from "@/lib/useSpotify";

/**
 * The right monitor: a music player, not a card about music.
 *
 * The earlier version was a tidy little panel — art, title, artist, a progress
 * bar. It was well behaved and it was wrong, because the premise of this screen
 * is that you're looking at *my actual screen*, and nobody's actual screen shows
 * a bespoke summary widget. They show the app. A sidebar, a library, a track
 * list and a transport bar across the bottom is what a music client looks like,
 * and the moment those are there the panel stops reading as a portfolio module
 * and starts reading as a window into a machine that someone is using.
 *
 * Every part of it is real. The library and the track list are genuine recent
 * plays from the API, the progress bar advances against the true position, and
 * the transport controls are deliberately non-interactive: this is a view of a
 * player, not a remote for one. They're rendered as static chrome and marked
 * aria-hidden so a screen reader isn't offered buttons that do nothing.
 *
 * Three states, all of which have to look deliberate — this screen is empty far
 * more often than it's full, since Yash is asleep for a third of every day and
 * the site is public the whole time. The empty state keeps the entire interface
 * and empties only the middle, because an empty state that throws away the
 * layout reads as broken while one that keeps it reads as idle, which is the
 * truth.
 */

const GREEN = "#1db954";

export function NowPlaying({
  variant = "wide",
}: {
  /**
   * Which shape of screen this is mounted on.
   *
   * `wide` is the desktop client — sidebar, main pane, transport bar across the
   * bottom. `tall` is the portrait monitor, and it isn't a squeezed version of
   * the same thing: a 618-pixel column can't hold a 236-pixel sidebar and a
   * four-column track list, and pretending otherwise gives you a desktop app
   * with everything truncated. It gets the layout a player actually uses in
   * portrait — art, title, transport, queue, stacked — which is a better fit for
   * the data anyway, because a music client is fundamentally a list and a list
   * wants height.
   */
  variant?: "wide" | "tall";
} = {}) {
  const { track, measuredAt } = useSpotify();
  const [, tick] = useState(0);

  // Re-render for the progress bar. 500ms is imperceptibly coarse for a bar
  // that moves 1% every two seconds, and costs almost nothing.
  useEffect(() => {
    if (!track?.playing) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [track?.playing]);

  const position = track ? livePosition(track, measuredAt.current) : 0;

  if (variant === "tall") {
    return <TallPlayer track={track} position={position} />;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#000] font-sans text-[#b3b3b3] antialiased">
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <Sidebar recent={track?.recent} />
        <Main track={track} />
      </div>
      <Transport track={track} position={position} />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Portrait
 * ---------------------------------------------------------------------- */

function TallPlayer({
  track,
  position,
}: {
  track: Playing | null;
  position: number;
}) {
  const pct = track?.durationMs ? (position / track.durationMs) * 100 : 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-[#2f4f4a] via-[#141c1c] to-[#0a0a0a] px-7 pb-6 pt-7 font-sans text-[#b3b3b3] antialiased">
      <header className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
          {track?.playing ? "Now playing" : "Last played"}
        </span>
        <Bars playing={!!track?.playing} />
      </header>

      {!track?.title ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="size-[180px] rounded-2xl bg-[#1c1c1c]" />
          <p className="text-[15px] text-[#6a6a6a]">
            {track ? "Nothing playing" : "Connecting…"}
          </p>
        </div>
      ) : (
        <>
          {/*
            Art at full column width. On the wide layout it's a 148px thumbnail
            beside a headline; here it's the subject, which is what a portrait
            column is for.
          */}
          <a
            href={track.url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 block focus-visible:outline-none"
          >
            <Art
              src={track.albumArt}
              size={510}
              radius="rounded-2xl"
              shadow
              fluid
            />
          </a>

          <h2 className="mt-6 text-[31px] font-black leading-[1.08] tracking-tight text-white">
            {track.title}
          </h2>
          <p className="mt-2 truncate text-[18px]">{track.artist}</p>

          <div className="mt-5">
            <span className="block h-[5px] w-full overflow-hidden rounded-full bg-[#4d4d4d]">
              <span
                className="block h-full rounded-full bg-white transition-[width] duration-500 ease-linear"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </span>
            <div className="mt-2.5 flex justify-between text-[12px] tabular-nums">
              <span>{track.durationMs ? formatDuration(position) : "0:00"}</span>
              <span>
                {track.durationMs ? formatDuration(track.durationMs) : "0:00"}
              </span>
            </div>
          </div>

          {/* Chrome, and hidden from assistive tech: none of it does anything. */}
          <div
            aria-hidden
            className="mt-5 flex items-center justify-between px-1 text-white"
          >
            <ShuffleIcon />
            <PrevIcon />
            <span className="flex size-[62px] items-center justify-center rounded-full bg-white text-black">
              {track.playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
            </span>
            <NextIcon />
            <RepeatIcon />
          </div>
        </>
      )}

      {track?.recent?.length ? (
        <section className="mt-6 flex min-h-0 flex-1 flex-col">
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#8a8a8a]">
            Recently played
          </h3>
          <ol className="min-h-0 flex-1 overflow-y-auto">
            {track.recent.map((t, i) => (
              <li key={`${t.title}-${i}`}>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3.5 rounded-lg px-2 py-2 transition-colors hover:bg-[#ffffff12] focus-visible:bg-[#ffffff12] focus-visible:outline-none"
                >
                  <Art src={t.albumArt} size={46} radius="rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-white">
                      {t.title}
                    </span>
                    <span className="block truncate text-[13px]">
                      {t.artist}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums">
                    {t.durationMs ? formatDuration(t.durationMs) : ""}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-4 shrink-0 text-[11px] text-[#6a6a6a]">
        Live from Spotify
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Sidebar
 * ---------------------------------------------------------------------- */

function Sidebar({ recent }: { recent?: Track[] }) {
  /*
   * Artists, not songs.
   *
   * The sidebar listed the same five tracks the main pane already lists, which
   * made the panel look like it was padding itself out. Collapsing history to
   * its distinct artists gives the library something the track list doesn't
   * have, and it's the same data — no extra call, no invented content.
   */
  const artists = Array.from(
    new Map(
      (recent ?? []).flatMap((t) =>
        t.artist
          .split(", ")
          .map(
            (name) =>
              [name, { name, albumArt: t.albumArt, url: t.url }] as const,
          ),
      ),
    ).values(),
  ).slice(0, 5);

  return (
    <nav
      aria-label="Library"
      /*
        Dropped on narrow viewports. The 3D surface is authored at a fixed
        1100px and always shows it, but the flat page renders the same component
        on a phone, where a 236px sidebar takes two thirds of the width and the
        track list collapses to nothing.
      */
      className="hidden w-[236px] shrink-0 flex-col gap-2 sm:flex"
    >
      <div className="rounded-lg bg-[#121212] px-3 py-3">
        <NavItem icon={<HomeIcon />} label="Home" active />
        <NavItem icon={<SearchIcon />} label="Search" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-[#121212]">
        <header className="flex items-center gap-2 px-4 pb-2 pt-3">
          <LibraryIcon />
          <span className="text-[13px] font-bold text-[#b3b3b3]">
            Your Library
          </span>
        </header>

        {/*
          Filter pills. Purely chrome, and worth the space: they're one of the
          two or three shapes that make this layout instantly recognisable.
        */}
        <div className="flex gap-2 px-3 pb-2">
          {["Playlists", "Artists"].map((f) => (
            <span
              key={f}
              className="rounded-full bg-[#232323] px-3 py-[3px] text-[11px] text-white"
            >
              {f}
            </span>
          ))}
        </div>

        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {/* The pinned row every real library has at the top of it. */}
          <li className="flex items-center gap-3 rounded-md px-2 py-[6px]">
            <span className="size-10 shrink-0 rounded bg-gradient-to-br from-[#4a24c4] to-[#b4a6f0]" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-white">
                Liked Songs
              </span>
              <span className="block truncate text-[11px]">
                Playlist · Yash
              </span>
            </span>
          </li>

          {artists.map((a) => (
            <li key={a.name}>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-md px-2 py-[6px] transition-colors hover:bg-[#1a1a1a] focus-visible:bg-[#1a1a1a] focus-visible:outline-none"
              >
                {/* Artists are round in a library list; songs are square. */}
                <Art src={a.albumArt} size={40} radius="rounded-full" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-white">
                    {a.name}
                  </span>
                  <span className="block truncate text-[11px]">Artist</span>
                </span>
              </a>
            </li>
          ))}

          {!recent?.length && (
            <li className="px-2 py-3 text-[12px] text-[#6a6a6a]">
              Nothing here yet.
            </li>
          )}
        </ul>

        {/*
          Attribution. Spotify's developer terms ask for it wherever their data
          is shown, and it's also the honest label for what this panel is —
          somebody else's service, read live, not a mock-up.
        */}
        <p className="px-4 pb-3 pt-1 text-[10px] text-[#6a6a6a]">
          Live from Spotify
        </p>
      </div>
    </nav>
  );
}

function NavItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 py-[7px] text-[14px] font-bold ${
        active ? "text-white" : "text-[#b3b3b3]"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Main pane
 * ---------------------------------------------------------------------- */

function Main({ track }: { track: Playing | null }) {
  if (!track) {
    return (
      <Pane>
        <div className="flex flex-1 items-center justify-center">
          <p className="animate-pulse text-[13px] text-[#6a6a6a]">
            Connecting…
          </p>
        </div>
      </Pane>
    );
  }

  if (!track.title) {
    return (
      <Pane>
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Bars playing={false} />
          <p className="text-[14px] text-[#6a6a6a]">Nothing playing</p>
        </div>
      </Pane>
    );
  }

  return (
    <Pane>
      {/*
        The header gradient. Spotify pulls it from the artwork; there's no way
        to sample a cross-origin image without tainting a canvas, so this is a
        fixed wash instead — which is close enough, because what the gradient is
        actually doing is separating the header from the list below it.
      */}
      <div className="relative shrink-0 bg-gradient-to-b from-[#2f4f4a] to-[#121212] px-6 pb-5 pt-6">
        <div className="flex items-end gap-5">
          <Art src={track.albumArt} size={148} radius="rounded-md" shadow />
          <div className="min-w-0 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white">
              {track.playing ? "Now playing" : "Last played"}
            </p>
            <h2 className="mt-1 truncate text-[40px] font-black leading-[1.05] tracking-tight text-white">
              {track.title}
            </h2>
            <p className="mt-3 truncate text-[12px] text-white">
              <span className="font-bold">{track.artist}</span>
              {track.album && ` · ${track.album}`}
              {track.durationMs
                ? ` · ${formatDuration(track.durationMs)}`
                : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5 px-6 py-3">
        <a
          href={track.url}
          target="_blank"
          rel="noreferrer"
          className="flex size-[46px] items-center justify-center rounded-full text-black transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline-none"
          style={{ background: GREEN }}
          aria-label={`Open ${track.title} in Spotify`}
        >
          <PlayIcon size={20} />
        </a>
        <HeartIcon />
        <Bars playing={!!track.playing} />
      </div>

      <TrackList recent={track.recent} />
    </Pane>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-[#121212]">
      {children}
    </section>
  );
}

function TrackList({ recent }: { recent?: Track[] }) {
  if (!recent?.length) return null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
      <div className="grid grid-cols-[24px_1fr_150px_44px] gap-3 border-b border-[#ffffff1a] px-2 pb-1 text-[11px] uppercase tracking-wide">
        <span>#</span>
        <span>Title</span>
        <span>Album</span>
        <span className="text-right">
          <ClockIcon />
        </span>
      </div>
      <ol className="mt-1">
        {recent.map((t, i) => (
          <li key={`${t.title}-${i}`}>
            <a
              href={t.url}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[24px_1fr_150px_44px] items-center gap-3 rounded-md px-2 py-[7px] transition-colors hover:bg-[#ffffff12] focus-visible:bg-[#ffffff12] focus-visible:outline-none"
            >
              <span className="text-[12px] tabular-nums">{i + 1}</span>
              <span className="flex min-w-0 items-center gap-3">
                <Art src={t.albumArt} size={32} radius="rounded-[3px]" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-white">
                    {t.title}
                  </span>
                  <span className="block truncate text-[11px]">{t.artist}</span>
                </span>
              </span>
              <span className="truncate text-[12px]">{t.album}</span>
              <span className="text-right text-[12px] tabular-nums">
                {t.durationMs ? formatDuration(t.durationMs) : "—"}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Transport
 * ---------------------------------------------------------------------- */

function Transport({
  track,
  position,
}: {
  track: Playing | null;
  position: number;
}) {
  const pct = track?.durationMs ? (position / track.durationMs) * 100 : 0;

  return (
    <footer className="flex h-[72px] shrink-0 items-center gap-4 px-4">
      <div className="flex w-[150px] min-w-0 items-center gap-3 sm:w-[236px]">
        {track?.title ? (
          <>
            <Art src={track.albumArt} size={48} radius="rounded" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-white">
                {track.title}
              </span>
              <span className="block truncate text-[11px]">{track.artist}</span>
            </span>
          </>
        ) : (
          <span className="text-[12px] text-[#6a6a6a]">—</span>
        )}
      </div>

      {/*
        Controls. Chrome, and hidden from assistive tech — a screen reader
        offered a "play" button that cannot play anything is worse served than
        one that's simply told the controls aren't there. The real affordance is
        the link on the artwork above.
      */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-[6px]">
        <div
          aria-hidden
          className="flex items-center gap-5 text-[#b3b3b3]"
        >
          <ShuffleIcon />
          <PrevIcon />
          <span className="flex size-8 items-center justify-center rounded-full bg-white text-black">
            {track?.playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
          </span>
          <NextIcon />
          <RepeatIcon />
        </div>

        <div className="flex w-full max-w-[420px] items-center gap-2">
          <span className="w-[34px] text-right text-[10px] tabular-nums">
            {track?.durationMs ? formatDuration(position) : "0:00"}
          </span>
          <span className="group h-[4px] flex-1 overflow-hidden rounded-full bg-[#4d4d4d]">
            <span
              className="block h-full rounded-full bg-white transition-[width] duration-500 ease-linear"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </span>
          <span className="w-[34px] text-[10px] tabular-nums">
            {track?.durationMs ? formatDuration(track.durationMs) : "0:00"}
          </span>
        </div>
      </div>

      <div
        aria-hidden
        className="hidden w-[236px] items-center justify-end gap-3 text-[#b3b3b3] sm:flex"
      >
        <QueueIcon />
        <VolumeIcon />
        <span className="h-[4px] w-[76px] overflow-hidden rounded-full bg-[#4d4d4d]">
          <span className="block h-full w-[68%] rounded-full bg-white" />
        </span>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------
 * Bits
 * ---------------------------------------------------------------------- */

function Art({
  src,
  size,
  radius,
  shadow,
  fluid,
}: {
  src?: string;
  size: number;
  radius: string;
  shadow?: boolean;
  /** Fill the column and stay square, rather than sitting at a fixed size. */
  fluid?: boolean;
}) {
  const className = `${radius} shrink-0 object-cover ${
    shadow ? "shadow-[0_10px_40px_rgba(0,0,0,0.65)]" : ""
  } ${fluid ? "mx-auto block aspect-square w-[80%]" : ""}`;
  const box = fluid ? undefined : { width: size, height: size };

  if (!src) {
    return <span className={`${className} block bg-[#282828]`} style={box} />;
  }

  return (
    // Deliberately not next/image: this is a remote host with a short-lived
    // URL, and the optimiser would cache a link that expires.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={box}
    />
  );
}

/** Three bars that bounce while playing and rest flat when not. */
function Bars({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={
            playing
              ? {
                  background: GREEN,
                  animation: `eq 900ms ease-in-out ${i * 140}ms infinite alternate`,
                  height: "40%",
                }
              : { background: "#535353", height: "18%" }
          }
        />
      ))}
      <style>{`@keyframes eq { from { height: 18% } to { height: 100% } }`}</style>
    </span>
  );
}

/*
 * Icons.
 *
 * Inline rather than a library: there are ten of them, they never change, and a
 * dependency for ten paths would cost more to load than the entire rest of this
 * screen. Everything inherits currentColor so a parent can recolour the set.
 */
const svg = (d: string, size = 16) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const HomeIcon = () =>
  svg("M12 3 2 11h3v9h6v-6h2v6h6v-9h3L12 3Z", 18);
const SearchIcon = () =>
  svg(
    "M10 2a8 8 0 1 0 4.9 14.32l5.39 5.39 1.42-1.42-5.39-5.39A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z",
    18,
  );
const LibraryIcon = () =>
  svg("M3 3h2v18H3V3Zm4 0h2v18H7V3Zm5.4.5 1.9-.5 4.7 17.4-1.9.5L12.4 3.5Z", 18);
const PlayIcon = ({ size = 16 }: { size?: number }) =>
  svg("M8 5v14l11-7L8 5Z", size);
const PauseIcon = ({ size = 16 }: { size?: number }) =>
  svg("M7 4h4v16H7V4Zm6 0h4v16h-4V4Z", size);
const PrevIcon = () => svg("M7 5h2v14H7V5Zm3 7 8-7v14l-8-7Z", 16);
const NextIcon = () => svg("M15 5h2v14h-2V5Zm-1 7L6 19V5l8 7Z", 16);
const ShuffleIcon = () =>
  svg(
    "M17 3v2h1.6l-3.3 3.3 1.4 1.4L20 6.4V8h2V3h-5ZM2 5h4l3 3 1.4-1.4L6.8 3H2v2Zm15.7 9.3-1.4 1.4L18.6 18H17v2h5v-5h-2v1.6l-2.3-2.3ZM2 17h4.8l9-9H20V6h-4.2l-9 9H2v2Z",
    15,
  );
const RepeatIcon = () =>
  svg(
    "M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z",
    15,
  );
const HeartIcon = () =>
  svg(
    "M12 21s-8-4.9-8-10.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8 3.8C20 16.1 12 21 12 21Z",
    17,
  );
const QueueIcon = () => svg("M3 5h18v2H3V5Zm0 6h12v2H3v-2Zm0 6h12v2H3v-2Z", 15);
const VolumeIcon = () =>
  svg("M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z", 15);
const ClockIcon = () =>
  svg(
    // A ring with hands. Filled at this size the disc swallows the cut-outs and
    // the whole glyph renders as a dot.
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm1 3h-2v6h5v-2h-3V7Z",
    13,
  );
