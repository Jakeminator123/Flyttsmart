"use client";

import { useEffect } from "react";

const W = 688;
const H = 960;
const AIDA_PORTRAIT_SRC = "/media/images/aida-placeholder.svg";

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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const source = image as HTMLImageElement;
  const scale = Math.max(width / source.width, height / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(source, dx, dy, drawWidth, drawHeight);
}

function renderFallbackPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const glow = ctx.createRadialGradient(x + width * 0.72, y + height * 0.2, 0, x + width * 0.72, y + height * 0.2, width * 0.7);
  glow.addColorStop(0, "rgba(126,232,162,0.36)");
  glow.addColorStop(1, "rgba(126,232,162,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "#f07c4a";
  ctx.beginPath();
  ctx.arc(x + width / 2, y + height * 0.43, width * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e6b49e";
  ctx.beginPath();
  ctx.arc(x + width / 2, y + height * 0.42, width * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#182338";
  roundRect(ctx, x + width * 0.28, y + height * 0.58, width * 0.44, height * 0.22, width * 0.06);
  ctx.fill();
}

function renderHeroCard(canvas: HTMLCanvasElement, portrait: HTMLImageElement | null) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#243552");
  bg.addColorStop(0.32, "#111827");
  bg.addColorStop(1, "#060814");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fill();

  const topGlow = ctx.createRadialGradient(W * 0.82, H * 0.1, 0, W * 0.82, H * 0.1, W * 0.6);
  topGlow.addColorStop(0, "rgba(126,232,162,0.42)");
  topGlow.addColorStop(1, "rgba(126,232,162,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, H);

  const bottomGlow = ctx.createRadialGradient(W * 0.16, H * 0.88, 0, W * 0.16, H * 0.88, W * 0.62);
  bottomGlow.addColorStop(0, "rgba(244,155,120,0.24)");
  bottomGlow.addColorStop(1, "rgba(244,155,120,0)");
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, 24, 24, W - 48, H - 48, 30);
  ctx.fill();

  const pad = 42;

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, pad, 42, 170, 38, 19);
  ctx.fill();
  ctx.fillStyle = "#f5f8fc";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AIDA GUIDE", pad + 85, 61);

  roundRect(ctx, W - pad - 92, 42, 92, 38, 19);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();
  ctx.fillStyle = "#7ee8a2";
  ctx.beginPath();
  ctx.arc(W - pad - 66, 61, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5f8fc";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("Redo", W - pad - 35, 61);

  ctx.textAlign = "left";
  ctx.fillStyle = "#f5f8fc";
  ctx.font = "700 42px system-ui, sans-serif";
  ctx.fillText("Din hängande guide", pad, 136);
  ctx.fillText("väntar på att kliva fram.", pad, 186);

  const portraitX = pad;
  const portraitY = 224;
  const portraitW = W - pad * 2;
  const portraitH = 470;

  ctx.save();
  roundRect(ctx, portraitX, portraitY, portraitW, portraitH, 34);
  ctx.clip();
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(portraitX, portraitY, portraitW, portraitH);
  if (portrait) {
    drawCoverImage(ctx, portrait, portraitX, portraitY, portraitW, portraitH);
  } else {
    renderFallbackPortrait(ctx, portraitX, portraitY, portraitW, portraitH);
  }
  const portraitShade = ctx.createLinearGradient(0, portraitY, 0, portraitY + portraitH);
  portraitShade.addColorStop(0, "rgba(255,255,255,0.06)");
  portraitShade.addColorStop(0.55, "rgba(255,255,255,0)");
  portraitShade.addColorStop(1, "rgba(1,4,10,0.72)");
  ctx.fillStyle = portraitShade;
  ctx.fillRect(portraitX, portraitY, portraitW, portraitH);
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  roundRect(ctx, pad, 728, W - pad * 2, 132, 28);
  ctx.fill();

  ctx.fillStyle = "#f5f8fc";
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText("Aida laddar sin guideprofil", pad + 26, 776);
  ctx.fillStyle = "rgba(245,248,252,0.74)";
  ctx.font = "400 18px system-ui, sans-serif";
  ctx.fillText("OpenClaw förbereder hjärnan medan avataren", pad + 26, 818);
  ctx.fillText("gör sig redo för din flyttguidning live.", pad + 26, 848);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, pad, 888, W - pad * 2, 40, 20);
  ctx.fill();
  ctx.fillStyle = "#dbe6ef";
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillText("Aida badge", pad + 22, 914);
  ctx.fillStyle = "rgba(219,230,239,0.7)";
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillText("Startklar för flyttguidning", pad + 140, 914);
}

interface HeroCardTextureProps {
  onTextureReady: (dataUrl: string) => void;
}

export default function HeroCardTexture({ onTextureReady }: HeroCardTextureProps) {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const portrait = await loadImage(AIDA_PORTRAIT_SRC);
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      renderHeroCard(canvas, portrait);
      onTextureReady(canvas.toDataURL("image/png"));
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [onTextureReady]);

  return null;
}
