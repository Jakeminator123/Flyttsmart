"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { cn } from "@/lib/utils"

interface TextRevealProps {
  children: string
  className?: string
  as?: "h1" | "h2" | "h3" | "p" | "span"
  splitBy?: "word" | "char"
  delay?: number
  staggerDelay?: number
  once?: boolean
  lively?: boolean
}

export function TextReveal({
  children,
  className,
  as: Tag = "p",
  splitBy = "word",
  delay = 0,
  staggerDelay = 0.04,
  once = true,
  lively = false,
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: "-80px 0px" })

  const words = children.split(" ")

  if (splitBy === "char") {
    let charIndex = 0
    return (
      <Tag ref={ref as React.RefObject<HTMLHeadingElement & HTMLParagraphElement & HTMLSpanElement>} className={cn("overflow-hidden", className)}>
        {words.map((word, wi) => (
          <span key={wi} className="inline-block whitespace-nowrap">
            {word.split("").map((char) => {
              const ci = charIndex++
              return (
                <span key={ci} className="inline-block overflow-hidden">
                  <motion.span
                    className={cn("inline-block", lively && "lively-word")}
                    initial={{ y: "110%", opacity: 0, rotateX: -80 }}
                    animate={isInView ? { y: "0%", opacity: 1, rotateX: 0 } : {}}
                    transition={{
                      duration: 0.7,
                      delay: delay + ci * staggerDelay,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={lively ? { animationDelay: `${ci * 0.45}s` } : undefined}
                  >
                    {char}
                  </motion.span>
                </span>
              )
            })}
            {wi < words.length - 1 && <span className="inline-block w-[0.3em]">{"\u00A0"}</span>}
          </span>
        ))}
      </Tag>
    )
  }

  return (
    <Tag ref={ref as React.RefObject<HTMLHeadingElement & HTMLParagraphElement & HTMLSpanElement>} className={cn("overflow-hidden", className)}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden">
          <motion.span
            className={cn("inline-block", lively && "lively-word")}
            initial={{ y: "110%", opacity: 0, rotateX: -80 }}
            animate={isInView ? { y: "0%", opacity: 1, rotateX: 0 } : {}}
            transition={{
              duration: 0.7,
              delay: delay + i * staggerDelay,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={lively ? { animationDelay: `${i * 0.45}s` } : undefined}
          >
            {word}{i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}

interface TextRevealByLineProps {
  children: string
  className?: string
  lineClassName?: string
  delay?: number
  once?: boolean
}

export function TextRevealByLine({
  children,
  className,
  lineClassName,
  delay = 0,
  once = true,
}: TextRevealByLineProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: "-60px 0px" })

  return (
    <div ref={ref} className={className}>
      <div className="overflow-hidden">
        <motion.div
          className={lineClassName}
          initial={{ y: "100%", opacity: 0 }}
          animate={isInView ? { y: "0%", opacity: 1 } : {}}
          transition={{
            duration: 0.8,
            delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
