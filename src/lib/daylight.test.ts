import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { daylight, formatIst, istHours } from "./daylight";

/** A Date at a given IST wall-clock time, built from the UTC offset. */
const ist = (hours: number, minutes = 0) =>
  new Date(Date.UTC(2026, 7, 16, hours - 5, minutes - 30));

describe("istHours", () => {
  it("converts UTC to IST regardless of the machine's timezone", () => {
    // 00:00 UTC is 05:30 IST.
    assert.equal(istHours(new Date("2026-08-16T00:00:00Z")), 5.5);
    assert.equal(istHours(new Date("2026-08-16T18:30:00Z")), 0);
  });

  it("wraps past midnight", () => {
    // 20:00 UTC is 01:30 IST the next day.
    assert.equal(istHours(new Date("2026-08-16T20:00:00Z")), 1.5);
  });
});

describe("daylight", () => {
  it("is dark in the small hours", () => {
    const d = daylight(ist(3));
    assert.equal(d.level, 0);
    assert.equal(d.night, true);
  });

  it("is full daylight at midday", () => {
    const d = daylight(ist(13));
    assert.ok(d.level > 0.98, `level was ${d.level}`);
    assert.equal(d.night, false);
  });

  it("rises through dawn and falls through dusk", () => {
    assert.ok(daylight(ist(5)).level < daylight(ist(7)).level);
    assert.ok(daylight(ist(20)).level < daylight(ist(18)).level);
  });

  it("trades the lamp against the window", () => {
    const noon = daylight(ist(13));
    const midnight = daylight(ist(1));
    assert.ok(midnight.lampIntensity > noon.lampIntensity);
    assert.ok(noon.windowIntensity > midnight.windowIntensity);
  });

  it("only casts direct sun while the sun is up", () => {
    // The sun is the shadow-caster, so a non-zero value in the small hours
    // would put a window-shaped patch of light on the floor at 3am.
    assert.equal(daylight(ist(3)).sunIntensity, 0);
    assert.ok(daylight(ist(13)).sunIntensity > 2.5);
  });

  it("switches the room's own lights rather than dimming them", () => {
    // The bias strip and the shelf spot are on at night and off in daylight,
    // and — unlike the lamp — they have to be fully off well before noon.
    // A strip glowing at a fifth of brightness at 3pm is the giveaway that
    // this is a ramp rather than a switch.
    assert.equal(daylight(ist(2)).nightIntensity, 1);
    assert.equal(daylight(ist(15)).nightIntensity, 0);
    assert.ok(daylight(ist(9)).nightIntensity === 0);
  });

  it("never lets the window go fully black", () => {
    // A pure-black window reads as a hole in the wall, not as glass at night.
    assert.ok(daylight(ist(2)).windowIntensity > 0);
  });

  it("is gold near the horizon and cooler at noon", () => {
    const red = (hex: string) => parseInt(hex.slice(1, 3), 16);
    const blue = (hex: string) => parseInt(hex.slice(5, 7), 16);
    const dusk = daylight(ist(18)).windowColor;
    const noon = daylight(ist(12, 30)).windowColor;
    // Gold means red dominates blue; midday light is blue-leaning.
    assert.ok(red(dusk) - blue(dusk) > red(noon) - blue(noon));
  });

  it("emits a valid hex colour at every hour", () => {
    for (let h = 0; h < 24; h += 0.25) {
      const d = daylight(ist(Math.floor(h), (h % 1) * 60));
      for (const c of [d.windowColor, d.bounceColor, d.sunColor]) {
        assert.match(c, /^#[0-9a-f]{6}$/, `${c} at ${h}h`);
      }
      assert.ok(d.level >= 0 && d.level <= 1);
    }
  });
});

describe("formatIst", () => {
  it("pads to a stable width so the label doesn't jitter", () => {
    assert.equal(formatIst(ist(9, 5)), "09:05");
    assert.equal(formatIst(ist(23, 59)), "23:59");
  });
});
