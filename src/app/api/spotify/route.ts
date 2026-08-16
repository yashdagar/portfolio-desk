import { NextResponse } from "next/server";

/**
 * Now playing.
 *
 * This is the one source that has to be live at request time — a track changes
 * every few minutes, so the Action-generated JSON that serves the commit feed
 * would always be wrong here.
 *
 * Uses the refresh-token grant: a one-time manual authorisation produces a
 * long-lived refresh token, stored as an env var, which this route exchanges
 * for a short-lived access token on demand. See scripts/spotify-auth.mjs.
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
const RECENT_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=1";

export interface NowPlaying {
  /** False when nothing is playing — the UI then shows the last track instead. */
  playing: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  url?: string;
  /** Present only while playing, for the progress bar. */
  progressMs?: number;
  durationMs?: number;
  /** True when this is the most recent track rather than a current one. */
  stale?: boolean;
}

async function accessToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
    // Access tokens last an hour; refreshing every 50 minutes keeps one call
    // out of the critical path for almost every visitor.
    next: { revalidate: 3000 },
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

interface SpotifyTrack {
  name: string;
  external_urls: { spotify: string };
  artists: { name: string }[];
  album: { name: string; images: { url: string; width: number }[] };
  duration_ms: number;
}

function shape(track: SpotifyTrack, extra: Partial<NowPlaying>): NowPlaying {
  // Spotify returns images largest-first; the middle one (~300px) is the right
  // size for a monitor-sized panel without pulling a 640px asset every poll.
  const art =
    track.album.images.find((i) => i.width && i.width <= 400) ??
    track.album.images.at(-1);
  return {
    playing: false,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumArt: art?.url,
    url: track.external_urls.spotify,
    durationMs: track.duration_ms,
    ...extra,
  };
}

export async function GET() {
  const token = await accessToken();

  // Not configured yet, or Spotify is down. The screen has a designed empty
  // state, so this is a normal response rather than an error.
  if (!token) {
    return NextResponse.json<NowPlaying>(
      { playing: false },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  }

  const headers = { authorization: `Bearer ${token}` };

  const current = await fetch(NOW_PLAYING_URL, {
    headers,
    cache: "no-store",
  });

  // 204 means the player is idle; anything playing comes back as 200.
  if (current.status === 200) {
    const json = (await current.json()) as {
      is_playing: boolean;
      progress_ms: number | null;
      item: SpotifyTrack | null;
    };
    if (json.item) {
      return NextResponse.json<NowPlaying>(
        shape(json.item, {
          playing: json.is_playing,
          progressMs: json.progress_ms ?? 0,
        }),
        // Short cache: long enough to absorb a burst of visitors, short enough
        // that the progress bar isn't visibly wrong.
        { headers: { "cache-control": "public, max-age=20" } },
      );
    }
  }

  const recent = await fetch(RECENT_URL, { headers, cache: "no-store" });
  if (recent.ok) {
    const json = (await recent.json()) as {
      items: { track: SpotifyTrack }[];
    };
    const track = json.items?.[0]?.track;
    if (track) {
      return NextResponse.json<NowPlaying>(shape(track, { stale: true }), {
        headers: { "cache-control": "public, max-age=60" },
      });
    }
  }

  return NextResponse.json<NowPlaying>(
    { playing: false },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
