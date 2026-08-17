/**
 * Print a map of what each part of the frame actually clicks.
 *
 *   node scripts/hit-map.mjs [url] [x0] [x1] [y0] [y1]
 *
 * One character per grid point: `C` commits, `A` about, `M` music, `t` catan,
 * `h` chess, `L` lamp, `.` nothing. Laid beside a screenshot, the letters should
 * sit where the objects are.
 *
 * A broken hit region is invisible to every other check here — the render is
 * perfect and nothing works. Two things keep it fixed: `pointerEvents` on the
 * Html in Surface.tsx and `eventPrefix="client"` on the canvas.
 *
 * The camera must be back at rest before each sample or the map comes out
 * scrambled.
 */
import { chromium } from "playwright";

const [, , url = "http://localhost:3000", ...box] = process.argv;
const [X0 = 40, X1 = 1400, Y0 = 200, Y1 = 860] = box.map(Number);
const DX = 40;
const DY = 30;

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-gl=angle", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__scene, { timeout: 20000 });
await page.waitForTimeout(2000);

const settle = async () => {
  await page.evaluate(() => {
    window.__lastCam = null;
  });
  await page
    .waitForFunction(
      () => {
        const cam = window.__cameraProbe;
        if (!cam) return true;
        const now = `${cam.x.toFixed(4)},${cam.y.toFixed(4)},${cam.z.toFixed(4)}`;
        const settled = window.__lastCam === now;
        window.__lastCam = now;
        return settled;
      },
      { timeout: 8000, polling: 100 },
    )
    .catch(() => {});
};

const read = () =>
  page.evaluate(() => {
    const s = window.__scene.getState();
    return JSON.stringify({ focus: s.focus, lamp: s.lampStep });
  });

const CHAR = { commits: "C", about: "A", music: "M", catan: "t", chess: "h" };

for (let y = Y0; y <= Y1; y += DY) {
  let line = "";
  for (let x = X0; x <= X1; x += DX) {
    const before = JSON.parse(await read());
    await page.mouse.click(x, y);
    const after = JSON.parse(await read());

    if (after.lamp !== before.lamp) line += "L";
    else if (after.focus.kind === "none") line += ".";
    else line += CHAR[after.focus.id] ?? "?";

    if (after.focus.kind !== "none") {
      await page.evaluate(() => window.__scene.getState().clearFocus());
      await settle();
    }
  }
  console.log(String(y).padStart(4) + " " + line);
}

console.log(`\nx: ${X0} → ${X1} step ${DX}    y: ${Y0} → ${Y1} step ${DY}`);
await browser.close();
