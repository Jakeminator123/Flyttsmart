"use client";

import { useEffect } from "react";

const W = 688;
const H = 960;

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

function drawFlameIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  const s = size / 24;
  ctx.beginPath();
  ctx.moveTo(12 * s, 0.5 * s);
  ctx.bezierCurveTo(
    14.5 * s, 4 * s,
    18 * s, 7 * s,
    19.5 * s, 11.5 * s,
  );
  ctx.bezierCurveTo(
    21.5 * s, 17.5 * s,
    17 * s, 23.5 * s,
    12 * s, 23.5 * s,
  );
  ctx.bezierCurveTo(
    7 * s, 23.5 * s,
    2.5 * s, 17.5 * s,
    4.5 * s, 11.5 * s,
  );
  ctx.bezierCurveTo(
    6 * s, 7 * s,
    9.5 * s, 4 * s,
    12 * s, 0.5 * s,
  );
  ctx.closePath();

  const flameGrad = ctx.createLinearGradient(0, 0, 0, size);
  flameGrad.addColorStop(0, "#ff6b6b");
  flameGrad.addColorStop(0.5, "#ee5a24");
  flameGrad.addColorStop(1, "#f0932b");
  ctx.fillStyle = flameGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(12 * s, 10 * s);
  ctx.bezierCurveTo(
    13.5 * s, 12 * s,
    15 * s, 14 * s,
    15 * s, 16.5 * s,
  );
  ctx.bezierCurveTo(
    15 * s, 19 * s,
    13.5 * s, 20.5 * s,
    12 * s, 20.5 * s,
  );
  ctx.bezierCurveTo(
    10.5 * s, 20.5 * s,
    9 * s, 19 * s,
    9 * s, 16.5 * s,
  );
  ctx.bezierCurveTo(
    9 * s, 14 * s,
    10.5 * s, 12 * s,
    12 * s, 10 * s,
  );
  ctx.closePath();

  const innerGrad = ctx.createLinearGradient(0, 10 * s, 0, 21 * s);
  innerGrad.addColorStop(0, "#ffeaa7");
  innerGrad.addColorStop(1, "#fdcb6e");
  ctx.fillStyle = innerGrad;
  ctx.fill();

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

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.25, 0, W * 0.5, H * 0.25, W * 0.6);
  glow.addColorStop(0, "rgba(99,102,241,0.08)");
  glow.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, 24, 24, W - 48, H - 48, 28);
  ctx.stroke();

  const logoY = 200;
  drawFlameIcon(ctx, W / 2, logoY, 72);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("flytt.io", W / 2, logoY + 64);

  const badgeY = logoY + 120;
  const badgeText = "ERBJUDANDE";
  ctx.font = "700 16px system-ui, sans-serif";
  const badgeW = ctx.measureText(badgeText).width + 40;
  ctx.fillStyle = "rgba(249,202,36,0.12)";
  roundRect(ctx, (W - badgeW) / 2, badgeY - 14, badgeW, 28, 14);
  ctx.fill();
  ctx.fillStyle = "#f9ca24";
  ctx.fillText(badgeText, W / 2, badgeY);

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
  btnGrad.addColorStop(0, "#ff6b6b");
  btnGrad.addColorStop(1, "#ee5a24");
  ctx.fillStyle = btnGrad;
  roundRect(ctx, btnX, btnY, btnW, btnH, 30);
  ctx.fill();

  ctx.shadowColor = "rgba(238,90,36,0.4)";
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
