"use client"

import { useEffect, useRef, useState } from "react"
import { useInView, motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedCounterProps {
  target: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
  once?: boolean
}

export function AnimatedCounter({
  target,
  duration = 2,
  suffix = "",
  prefix = "",
  className,
  once = true,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once, margin: "-60px 0px" })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isInView) return

    let startTime: number | null = null
    let animationFrame: number

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)

      const eased = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(eased * target))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        setCount(target)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [isInView, target, duration])

  return (
    <motion.span
      ref={ref}
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {prefix}{count.toLocaleString("sv-SE")}{suffix}
    </motion.span>
  )
}
