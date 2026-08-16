/**
 * Printed artwork for the Catan box.
 *
 * Drawn to canvas rather than shipped as an image file. Two reasons: nothing
 * here needs to be photographic, and a procedural lid means the colours can be
 * tuned against the room's palette instead of fighting it.
 *
 * Catan's identity is the hex — it's on the board, the pieces and the logo —
 * and its boxes have always been warm illustrated island scenes under a heavy
 * wordmark banner. So the lid is one: a 3-4-5-4-3 island, six terrains with
 * their icons, number tokens with the red six and eight, roads and settlements
 * laid over it.
 *
 * There was a chess lid beside it in the opposite idiom — minimal, typographic,
 * foil on grey board — and it was decent work that came out of the room the
 * moment the chess set became a wooden folding board instead of a carton. Two
 * printed cartons on a shelf are one object repeated; a carton and a wooden
 * case are a shelf. See chessCase.ts.
 *
 * Built to read as a silhouette first. It sits a metre and a half from the
 * camera where the lid is barely 80 pixels across, so it has to survive being
 * reduced to a field of colour and a bar of type. The detail is for the moment
 * someone pulls it down.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

const LID = 1024;
/** Spine art is the same width as the lid but only as tall as the box is deep. */
const SPINE_H = Math.round(LID * (0.075 / 0.295));

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearFilter;
  return tex;
}

function surface(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/* ==========================================================================
 * Catan — illustrated, warm, four colours
 * ======================================================================= */

/** Flat-top hexagon path, centred on (cx, cy). */
function hexPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

interface Terrain {
  fill: string;
  shade: string;
  /** Drawn small and centred: the thing that says which resource this is. */
  icon: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;
}

const TERRAIN: Terrain[] = [
  {
    // Forest
    fill: "#3f6b3f",
    shade: "#2c4d2d",
    icon: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#20401f";
      for (const dx of [-r * 0.34, 0, r * 0.34]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy - r * 0.42);
        ctx.lineTo(cx + dx + r * 0.2, cy + r * 0.18);
        ctx.lineTo(cx + dx - r * 0.2, cy + r * 0.18);
        ctx.closePath();
        ctx.fill();
      }
    },
  },
  {
    // Fields
    fill: "#d7a63f",
    shade: "#b3852c",
    icon: (ctx, cx, cy, r) => {
      ctx.strokeStyle = "#8a6318";
      ctx.lineWidth = r * 0.09;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * r * 0.24, cy - r * 0.38);
        ctx.lineTo(cx + i * r * 0.24, cy + r * 0.34);
        ctx.stroke();
      }
    },
  },
  {
    // Pasture
    fill: "#8fae4c",
    shade: "#6f8c38",
    icon: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#eee8dc";
      for (const [dx, dy] of [
        [-0.26, 0.06],
        [0.24, -0.14],
      ]) {
        ctx.beginPath();
        ctx.ellipse(cx + dx * r, cy + dy * r, r * 0.2, r * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    // Hills, i.e. brick
    fill: "#a95d38",
    shade: "#84462a",
    icon: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#7b3d22";
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const off = row % 2 ? r * 0.14 : 0;
          ctx.fillRect(
            cx - r * 0.42 + col * r * 0.3 + off,
            cy - r * 0.34 + row * r * 0.25,
            r * 0.22,
            r * 0.15,
          );
        }
      }
    },
  },
  {
    // Mountains, i.e. ore
    fill: "#7d838c",
    shade: "#5f656e",
    icon: (ctx, cx, cy, r) => {
      ctx.fillStyle = "#4a4f57";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.44, cy + r * 0.3);
      ctx.lineTo(cx - r * 0.1, cy - r * 0.36);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.06);
      ctx.lineTo(cx + r * 0.36, cy - r * 0.16);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.3);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    // Desert
    fill: "#cbb488",
    shade: "#ab946a",
    icon: (ctx, cx, cy, r) => {
      ctx.strokeStyle = "#9c8560";
      ctx.lineWidth = r * 0.08;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.4, cy + i * r * 0.22);
        ctx.quadraticCurveTo(
          cx,
          cy + i * r * 0.22 - r * 0.14,
          cx + r * 0.4,
          cy + i * r * 0.22,
        );
        ctx.stroke();
      }
    },
  },
];

/** The cream discs with a roll number on them. Instantly says "Catan". */
function numberToken(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  n: number,
) {
  ctx.fillStyle = "#efe3c8";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(60,44,26,0.35)";
  ctx.lineWidth = r * 0.12;
  ctx.stroke();

  // 6 and 8 are red on every edition ever printed.
  ctx.fillStyle = n === 6 || n === 8 ? "#a8332a" : "#3a2c1c";
  ctx.font = `700 ${r * 1.15}px ui-serif, Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), cx, cy + r * 0.04);
}

function catanLid(): CanvasTexture {
  const { canvas, ctx } = surface(LID, LID);
  const rand = rng(2718);

  // Sea, lit from the top right where the sun is.
  const sea = ctx.createRadialGradient(
    LID * 0.78,
    LID * 0.1,
    LID * 0.05,
    LID * 0.5,
    LID * 0.55,
    LID * 0.95,
  );
  sea.addColorStop(0, "#3f7f92");
  sea.addColorStop(0.45, "#20586d");
  sea.addColorStop(1, "#123a4c");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, LID, LID);

  const sun = ctx.createRadialGradient(
    LID * 0.82,
    LID * 0.1,
    0,
    LID * 0.82,
    LID * 0.1,
    LID * 0.3,
  );
  sun.addColorStop(0, "rgba(255,232,180,0.85)");
  sun.addColorStop(1, "rgba(255,232,180,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, LID, LID * 0.5);

  // Swell: a few pale arcs, which is all a painted sea needs at this size.
  ctx.strokeStyle = "rgba(220,238,244,0.16)";
  for (let i = 0; i < 26; i++) {
    const y = LID * 0.08 + rand() * LID * 0.78;
    const x = rand() * LID;
    const w = LID * (0.04 + rand() * 0.09);
    ctx.lineWidth = LID * 0.005;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - LID * 0.012, x + w, y);
    ctx.stroke();
  }

  // The island: the standard 3-4-5-4-3 layout, which is the shape everyone
  // recognises long before they can read anything.
  const r = LID * 0.083;
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);
  const rows = [3, 4, 5, 4, 3];
  const cx0 = LID * 0.5;
  const cy0 = LID * 0.34;

  const NUMBERS = [10, 2, 9, 12, 6, 4, 10, 9, 11, 0, 3, 8, 8, 3, 4, 5, 5, 6, 11];
  let n = 0;

  // A soft shore, so the island isn't a hard-edged sticker on the water.
  ctx.fillStyle = "rgba(214,196,150,0.35)";
  rows.forEach((count, ri) => {
    const row = ri - 2;
    for (let i = 0; i < count; i++) {
      hexPath(ctx, cx0 + row * dx, cy0 + (i - (count - 1) / 2) * dy, r * 1.16);
      ctx.fill();
    }
  });

  rows.forEach((count, ri) => {
    const row = ri - 2;
    for (let i = 0; i < count; i++) {
      const cx = cx0 + row * dx;
      const cy = cy0 + (i - (count - 1) / 2) * dy;
      const terrain = TERRAIN[n % TERRAIN.length];

      hexPath(ctx, cx, cy, r * 0.97);
      ctx.fillStyle = terrain.fill;
      ctx.fill();

      // Shade the lower half of each tile, so nineteen flat hexes become
      // nineteen objects with a light direction.
      ctx.save();
      ctx.clip();
      ctx.fillStyle = terrain.shade;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 0.18);
      ctx.lineTo(cx + r, cy + r * 0.02);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      terrain.icon(ctx, cx, cy, r);
      ctx.restore();

      hexPath(ctx, cx, cy, r * 0.97);
      ctx.strokeStyle = "rgba(30,42,46,0.45)";
      ctx.lineWidth = LID * 0.005;
      ctx.stroke();

      if (NUMBERS[n]) numberToken(ctx, cx, cy + r * 0.02, r * 0.3, NUMBERS[n]);
      n++;
    }
  });

  // Roads and settlements, in two players' colours.
  const play = (colour: string, pts: [number, number][]) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = LID * 0.016;
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();

    ctx.fillStyle = colour;
    for (const [x, y] of [pts[0], pts[pts.length - 1]]) {
      // Settlements are little houses: a square with a roof.
      ctx.beginPath();
      ctx.moveTo(x - LID * 0.018, y + LID * 0.016);
      ctx.lineTo(x - LID * 0.018, y - LID * 0.004);
      ctx.lineTo(x, y - LID * 0.022);
      ctx.lineTo(x + LID * 0.018, y - LID * 0.004);
      ctx.lineTo(x + LID * 0.018, y + LID * 0.016);
      ctx.closePath();
      ctx.fill();
    }
  };

  play("#e4e0d6", [
    [cx0 - dx * 0.9, cy0 - dy * 1.35],
    [cx0 + dx * 0.15, cy0 - dy * 0.5],
    [cx0 + dx * 1.05, cy0 + dy * 0.55],
  ]);
  play("#c1462f", [
    [cx0 - dx * 1.2, cy0 + dy * 0.65],
    [cx0 - dx * 0.2, cy0 + dy * 1.15],
  ]);

  // A ship out on the water, bottom left.
  ctx.fillStyle = "#e8dcc0";
  ctx.beginPath();
  ctx.moveTo(LID * 0.11, LID * 0.6);
  ctx.lineTo(LID * 0.19, LID * 0.6);
  ctx.lineTo(LID * 0.165, LID * 0.635);
  ctx.lineTo(LID * 0.125, LID * 0.635);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(LID * 0.15, LID * 0.505);
  ctx.lineTo(LID * 0.185, LID * 0.595);
  ctx.lineTo(LID * 0.15, LID * 0.595);
  ctx.closePath();
  ctx.fill();

  /*
   * The wordmark banner.
   *
   * Knocked out of a solid bar rather than set over the artwork. Type on a busy
   * field is the single most common way a game box lid goes illegible, and at
   * eighty pixels the bar does more work than the letters do.
   */
  const barY = LID * 0.685;
  const barH = LID * 0.215;

  const band = ctx.createLinearGradient(0, barY, 0, barY + barH);
  band.addColorStop(0, "#b7431f");
  band.addColorStop(1, "#8f2f16");
  ctx.fillStyle = band;
  ctx.fillRect(LID * 0.055, barY, LID * 0.89, barH);

  ctx.strokeStyle = "rgba(240,224,190,0.55)";
  ctx.lineWidth = LID * 0.005;
  ctx.strokeRect(
    LID * 0.055 + LID * 0.012,
    barY + LID * 0.012,
    LID * 0.89 - LID * 0.024,
    barH - LID * 0.024,
  );

  // A small hex, because the hex is the logo.
  ctx.fillStyle = "rgba(242,228,198,0.92)";
  hexPath(ctx, LID * 0.135, barY + barH * 0.42, LID * 0.032);
  ctx.fill();

  ctx.fillStyle = "#f2e4c6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${LID * 0.125}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${LID * 0.026}px`;
  ctx.fillText("CATAN", LID * 0.53, barY + barH * 0.42);

  // Measured, not guessed: at the old size and tracking this line was 940px
  // wide inside a 912px banner, and the last four characters fell off the end.
  ctx.font = `600 ${LID * 0.027}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${LID * 0.007}px`;
  ctx.globalAlpha = 0.78;
  ctx.fillText("ONLINE MULTIPLAYER · 2–4 PLAYERS", LID * 0.5, barY + barH * 0.79);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = "0px";

  return texture(canvas);
}

function catanSpine(): CanvasTexture {
  const { canvas, ctx } = surface(LID, SPINE_H);

  const band = ctx.createLinearGradient(0, 0, 0, SPINE_H);
  band.addColorStop(0, "#b7431f");
  band.addColorStop(1, "#8b2d15");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, LID, SPINE_H);

  ctx.fillStyle = "rgba(242,228,198,0.92)";
  hexPath(ctx, SPINE_H * 0.62, SPINE_H * 0.5, SPINE_H * 0.22);
  ctx.fill();

  ctx.fillStyle = "#f2e4c6";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${SPINE_H * 0.38}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${SPINE_H * 0.08}px`;
  const catanEnd = SPINE_H * 1.05 + ctx.measureText("CATAN").width;
  ctx.fillText("CATAN", SPINE_H * 1.05, SPINE_H * 0.52);
  ctx.letterSpacing = "0px";

  /*
   * The credit, only if it fits.
   *
   * Both spines used to draw a title from the left and a second line
   * right-aligned, with no check that the two didn't meet — and on a 75 mm
   * spine they met in the middle and overprinted into an unreadable smear.
   * Measuring the title first is three lines and makes the overlap impossible.
   */
  ctx.textAlign = "right";
  ctx.globalAlpha = 0.6;
  ctx.font = `600 ${SPINE_H * 0.18}px ui-sans-serif, system-ui, sans-serif`;
  const catanCredit = "2–4 PLAYERS";
  if (LID * 0.95 - ctx.measureText(catanCredit).width > catanEnd + SPINE_H * 0.4) {
    ctx.fillText(catanCredit, LID * 0.95, SPINE_H * 0.54);
  }
  ctx.globalAlpha = 1;

  return texture(canvas);
}

export interface BoxArt {
  lid: CanvasTexture;
  spine: CanvasTexture;
}

export function catanArt(): BoxArt {
  return { lid: catanLid(), spine: catanSpine() };
}
