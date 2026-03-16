"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mic,
  Sparkles,
  Volume2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useDIDStream } from "@/lib/did-stream-context"
import { getSharedAidaSessionId } from "@/lib/aida/client-session"
import { parseOpenClawResponse } from "@/lib/openclaw/response"
import {
  MINI_MIF_EVENT,
  describeMiniMifMissing,
  readMiniMifContext,
  type MiniMifContext,
} from "@/lib/mif/prefill"
import { persistMiniMifResult, resolveMiniMifInput } from "@/lib/mif/resolve"

const DID_CLIENT_KEY = process.env.NEXT_PUBLIC_DID_CLIENT_KEY ?? ""
const DID_AGENT_ID = process.env.NEXT_PUBLIC_DID_AGENT_ID ?? ""
const DID_BRIDGE_ENABLED = process.env.NEXT_PUBLIC_DID_BRIDGE_ENABLED === "true"
const AIDA_PLACEHOLDER_SRC = "/media/images/aida-placeholder.svg"

const QUICK_EXAMPLES = [
  "19900101-1234",
  "Vi flyttar 1 juni till Malmö",
  "Ny adress blir Storgatan 12 i Göteborg",
]

const FIELD_LABELS: Record<string, string> = {
  firstName: "förnamn",
  lastName: "efternamn",
  personalNumber: "personnummer",
  fromStreet: "nuvarande adress",
  fromPostal: "nuvarande postnummer",
  fromCity: "nuvarande ort",
  toStreet: "ny adress",
  toPostal: "nytt postnummer",
  toCity: "ny ort",
  moveDate: "inflyttningsdatum",
}

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

function AidaPortrait({
  className,
  imageClassName,
  alt = "Illustration av Aida",
}: {
  className?: string
  imageClassName?: string
  alt?: string
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={AIDA_PLACEHOLDER_SRC}
        alt={alt}
        fill
        className={cn("object-cover", imageClassName)}
      />
    </div>
  )
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

  const visibleFieldLabels = useMemo(
    () => Object.keys(miniMifContext?.fields ?? {}).map((field) => FIELD_LABELS[field] ?? field),
    [miniMifContext],
  )
  const missingLabels = useMemo(
    () => describeMiniMifMissing(miniMifContext?.missingCritical ?? []),
    [miniMifContext],
  )

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
      if (videoEl.srcObject !== srcObjectRef.current) {
        videoEl.src = ""
        videoEl.srcObject = srcObjectRef.current
      }
      void videoEl.play().catch(() => {})
      return
    }

    const idleVideo = agentRef.current?.agent?.presenter?.idle_video
    if (idleVideo && videoEl.src !== idleVideo) {
      videoEl.srcObject = null
      videoEl.src = idleVideo
      void videoEl.play().catch(() => {})
    }
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
        },
        onVideoStateChange(state: string) {
          if (state === "STOP") {
            setSpeaking(false)
            const videoEl = panelVideoRef.current
            if (videoEl && agentRef.current?.agent?.presenter?.idle_video) {
              videoEl.srcObject = null
              videoEl.src = agentRef.current.agent.presenter.idle_video
              void videoEl.play().catch(() => {})
            }
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
    <div className="mt-8 w-full max-w-2xl rounded-[32px] border border-border/70 bg-card/92 p-4 shadow-xl shadow-primary/10 backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-[28px] border border-border/60 bg-linear-to-b from-slate-950 via-slate-900 to-slate-950">
          <div className="relative h-[220px] bg-black">
            <video
              ref={panelVideoRef}
              autoPlay
              playsInline
              poster={AIDA_PLACEHOLDER_SRC}
              muted={connectionState !== "connected"}
              onLoadedMetadata={(event) => {
                if (connectionState === "connected" || srcObjectRef.current) {
                  setAvatarReady(true)
                }
                void (event.currentTarget as HTMLVideoElement).play().catch(() => {})
              }}
              className="h-full w-full object-contain object-top"
            />
            {!avatarReady && (
              <div className="absolute inset-0">
                <AidaPortrait className="h-full w-full" imageClassName="object-cover object-top opacity-95" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/60 to-transparent" />
          </div>

          <div className="space-y-3 border-t border-white/10 px-4 py-4 text-white">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", stateDotClass)} />
              <span className="text-sm font-medium">{stateLabel}</span>
            </div>
            <p className="text-xs leading-relaxed text-white/75">
              D-ID ger Aida röst och närvaro här i hero-ytan. OpenClaw står för förståelse, svar och nästa steg.
            </p>
            {didAvailable ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void connectStream()}
                disabled={connectionState === "connecting" || connectionState === "connected"}
                className="w-full justify-center rounded-xl"
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

        <div className="flex min-h-[430px] flex-col overflow-hidden rounded-[28px] border border-border/60 bg-background/75">
          <div className="border-b border-border/50 bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Börja med Aida</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Skriv personnummer eller fri text, så plockar hon ut det som går och guidar dig vidare.
                </p>
              </div>
              <Button asChild size="sm" className="rounded-full">
                <Link href="/adressandring">
                  Till formuläret
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
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

          {(warning || miniMifContext) && (
            <div className="border-b border-border/40 px-4 py-3">
              {warning && (
                <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warning}</span>
                </div>
              )}

              {miniMifContext && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Hittade uppgifter
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visibleFieldLabels.length > 0 ? (
                        visibleFieldLabels.map((field) => (
                          <span
                            key={field}
                            className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-foreground"
                          >
                            {field}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Ingen säker träff ännu, men Aida kan fortfarande guida dig vidare.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Viktigt kvar för SKV
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {missingLabels.length > 0 ? (
                        missingLabels.map((field) => (
                          <span
                            key={field}
                            className="rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground"
                          >
                            {field}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Blockerande startfält är redan täckta.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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

          <div className="border-t border-border/50 bg-card/80 px-4 py-3">
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

                <div className="flex gap-2">
                  <Button asChild type="button" variant="outline" className="rounded-xl">
                    <Link href="/adressandring">Gå direkt till formuläret</Link>
                  </Button>
                  <Button
                    type="submit"
                    disabled={!input.trim() || thinking}
                    className="rounded-xl"
                  >
                    {thinking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Låt Aida starta
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
