import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertNoLeak,
  classify,
  computeStreak,
  dropTimestampClusters,
  isBlockedRepo,
  isBotMessage,
  toOwnCommit,
  toWorkCommit,
} from "./activity";

describe("isBlockedRepo", () => {
  it("blocks the commit generator regardless of owner", () => {
    assert.equal(isBlockedRepo("yashdagar4557/commiter"), true);
    assert.equal(isBlockedRepo("someoneelse/commiter"), true);
    assert.equal(isBlockedRepo("yashdagar/committed"), true);
  });

  it("blocks LeetHub sync targets", () => {
    assert.equal(isBlockedRepo("yashdagar/leetcode"), true);
    assert.equal(isBlockedRepo("yashdagar/LeetCode"), true);
  });

  it("does not block real repos with similar names", () => {
    // leetcode-cli is hand-written and must survive the leetcode rule.
    assert.equal(isBlockedRepo("yashdagar/leetcode-cli"), false);
    assert.equal(isBlockedRepo("yashdagar/rusty-sql"), false);
    assert.equal(isBlockedRepo("yashdagar/catan"), false);
  });
});

describe("isBotMessage", () => {
  it("catches the generator's sequential commits", () => {
    assert.equal(isBotMessage("W8-Commit 87443"), true);
    assert.equal(isBotMessage("Commit 1"), true);
  });

  it("catches LeetHub output", () => {
    assert.equal(
      isBotMessage("Time: 285 ms (71.21%), Space: 145.8 MB (30.3%) - LeetHub"),
      true,
    );
    assert.equal(isBotMessage("Add 3310-remove-methods-from-project to topics."), true);
  });

  it("catches merge commits, which are real but not authored", () => {
    assert.equal(isBotMessage("Merge pull request #12 from x/y"), true);
    assert.equal(isBotMessage("Merge branch 'main' into feature"), true);
  });

  it("keeps real messages", () => {
    assert.equal(isBotMessage("fix: handle EOF in the FEN parser"), false);
    assert.equal(isBotMessage("Add magic bitboard move generation"), false);
    // Contains "commit" but isn't the generator's shape.
    assert.equal(isBotMessage("refactor: split the commit parser"), false);
  });

  it("treats an empty message as noise", () => {
    assert.equal(isBotMessage(""), true);
    assert.equal(isBotMessage("   \n  "), true);
  });
});

describe("dropTimestampClusters", () => {
  it("removes commits sharing a second with many others", () => {
    const generated = Array.from({ length: 40 }, (_, i) => ({
      at: "2026-03-05T13:02:20Z",
      id: String(i),
    }));
    const real = [
      { at: "2026-08-05T15:25:05Z", id: "a" },
      { at: "2026-08-05T15:26:11Z", id: "b" },
    ];
    const kept = dropTimestampClusters([...generated, ...real]);
    assert.deepEqual(
      kept.map((c) => c.id),
      ["a", "b"],
    );
  });

  it("keeps small bursts, which happen when genuinely working fast", () => {
    const burst = Array.from({ length: 4 }, (_, i) => ({
      at: "2026-08-05T15:25:05Z",
      id: String(i),
    }));
    assert.equal(dropTimestampClusters(burst).length, 4);
  });
});

describe("classify", () => {
  it("reads conventional commit prefixes", () => {
    assert.equal(classify("feat: add the shelf"), "feat");
    assert.equal(classify("fix(parser): handle EOF"), "fix");
    assert.equal(classify("feat(api)!: breaking change"), "feat");
    assert.equal(classify("chore: bump deps"), "chore");
  });

  it("maps aliases onto canonical kinds", () => {
    assert.equal(classify("bugfix: off-by-one"), "fix");
    assert.equal(classify("hotfix: revert"), "fix");
    assert.equal(classify("feature: new screen"), "feat");
  });

  it("sniffs the leading verb when not conventionally formatted", () => {
    assert.equal(classify("Fix the transposition table"), "fix");
    assert.equal(classify("Add zobrist hashing"), "feat");
    assert.equal(classify("Refactor board utils"), "refactor");
  });

  it("falls back to other", () => {
    assert.equal(classify("wip"), "other");
    assert.equal(classify("asdf"), "other");
  });

  /*
   * The security-critical property: for work commits, `kind` is the only field
   * published. It must therefore be drawn from a closed set and never echo any
   * part of the message.
   */
  it("never leaks message content into the kind", () => {
    const secrets = [
      "feat: add ACME_CORP_SECRET_KEY to the vault",
      "fix(billing): stop double-charging enterprise customers",
      "chore: remove the internal pricing table",
      "some entirely unstructured message about a client",
    ];
    const allowed = new Set([
      "feat",
      "fix",
      "chore",
      "refactor",
      "docs",
      "test",
      "style",
      "perf",
      "build",
      "ci",
      "other",
    ]);
    for (const message of secrets) {
      const kind = classify(message);
      assert.ok(allowed.has(kind), `${kind} is not in the closed set`);
      // No token longer than the kind itself may survive.
      assert.ok(
        !message.toLowerCase().includes(kind) ||
          kind.length <= 9,
        "kind must be a label, not an excerpt",
      );
    }
  });
});

describe("toWorkCommit", () => {
  const secret = {
    sha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    message: "fix(billing): stop double-charging ACME enterprise accounts",
    at: "2026-08-14T09:12:44Z",
  };

  it("publishes only kind, timestamp, visibility and a hashed id", () => {
    const c = toWorkCommit(secret);
    assert.deepEqual(Object.keys(c).sort(), ["at", "id", "kind", "visibility"]);
    assert.equal(c.kind, "fix");
    assert.equal(c.visibility, "work");
    assert.equal(c.at, secret.at);
  });

  it("does not carry the message, repo, url or language", () => {
    const c = toWorkCommit(secret);
    assert.equal(c.message, undefined);
    assert.equal(c.repo, undefined);
    assert.equal(c.url, undefined);
    assert.equal(c.language, undefined);
  });

  it("does not expose a usable sha prefix", () => {
    const c = toWorkCommit(secret);
    assert.ok(!secret.sha.startsWith(c.id.slice(1)), "id is a sha prefix");
    assert.ok(!c.id.includes(secret.sha.slice(0, 6)));
  });

  it("serialises without any fragment of the message", () => {
    const json = JSON.stringify(toWorkCommit(secret));
    for (const word of ["billing", "double", "charging", "ACME", "enterprise"]) {
      assert.ok(!json.toLowerCase().includes(word.toLowerCase()), `leaked ${word}`);
    }
  });

  it("is stable across runs, so the client can key on it", () => {
    assert.equal(toWorkCommit(secret).id, toWorkCommit(secret).id);
  });
});

describe("assertNoLeak", () => {
  it("passes a properly built work commit", () => {
    assert.doesNotThrow(() =>
      assertNoLeak(toWorkCommit({ sha: "abc123", message: "feat: x", at: "2026-01-01T00:00:00Z" })),
    );
  });

  it("throws when a work commit carries a message", () => {
    const tampered = {
      ...toWorkCommit({ sha: "abc123", message: "feat: x", at: "2026-01-01T00:00:00Z" }),
      message: "feat: the real subject",
    };
    assert.throws(() => assertNoLeak(tampered), /forbidden field: message/);
  });

  it("throws when a work commit carries a repo name", () => {
    const tampered = {
      ...toWorkCommit({ sha: "abc123", message: "fix: y", at: "2026-01-01T00:00:00Z" }),
      repo: "CodingNinjasHQ/secret-service",
    };
    assert.throws(() => assertNoLeak(tampered), /forbidden field: repo/);
  });

  it("throws when a work commit has a raw sha as its id", () => {
    const tampered = {
      ...toWorkCommit({ sha: "abc123", message: "fix: y", at: "2026-01-01T00:00:00Z" }),
      id: "a1b2c3d4e5f6",
    };
    assert.throws(() => assertNoLeak(tampered), /not a hashed id/);
  });

  it("ignores non-work commits, which are allowed to carry everything", () => {
    const own = toOwnCommit({
      visibility: "personal",
      sha: "deadbeef1234",
      message: "Give every scrollbar a wooden thumb",
      repo: "yashdagar/catan",
      url: "https://github.com/yashdagar/catan/commit/deadbeef1234",
      at: "2026-08-02T19:18:25Z",
    });
    assert.doesNotThrow(() => assertNoLeak(own));
    assert.equal(own.message, "Give every scrollbar a wooden thumb");
  });
});

describe("computeStreak", () => {
  const at = (d: string) => ({ at: `${d}T10:00:00Z` }) as never;

  it("counts back from today", () => {
    const commits = [at("2026-08-16"), at("2026-08-15"), at("2026-08-14")];
    assert.equal(computeStreak(commits, new Date("2026-08-16T12:00:00Z")), 3);
  });

  it("survives today being empty so far", () => {
    const commits = [at("2026-08-15"), at("2026-08-14")];
    assert.equal(computeStreak(commits, new Date("2026-08-16T12:00:00Z")), 2);
  });

  it("breaks on a real gap", () => {
    const commits = [at("2026-08-15"), at("2026-08-13")];
    assert.equal(computeStreak(commits, new Date("2026-08-16T12:00:00Z")), 1);
  });

  it("is zero when nothing is recent", () => {
    assert.equal(
      computeStreak([at("2026-07-01")], new Date("2026-08-16T12:00:00Z")),
      0,
    );
  });
});
