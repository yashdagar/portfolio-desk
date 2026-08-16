/**
 * Printed artwork for the two board game boxes.
 *
 * Drawn to canvas rather than shipped as image files. Two reasons: nothing here
 * needs to be photographic, and a procedural lid means the colours can be pulled
 * from the same palette the rest of the site uses instead of fighting it. A
 * stock box render would be the most saturated thing in a deliberately
 * desaturated room.
 *
 * The boxes sit on a shelf about a metre and a half from the camera, where the
 * lid is maybe 80 pixels across. Everything is therefore built to read as a
 * silhouette first — a field of hexes, a checkerboard — with the title as the
 * only thing that has to survive at that size. The detail is for the moment
 * someone pulls one down.
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

/**
 * Title block shared by both lids.
 *
 * Knocked out of a solid bar rather than set over the artwork. Type over a busy
 * field is the single most common way a game box lid goes illegible, and at 80
 * pixels the bar is doing more work than the letters are.
 */
function titleBar(
  ctx: CanvasRenderingContext2D,
  w: number,
  title: string,
  sub: string,
  ink: string,
  paper: string,
) {
  const barY = LID * 0.66;
  const barH = LID * 0.235;

  ctx.fillStyle = paper;
  ctx.fillRect(LID * 0.07, barY, w - LID * 0.14, barH);

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${LID * 0.115}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${LID * 0.014}px`;
  ctx.fillText(title, w / 2, barY + barH * 0.4);

  ctx.font = `500 ${LID * 0.036}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${LID * 0.008}px`;
  ctx.globalAlpha = 0.62;
  ctx.fillText(sub, w / 2, barY + barH * 0.76);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = "0px";
}

function spine(title: string, bg: string, ink: string): CanvasTexture {
  const { canvas, ctx } = surface(LID, SPINE_H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, LID, SPINE_H);

  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.14;
  ctx.fillRect(0, SPINE_H - 6, LID, 6);
  ctx.globalAlpha = 1;

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${SPINE_H * 0.42}px ui-sans-serif, system-ui, sans-serif`;
  ctx.letterSpacing = `${SPINE_H * 0.09}px`;
  ctx.fillText(title, LID * 0.06, SPINE_H * 0.52);
  ctx.letterSpacing = "0px";

  ctx.textAlign = "right";
  ctx.globalAlpha = 0.5;
  ctx.font = `500 ${SPINE_H * 0.22}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("YASH DAGAR", LID * 0.94, SPINE_H * 0.54);
  ctx.globalAlpha = 1;

  return texture(canvas);
}

/**
 * Catan: a field of resource hexes.
 *
 * Six terrain colours on the island's own layout, with a ring of sea around it
 * — which is the shape everyone recognises long before they can read anything.
 */
function catanLid(): CanvasTexture {
  const { canvas, ctx } = surface(LID, LID);

  const sea = ctx.createLinearGradient(0, 0, 0, LID);
  sea.addColorStop(0, "#1d4f63");
  sea.addColorStop(1, "#123544");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, LID, LID);

  const TERRAIN = [
    "#8fa03f", // pasture
    "#c9a13f", // fields
    "#4f6b3a", // forest
    "#9d5f36", // hills
    "#7b7f86", // mountains
    "#c2b393", // desert
  ];

  const r = LID * 0.088;
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);
  // Standard 3-4-5-4-3 island.
  const rows = [3, 4, 5, 4, 3];
  const cx0 = LID / 2;
  const cy0 = LID * 0.36;

  let n = 0;
  rows.forEach((count, ri) => {
    const row = ri - 2;
    for (let i = 0; i < count; i++) {
      const cx = cx0 + row * dx;
      const cy = cy0 + (i - (count - 1) / 2) * dy;
      hexPath(ctx, cx, cy, r * 0.96);
      ctx.fillStyle = TERRAIN[n % TERRAIN.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(20,32,38,0.55)";
      ctx.lineWidth = LID * 0.006;
      ctx.stroke();
      n++;
    }
  });

  // A road and two settlements, so the lid says "there is a game here".
  ctx.strokeStyle = "#e8dcc4";
  ctx.lineWidth = LID * 0.014;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx0 - dx * 0.9, cy0 - dy * 1.2);
  ctx.lineTo(cx0 + dx * 0.2, cy0 - dy * 0.4);
  ctx.lineTo(cx0 + dx * 1.0, cy0 + dy * 0.7);
  ctx.stroke();

  ctx.fillStyle = "#e8dcc4";
  [
    [cx0 - dx * 0.9, cy0 - dy * 1.2],
    [cx0 + dx * 1.0, cy0 + dy * 0.7],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, LID * 0.019, 0, Math.PI * 2);
    ctx.fill();
  });

  titleBar(ctx, LID, "CATAN", "ONLINE · 2–4 PLAYERS", "#17323d", "#efe4cd");
  return texture(canvas);
}

/**
 * Chess: a board in perspective-free plan, with two pieces reduced to marks.
 *
 * Resisting the urge to draw a knight. At 80 pixels a knight is a smudge; a
 * board is unmistakable.
 */
function chessLid(): CanvasTexture {
  const { canvas, ctx } = surface(LID, LID);

  ctx.fillStyle = "#15181c";
  ctx.fillRect(0, 0, LID, LID);

  const boardSize = LID * 0.62;
  const cell = boardSize / 8;
  const ox = (LID - boardSize) / 2;
  const oy = LID * 0.075;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#e3dbcb" : "#3f4a52";
      ctx.fillRect(ox + col * cell, oy + row * cell, cell, cell);
    }
  }

  // Two squares picked out in the accent — a move, mid-game.
  ctx.fillStyle = "rgba(78,205,196,0.55)";
  ctx.fillRect(ox + 4 * cell, oy + 6 * cell, cell, cell);
  ctx.fillRect(ox + 4 * cell, oy + 4 * cell, cell, cell);

  ctx.strokeStyle = "rgba(9,12,14,0.5)";
  ctx.lineWidth = LID * 0.005;
  ctx.strokeRect(ox, oy, boardSize, boardSize);

  titleBar(ctx, LID, "CHESS", "ENGINE · PRIVATE REPO", "#e3dbcb", "#242c33");
  return texture(canvas);
}

export interface BoxArt {
  lid: CanvasTexture;
  spine: CanvasTexture;
}

export function catanArt(): BoxArt {
  return { lid: catanLid(), spine: spine("CATAN", "#17323d", "#efe4cd") };
}

export function chessArt(): BoxArt {
  return { lid: chessLid(), spine: spine("CHESS", "#242c33", "#e3dbcb") };
}
