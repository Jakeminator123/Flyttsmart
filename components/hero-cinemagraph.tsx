"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { motion, useReducedMotion } from "framer-motion"

type Phase = "loading" | "intro" | "cinemagraph"

const VIDEO_SRC = "/media/videos/hero.mp4"
const WATERMARK_PLACEHOLDER_SRC = "/media/videos/reklam.mp4"
const STILL_FALLBACK = "/media/images/glad_familj.webp"

const ROBOT_ZONE = "polygon(0% 22%, 15% 22%, 15% 78%, 0% 78%)"
const PEOPLE_ZONE = "polygon(14% 6%, 60% 6%, 60% 95%, 14% 95%)"
const WATERMARK_RECT_IN_SOURCE = {
  x: 0.07,
  y: 0.56,
  width: 0.40,
  height: 0.17,
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check, { passive: true })
    return () => window.removeEventListener("resize", check)
  }, [])
  return isMobile
}

function useViewportWidth() {
  const [viewportWidth, setViewportWidth] = useState(1280)
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    onResize()
    window.addEventListener("resize", onResize, { passive: true })
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return viewportWidth
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

interface HeroCinemagraphProps {
  className?: string
}

export function HeroCinemagraph({ className }: HeroCinemagraphProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLVideoElement>(null)
  const robotLoopRef = useRef<HTMLVideoElement>(null)
  const peopleLoopRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>("loading")
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [videoSize, setVideoSize] = useState({ width: 1920, height: 1080 })
  const prefersReducedMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const viewportWidth = useViewportWidth()
  const objectPositionY = viewportWidth < 640 ? 74 : viewportWidth < 768 ? 70 : viewportWidth < 1024 ? 64 : 60
  const topGuardHeight = viewportWidth < 640 ? "16%" : viewportWidth < 1024 ? "13%" : "11%"
  const mediaObjectPosition = `50% ${objectPositionY}%`

  const handleCanPlay = useCallback(() => {
    if (phase === "loading") {
      setPhase("intro")
      baseRef.current?.play().catch(() => {})
    }
  }, [phase])

  const handleIntroEnd = useCallback(() => {
    setPhase("cinemagraph")
    const robot = robotLoopRef.current
    const people = peopleLoopRef.current
    if (robot) {
      robot.currentTime = 0
      robot.play().catch(() => {})
    }
    if (people) {
      people.currentTime = 0
      people.play().catch(() => {})
    }
  }, [])

  const handleMetadata = useCallback(() => {
    const base = baseRef.current
    if (!base || !base.videoWidth || !base.videoHeight) return
    setVideoSize({ width: base.videoWidth, height: base.videoHeight })
  }, [])

  useEffect(() => {
    const base = baseRef.current
    if (!base) return
    base.playbackRate = 0.6

    if (prefersReducedMotion) {
      base.pause()
      setPhase("cinemagraph")
      return
    }

    const timeout = setTimeout(() => {
      if (phase === "loading") {
        setPhase("intro")
        base.play().catch(() => {})
      }
    }, 1500)

    return () => clearTimeout(timeout)
  }, [prefersReducedMotion, phase])

  useEffect(() => {
    if (robotLoopRef.current) robotLoopRef.current.playbackRate = 0.6
    if (peopleLoopRef.current) peopleLoopRef.current.playbackRate = 0.6
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const updateSize = () => {
      const rect = root.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }

    updateSize()
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(root)
    window.addEventListener("resize", updateSize, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateSize)
    }
  }, [])

  const showRobotLoop = phase === "cinemagraph" && !prefersReducedMotion
  const showPeopleLoop = phase === "cinemagraph" && !prefersReducedMotion && !isMobile
  const showWatermarkCover = phase === "cinemagraph"
  const watermarkCoverStyle = useMemo<CSSProperties>(() => {
    if (!containerSize.width || !containerSize.height || !videoSize.width || !videoSize.height) {
      return {
        left: "8%",
        top: "58%",
        width: "42%",
        height: "14%",
      }
    }

    const containerWidth = containerSize.width
    const containerHeight = containerSize.height
    const sourceRatio = videoSize.width / videoSize.height
    const containerRatio = containerWidth / containerHeight

    const renderedWidth =
      containerRatio > sourceRatio ? containerWidth : containerHeight * sourceRatio
    const renderedHeight =
      containerRatio > sourceRatio ? containerWidth / sourceRatio : containerHeight

    const cropX = Math.max(0, renderedWidth - containerWidth)
    const cropY = Math.max(0, renderedHeight - containerHeight)
    const visibleLeft = cropX * 0.5
    const visibleTop = cropY * (objectPositionY / 100)

    const padX = renderedWidth * 0.018
    const padY = renderedHeight * 0.012
    const rawLeft = WATERMARK_RECT_IN_SOURCE.x * renderedWidth - visibleLeft - padX
    const rawTop = WATERMARK_RECT_IN_SOURCE.y * renderedHeight - visibleTop - padY
    const rawWidth = WATERMARK_RECT_IN_SOURCE.width * renderedWidth + padX * 2
    const rawHeight = WATERMARK_RECT_IN_SOURCE.height * renderedHeight + padY * 2

    const minWidth = Math.max(150, containerWidth * 0.24)
    const maxWidth = containerWidth * 0.72
    const minHeight = Math.max(46, containerHeight * 0.08)
    const maxHeight = containerHeight * 0.26
    const width = clamp(rawWidth, minWidth, maxWidth)
    const height = clamp(rawHeight, minHeight, maxHeight)
    const left = clamp(rawLeft, 0, Math.max(0, containerWidth - width))
    const top = clamp(rawTop, 0, Math.max(0, containerHeight - height))

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    }
  }, [containerSize.height, containerSize.width, videoSize.height, videoSize.width, objectPositionY])

  return (
    <div ref={rootRef} className={className} style={{ position: "relative" }}>
      {/* Immediate first-frame fallback to avoid white flash */}
      <Image
        src={STILL_FALLBACK}
        alt=""
        fill
        priority
        fetchPriority="high"
        className="object-cover"
        style={{ objectPosition: mediaObjectPosition }}
      />

      {/* Base layer: plays once then freezes */}
      <video
        ref={baseRef}
        className="absolute inset-0 z-2 h-full w-full object-cover"
        style={{ objectPosition: mediaObjectPosition }}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        onCanPlay={handleCanPlay}
        onEnded={handleIntroEnd}
        onLoadedMetadata={handleMetadata}
      />

      {/* Robot loop zone */}
      {showRobotLoop && (
        <motion.div
          className="absolute inset-0 z-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <video
            ref={robotLoopRef}
            className="h-full w-full object-cover"
            style={{ clipPath: ROBOT_ZONE, objectPosition: mediaObjectPosition }}
            src={VIDEO_SRC}
            muted
            playsInline
            loop
            preload="auto"
            onLoadedMetadata={handleMetadata}
          />
        </motion.div>
      )}

      {/* People loop zone (disabled on mobile for performance) */}
      {showPeopleLoop && (
        <motion.div
          className="absolute inset-0 z-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <video
            ref={peopleLoopRef}
            className="h-full w-full object-cover"
            style={{ clipPath: PEOPLE_ZONE, objectPosition: mediaObjectPosition }}
            src={VIDEO_SRC}
            muted
            playsInline
            loop
            preload="auto"
            onLoadedMetadata={handleMetadata}
          />
        </motion.div>
      )}

      {/* Subtle color tint */}
      <div className="absolute inset-0 z-4 bg-background/8" />

      {/* Hard cap to hide source label at top across viewports */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-5" style={{ height: topGuardHeight }}>
        <div className="h-full w-full bg-linear-to-b from-background/92 via-background/64 to-transparent" />
      </div>

      {/* Cover Sora watermark area after intro settles */}
      <motion.div
        className="pointer-events-none absolute z-6 overflow-hidden rounded-xl border border-foreground/15 shadow-xl shadow-black/20"
        style={watermarkCoverStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: showWatermarkCover ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      >
        <video
          className="h-full w-full object-cover"
          src={WATERMARK_PLACEHOLDER_SRC}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/70 via-background/25 to-background/60" />
        <div className="absolute inset-0 flex items-end justify-between px-2.5 py-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/70">
            Flytt.io
          </span>
          <span className="text-[10px] text-foreground/60">
            Partner
          </span>
        </div>
      </motion.div>
    </div>
  )
}
