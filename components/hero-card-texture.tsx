"use client";

import { useEffect } from "react";

const W = 688;
const H = 960;

const FLAME_OUTER =
  "M99 43L91 51 86 60 84 62 82 66 82 68 80 71 79 77 78 78 78 82 77 83 77 93 78 94 78 99 79 100 80 105 87 117 91 121 91 122 119 150 119 151 129 162 137 174 142 185 142 188 144 193 144 204 143 205 143 209 142 211 144 210 151 202 156 193 156 191 158 187 158 184 159 183 159 176 160 175 158 158 157 157 156 151 154 148 154 146 147 132 137 117 117 91 112 82 110 80 108 75 106 73 106 71 102 64 101 58 100 57 100 53 99 52Z";
const FLAME_INNER =
  "M97 142L92 147 86 158 86 161 84 166 84 174 85 175 85 178 88 184 94 192 113 211 121 222 125 231 125 236 126 237 125 245 130 240 134 231 134 228 135 227 135 216 134 215 134 212 133 211 132 206 125 193 105 166 99 154 99 151 98 150 98 142Z";

const FLAME_CX = 118.5;
const FLAME_CY = 144;
const FLAME_SVG_H = 202;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBrandFlame(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  height: number,
) {
  const scale = height / FLAME_SVG_H;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-FLAME_CX, -FLAME_CY);
  ctx.fillStyle = "#FD3C73";
  ctx.fill(new Path2D(FLAME_OUTER));
  ctx.fill(new Path2D(FLAME_INNER));
  ctx.restore();
}

function drawLightningBolt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  const s = size / 24;
  ctx.beginPath();
  ctx.moveTo(13 * s, 0);
  ctx.lineTo(5 * s, 13 * s);
  ctx.lineTo(11 * s, 13 * s);
  ctx.lineTo(10.5 * s, 24 * s);
  ctx.lineTo(19 * s, 10 * s);
  ctx.lineTo(13 * s, 10 * s);
  ctx.closePath();
  ctx.fillStyle = "#f9ca24";
  ctx.fill();
  ctx.restore();
}

function drawBrandText(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  font: string,
) {
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "middle";
  const parts = [
    { t: "flytt", c: "#5C7FF3" },
    { t: ".", c: "#FD3C73" },
    { t: "io", c: "#5C7FF3" },
  ];
  const total = parts.reduce((s, p) => s + ctx.measureText(p.t).width, 0);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  for (const p of parts) {
    ctx.fillStyle = p.c;
    ctx.fillText(p.t, x, cy);
    x += ctx.measureText(p.t).width;
  }
  ctx.restore();
}

function renderHeroCard(canvas: HTMLCanvasElement) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, "#1a2035");
  bg.addColorStop(0.5, "#111827");
  bg.addColorStop(1, "#0a0e1a");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fill();

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.22, 0, W * 0.5, H * 0.22, W * 0.55);
  glow.addColorStop(0, "rgba(253,60,115,0.07)");
  glow.addColorStop(1, "rgba(253,60,115,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.7, H * 0.7, 0, W * 0.7, H * 0.7, W * 0.4);
  glow2.addColorStop(0, "rgba(92,127,243,0.05)");
  glow2.addColorStop(1, "rgba(92,127,243,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, 24, 24, W - 48, H - 48, 28);
  ctx.stroke();

  const logoY = 200;
  drawBrandFlame(ctx, W / 2, logoY, 100);
  drawBrandText(ctx, W / 2, logoY + 78, "bold 38px system-ui, sans-serif");

  const badgeY = logoY + 140;
  const badgeLabel = "ERBJUDANDE";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const badgeW = ctx.measureText(badgeLabel).width + 40;
  ctx.fillStyle = "rgba(249,202,36,0.12)";
  roundRect(ctx, (W - badgeW) / 2, badgeY - 14, badgeW, 28, 14);
  ctx.fill();
  ctx.fillStyle = "#f9ca24";
  ctx.fillText(badgeLabel, W / 2, badgeY);

  const titleY = badgeY + 60;
  drawLightningBolt(ctx, W / 2 - 140, titleY + 8, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 72px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GRATIS EL", W / 2 + 10, titleY + 20);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "400 22px system-ui, sans-serif";
  ctx.fillText("vid din flytt till ny adress", W / 2, titleY + 68);

  const btnY = titleY + 120;
  const btnW = 380;
  const btnH = 60;
  const btnX = (W - btnW) / 2;

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
  btnGrad.addColorStop(0, "#FD3C73");
  btnGrad.addColorStop(1, "#e52860");
  ctx.fillStyle = btnGrad;
  roundRect(ctx, btnX, btnY, btnW, btnH, 30);
  ctx.fill();

  ctx.shadowColor = "rgba(253,60,115,0.4)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, btnX, btnY, btnW, btnH, 30);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("Spara upp till 3 000 kr/år", W / 2, btnY + btnH / 2 + 1);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "400 16px system-ui, sans-serif";
  ctx.fillText("flytt.io/el", W / 2, H - 60);
}

interface HeroCardTextureProps {
  onTextureReady: (dataUrl: string) => void;
}

export default function HeroCardTexture({
  onTextureReady,
}: HeroCardTextureProps) {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    renderHeroCard(canvas);
    onTextureReady(canvas.toDataURL("image/png"));
  }, [onTextureReady]);

  return null;
}
