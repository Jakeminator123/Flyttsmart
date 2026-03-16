"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2,
  Mic,
  Sparkles,
  Volume2,
} from "lucide-react"
import { LandingFormStart } from "@/components/forms/landing-form-start"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useDIDStream } from "@/lib/did-stream-context"
import { getSharedAidaSessionId } from "@/lib/aida/client-session"
import { parseOpenClawResponse } from "@/lib/openclaw/response"
import {
  MINI_MIF_EVENT,
  readMiniMifContext,
  type MiniMifContext,
} from "@/lib/mif/prefill"
import { persistMiniMifResult, resolveMiniMifInput } from "@/lib/mif/resolve"

const DID_CLIENT_KEY = process.env.NEXT_PUBLIC_DID_CLIENT_KEY ?? ""
const DID_AGENT_ID = process.env.NEXT_PUBLIC_DID_AGENT_ID ?? ""
const DID_BRIDGE_ENABLED = process.env.NEXT_PUBLIC_DID_BRIDGE_ENABLED === "true"
const AIDA_FALLBACK_VIDEO_SRC = "/media/videos/aida-intro.mp4"

const QUICK_EXAMPLES = [
  "19900101-1234",
  "Vi flyttar 1 juni till Malmö",
  "Ny adress blir Storgatan 12 i Göteborg",
]

type ConnectionState = "idle" | "connecting" | "connected" | "error" | "unavailable"

type LandingMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  isError?: boolean
}

function createMessageId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function getSpeechRecognition(): (new () => any) | null {
  if (typeof window === "undefined") return null
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function sendLandingMessage(
  sessionId: string,
  message: string,
  recentMessages: Array<{ role: string; content: string }>,
  mifContext: MiniMifContext | null,
) {
  const formContext = mifContext?.fields ?? {}
  const res = await fetch("/api/did/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      message,
      source: "landing-hero",
      formContext,
      mifContext,
      ...(recentMessages.length > 0 ? { clientHistory: recentMessages.slice(-10) } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `Status ${res.status}`)
  }

  const data = await res.json()
  return data.reply || data.content || data.text || "Inget svar från Aida."
}

export function EmbeddedLandingAida() {
  const didStreamCtx = useDIDStream()
  const didAvailable = DID_BRIDGE_ENABLED && Boolean(DID_CLIENT_KEY) && Boolean(DID_AGENT_ID)

  const sessionIdRef = useRef("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const panelVideoRef = useRef<HTMLVideoElement>(null)
  const agentRef = useRef<any>(null)
  const recognitionRef = useRef<any>(null)
  const sdkModuleRef = useRef<any>(null)
  const connectInFlightRef = useRef(false)
  const autoConnectRequestedRef = useRef(false)
  const srcObjectRef = useRef<MediaStream | null>(null)
  const pendingSpeakRef = useRef<string | null>(null)

  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [avatarReady, setAvatarReady] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [warning, setWarning] = useState<string | null>(null)
  const [sttSupported, setSttSupported] = useState(false)
  const [miniMifContext, setMiniMifContext] = useState<MiniMifContext | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    didAvailable ? "idle" : "unavailable",
  )
  const [messages, setMessages] = useState<LandingMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hej, jag är Aida. Skriv personnummer eller det du vet om flytten, så plockar jag ut det som går och guidar dig vidare.",
    },
  ])

  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    sessionIdRef.current = getSharedAidaSessionId()
    setMiniMifContext(readMiniMifContext())
    setSttSupported(getSpeechRecognition() !== null)
  }, [])

  useEffect(() => {
    const syncMiniMif = () => setMiniMifContext(readMiniMifContext())
    syncMiniMif()
    window.addEventListener(MINI_MIF_EVENT, syncMiniMif as EventListener)
    window.addEventListener("storage", syncMiniMif)
    return () => {
      window.removeEventListener(MINI_MIF_EVENT, syncMiniMif as EventListener)
      window.removeEventListener("storage", syncMiniMif)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, interimTranscript, thinking])

  const stateLabel =
    connectionState === "connecting"
      ? "Ansluter"
      : connectionState === "connected"
        ? speaking
          ? "Talar"
          : listening
            ? "Lyssnar"
            : thinking
              ? "Tänker"
              : "Redo"
        : connectionState === "error"
          ? "Fel"
          : connectionState === "unavailable"
            ? "Textläge"
            : "Viloläge"

  const stateDotClass =
    connectionState === "connected"
      ? "bg-emerald-500"
      : connectionState === "connecting"
        ? "bg-amber-500 animate-pulse"
        : connectionState === "error"
          ? "bg-red-500"
          : "bg-slate-400"

  const syncVideoPlayback = useCallback(() => {
    const videoEl = panelVideoRef.current
    if (!videoEl) return

    if (srcObjectRef.current) {
      if (videoEl.srcObject !== srcObjectRef.current || videoEl.dataset.source !== "stream") {
        videoEl.loop = false
        videoEl.src = ""
        videoEl.srcObject = srcObjectRef.current
        videoEl.dataset.source = "stream"
      }
      videoEl.muted = false
      void videoEl.play().catch(() => {})
      return
    }

    const idleVideo = agentRef.current?.agent?.presenter?.idle_video
    if (idleVideo) {
      if (videoEl.src !== idleVideo || videoEl.dataset.source !== "idle") {
        videoEl.loop = true
        videoEl.srcObject = null
        videoEl.src = idleVideo
        videoEl.dataset.source = "idle"
      }
      videoEl.muted = true
      void videoEl.play().catch(() => {})
      return
    }

    if (
      videoEl.getAttribute("src") !== AIDA_FALLBACK_VIDEO_SRC ||
      videoEl.dataset.source !== "fallback"
    ) {
      videoEl.loop = true
      videoEl.srcObject = null
      videoEl.src = AIDA_FALLBACK_VIDEO_SRC
      videoEl.dataset.source = "fallback"
    }
    videoEl.muted = true
    void videoEl.play().catch(() => {})
  }, [])

  const loadDidSdk = useCallback(async () => {
    if (sdkModuleRef.current) return sdkModuleRef.current
    sdkModuleRef.current = await import("@d-id/client-sdk")
    return sdkModuleRef.current
  }, [])

  const initAgent = useCallback(async () => {
    if (!didAvailable || agentRef.current || connectInFlightRef.current) return
    connectInFlightRef.current = true

    try {
      const did = await loadDidSdk()
      const auth = { type: "key" as const, clientKey: DID_CLIENT_KEY }
      const callbacks = {
        onSrcObjectReady(value: MediaStream) {
          srcObjectRef.current = value
          setAvatarReady(true)
          didStreamCtx.setStream(value)
          didStreamCtx.setAvatarReady(true)
          syncVideoPlayback()
        },
        onConnectionStateChange(state: string) {
          if (state === "connected") setConnectionState("connected")
          else if (state === "disconnected" || state === "closed") setConnectionState("idle")
          else if (state === "failed") setConnectionState("error")
          syncVideoPlayback()
        },
        onVideoStateChange(state: string) {
          if (state === "STOP") {
            setSpeaking(false)
            syncVideoPlayback()
          } else {
            setSpeaking(state === "speaking")
            syncVideoPlayback()
          }
        },
      }

      agentRef.current = await did.createAgentManager(DID_AGENT_ID, {
        auth,
        callbacks,
        streamOptions: {
          compatibilityMode: "auto" as const,
          streamWarmup: true,
        },
      })
      setConnectionState("idle")
      syncVideoPlayback()
    } catch (error) {
      console.error("[DID SDK] init error:", error)
      setConnectionState("error")
      syncVideoPlayback()
    } finally {
      connectInFlightRef.current = false
    }
  }, [didAvailable, didStreamCtx, loadDidSdk, syncVideoPlayback])

  const connectStream = useCallback(async () => {
    if (!didAvailable) return
    if (connectionState === "connected") return
    if (connectInFlightRef.current) return

    await initAgent()
    if (!agentRef.current) return

    connectInFlightRef.current = true
    setConnectionState("connecting")
    try {
      await agentRef.current.connect()
      setConnectionState("connected")
    } catch (error) {
      console.error("[DID SDK] connect error:", error)
      setConnectionState("error")
      syncVideoPlayback()
    } finally {
      connectInFlightRef.current = false
    }
  }, [connectionState, didAvailable, initAgent])

  useEffect(() => {
    if (!didAvailable) return
    return () => {
      recognitionRef.current?.abort?.()
      void agentRef.current?.disconnect?.().catch(() => {})
    }
  }, [didAvailable])

  useEffect(() => {
    if (!didAvailable || autoConnectRequestedRef.current) return

    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    const warmup = () => {
      autoConnectRequestedRef.current = true
      void (async () => {
        await initAgent()
        await connectStream()
      })()
    }

    let timeoutId: number | undefined
    let idleId: number | undefined

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(warmup, { timeout: 1200 })
    } else {
      timeoutId = window.setTimeout(warmup, 450)
    }

    return () => {
      if (idleId !== undefined && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId)
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [connectStream, didAvailable, initAgent])

  useEffect(() => {
    if (connectionState !== "connected") return
    const id = window.setInterval(() => {
      const pending = pendingSpeakRef.current
      if (!pending || !agentRef.current) return
      pendingSpeakRef.current = null
      void agentRef.current.speak({ type: "text", input: pending }).catch(() => {
        pendingSpeakRef.current = pending
      })
    }, 800)
    return () => window.clearInterval(id)
  }, [connectionState])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncVideoPlayback()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [avatarReady, connectionState, speaking, syncVideoPlayback])

  const speakReply = useCallback(
    (text: string) => {
      if (!didAvailable || !text.trim()) return
      if (agentRef.current && connectionState === "connected") {
        void agentRef.current.speak({ type: "text", input: text }).catch(() => {
          pendingSpeakRef.current = text
        })
        return
      }
      pendingSpeakRef.current = text
      void connectStream()
    },
    [connectStream, connectionState, didAvailable],
  )

  const streamAssistantMessage = useCallback(async (text: string, isError = false) => {
    const messageId = createMessageId()
    setMessages((prev) => [...prev, { id: messageId, role: "assistant", content: "", isError }])

    const parts = text.split(/(\s+)/).filter(Boolean)
    let current = ""

    for (const part of parts) {
      current += part
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? { ...message, content: current } : message,
        ),
      )
      await sleep(parts.length > 32 ? 14 : 26)
    }
  }, [])

  const handleSendMessage = useCallback(
    async (rawInput: string) => {
      const cleanText = rawInput.trim()
      if (!cleanText || thinking) return

      setThinking(true)
      setWarning(null)
      setInterimTranscript("")
      setInput("")
      setMessages((prev) => [
        ...prev,
        { id: createMessageId(), role: "user", content: cleanText },
      ])

      let nextMiniMifContext = miniMifContext
      try {
        const resolved = await resolveMiniMifInput(cleanText)
        persistMiniMifResult(resolved)
        nextMiniMifContext = resolved.context
        setMiniMifContext(resolved.context)
        if (resolved.warning) {
          setWarning(resolved.warning)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Kunde inte tolka startinformationen."
        setWarning(message)
      }

      try {
        const recentMessages = messagesRef.current
          .filter((message) => !message.isError)
          .map(({ role, content }) => ({ role, content }))

        const rawReply = await sendLandingMessage(
          sessionIdRef.current,
          cleanText,
          recentMessages,
          nextMiniMifContext,
        )
        const { text } = parseOpenClawResponse(rawReply)
        const displayText = text || rawReply

        speakReply(displayText)
        await streamAssistantMessage(displayText)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Okänt fel"
        await streamAssistantMessage(`Kunde inte nå Aida just nu: ${message}`, true)
      } finally {
        setThinking(false)
      }
    },
    [miniMifContext, speakReply, streamAssistantMessage, thinking],
  )

  const startListening = useCallback(() => {
    const SpeechRec = getSpeechRecognition()
    if (!SpeechRec || thinking) return

    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    const recognition = new SpeechRec()
    recognition.lang = "sv-SE"
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      void connectStream()
    }

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      const text = result[0].transcript
      setInterimTranscript(text)

      if (result.isFinal && text.trim()) {
        void handleSendMessage(text.trim())
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("[landing STT] error:", event.error)
      }
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      setInterimTranscript("")
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [connectStream, handleSendMessage, thinking])

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort()
    setListening(false)
    setInterimTranscript("")
  }, [])

  return (
    <div className="mt-8 w-full max-w-[1240px] rounded-[36px] border border-border/70 bg-card/90 p-3 shadow-2xl shadow-primary/10 backdrop-blur sm:p-4 xl:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
        <div className="flex min-w-0 flex-col overflow-hidden rounded-[30px] border border-border/60 bg-background/78">
          <div className="overflow-hidden border-b border-border/50 bg-linear-to-b from-slate-950 via-slate-900 to-slate-950">
            <div className="relative h-[220px] bg-black sm:h-[250px] xl:h-[300px]">
              <video
                ref={panelVideoRef}
                autoPlay
                playsInline
                muted={connectionState !== "connected" || !srcObjectRef.current}
                onLoadedData={(event) => {
                  setAvatarReady(true)
                  void (event.currentTarget as HTMLVideoElement).play().catch(() => {})
                }}
                onError={(event) => {
                  const video = event.currentTarget as HTMLVideoElement
                  if (video.dataset.source === "fallback") return
                  setAvatarReady(false)
                  video.srcObject = null
                  video.src = AIDA_FALLBACK_VIDEO_SRC
                  video.dataset.source = "fallback"
                  video.loop = true
                  video.muted = true
                  void video.play().catch(() => {})
                }}
                className="h-full w-full object-contain object-top"
              />
              {!avatarReady && (
                <div className="absolute inset-0 flex items-end bg-linear-to-br from-slate-950 via-slate-900/90 to-slate-950 px-4 py-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Aida startar upp sin videoyta
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/65 to-transparent" />
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 text-white md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", stateDotClass)} />
                  <span className="text-sm font-medium">{stateLabel}</span>
                </div>
                <p className="max-w-xl text-xs leading-relaxed text-white/75">
                  D-ID ger Aida närvaro i hero-ytan. Om liveströmmen inte hinner upp
                  direkt visar vi hennes videobas medan OpenClaw fortsätter driva
                  förståelsen och svaren.
                </p>
              </div>
              {didAvailable ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void connectStream()}
                  disabled={connectionState === "connecting" || connectionState === "connected"}
                  className="w-full justify-center rounded-xl md:w-auto"
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  {connectionState === "connected" ? "Röst aktiv" : "Aktivera röst"}
                </Button>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                  D-ID är inte aktivt just nu. Aida fungerar fortfarande i textläge.
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-[440px] flex-1 flex-col bg-background/82">
            <div className="border-b border-border/50 bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-4 py-4">
              <p className="text-sm font-semibold text-foreground">Prata med Aida</p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Skriv personnummer eller fri text. Det du berättar här kan samtidigt
                fylla på formulärstarten till höger.
              </p>
            </div>

            <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setInput(example)}
                    className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                      message.role === "user"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : message.isError
                          ? "rounded-bl-md border border-red-500/25 bg-red-500/10 text-foreground"
                          : "rounded-bl-md bg-muted/75 text-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {interimTranscript && listening && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-foreground/90">
                    Lyssnar: {interimTranscript}
                  </div>
                </div>
              )}

              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-muted/75 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border/50 bg-card/80 px-4 py-4">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSendMessage(input)
                }}
                className="space-y-3"
              >
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder='Skriv t.ex. "19900101-1234" eller "Vi flyttar 1 juni till Malmö"'
                  className="min-h-24 rounded-2xl border-border/70 bg-background/85 px-4 py-3 text-base"
                  disabled={thinking}
                />

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    {sttSupported && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={listening ? stopListening : startListening}
                        disabled={thinking}
                        className="rounded-xl"
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        {listening ? "Sluta lyssna" : "Prata med Aida"}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Aida kan läsa det du redan vet och lotsa dig vidare steg för steg.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={!input.trim() || thinking}
                    className="rounded-xl md:min-w-44"
                  >
                    {thinking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Skicka till Aida
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <LandingFormStart miniMifContext={miniMifContext} warning={warning} />
      </div>
    </div>
  )
}
