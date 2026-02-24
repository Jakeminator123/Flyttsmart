"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"

type Phase = "loading" | "intro" | "cinemagraph"

const VIDEO_SRC = "/media/videos/hero.mp4"
const STILL_FALLBACK = "/media/images/glad_familj.webp"

const ROBOT_ZONE = "polygon(0% 22%, 15% 22%, 15% 78%, 0% 78%)"
const PEOPLE_ZONE = "polygon(14% 6%, 60% 6%, 60% 95%, 14% 95%)"

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

interface HeroCinemagraphProps {
  className?: string
}

export function HeroCinemagraph({ className }: HeroCinemagraphProps) {
  const baseRef = useRef<HTMLVideoElement>(null)
  const robotLoopRef = useRef<HTMLVideoElement>(null)
  const peopleLoopRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>("loading")
  const [showWatermarkCover, setShowWatermarkCover] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const isMobile = useIsMobile()

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
    if (phase !== "cinemagraph") {
      setShowWatermarkCover(false)
      return
    }
    const timer = setTimeout(() => setShowWatermarkCover(true), 6000)
    return () => clearTimeout(timer)
  }, [phase])

  const showRobotLoop = phase === "cinemagraph" && !prefersReducedMotion
  const showPeopleLoop = phase === "cinemagraph" && !prefersReducedMotion && !isMobile

  return (
    <div className={className} style={{ position: "relative" }}>
      {/* Immediate first-frame fallback to avoid white flash */}
      <Image
        src={STILL_FALLBACK}
        alt=""
        fill
        priority
        fetchPriority="high"
        className="object-cover object-center"
      />

      {/* Base layer: plays once then freezes */}
      <video
        ref={baseRef}
        className="absolute inset-0 z-2 h-full w-full object-cover object-center"
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        onCanPlay={handleCanPlay}
        onEnded={handleIntroEnd}
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
            className="h-full w-full object-cover object-center"
            style={{ clipPath: ROBOT_ZONE }}
            src={VIDEO_SRC}
            muted
            playsInline
            loop
            preload="auto"
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
            className="h-full w-full object-cover object-center"
            style={{ clipPath: PEOPLE_ZONE }}
            src={VIDEO_SRC}
            muted
            playsInline
            loop
            preload="auto"
          />
        </motion.div>
      )}

      {/* Subtle color tint */}
      <div className="absolute inset-0 z-4 bg-background/8" />

      {/* Cover Sora watermark area after intro settles */}
      <motion.div
        className="pointer-events-none absolute left-[31%] top-[66%] z-5 h-[13%] w-[48%] -translate-x-1/2 -translate-y-1/2 md:left-[24%] md:top-[64%] md:h-[12%] md:w-[32%]"
        initial={{ opacity: 0 }}
        animate={{ opacity: showWatermarkCover ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="h-full w-full rounded-2xl bg-background/65 backdrop-blur-[2.5px]" />
      </motion.div>
    </div>
  )
}
