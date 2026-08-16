/**
 * Screenshot the running dev server.
 *
 *   node scripts/shot.mjs [outfile] [url] [width] [height]
 *
 * Uses the system Chrome rather than bundled Chromium: headless Chromium falls
 * back to SwiftShader for WebGL, which renders correctly but slowly and with
 * subtly different tone mapping. Since this project is judged on how it looks,
 * the screenshots need to come from the same renderer a visitor would use.
 *
 * Waits for the canvas to have actually drawn something rather than for a fixed
 * timeout — a black frame captured too early looks identical to a broken scene.
 */
import { chromium } from "playwright";

const [, , out = "shot.png", url = "http://localhost:3000", w = "1440", h = "900"] =
  process.argv;

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 2,
});

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });

// Wait for a canvas whose backbuffer isn't uniformly the clear colour.
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
    { timeout: 15000 },
  )
  .catch(() => console.warn("! canvas never drew a non-uniform frame"));

await page.screenshot({ path: out });
await browser.close();

console.log(`wrote ${out}`);
if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of errors.slice(0, 10)) console.log("  " + e);
  process.exitCode = 1;
}
