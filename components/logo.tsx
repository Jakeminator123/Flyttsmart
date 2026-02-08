import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "full" | "icon"
}

export function Logo({ className, size = "md", variant = "full" }: LogoProps) {
  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-12 w-12",
  }

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20",
          iconSizes[size]
        )}
      >
        {/* House + arrow SVG icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[60%] w-[60%]"
          aria-hidden="true"
        >
          {/* House roof */}
          <path
            d="M3 11L12 4L21 11"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* House body */}
          <path
            d="M5 10V19C5 19.5523 5.44772 20 6 20H10V15C10 14.4477 10.4477 14 11 14H13C13.5523 14 14 14.4477 14 15V20H18C18.5523 20 19 19.5523 19 19V10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Forward arrow */}
          <path
            d="M15 8L18.5 4.5M18.5 4.5L15 1M18.5 4.5H12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {variant === "full" && (
        <span
          className={cn(
            "font-heading font-bold tracking-tight text-foreground",
            textSizes[size]
          )}
        >
          Flytt<span className="text-primary">smart</span>
        </span>
      )}
    </span>
  )
}
