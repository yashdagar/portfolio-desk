/**
 * Screenshot a single element, at its own size.
 *
 *   node scripts/shot-el.mjs <out.png> <url> <selector> [nth]
 *
 * Used against /screens to judge each mounted surface flat and at its true
 * design size. In the 3D scene a screen is small and at an angle, which hides
 * bad spacing, unreadable type and broken empty states very effectively.
 */
import { chromium } from "playwright";

const [, , out, url, selector, idx = "0"] = process.argv;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1400, height: 1000 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.locator(selector).nth(Number(idx)).screenshot({ path: out });
await browser.close();

console.log("wrote", out);
if (errors.length) {
  console.log(errors.slice(0, 6).join("\n"));
  process.exitCode = 1;
}
