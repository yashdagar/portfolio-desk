/**
 * Screenshot just the speedcube, magnified.
 *
 *   node scripts/shot-cube.mjs <out.png> [url] [scale]
 *
 * The cube is about 55 px across in a 1440-wide frame, which is the size it has
 * to work at and also far too small to tell a modelling mistake from a
 * compression artefact. This clips the ~90 px around it and renders at a high
 * device scale factor, so the pixels are real rather than upscaled.
 *
 * Judge shape here; judge whether the shape was worth it in scripts/shot.mjs,
 * at the size the thing actually is. Several rounds of this cube were lost by
 * only ever doing the first.
 */
import { chromium } from "playwright";

const [, , out = "cube.png", url = "http://localhost:3000", scale = "8"] =
  process.argv;

/** Where the cube sits in a 1440 × 900 frame, in CSS pixels. */
const CLIP = { x: 1096, y: 646, width: 92, height: 92 };

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: Number(scale),
});

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });
await page
  .waitForFunction(
    () => {
      const c = document.querySelector("canvas");
      if (!c || !c.width) return false;
      const gl = c.getContext("webgl2") ?? c.getContext("webgl");
      if (!gl) return false;
      const px = new Uint8Array(4 * 64 * 64);
      gl.readPixels(
        Math.floor(c.width / 2) - 32,
        Math.floor(c.height / 2) - 32,
        64,
        64,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        px,
      );
      return new Set(px).size > 3;
    },
    { timeout: 20000 },
  )
  .catch(() => console.warn("! canvas never drew a non-uniform frame"));

// The camera drifts on idle, so let it settle rather than catching it mid-swing.
await page.waitForTimeout(1500);
await page.screenshot({ path: out, clip: CLIP });
await browser.close();

console.log(`wrote ${out}`);
if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of errors.slice(0, 10)) console.log("  " + e);
  process.exitCode = 1;
}
