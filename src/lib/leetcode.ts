/**
 * The LeetCode profile, from LeetCode's own GraphQL endpoint — undocumented but
 * public and unauthenticated, so no key and no account.
 */

/** Public, so this is not a secret and belongs in the source. */
export const LEETCODE_USER = "yash_says_hi";
export const LEETCODE_URL = `https://leetcode.com/u/${LEETCODE_USER}/`;

export type Difficulty = "Easy" | "Medium" | "Hard";

/**
 * LeetCode's own three, borrowed rather than restyled into the room's palette:
 * anyone who has used the site knows what amber means without reading a label.
 */
export const DIFFICULTY_TONE: Record<Difficulty, string> = {
  Easy: "#37bfa5",
  Medium: "#e8a33d",
  Hard: "#e05c62",
};

export interface SolvedProblem {
  title: string;
  slug: string;
  /** Unix seconds. */
  at: number;
}

export interface LeetCodeStats {
  user: string;
  realName: string | null;
  avatar: string | null;
  about: string | null;
  country: string | null;
  school: string | null;
  /** GitHub / LinkedIn / X / personal site, whichever the profile carries. */
  links: { label: string; href: string }[];
  /** Badge names, best first — LeetCode already returns them in that order. */
  badges: string[];
  /** Languages actually used, most-solved first. */
  languages: { name: string; solved: number }[];
  /** The last few accepted submissions. */
  recent: SolvedProblem[];
  /** Accepted problems, and how many exist, per difficulty. */
  solved: Record<Difficulty, { count: number; total: number }>;
  /** Accepted problems overall. */
  total: number;
  /** Global rank. Null when LeetCode declines to give one. */
  rank: number | null;
  /** Consecutive days with a submission, and days active in the last year. */
  streak: number;
  activeDays: number;
  /** Keyed by UTC "YYYY-MM-DD". LeetCode ships a JSON *string* of unix-second
   *  keys, parsed once here into something a calendar can index. */
  calendar: Record<string, number>;
}

const QUERY = `
  query profile($username: String!, $recent: Int!) {
    allQuestionsCount { difficulty count }
    matchedUser(username: $username) {
      username
      githubUrl
      twitterUrl
      linkedinUrl
      profile {
        ranking
        realName
        aboutMe
        userAvatar
        countryName
        school
        websites
      }
      badges { displayName }
      languageProblemCount { languageName problemsSolved }
      submitStatsGlobal { acSubmissionNum { difficulty count } }
      userCalendar { streak totalActiveDays submissionCalendar }
    }
    recentAcSubmissionList(username: $username, limit: $recent) {
      title
      titleSlug
      timestamp
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
    recentAcSubmissionList?: {
      title?: string;
      titleSlug?: string;
      timestamp?: string;
    }[];
    matchedUser?: {
      username?: string;
      githubUrl?: string | null;
      twitterUrl?: string | null;
      linkedinUrl?: string | null;
      profile?: {
        ranking?: number | null;
        realName?: string | null;
        aboutMe?: string | null;
        userAvatar?: string | null;
        countryName?: string | null;
        school?: string | null;
        websites?: string[] | null;
      };
      badges?: { displayName?: string }[] | null;
      languageProblemCount?:
        | { languageName?: string; problemsSolved?: number }[]
        | null;
      submitStatsGlobal?: { acSubmissionNum?: Bucket[] };
      userCalendar?: {
        streak?: number;
        totalActiveDays?: number;
        submissionCalendar?: string | null;
      } | null;
    } | null;
  };
}

const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

/** Parsed inside a try: the day this undocumented string stops being valid
 *  JSON, the calendar should disappear rather than take the profile with it. */
function readCalendar(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [seconds, count] of Object.entries(parsed)) {
      const day = new Date(Number(seconds) * 1000).toISOString().slice(0, 10);
      out[day] = (out[day] ?? 0) + count;
    }
    return out;
  } catch {
    return {};
  }
}

/** Strip the scheme and any trailing slash, so a link reads as a handle. */
function handle(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/**
 * Exported and pure so it can be tested against a captured payload: on an
 * undocumented endpoint the failure worth catching is a field quietly changing
 * shape, not a network error.
 */
export function readLeetCodeStats(json: unknown): LeetCodeStats | null {
  const payload = json as Payload;
  const user = payload?.data?.matchedUser;
  if (!user?.username) return null;

  const byDifficulty = (buckets: Bucket[] | undefined) =>
    new Map((buckets ?? []).map((b) => [b.difficulty, b.count]));

  const accepted = byDifficulty(user.submitStatsGlobal?.acSubmissionNum);
  const existing = byDifficulty(payload.data?.allQuestionsCount);

  const solved = {} as LeetCodeStats["solved"];
  for (const d of DIFFICULTIES) {
    solved[d] = { count: accepted.get(d) ?? 0, total: existing.get(d) ?? 0 };
  }

  // "All" rather than the sum of three, which stops agreeing the day LeetCode
  // adds a fourth tier.
  const total = accepted.get("All") ?? 0;
  if (total === 0) return null;

  const links: LeetCodeStats["links"] = [];
  if (user.githubUrl) links.push({ label: "GitHub", href: user.githubUrl });
  if (user.linkedinUrl)
    links.push({ label: "LinkedIn", href: user.linkedinUrl });
  if (user.twitterUrl) links.push({ label: "X", href: user.twitterUrl });
  for (const site of user.profile?.websites ?? []) {
    links.push({ label: handle(site), href: site });
  }

  return {
    user: user.username,
    realName: user.profile?.realName || null,
    avatar: user.profile?.userAvatar || null,
    about: user.profile?.aboutMe || null,
    country: user.profile?.countryName || null,
    school: user.profile?.school || null,
    links,
    badges: (user.badges ?? [])
      .map((b) => b.displayName)
      .filter((n): n is string => !!n),
    // LeetCode returns every language ever used, in no useful order.
    languages: (user.languageProblemCount ?? [])
      .map((l) => ({ name: l.languageName ?? "", solved: l.problemsSolved ?? 0 }))
      .filter((l) => l.name && l.solved > 0)
      .sort((a, b) => b.solved - a.solved),
    recent: (payload.data?.recentAcSubmissionList ?? [])
      .filter((s) => s.title && s.titleSlug)
      .map((s) => ({
        title: s.title!,
        slug: s.titleSlug!,
        at: Number(s.timestamp ?? 0),
      })),
    solved,
    total,
    rank: user.profile?.ranking ?? null,
    streak: user.userCalendar?.streak ?? 0,
    activeDays: user.userCalendar?.totalActiveDays ?? 0,
    calendar: readCalendar(user.userCalendar?.submissionCalendar),
  };
}

/**
 * Returns null on anything going wrong. This decorates a screen that is complete
 * without it, so failure means "the panel isn't there" — never a 500 on the page
 * carrying the contact details.
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
        variables: { username: LEETCODE_USER, recent: 12 },
      }),
      next: { revalidate },
    });
    if (!res.ok) return null;
    return readLeetCodeStats(await res.json());
  } catch {
    return null;
  }
}
