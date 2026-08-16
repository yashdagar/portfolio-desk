/**
 * Capture the three delivery modes.
 *
 *   node scripts/shot-modes.mjs <outdir> [url]
 *
 * The site decides at runtime whether to serve the full room, a hero render
 * with the page below it, or no canvas at all. Each is a different experience
 * for a different visitor, and each has to be judged — the fallback especially,
 * since it's the one a recruiter is most likely to get.
 */
import { chromium } from "playwright";
import path from "node:path";

const [, , outDir = ".", url = "http://localhost:3000"] = process.argv;

const MODES = [
  {
    name: "desktop-scene",
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    full: false,
  },
  {
    name: "mobile-hero",
    context: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    },
    full: true,
  },
  {
    name: "reduced-motion",
    context: {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    },
    full: true,
  },
];

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist"],
});

let failed = false;

for (const mode of MODES) {
  const context = await browser.newContext(mode.context);
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const file = path.join(outDir, `${mode.name}.png`);
  await page.screenshot({ path: file, fullPage: mode.full });
  console.log(`wrote ${file}`);

  if (errors.length) {
    failed = true;
    console.log(`  ${errors.length} console error(s):`);
    for (const e of errors.slice(0, 5)) console.log("    " + e);
  }

  await context.close();
}

await browser.close();
if (failed) process.exitCode = 1;
