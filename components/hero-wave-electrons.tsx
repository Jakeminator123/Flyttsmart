"use client"

import { useEffect, useRef } from "react"

interface WaveConfig {
  amplitude: number
  frequency: number
  speed: number
  yOffset: number
  opacity: number
  lineWidth: number
}

interface Electron {
  waveIndex: number
  x: number
  speed: number
  radius: number
  glowRadius: number
  opacity: number
}

const WAVES: WaveConfig[] = [
  { amplitude: 38, frequency: 0.003, speed: 0.012, yOffset: 0.22, opacity: 0.16, lineWidth: 1.8 },
  { amplitude: 26, frequency: 0.005, speed: 0.008, yOffset: 0.42, opacity: 0.12, lineWidth: 1.4 },
  { amplitude: 32, frequency: 0.004, speed: 0.015, yOffset: 0.62, opacity: 0.14, lineWidth: 1.6 },
  { amplitude: 20, frequency: 0.006, speed: 0.01, yOffset: 0.82, opacity: 0.10, lineWidth: 1.2 },
]

const ELECTRON_TEMPLATES: Omit<Electron, "x">[] = [
  { waveIndex: 0, speed: 0.4, radius: 6, glowRadius: 50, opacity: 0.8 },
  { waveIndex: 1, speed: 0.25, radius: 4.5, glowRadius: 38, opacity: 0.65 },
  { waveIndex: 2, speed: 0.35, radius: 5.5, glowRadius: 45, opacity: 0.75 },
]

function getWaveY(x: number, wave: WaveConfig, time: number, h: number) {
  return (
    h * wave.yOffset +
    Math.sin(x * wave.frequency + time * wave.speed) * wave.amplitude +
    Math.sin(x * wave.frequency * 0.6 + time * wave.speed * 1.4) * wave.amplitude * 0.4
  )
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  electrons: Electron[],
) {
  ctx.clearRect(0, 0, w, h)

  for (const wave of WAVES) {
    ctx.beginPath()
    ctx.strokeStyle = `rgba(92, 127, 243, ${wave.opacity})`
    ctx.lineWidth = wave.lineWidth

    for (let x = 0; x <= w; x += 3) {
      const y = getWaveY(x, wave, time, h)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  for (const electron of electrons) {
    const wave = WAVES[electron.waveIndex]
    electron.x += electron.speed
    if (electron.x > w + 40) electron.x = -40

    const y = getWaveY(electron.x, wave, time, h)

    const glow = ctx.createRadialGradient(
      electron.x, y, 0,
      electron.x, y, electron.glowRadius,
    )
    glow.addColorStop(0, `rgba(253, 60, 115, ${electron.opacity * 0.6})`)
    glow.addColorStop(0.3, `rgba(253, 60, 115, ${electron.opacity * 0.2})`)
    glow.addColorStop(1, "rgba(253, 60, 115, 0)")

    ctx.beginPath()
    ctx.arc(electron.x, y, electron.glowRadius, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    ctx.beginPath()
    ctx.arc(electron.x, y, electron.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(253, 60, 115, ${electron.opacity})`
    ctx.fill()
  }
}

interface HeroWaveElectronsProps {
  className?: string
}

export function HeroWaveElectrons({ className }: HeroWaveElectronsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    let time = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const electrons: Electron[] = ELECTRON_TEMPLATES.map((tpl, i) => ({
      ...tpl,
      x: (i + 1) * 400,
    }))

    const resize = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener("resize", resize, { passive: true })

    const prefersStatic = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersStatic) {
      drawFrame(ctx, canvas.offsetWidth, canvas.offsetHeight, 0, electrons)
      return () => window.removeEventListener("resize", resize)
    }

    const loop = () => {
      drawFrame(ctx, canvas.offsetWidth, canvas.offsetHeight, time, electrons)
      time += 1
      animationId = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ width: "100%", height: "100%" }}
    />
  )
}
