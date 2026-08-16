/**
 * LeetCode profile stats.
 *
 * The third live source in the room, and the one that says something the other
 * two can't. The commit feed shows what gets shipped and Spotify shows what's
 * playing while it gets shipped; neither is evidence of the thing a technical
 * screen actually asks about. A thousand accepted solutions with the hard count
 * broken out is — and like the commit feed, it isn't a claim anyone gets to
 * edit.
 *
 * Read from LeetCode's own GraphQL endpoint. It's undocumented but public and
 * unauthenticated: it's what leetcode.com's profile page calls, so it needs no
 * key and no account, which puts it in the same bracket as the weather rather
 * than the same bracket as Spotify.
 */

/** The account. Public, so this is not a secret and belongs in the source. */
export const LEETCODE_USER = "yash_says_hi";
export const LEETCODE_URL = `https://leetcode.com/u/${LEETCODE_USER}/`;

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface LeetCodeStats {
  user: string;
  /** Accepted problems, and how many exist, per difficulty. */
  solved: Record<Difficulty, { count: number; total: number }>;
  /** Accepted problems overall. */
  total: number;
  /** Global rank. Null when LeetCode declines to give one. */
  rank: number | null;
  /** Consecutive days with a submission, and days active in the last year. */
  streak: number;
  activeDays: number;
}

const QUERY = `
  query stats($username: String!) {
    allQuestionsCount { difficulty count }
    matchedUser(username: $username) {
      username
      profile { ranking }
      submitStatsGlobal { acSubmissionNum { difficulty count } }
      userCalendar { streak totalActiveDays }
    }
  }
`;

interface Bucket {
  difficulty: string;
  count: number;
}

interface Payload {
  data?: {
    allQuestionsCount?: Bucket[];
    matchedUser?: {
      username?: string;
      profile?: { ranking?: number | null };
      submitStatsGlobal?: { acSubmissionNum?: Bucket[] };
      userCalendar?: { streak?: number; totalActiveDays?: number };
    } | null;
  };
}

const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

/**
 * Turn the GraphQL response into the shape the screens want.
 *
 * Exported and pure so it can be tested against a captured payload — this is
 * an undocumented endpoint, and the failure mode worth catching is not a
 * network error but a field quietly changing shape underneath us.
 */
export function readLeetCodeStats(json: unknown): LeetCodeStats | null {
  const user = (json as Payload)?.data?.matchedUser;
  if (!user?.username) return null;

  const byDifficulty = (buckets: Bucket[] | undefined) =>
    new Map((buckets ?? []).map((b) => [b.difficulty, b.count]));

  const accepted = byDifficulty(user.submitStatsGlobal?.acSubmissionNum);
  const existing = byDifficulty((json as Payload).data?.allQuestionsCount);

  const solved = {} as LeetCodeStats["solved"];
  for (const d of DIFFICULTIES) {
    solved[d] = { count: accepted.get(d) ?? 0, total: existing.get(d) ?? 0 };
  }

  /*
   * "All" rather than the sum of the three.
   *
   * They agree today. They won't the day LeetCode adds a fourth tier, and a
   * headline number that silently stops matching the rows under it is worse
   * than one that's occasionally a few off.
   */
  const total = accepted.get("All") ?? 0;
  if (total === 0) return null;

  return {
    user: user.username,
    solved,
    total,
    rank: user.profile?.ranking ?? null,
    streak: user.userCalendar?.streak ?? 0,
    activeDays: user.userCalendar?.totalActiveDays ?? 0,
  };
}

/**
 * Fetch the stats. Returns null on anything at all going wrong.
 *
 * Same contract as the weather: this decorates a screen that is complete
 * without it, so its failure mode is "the panel isn't there", never a broken
 * render or a 500 on the page that carries the contact details.
 */
export async function fetchLeetCodeStats(
  revalidate = 3600,
): Promise<LeetCodeStats | null> {
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // LeetCode rejects requests without a browser-ish referer.
        referer: "https://leetcode.com",
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { username: LEETCODE_USER },
      }),
      next: { revalidate },
    });
    if (!res.ok) return null;
    return readLeetCodeStats(await res.json());
  } catch {
    return null;
  }
}
