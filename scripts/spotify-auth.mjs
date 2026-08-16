/**
 * One-time Spotify authorisation.
 *
 *   node scripts/spotify-auth.mjs
 *
 * Spotify has no way to mint a refresh token without a human approving the
 * scopes in a browser, so this spins up a throwaway localhost server, opens the
 * consent page, catches the redirect, and prints the token to paste into your
 * env. It never touches the network again after that.
 *
 * Before running, create an app at https://developer.spotify.com/dashboard and
 * add exactly this redirect URI:
 *
 *   http://127.0.0.1:8888/callback
 *
 * Then export SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET and run this.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT = "http://127.0.0.1:8888/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.\n\n" +
      "  export SPOTIFY_CLIENT_ID=...\n" +
      "  export SPOTIFY_CLIENT_SECRET=...\n",
  );
  process.exit(1);
}

// Only what the site actually reads. Anything more would be over-asking for a
// token that lives in a deployment env var indefinitely.
const SCOPES = ["user-read-currently-playing", "user-read-recently-played"];
const state = randomBytes(16).toString("hex");

const authUrl =
  "https://accounts.spotify.com/authorize?" +
  new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES.join(" "),
    redirect_uri: REDIRECT,
    state,
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8888");
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  if (url.searchParams.get("state") !== state) {
    res.writeHead(400).end("State mismatch — start over.");
    server.close();
    process.exitCode = 1;
    return;
  }

  const error = url.searchParams.get("error");
  if (error) {
    res.writeHead(400).end(`Spotify said: ${error}`);
    server.close();
    process.exitCode = 1;
    return;
  }

  const code = url.searchParams.get("code");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
    }),
  });

  const json = await tokenRes.json();

  if (!tokenRes.ok || !json.refresh_token) {
    res.writeHead(500).end("Token exchange failed — see the terminal.");
    console.error(json);
    server.close();
    process.exitCode = 1;
    return;
  }

  res
    .writeHead(200, { "content-type": "text/html" })
    .end(
      "<body style='font:16px system-ui;padding:3rem;background:#1a1918;color:#e6e9ea'>" +
        "<h1>Done.</h1><p>Refresh token is in your terminal. You can close this.</p></body>",
    );

  console.log("\n  SPOTIFY_REFRESH_TOKEN=" + json.refresh_token + "\n");
  console.log("Add that to .env.local and to the Vercel project env.\n");

  server.close();
});

server.listen(8888, "127.0.0.1", () => {
  console.log("Opening Spotify consent…\nIf nothing opens, visit:\n\n" + authUrl + "\n");
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  spawn(opener, [authUrl], { stdio: "ignore", detached: true }).unref();
});
