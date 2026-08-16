/**
 * Everything the screens say about Yash.
 *
 * Kept as data rather than JSX so the same content drives the 3D surfaces, the
 * DOM fallback and the OG image without three copies drifting apart.
 */

export const PROFILE = {
  name: "Yash Dagar",
  role: "Full-stack developer",
  location: "Gurugram, India",
  /** Deliberately the personal address, not the work one. */
  email: "by.yashdagar@gmail.com",
  links: [
    { label: "GitHub", href: "https://github.com/yashdagar", handle: "yashdagar" },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/yoursyash/",
      handle: "yoursyash",
    },
    { label: "X", href: "https://x.com/yash_builds", handle: "yash_builds" },
    { label: "Site", href: "https://yashdagar.me", handle: "yashdagar.me" },
  ],
  /**
   * Two short paragraphs. The monitor is 27 inches, not a page — anything
   * longer stops being read and starts being skipped.
   */
  bio: [
    "I build things that have to be correct: rules engines, parsers, board logic. Rust, TypeScript, Dart, a bit of C when the problem deserves it.",
    "The monitor to your left is a live feed of what I actually pushed. It isn't a summary, and I don't get to edit it.",
  ],
  githubSince: 2020,
} as const;

export interface GameBoxCopy {
  id: "catan" | "chess";
  title: string;
  /** The line under the title, the way a real box has one. */
  tagline: string;
  players: string;
  time: string;
  /** Back-of-box blurb. */
  blurb: string[];
  /** "Components" — really the tech, framed the way a box lists its contents. */
  components: string[];
  playHref?: string;
  repoHref?: string;
  /** Shown when there's no live build to link to. */
  status?: string;
}

export const BOXES: Record<"catan" | "chess", GameBoxCopy> = {
  catan: {
    id: "catan",
    title: "CATAN",
    tagline: "An online multiplayer clone",
    players: "2–4 players",
    time: "60–90 min",
    blurb: [
      "Online multiplayer. No bots, no hotseat, landscape only. The full base game: snake-order setup, the robber, all 25 development cards, harbour and bank trading, longest road computed properly across branching networks, and the ten victory point win.",
      "The server owns the rules. Catan has hidden information — your hand, the unplayed development cards, the order of the deck — and a client that knows enough to validate a move knows enough to cheat. So no client is ever given full state. Each player receives a redacted snapshot: their own hand, and everyone else's card counts.",
      "There is no image asset anywhere in the app. Every tile, token, harbour and playing piece is painted at runtime, and each hex seeds its own RNG from its id and terrain, so no two forests repeat and every pasture gets a different flock.",
    ],
    components: [
      "Authoritative rules engine — plain TypeScript, no framework imports, runs under deno test on its own",
      "Supabase edge function, the only writer in the system",
      "Postgres row-level security with zero policies: only the service role can read authoritative state",
      "Realtime subscriptions push each player their own redacted view",
      "Flutter client — Android, iOS and web",
      "24 engine tests · 58 client tests · one 140-turn game played end to end against live",
    ],
    playHref: "https://catann.netlify.app",
  },
  chess: {
    id: "chess",
    title: "CHESS",
    tagline: "An engine, and a board to watch it think",
    players: "1–2 players",
    time: "As long as it takes",
    blurb: [
      "A chess engine written from scratch, and a board to play it on. Legal move generation, full rules, and a search that plays a real game rather than a demo.",
      "Move generation uses magic bitboards — precomputed perfect-hash tables that turn sliding-piece attacks into a multiply and a shift instead of a loop. Positions are fingerprinted with Zobrist hashing so a transposition table can recognise a position it has already searched, whichever move order arrived at it.",
      "The search is negamax with alpha-beta pruning, move ordering to get the cutoffs early, and bounded entries in the table so a shallower result can still prune a deeper one.",
    ],
    components: [
      "Magic bitboard move generation",
      "Zobrist hashing with a transposition table — exact, upper and lower bound entries",
      "Negamax with alpha-beta pruning and move ordering, to depth 12",
      "FEN parser, so any position can be loaded",
      "Flutter client — the board, the pieces, and the engine's evaluation",
    ],
    repoHref: "https://github.com/yashdagar/chess",
    status: "Private repo",
  },
};
