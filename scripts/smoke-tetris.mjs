/**
 * Actually play the thing, in the room, through the real store and real key
 * events. Screenshots are not enough here — a board can look perfect and not
 * respond to a single key.
 */
import { chromium } from "playwright";

const [, , outDir, url = "http://localhost:3000"] = process.argv;

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__scene, { timeout: 20000 });
await page.waitForTimeout(2500);

const read = () =>
  page.evaluate(() => {
    const t = window.__tetris?.getState();
    if (!t) return null;
    return {
      mode: t.mode,
      score: t.game.score,
      lines: t.game.lines,
      col: t.game.current?.col ?? null,
      rot: t.game.current?.rot ?? null,
      filled: t.game.board.filter(Boolean).length,
    };
  });

const step = async (label) => console.log(label.padEnd(22), JSON.stringify(await read()));

console.log("== attract, nothing focused ==");
await step("initial");
const a = await read();
await page.waitForTimeout(2500);
const b = await read();
console.log(
  a.filled !== b.filled || a.score !== b.score
    ? "PASS  bot is playing on its own"
    : "FAIL  board is frozen in attract mode",
);

console.log("\n== keys must do nothing while unfocused ==");
// Not compared against the board, which the bot is changing anyway — the thing
// that must not happen is Space starting a game nobody asked for.
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("Space");
const after = await read();
console.log(
  after.mode === "attract" ? "PASS  ignored while unfocused" : "FAIL  keys leaked",
);

console.log("\n== focus the centre monitor and start ==");
await page.evaluate(() => window.__scene.getState().focusScreen("about"));
await page.waitForTimeout(1800);
await step("focused");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
await step("after Enter");
const started = await read();
console.log(
  started.mode === "playing" ? "PASS  game started" : "FAIL  Enter did not start",
);

console.log("\n== movement ==");
const m0 = await read();
await page.keyboard.press("ArrowLeft");
const m1 = await read();
console.log(m1.col === m0.col - 1 ? "PASS  left moves" : `FAIL  left: ${m0.col}->${m1.col}`);

await page.keyboard.press("ArrowRight");
const m2 = await read();
console.log(m2.col === m1.col + 1 ? "PASS  right moves" : `FAIL  right: ${m1.col}->${m2.col}`);

const r0 = await read();
await page.keyboard.press("ArrowUp");
const r1 = await read();
console.log(
  r1.rot !== r0.rot || r0.rot === null ? "PASS  rotate turns" : "FAIL  rotate did nothing",
);

console.log("\n== auto-shift (hold left) ==");
const d0 = await read();
await page.keyboard.down("ArrowLeft");
await page.waitForTimeout(500);
await page.keyboard.up("ArrowLeft");
const d1 = await read();
console.log(
  d1.col < d0.col - 1 ? `PASS  DAS repeated (${d0.col} -> ${d1.col})` : `FAIL  no repeat`,
);

console.log("\n== hard drop ==");
const h0 = await read();
await page.keyboard.press("Space");
await page.waitForTimeout(150);
const h1 = await read();
console.log(
  h1.filled > h0.filled && h1.score > h0.score
    ? `PASS  piece locked, score ${h0.score} -> ${h1.score}`
    : `FAIL  hard drop: ${JSON.stringify(h0)} -> ${JSON.stringify(h1)}`,
);

console.log("\n== hold ==");
await page.keyboard.press("c");
await page.waitForTimeout(120);
const held = await page.evaluate(() => window.__tetris.getState().game.hold);
console.log(held ? `PASS  hold stored ${held}` : "FAIL  hold empty");

await page.screenshot({ path: `${outDir}/room-playing.png` });

console.log("\n== stepping back pauses, coming back resumes ==");
await page.keyboard.press("Escape");
await page.waitForTimeout(1600);
const paused = await read();
console.log(
  paused.mode === "paused" ? "PASS  paused on losing focus" : `FAIL  mode ${paused.mode}`,
);
await page.screenshot({ path: `${outDir}/room-rest.png` });

await page.evaluate(() => window.__scene.getState().focusScreen("about"));
await page.waitForTimeout(1600);
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
const resumed = await read();
console.log(
  resumed.mode === "playing" && resumed.score === paused.score
    ? "PASS  resumed the same game, not a new one"
    : `FAIL  ${JSON.stringify(resumed)}`,
);

console.log("\n== top out, then the initials flow ==");
// Drops straight down the spawn columns without moving, which stacks out fast.
for (let i = 0; i < 30; i++) {
  const s = await read();
  if (s.mode === "over") break;
  await page.keyboard.press("Space");
  await page.waitForTimeout(70);
}
const dead = await read();
console.log(dead.mode === "over" ? "PASS  topped out" : `FAIL  mode ${dead.mode}`);
await page.screenshot({ path: `${outDir}/room-over.png` });

await page.keyboard.press("y");
await page.keyboard.press("s");
await page.keyboard.press("h");
await page.waitForTimeout(120);
const typed = await page.evaluate(() => window.__tetris.getState().initials);
console.log(typed === "YSH" ? "PASS  initials typed" : `FAIL  initials "${typed}"`);

await page.keyboard.press("Enter");
await page.waitForTimeout(250);
const done = await read();
const table = await page.evaluate(() => window.__tetris.getState().scores);
console.log(
  done.mode === "attract" && table.length === 1 && table[0].name === "YSH"
    ? `PASS  score saved (${table[0].name} ${table[0].score}) and back to demo`
    : `FAIL  mode ${done.mode}, table ${JSON.stringify(table)}`,
);

// Reload to prove it persisted rather than only living in memory.
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__tetris, { timeout: 15000 });
await page.waitForTimeout(1200);
const persisted = await page.evaluate(() => window.__tetris.getState().scores);
console.log(
  persisted.length === 1 && persisted[0].name === "YSH"
    ? "PASS  survived a reload"
    : `FAIL  after reload ${JSON.stringify(persisted)}`,
);

await browser.close();
if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of errors.slice(0, 8)) console.log("  " + e);
  process.exitCode = 1;
}
