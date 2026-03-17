"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle2,
  Circle,
  MapPin,
  Truck,
  Package,
  Home,
  ArrowRight,
  Zap,
} from "lucide-react"

const CHECKLIST = [
  { label: "Skatteverket", done: true },
  { label: "Försäkringskassan", done: true },
  { label: "Bankerna", done: true },
  { label: "Elavtal & bredband", done: false },
  { label: "Försäkringar", done: false },
]

export function HeroVisual() {
  const [progress, setProgress] = useState(0)
  const [visibleItems, setVisibleItems] = useState(0)
  const [showNotification, setShowNotification] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setProgress(62), 600)

    const itemTimers = CHECKLIST.map((_, i) =>
      setTimeout(() => setVisibleItems(i + 1), 900 + i * 200),
    )

    const notifTimer = setTimeout(() => setShowNotification(true), 2200)

    return () => {
      clearTimeout(timer)
      itemTimers.forEach(clearTimeout)
      clearTimeout(notifTimer)
    }
  }, [])

  return (
    <div className="relative w-full">
      {/* Floating decorative elements */}
      <motion.div
        className="absolute -top-4 -right-4 z-20"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-sm border border-primary/20 shadow-lg">
          <Package className="h-6 w-6 text-primary" />
        </div>
      </motion.div>
      <motion.div
        className="absolute -bottom-3 -left-3 z-20"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 backdrop-blur-sm border border-accent/20 shadow-lg">
          <Home className="h-5 w-5 text-accent-foreground" />
        </div>
      </motion.div>

      {/* Main card */}
      <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-md shadow-2xl shadow-primary/10">
        {/* Header bar */}
        <div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-5 py-3.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-chart-5/60" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-medium text-muted-foreground">
              Flytt.io
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
            <Zap className="mr-1 h-3 w-3" />
            Live
          </Badge>
        </div>

        <CardContent className="p-5 space-y-4">
          {/* Address change route */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-chart-5/10">
                <MapPin className="h-4 w-4 text-chart-5" />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Från
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Sveavägen 42, Stockholm
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Till
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Kungsgatan 15, Göteborg
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          {/* Animated progress section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Adressändring
              </span>
              <motion.span
                className="text-xs font-bold text-primary tabular-nums"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {progress}%
              </motion.span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Truck className="h-3 w-3" />
              <span>3 av 5 myndigheter klara</span>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Checklist */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground mb-2">
              Checklista
            </p>
            {CHECKLIST.map((item, i) => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-500"
                style={{
                  opacity: i < visibleItems ? 1 : 0,
                  transform:
                    i < visibleItems
                      ? "translateX(0)"
                      : "translateX(-8px)",
                  transitionDelay: `${i * 60}ms`,
                }}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-chart-5" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
                <span
                  className={`text-xs ${item.done ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {item.label}
                </span>
                {item.done && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[9px] px-1.5 py-0 bg-chart-5/10 text-chart-5 border-0"
                  >
                    Klar
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Floating notification card */}
      <motion.div
        className="absolute -bottom-6 -right-6 z-10 w-56"
        initial={{ y: 16, opacity: 0 }}
        animate={showNotification ? { y: 0, opacity: 1 } : {}}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="glass border-border/40 shadow-xl">
          <CardContent className="flex items-center gap-3 p-3">
            <Avatar className="h-9 w-9 border-2 border-card shrink-0">
              <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                SK
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                Skatteverket
              </p>
              <p className="text-[10px] text-chart-5 font-medium">
                Adressändring godkänd
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-chart-5" />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
