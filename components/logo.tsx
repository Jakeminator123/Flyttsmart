"use client"

import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "full" | "icon"
}

export function Logo({ className, size = "md", variant = "full" }: LogoProps) {
  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-13 w-13",
  }

  const textSizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  }

  return (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative flex items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-primary/35 group-hover:-translate-y-0.5",
          iconSizes[size],
        )}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className="h-[62%] w-[62%]"
          aria-hidden="true"
        >
          {/* House body */}
          <path
            d="M6 14v11a2 2 0 002 2h5v-6a1 1 0 011-1h4a1 1 0 011 1v6h5a2 2 0 002-2V14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />
          {/* House roof */}
          <path
            d="M3 15L16 5l13 10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Moving arrow – slides right on hover */}
          <g className="transition-transform duration-500 ease-out group-hover:translate-x-1">
            <path
              d="M20 8h6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M23 5l3 3-3 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>

        {/* Subtle shine overlay */}
        <span className="absolute inset-0 rounded-xl bg-linear-to-tr from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </span>

      {variant === "full" && (
        <span
          className={cn(
            "font-heading font-bold tracking-tight text-foreground transition-colors duration-300",
            textSizes[size],
          )}
        >
          Flytt<span className="text-gradient">.io</span>
        </span>
      )}
    </span>
  )
}