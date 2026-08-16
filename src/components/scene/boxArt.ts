/**
 * Printed artwork for the two board game boxes.
 *
 * Drawn to canvas rather than shipped as image files. Two reasons: nothing here
 * needs to be photographic, and a procedural lid means the colours can be tuned
 * against the room's palette instead of fighting it.
 *
 * The two lids are deliberately in different idioms, because their subjects
 * are. Catan's identity is the hex — it's on the board, the pieces and the logo
 * — and its boxes have always been warm illustrated island scenes under a heavy
 * wordmark banner. Chess packaging goes the other way entirely: the reference
 * designs are minimal and typographic, black foil on grey board, a severely
 * limited palette and notation used as ornament. One lid should look printed in
 * four colours and the other should look foil-blocked in one.
 *
 * Both are built to read as a silhouette first. They sit on a shelf a metre and
 * a half from the camera where the lid is barely 80 pixels across, so each has
 * to survive being reduced to a field of colour and a bar of type. The detail
 * is for the moment someone pulls one down.
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

/* ==========================================================================
 * Chess — minimal, typographic, one colour and a foil
 * ======================================================================= */

const FOIL = "#c9a54e";
const CHESS_BG = "#111315";

/**
 * A king, in profile.
 *
 * The most drawable of the six and the least ambiguous — nobody has ever
 * mistaken a cross on a stem for anything else. The knight is the more famous
 * silhouette and needs real draughtsmanship to avoid looking like a seahorse.
 *
 * Drawn as one half and mirrored, which is both less code and the only way to
 * guarantee it's actually symmetric.
 */
function kingHalf(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number,
) {
  const w = h * 0.34;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.5);
  // Cross.
  ctx.lineTo(cx + w * 0.16, cy - h * 0.5);
  ctx.lineTo(cx + w * 0.16, cy - h * 0.43);
  ctx.lineTo(cx + w * 0.42, cy - h * 0.43);
  ctx.lineTo(cx + w * 0.42, cy - h * 0.35);
  ctx.lineTo(cx + w * 0.16, cy - h * 0.35);
  ctx.lineTo(cx + w * 0.16, cy - h * 0.28);
  // Crown.
  ctx.bezierCurveTo(
    cx + w * 0.8,
    cy - h * 0.27,
    cx + w * 0.95,
    cy - h * 0.13,
    cx + w * 0.6,
    cy - h * 0.05,
  );
  // Collar.
  ctx.lineTo(cx + w * 0.72, cy + h * 0.01);
  ctx.lineTo(cx + w * 0.48, cy + h * 0.06);
  // Body, flaring to the foot.
  ctx.bezierCurveTo(
    cx + w * 0.4,
    cy + h * 0.22,
    cx + w * 0.6,
    cy + h * 0.3,
    cx + w * 0.66,
    cy + h * 0.36,
  );
  ctx.lineTo(cx + w * 0.48, cy + h * 0.38);
  ctx.bezierCurveTo(
    cx + w * 0.72,
    cy + h * 0.42,
    cx + w * 1.0,
    cy + h * 0.44,
    cx + w * 1.06,
    cy + h * 0.5,
  );
  ctx.lineTo(cx, cy + h * 0.5);
  ctx.closePath();
  ctx.fill();
}

function king(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number) {
  kingHalf(ctx, cx, cy, h);
  ctx.save();
  ctx.translate(cx * 2, 0);
  ctx.scale(-1, 1);
  kingHalf(ctx, cx, cy, h);
  ctx.restore();
}

function chessLid(): CanvasTexture {
  const { canvas, ctx } = surface(LID, LID);
  const rand = rng(1729);

  ctx.fillStyle = CHESS_BG;
  ctx.fillRect(0, 0, LID, LID);

  // Board grain: greyboard has a visible tooth, and it's the only texture on an
  // otherwise completely flat lid.
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.022})`;
    ctx.fillRect(rand() * LID, rand() * LID, 2, 2);
  }

  /*
   * The board, as a ghost.
   *
   * Eight by eight in a barely-there tint, with four squares picked out in foil
   * — the last moves of a game. A fully drawn checkerboard would be the loudest
   * thing on the lid and would fight the type; at this weight it's a watermark
   * that only resolves when you're holding the box.
   */
  const size = LID * 0.62;
  const cell = size / 8;
  const ox = (LID - size) / 2;
  const oy = LID * 0.11;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2) continue;
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.fillRect(ox + col * cell, oy + row * cell, cell, cell);
    }
  }

  for (const [c, rw] of [
    [4, 6],
    [4, 4],
    [2, 5],
    [5, 2],
  ] as const) {
    ctx.fillStyle = "rgba(201,165,78,0.2)";
    ctx.fillRect(ox + c * cell, oy + rw * cell, cell, cell);
  }

  ctx.strokeStyle = "rgba(201,165,78,0.3)";
  ctx.lineWidth = LID * 0.0035;
  ctx.strokeRect(ox, oy, size, size);

  // The king, standing on the board.
  ctx.fillStyle = "#eae6dd";
  king(ctx, LID * 0.5, oy + size * 0.46, size * 0.74);

  // Notation, which is the ornament the reference designs all reach for.
  ctx.fillStyle = "rgba(201,165,78,0.55)";
  ctx.font = `500 ${LID * 0.025}px ui-monospace, SFMono-Regular, monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ["1. e4 e5", "2. Nf3 Nc6", "3. Bb5 a6"].forEach((line, i) => {
    ctx.fillText(line, ox, oy + size + LID * 0.05 + i * LID * 0.034);
  });

  // Wordmark. High-contrast serif, wide tracking, a foil rule above and below —
  // the whole vocabulary of a black-and-gold box in three marks.
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2efe8";
  ctx.font = `400 ${LID * 0.112}px ui-serif, Georgia, "Times New Roman", serif`;
  ctx.letterSpacing = `${LID * 0.05}px`;
  ctx.fillText("CHESS", LID * 0.52, LID * 0.855);
  ctx.letterSpacing = "0px";

  ctx.strokeStyle = FOIL;
  ctx.lineWidth = LID * 0.004;
  ctx.beginPath();
  ctx.moveTo(LID * 0.3, LID * 0.796);
  ctx.lineTo(LID * 0.7, LID * 0.796);
  ctx.moveTo(LID * 0.3, LID * 0.911);
  ctx.lineTo(LID * 0.7, LID * 0.911);
  ctx.stroke();

  ctx.fillStyle = FOIL;
  ctx.font = `500 ${LID * 0.027}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${LID * 0.02}px`;
  ctx.fillText("ENGINE · PRIVATE REPO", LID * 0.5, LID * 0.948);
  ctx.letterSpacing = "0px";

  return texture(canvas);
}

/* ==========================================================================
 * Spines
 *
 * Stacked on a shelf, this is the only part of a board game box anybody ever
 * sees — so each one carries its lid's whole identity in 75 mm.
 * ======================================================================= */

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

function chessSpine(): CanvasTexture {
  const { canvas, ctx } = surface(LID, SPINE_H);

  ctx.fillStyle = CHESS_BG;
  ctx.fillRect(0, 0, LID, SPINE_H);

  ctx.strokeStyle = FOIL;
  ctx.lineWidth = SPINE_H * 0.03;
  ctx.strokeRect(SPINE_H * 0.2, SPINE_H * 0.2, LID - SPINE_H * 0.4, SPINE_H * 0.6);

  ctx.fillStyle = "#f2efe8";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${SPINE_H * 0.36}px ui-serif, Georgia, serif`;
  ctx.letterSpacing = `${SPINE_H * 0.13}px`;
  const chessEnd = SPINE_H * 0.75 + ctx.measureText("CHESS").width;
  ctx.fillText("CHESS", SPINE_H * 0.75, SPINE_H * 0.53);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = FOIL;
  ctx.textAlign = "right";
  ctx.font = `500 ${SPINE_H * 0.16}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${SPINE_H * 0.05}px`;
  const chessCredit = "YASH DAGAR";
  const chessRight = LID - SPINE_H * 0.6;
  if (chessRight - ctx.measureText(chessCredit).width > chessEnd + SPINE_H * 0.4) {
    ctx.fillText(chessCredit, chessRight, SPINE_H * 0.54);
  }
  ctx.letterSpacing = "0px";

  return texture(canvas);
}

export interface BoxArt {
  lid: CanvasTexture;
  spine: CanvasTexture;
}

export function catanArt(): BoxArt {
  return { lid: catanLid(), spine: catanSpine() };
}

export function chessArt(): BoxArt {
  return { lid: chessLid(), spine: chessSpine() };
}
