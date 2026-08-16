import {
  DIFFICULTY_TONE as TONE,
  LEETCODE_URL,
  type Difficulty,
  type LeetCodeStats,
} from "@/lib/leetcode";

const ORDER: Difficulty[] = ["Easy", "Medium", "Hard"];

/**
 * The solve breakdown, as bars.
 *
 * The headline is the total, but the total is also the least interesting figure
 * on here — a thousand easies and a thousand mixed are the same number and not
 * the same person. The bars carry the part that matters, which is the shape:
 * how far along each difficulty is, and the fact that the hard bar isn't empty.
 *
 * Filled against the *whole catalogue* rather than normalised to the largest
 * count, so the bars are honest about scale — 180 hard problems out of 965 is a
 * short bar, and it should look like one.
 */
export function LeetCodePanel({
  stats,
  className = "",
}: {
  stats: LeetCodeStats;
  className?: string;
}) {
  return (
    <a
      href={LEETCODE_URL}
      target="_blank"
      rel="noreferrer"
      className={`block rounded-card bg-screen-raised px-4 py-3.5 transition-colors duration-150 hover:bg-screen-hi focus-visible:bg-screen-hi focus-visible:outline-none ${className}`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          LeetCode
        </span>
        <span className="font-mono text-[10px] text-ink-faint">
          {stats.user}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[30px] font-medium leading-none tracking-tight text-ink tabular-nums">
          {stats.total.toLocaleString("en-IN")}
        </span>
        <span className="text-[13px] text-ink-dim">solved</span>
      </div>

      <dl className="mt-3 space-y-[7px]">
        {ORDER.map((d) => {
          const { count, total } = stats.solved[d];
          const pct = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={d} className="grid grid-cols-[46px_1fr_auto] items-center gap-2">
              <dt
                className="font-mono text-[10px] uppercase tracking-[0.1em]"
                style={{ color: TONE[d] }}
              >
                {d}
              </dt>
              {/*
                The track is drawn even at zero width, so an empty difficulty
                reads as "none yet" rather than as a missing row.
              */}
              <dd className="h-[5px] overflow-hidden rounded-full bg-screen-line">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: TONE[d] }}
                />
              </dd>
              <dd className="font-mono text-[10px] text-ink-faint tabular-nums">
                {count}
                <span className="text-ink-faint/60">/{total}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-3 font-mono text-[10px] text-ink-faint tabular-nums">
        {stats.rank !== null && `rank #${stats.rank.toLocaleString("en-IN")}`}
        {stats.streak > 0 && ` · ${stats.streak}d streak`}
        {stats.activeDays > 0 && ` · ${stats.activeDays} active days`}
      </p>
    </a>
  );
}
