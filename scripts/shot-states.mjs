/**
 * Capture the scene in each of its states.
 *
 *   node scripts/shot-states.mjs <outdir> [url]
 *
 * Drives the real zustand store through `window.__scene` rather than clicking
 * guessed pixel coordinates, so each frame is genuinely the state a visitor
 * would reach — and the script can't quietly start photographing empty space
 * when the layout moves.
 *
 * Waits for the camera to settle rather than for a fixed delay: the rig damps
 * exponentially, so a fixed wait either truncates the move or wastes seconds.
 */
import { chromium } from "playwright";
import path from "node:path";

const [, , outDir = ".", url = "http://localhost:3000"] = process.argv;

const STATES = [
  { name: "rest", apply: (s) => s.getState().clearFocus() },
  { name: "focus-commits", apply: (s) => s.getState().focusScreen("commits") },
  { name: "focus-about", apply: (s) => s.getState().focusScreen("about") },
  { name: "focus-music", apply: (s) => s.getState().focusScreen("music") },
  { name: "focus-catan", apply: (s) => s.getState().focusBox("catan") },
];

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
await page.waitForFunction(() => !!window.__scene, { timeout: 15000 });

for (const state of STATES) {
  await page.evaluate(
    ([fnBody]) => {
      // eslint-disable-next-line no-new-func
      new Function("s", fnBody)(window.__scene);
    },
    [`(${state.apply.toString()})(s)`],
  );

  // Settle: sample the camera until it stops moving. The rig converges
  // exponentially, so "stopped" means two consecutive frames under a threshold.
  await page.waitForFunction(
    () => {
      const w = window;
      const cam = w.__cameraProbe;
      if (!cam) return true; // no probe — fall through to the timeout below
      const now = `${cam.x.toFixed(4)},${cam.y.toFixed(4)},${cam.z.toFixed(4)}`;
      const settled = w.__lastCam === now;
      w.__lastCam = now;
      return settled;
    },
    { timeout: 6000, polling: 120 },
  ).catch(() => {});

  await page.waitForTimeout(900);

  const file = path.join(outDir, `${state.name}.png`);
  await page.screenshot({ path: file });
  console.log("wrote", file);
}

await browser.close();

if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of errors.slice(0, 10)) console.log("  " + e);
  process.exitCode = 1;
}
