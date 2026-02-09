"use client"

import { useState } from "react"
import { X, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Small inline SVG avatar – a friendly feminine silhouette */
function AgentAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Hair + head */}
      <circle cx="18" cy="13" r="8" fill="#5B3A29" />
      <ellipse cx="18" cy="15" rx="6.5" ry="7" fill="#F5CBA7" />
      {/* Hair fringe */}
      <path
        d="M11 13c0-5 3.5-9 7-9s7 4 7 9c0 0-2-4-7-4s-7 4-7 4z"
        fill="#5B3A29"
      />
      {/* Eyes */}
      <circle cx="15.2" cy="14.5" r="1" fill="#2C3E50" />
      <circle cx="20.8" cy="14.5" r="1" fill="#2C3E50" />
      {/* Smile */}
      <path
        d="M15.5 18.5c1 1.2 3.5 1.2 5 0"
        stroke="#2C3E50"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      {/* Body / shoulders */}
      <path
        d="M8 33c0-6 4.5-10 10-10s10 4 10 10"
        fill="#6C63FF"
      />
    </svg>
  )
}

const DID_SHARE_URL =
  "https://studio.d-id.com/agents/share?id=v2_agt_THZNQGpC&utm_source=copy&key=WjI5dloyeGxMVzloZFhSb01ud3hNVFV5TnpnMU56UXpORE0yTnpFMU9UUTVPRFU2VkZGclUxSTNTVU54V0hwdFpIZzNOSGxOVkhKMA=="

export function DIdAgentWidget() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)

  return (
    <>
      {/* Floating trigger button – avatar with online dot */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true)
            setMinimized(false)
          }}
          className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/30 bg-white shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/30 active:scale-95"
          aria-label="Öppna AI-videoagent"
        >
          <AgentAvatar className="h-12 w-12 rounded-full" />
          {/* Online indicator */}
          <span className="absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          </span>
        </button>
      )}

      {/* Minimized pill */}
      {open && minimized && (
        <div
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full border border-border/60 bg-card px-3 py-2 shadow-lg transition-all duration-300 hover:shadow-xl cursor-pointer"
          onClick={() => setMinimized(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setMinimized(false) }}
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-white">
            <AgentAvatar className="h-6 w-6" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
          </div>
          <span className="text-sm font-medium text-foreground">
            AI-agent
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              setMinimized(false)
            }}
            className="ml-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Stäng agent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Full overlay panel */}
      {open && !minimized && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMinimized(true)}
          />

          {/* Agent panel */}
          <div
            className={cn(
              "fixed z-50 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl",
              "animate-in fade-in zoom-in-95 duration-300",
              // Mobile: nearly full screen. Desktop: large panel bottom-right.
              "inset-3 sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(680px,calc(100vh-3rem))] sm:w-[min(440px,calc(100vw-3rem))]"
            )}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between border-b bg-linear-to-r from-primary/5 to-primary/10 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-white">
                  <AgentAvatar className="h-6 w-6" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none text-foreground">
                    Flyttsmart Agent
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    AI-videoassistent av D-ID
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setMinimized(true)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Minimera"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setOpen(false)
                    setMinimized(false)
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Stäng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* D-ID agent iframe */}
            <iframe
              src={DID_SHARE_URL}
              className="h-[calc(100%-3rem)] w-full border-0"
              allow="camera;microphone;display-capture;autoplay"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
              title="Flyttsmart AI-agent"
            />
          </div>
        </>
      )}
    </>
  )
}