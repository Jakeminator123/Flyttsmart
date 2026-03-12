"use client";

import { useEffect } from "react";

const W = 688;
const H = 960;
const CHECKLIST = [
  { label: "Skatteverket", done: true },
  { label: "Försäkringskassan", done: true },
  { label: "Bankerna", done: true },
  { label: "Elavtal & bredband", done: false },
  { label: "Försäkringar", done: false },
];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function renderHeroCard(canvas: HTMLCanvasElement) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#151c2a");
  bg.addColorStop(1, "#0f1320");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fill();

  ctx.fillStyle = "rgba(126,232,162,0.06)";
  ctx.fillRect(0, 0, W, 68);

  ctx.fillStyle = "#7ee8a2";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Flytt.io", W / 2, 36);

  const pad = 40;
  let y = 96;

  roundRect(ctx, pad, y, W - pad * 2, 140, 16);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("FRÅN", pad + 20, y + 28);
  ctx.fillStyle = "#edf2f6";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText("Sveavägen 42, Stockholm", pad + 20, y + 56);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("TILL", pad + 20, y + 90);
  ctx.fillStyle = "#edf2f6";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText("Kungsgatan 15, Göteborg", pad + 20, y + 118);

  y += 170;
  ctx.fillStyle = "#edf2f6";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.fillText("Adressändring", pad, y);
  ctx.textAlign = "right";
  ctx.fillStyle = "#7ee8a2";
  ctx.fillText("62%", W - pad, y);
  ctx.textAlign = "left";

  y += 20;
  roundRect(ctx, pad, y, W - pad * 2, 10, 5);
  ctx.fillStyle = "rgba(126,232,162,0.2)";
  ctx.fill();

  const barW = (W - pad * 2) * 0.62;
  roundRect(ctx, pad, y, barW, 10, 5);
  ctx.fillStyle = "#7ee8a2";
  ctx.fill();

  y += 28;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("3 av 5 myndigheter klara", pad, y);

  y += 40;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();

  y += 28;
  ctx.fillStyle = "#edf2f6";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.fillText("Checklista", pad, y);

  y += 16;
  for (const item of CHECKLIST) {
    y += 32;
    const dotR = 8;
    if (item.done) {
      ctx.fillStyle = "#8fcfb0";
      ctx.beginPath();
      ctx.arc(pad + dotR, y, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f1320";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓", pad + dotR, y + 1);
      ctx.textAlign = "left";
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pad + dotR, y, dotR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = item.done ? "#edf2f6" : "rgba(255,255,255,0.4)";
    ctx.font = "15px system-ui, sans-serif";
    ctx.fillText(item.label, pad + 28, y + 5);

    if (item.done) {
      ctx.fillStyle = "rgba(126,232,162,0.15)";
      roundRect(ctx, W - pad - 48, y - 12, 48, 22, 11);
      ctx.fill();
      ctx.fillStyle = "#8fcfb0";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Klar", W - pad - 24, y + 2);
      ctx.textAlign = "left";
    }
  }
}

interface HeroCardTextureProps {
  onTextureReady: (dataUrl: string) => void;
}

export default function HeroCardTexture({ onTextureReady }: HeroCardTextureProps) {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    renderHeroCard(canvas);
    onTextureReady(canvas.toDataURL("image/png"));
  }, [onTextureReady]);

  return null;
}
