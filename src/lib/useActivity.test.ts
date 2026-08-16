import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Commit } from "./activity";
import { groupCommits, shortAge, toLogLines } from "./useActivity";

/*
 * The hook itself isn't tested here — it needs a DOM and a network. What is
 * tested is the shaping the terminal depends on, which is where the real bugs
 * live: a repo column that prints when it shouldn't, or a date line that
 * doesn't, is the kind of thing that looks fine in one screenshot and wrong in
 * every other one.
 */

let n = 0;
function commit(partial: Partial<Commit> & { at: string }): Commit {
  return {
    id: `c${n++}`,
    visibility: "public",
    kind: "feat",
    message: "a commit",
    repo: "yashdagar/portfolio-desk",
    ...partial,
  };
}

describe("groupCommits", () => {
  it("collapses a run on one repo on one day", () => {
    const groups = groupCommits([
      commit({ at: "2026-08-16T13:00:00Z" }),
      commit({ at: "2026-08-16T12:00:00Z" }),
      commit({ at: "2026-08-16T11:00:00Z", repo: "yashdagar/catan" }),
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].commits.length, 2);
    assert.equal(groups[1].repo, "yashdagar/catan");
  });

  it("starts a new group when the day turns over", () => {
    const groups = groupCommits([
      commit({ at: "2026-08-16T00:30:00Z" }),
      commit({ at: "2026-08-15T23:30:00Z" }),
    ]);
    assert.equal(groups.length, 2);
  });
});

describe("toLogLines", () => {
  it("prints one line per commit — nothing is folded away", () => {
    const commits = [
      commit({ at: "2026-08-16T13:00:00Z" }),
      commit({ at: "2026-08-16T12:00:00Z" }),
      commit({ at: "2026-08-16T11:00:00Z" }),
    ];
    const lines = toLogLines(commits);
    assert.equal(lines.filter((l) => l.type === "commit").length, 3);
  });

  it("prints the repo only when it changes", () => {
    const lines = toLogLines([
      commit({ at: "2026-08-16T13:00:00Z" }),
      commit({ at: "2026-08-16T12:00:00Z" }),
      commit({ at: "2026-08-16T11:00:00Z", repo: "yashdagar/catan" }),
      commit({ at: "2026-08-16T10:00:00Z", repo: "yashdagar/catan" }),
    ]);
    const repos = lines
      .filter((l) => l.type === "commit")
      .map((l) => (l.type === "commit" ? l.repo : null));
    assert.deepEqual(repos, [
      "yashdagar/portfolio-desk",
      undefined,
      "yashdagar/catan",
      undefined,
    ]);
  });

  it("reprints the repo under a date line, since the column is broken there", () => {
    const lines = toLogLines([
      commit({ at: "2026-08-16T13:00:00Z" }),
      commit({ at: "2026-08-15T13:00:00Z" }),
    ]);
    const repos = lines
      .filter((l) => l.type === "commit")
      .map((l) => (l.type === "commit" ? l.repo : null));
    assert.deepEqual(repos, [
      "yashdagar/portfolio-desk",
      "yashdagar/portfolio-desk",
    ]);
  });

  it("counts the whole day, not the group, on a date line", () => {
    const lines = toLogLines([
      commit({ at: "2026-08-16T13:00:00Z" }),
      commit({ at: "2026-08-16T12:00:00Z", repo: "yashdagar/catan" }),
      commit({ at: "2026-08-16T11:00:00Z" }),
      commit({ at: "2026-08-15T11:00:00Z" }),
    ]);
    const days = lines.filter((l) => l.type === "day");
    assert.equal(days.length, 2);
    assert.equal(days[0].type === "day" && days[0].count, 3);
    assert.equal(days[1].type === "day" && days[1].count, 1);
  });

  it("labels work commits without ever naming a repo", () => {
    const lines = toLogLines([
      commit({ at: "2026-08-16T13:00:00Z", visibility: "work", repo: undefined }),
    ]);
    const row = lines.find((l) => l.type === "commit");
    assert.equal(row?.type === "commit" && row.repo, "private");
  });

  it("gives every line a key unique within the log", () => {
    const lines = toLogLines([
      commit({ at: "2026-08-16T13:00:00Z" }),
      commit({ at: "2026-08-15T13:00:00Z" }),
      commit({ at: "2026-08-14T13:00:00Z" }),
    ]);
    assert.equal(new Set(lines.map((l) => l.key)).size, lines.length);
  });

  it("survives an empty feed", () => {
    assert.deepEqual(toLogLines([]), []);
  });
});

describe("shortAge", () => {
  const now = Date.parse("2026-08-16T12:00:00Z");

  it("drops the 'ago' so the column stays narrow", () => {
    assert.equal(shortAge("2026-08-16T10:00:00Z", now), "2h");
    assert.equal(shortAge("2026-08-13T12:00:00Z", now), "3d");
  });

  it("shortens 'just now' too, which has no ago to drop", () => {
    assert.equal(shortAge("2026-08-16T11:59:30Z", now), "now");
  });
});
