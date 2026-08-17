import { NextResponse } from "next/server";

/**
 * The one source that has to be live at request time — a track changes every few
 * minutes, so the Action-generated JSON behind the commit feed would always be
 * wrong here.
 *
 * Refresh-token grant: a one-time manual authorisation produces a long-lived
 * refresh token in an env var, exchanged here for a short-lived access token.
 * See scripts/spotify-auth.mjs.
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
const RECENT_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=10";

export interface Track {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  url?: string;
  durationMs?: number;
}

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
  /** Fetched whether or not something is playing: a player client with an empty
   *  library reads as a mockup. */
  recent?: Track[];
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

function condense(track: SpotifyTrack): Track {
  // Spotify returns images largest-first; the middle one (~300px) is the right
  // size for a monitor-sized panel without pulling a 640px asset every poll.
  const art =
    track.album.images.find((i) => i.width && i.width <= 400) ??
    track.album.images.at(-1);
  return {
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumArt: art?.url,
    url: track.external_urls.spotify,
    durationMs: track.duration_ms,
  };
}

function shape(track: SpotifyTrack, extra: Partial<NowPlaying>): NowPlaying {
  return { playing: false, ...condense(track), ...extra };
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

  // Both at once. The history is needed for the client's track list whether or
  // not something is playing, and firing them in sequence would put a second
  // round trip to Spotify in front of every cold response.
  const [current, recent] = await Promise.all([
    fetch(NOW_PLAYING_URL, { headers, cache: "no-store" }),
    fetch(RECENT_URL, { headers, cache: "no-store" }),
  ]);

  let history: Track[] = [];
  if (recent.ok) {
    const json = (await recent.json()) as { items?: { track: SpotifyTrack }[] };
    const seen = new Set<string>();
    history = (json.items ?? [])
      .map((i) => i.track)
      .filter((t) => {
        // Spotify's history repeats a track every time it was played, and a
        // list showing the same song six times looks broken rather than honest.
        if (!t || seen.has(t.name)) return false;
        seen.add(t.name);
        return true;
      })
      .slice(0, 6)
      .map(condense);
  }

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
          recent: history,
        }),
        // Short cache: long enough to absorb a burst of visitors, short enough
        // that the progress bar isn't visibly wrong.
        { headers: { "cache-control": "public, max-age=20" } },
      );
    }
  }

  if (history.length) {
    const [last, ...rest] = history;
    return NextResponse.json<NowPlaying>(
      {
        playing: false,
        stale: true,
        ...last,
        recent: rest,
      },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  }

  return NextResponse.json<NowPlaying>(
    { playing: false },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
