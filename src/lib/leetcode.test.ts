import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readLeetCodeStats } from "./leetcode";

/**
 * A real response, trimmed to the fields we read.
 *
 * Captured from leetcode.com/graphql rather than invented, because the whole
 * point of testing this parser is that the endpoint is undocumented: the
 * failure worth catching is a field quietly changing shape, and a fixture
 * written from the type definition would agree with the type definition
 * forever.
 */
const PAYLOAD = {
  data: {
    allQuestionsCount: [
      { difficulty: "All", count: 4028 },
      { difficulty: "Easy", count: 960 },
      { difficulty: "Medium", count: 2103 },
      { difficulty: "Hard", count: 965 },
    ],
    matchedUser: {
      username: "yash_says_hi",
      profile: { ranking: 31146 },
      submitStatsGlobal: {
        acSubmissionNum: [
          { difficulty: "All", count: 1020 },
          { difficulty: "Easy", count: 287 },
          { difficulty: "Medium", count: 553 },
          { difficulty: "Hard", count: 180 },
        ],
      },
      userCalendar: { streak: 109, totalActiveDays: 299 },
    },
  },
};

describe("readLeetCodeStats", () => {
  it("reads a full response", () => {
    const stats = readLeetCodeStats(PAYLOAD);

    assert.ok(stats);
    assert.equal(stats.user, "yash_says_hi");
    assert.equal(stats.total, 1020);
    assert.equal(stats.rank, 31146);
    assert.equal(stats.streak, 109);
    assert.equal(stats.activeDays, 299);
    assert.deepEqual(stats.solved.Hard, { count: 180, total: 965 });
  });

  it("takes the headline from 'All', not from the sum of the tiers", () => {
    // The day a fourth difficulty appears, the rows and the total will disagree
    // — and the total should still be the one LeetCode reports.
    const stats = readLeetCodeStats({
      data: {
        ...PAYLOAD.data,
        matchedUser: {
          ...PAYLOAD.data.matchedUser,
          submitStatsGlobal: {
            acSubmissionNum: [
              { difficulty: "All", count: 1200 },
              { difficulty: "Easy", count: 287 },
            ],
          },
        },
      },
    });

    assert.equal(stats?.total, 1200);
    assert.equal(stats?.solved.Medium.count, 0);
  });

  it("is null for an unknown user", () => {
    assert.equal(
      readLeetCodeStats({ data: { allQuestionsCount: [], matchedUser: null } }),
      null,
    );
  });

  it("is null when nothing has been solved, rather than showing a zero", () => {
    // A profile that reports no accepted submissions at all is far more likely
    // to be a shape change than a real account, and an empty panel on the
    // centre monitor is worse than no panel.
    const stats = readLeetCodeStats({
      data: {
        ...PAYLOAD.data,
        matchedUser: {
          ...PAYLOAD.data.matchedUser,
          submitStatsGlobal: { acSubmissionNum: [] },
        },
      },
    });

    assert.equal(stats, null);
  });

  it("survives an error response with no data at all", () => {
    assert.equal(readLeetCodeStats({ errors: [{ message: "nope" }] }), null);
    assert.equal(readLeetCodeStats(null), null);
  });

  it("defaults the calendar fields when they're missing", () => {
    const stats = readLeetCodeStats({
      data: {
        ...PAYLOAD.data,
        matchedUser: {
          ...PAYLOAD.data.matchedUser,
          profile: {},
          userCalendar: null,
        },
      },
    });

    assert.equal(stats?.rank, null);
    assert.equal(stats?.streak, 0);
    assert.equal(stats?.activeDays, 0);
  });
});
