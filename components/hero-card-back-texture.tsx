"use client";

import { useEffect } from "react";
import qrcode from "qrcode-generator";

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

function renderQRBack(canvas: HTMLCanvasElement) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(0.4, "#0c1425");
  bg.addColorStop(1, "#060a14");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fill();

  const glow1 = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, W * 0.5);
  glow1.addColorStop(0, "rgba(253,60,115,0.06)");
  glow1.addColorStop(1, "rgba(253,60,115,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.7, H * 0.8, 0, W * 0.7, H * 0.8, W * 0.45);
  glow2.addColorStop(0, "rgba(92,127,243,0.05)");
  glow2.addColorStop(1, "rgba(92,127,243,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, 24, 24, W - 48, H - 48, 28);
  ctx.stroke();

  drawBrandFlame(ctx, W / 2, 90, 60);
  drawBrandText(ctx, W / 2, 138, "bold 28px system-ui, sans-serif");

  const qr = qrcode(0, "H");
  qr.addData("https://flytt.io");
  qr.make();

  const moduleCount = qr.getModuleCount();
  const qrSize = 420;
  const moduleSize = qrSize / moduleCount;
  const qrX = (W - qrSize) / 2;
  const qrY = (H - qrSize) / 2 - 30;
  const modR = moduleSize * 0.32;

  ctx.fillStyle = "rgba(253,60,115,0.04)";
  roundRect(ctx, qrX - 30, qrY - 30, qrSize + 60, qrSize + 60, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(253,60,115,0.10)";
  ctx.lineWidth = 1;
  roundRect(ctx, qrX - 30, qrY - 30, qrSize + 60, qrSize + 60, 28);
  ctx.stroke();

  const centerModules = Math.ceil(moduleCount * 0.24);
  const centerStart = Math.floor((moduleCount - centerModules) / 2);
  const centerEnd = centerStart + centerModules;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (
        row >= centerStart &&
        row < centerEnd &&
        col >= centerStart &&
        col < centerEnd
      )
        continue;
      if (!qr.isDark(row, col)) continue;

      const x = qrX + col * moduleSize;
      const y = qrY + row * moduleSize;

      const isFinderArea =
        (row < 7 && col < 7) ||
        (row < 7 && col >= moduleCount - 7) ||
        (row >= moduleCount - 7 && col < 7);

      if (isFinderArea) {
        ctx.fillStyle = "#FD3C73";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }

      roundRect(
        ctx,
        x + 0.4,
        y + 0.4,
        moduleSize - 0.8,
        moduleSize - 0.8,
        isFinderArea ? modR * 0.6 : modR,
      );
      ctx.fill();
    }
  }

  const centerPx = centerModules * moduleSize;
  const logoCx = qrX + centerStart * moduleSize + centerPx / 2;
  const logoCy = qrY + centerStart * moduleSize + centerPx / 2;

  ctx.fillStyle = "#0c1425";
  roundRect(
    ctx,
    logoCx - centerPx / 2 - 6,
    logoCy - centerPx / 2 - 6,
    centerPx + 12,
    centerPx + 12,
    14,
  );
  ctx.fill();

  ctx.strokeStyle = "rgba(253,60,115,0.25)";
  ctx.lineWidth = 2;
  roundRect(
    ctx,
    logoCx - centerPx / 2 - 6,
    logoCy - centerPx / 2 - 6,
    centerPx + 12,
    centerPx + 12,
    14,
  );
  ctx.stroke();

  const logoGlow = ctx.createRadialGradient(
    logoCx,
    logoCy,
    0,
    logoCx,
    logoCy,
    centerPx * 0.6,
  );
  logoGlow.addColorStop(0, "rgba(253,60,115,0.12)");
  logoGlow.addColorStop(1, "rgba(253,60,115,0)");
  ctx.fillStyle = logoGlow;
  ctx.fillRect(
    logoCx - centerPx / 2 - 6,
    logoCy - centerPx / 2 - 6,
    centerPx + 12,
    centerPx + 12,
  );

  drawBrandFlame(ctx, logoCx, logoCy, centerPx * 0.6);

  ctx.fillStyle = "rgba(226,232,240,0.55)";
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Skanna för att flytta smartare", W / 2, qrY + qrSize + 55);

  ctx.fillStyle = "rgba(253,60,115,0.35)";
  ctx.font = "400 15px system-ui, sans-serif";
  ctx.fillText("flytt.io", W / 2, H - 55);
}

interface HeroCardBackTextureProps {
  onTextureReady: (dataUrl: string) => void;
}

export default function HeroCardBackTexture({
  onTextureReady,
}: HeroCardBackTextureProps) {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    renderQRBack(canvas);
    onTextureReady(canvas.toDataURL("image/png"));
  }, [onTextureReady]);

  return null;
}
