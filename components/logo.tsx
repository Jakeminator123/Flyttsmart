"use client"

import { cn } from "@/lib/utils"
import { motion, type Variants } from "framer-motion"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "full" | "icon"
  animate?: boolean
}

const iconSizes = {
  sm: "h-8 w-5",
  md: "h-10 w-6",
  lg: "h-13 w-8",
}

const textSizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
}

const flameContainer: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.15,
    },
  },
}

const flamePath: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
}

const textLetterVariants: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      delay: 0.8 + i * 0.06,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
}

function AnimatedFlameIcon({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="70 35 100 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      variants={flameContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.path
        d="M97 142L92 147 86 158 86 161 84 166 84 174 85 175 85 178 88 184 94 192 113 211 121 222 125 231 125 236 126 237 125 245 130 240 134 231 134 228 135 227 135 216 134 215 134 212 133 211 132 206 125 193 105 166 99 154 99 151 98 150 98 142Z"
        fill="#FD3C73"
        variants={flamePath}
      />
      <motion.path
        d="M99 43L91 51 86 60 84 62 82 66 82 68 80 71 79 77 78 78 78 82 77 83 77 93 78 94 78 99 79 100 80 105 87 117 91 121 91 122 119 150 119 151 129 162 137 174 142 185 142 188 144 193 144 204 143 205 143 209 142 211 144 210 151 202 156 193 156 191 158 187 158 184 159 183 159 176 160 175 158 158 157 157 156 151 154 148 154 146 147 132 137 117 117 91 112 82 110 80 108 75 106 73 106 71 102 64 101 58 100 57 100 53 99 52Z"
        fill="#FD3C73"
        variants={flamePath}
      />
      <motion.rect
        x="70"
        y="35"
        width="100"
        height="220"
        fill="transparent"
        animate={{
          filter: [
            "drop-shadow(0 0 2px rgba(253,60,115,0.2))",
            "drop-shadow(0 0 6px rgba(253,60,115,0.4))",
            "drop-shadow(0 0 2px rgba(253,60,115,0.2))",
          ],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
    </motion.svg>
  )
}

function StaticFlameIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="70 35 100 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M97 142L92 147 86 158 86 161 84 166 84 174 85 175 85 178 88 184 94 192 113 211 121 222 125 231 125 236 126 237 125 245 130 240 134 231 134 228 135 227 135 216 134 215 134 212 133 211 132 206 125 193 105 166 99 154 99 151 98 150 98 142Z"
        fill="#FD3C73"
      />
      <path
        d="M99 43L91 51 86 60 84 62 82 66 82 68 80 71 79 77 78 78 78 82 77 83 77 93 78 94 78 99 79 100 80 105 87 117 91 121 91 122 119 150 119 151 129 162 137 174 142 185 142 188 144 193 144 204 143 205 143 209 142 211 144 210 151 202 156 193 156 191 158 187 158 184 159 183 159 176 160 175 158 158 157 157 156 151 154 148 154 146 147 132 137 117 117 91 112 82 110 80 108 75 106 73 106 71 102 64 101 58 100 57 100 53 99 52Z"
        fill="#FD3C73"
      />
    </svg>
  )
}

const logoText = "flytt.io"

export function Logo({
  className,
  size = "md",
  variant = "full",
  animate = false,
}: LogoProps) {
  return (
    <span className={cn("group inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center transition-transform duration-300 group-hover:-translate-y-0.5",
          iconSizes[size],
        )}
      >
        {animate ? (
          <AnimatedFlameIcon className="h-full w-full" />
        ) : (
          <StaticFlameIcon className="h-full w-full" />
        )}
      </span>

      {variant === "full" && (
        <span
          className={cn(
            "font-heading font-bold tracking-tight",
            textSizes[size],
          )}
          style={{ color: "#5C7FF3" }}
        >
          {animate ? (
            logoText.split("").map((char, i) => (
              <motion.span
                key={i}
                custom={i}
                variants={textLetterVariants}
                initial="hidden"
                animate="visible"
                className="inline-block"
                style={char === "." ? { color: "#FD3C73" } : undefined}
              >
                {char}
              </motion.span>
            ))
          ) : (
            <>flytt<span style={{ color: "#5C7FF3" }}>.io</span></>
          )}
        </span>
      )}
    </span>
  )
}
