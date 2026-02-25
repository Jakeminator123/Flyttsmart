"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { parseOpenClawResponse } from "@/lib/openclaw/response";
import { cn } from "@/lib/utils";

const DID_CLIENT_KEY = process.env.NEXT_PUBLIC_DID_CLIENT_KEY ?? "";
const DID_AGENT_ID = process.env.NEXT_PUBLIC_DID_AGENT_ID ?? "";
const DID_BRIDGE_ENABLED = process.env.NEXT_PUBLIC_DID_BRIDGE_ENABLED === "true";
const MERGE_OC_DID =
  process.env.NEXT_PUBLIC_MERGE_OC_DID?.toLowerCase() === "y";

function getDidSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "did_bridge_session_id";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function pickBlurValue(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (target instanceof HTMLSelectElement) {
    return target.selectedOptions?.[0]?.text?.trim() || target.value.trim();
  }
  return target.value.trim();
}

const BLOCKED_INPUT_TYPES = new Set([
  "hidden", "password", "button", "submit", "reset",
  "file", "checkbox", "radio", "range", "color", "image",
]);

function canTrackBlur(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (target instanceof HTMLInputElement && BLOCKED_INPUT_TYPES.has(target.type)) {
    return false;
  }
  return true;
}

function collectFormContext(): Record<string, string> {
  const ctx: Record<string, string> = {};
  if (typeof document === "undefined") return ctx;
  const fields = document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input, textarea, select");

  for (const el of fields) {
    if (el instanceof HTMLInputElement && BLOCKED_INPUT_TYPES.has(el.type)) continue;
    const name = el.name || el.id;
    if (!name) continue;
    const value = el instanceof HTMLSelectElement
      ? (el.selectedOptions?.[0]?.text?.trim() || el.value.trim())
      : el.value.trim();
    if (value) ctx[name] = value;
  }
  return ctx;
}

function applySuggestions(suggestions: Record<string, string>): string[] {
  const applied: string[] = [];
  for (const [field, value] of Object.entries(suggestions)) {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[name="${field}"], #${field}`
    );
    if (!el) continue;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLSelectElement ? HTMLSelectElement.prototype :
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype :
      HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.value = value;
    }
    applied.push(field);
  }
  return applied;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "Förnamn", lastName: "Efternamn", personalNumber: "Personnummer",
  fromStreet: "Nuvarande gata", fromPostal: "Nuvarande postnr", fromCity: "Nuvarande ort",
  toStreet: "Ny gata", toPostal: "Nytt postnr", toCity: "Ny ort",
  apartmentNumber: "Lgh-nr", propertyDesignation: "Fastighetsbeteckning",
  propertyOwner: "Fastighetsägare", email: "E-post", phone: "Telefon", moveDate: "Flyttdatum",
};

const QUICK_PROMPTS = [
  "Vad saknas i formuläret just nu?",
  "Kan du ge mig en kort flyttchecklista?",
  "Har du tips inför flyttdatumet?",
];

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

type BridgeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  appliedFields?: string[];
  isError?: boolean;
};

async function sendChatMessage(
  sessionId: string,
  message: string,
): Promise<string> {
  const formContext = MERGE_OC_DID ? collectFormContext() : undefined;
  const res = await fetch("/api/did/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      message,
      source: "did-sdk-voice",
      ...(formContext ? { formContext } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Status ${res.status}`);
  }

  const data = await res.json();
  return data.reply || data.content || data.text || "Inget svar.";
}

function getSpeechRecognition(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function createMessageId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function DidOpenClawBridgeWidget() {
  const sessionIdRef = useRef("");
  const agentRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const sdkModuleRef = useRef<any>(null);
  const connectInFlightRef = useRef(false);
  const pendingSpeakRef = useRef<string | null>(null);
  const lastFieldValuesRef = useRef<Map<string, string>>(new Map());
  const lastFieldTimesRef = useRef<Map<string, number>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [sttSupported, setSttSupported] = useState(false);
  const [messages, setMessages] = useState<BridgeMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hej! Jag är Aida. Jag kan guida dig i formuläret, svara på frågor om flytten och föreslå fält att fylla i.",
    },
  ]);

  useEffect(() => {
    sessionIdRef.current = getDidSessionId();
    setSttSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, interimTranscript]);

  const loadDidSdk = useCallback(async () => {
    if (sdkModuleRef.current) return sdkModuleRef.current;
    sdkModuleRef.current = await import("@d-id/client-sdk");
    return sdkModuleRef.current;
  }, []);

  const connectAgent = useCallback(async () => {
    if (agentRef.current || connectInFlightRef.current || !DID_CLIENT_KEY || !DID_AGENT_ID) return;
    connectInFlightRef.current = true;
    setConnectionState("connecting");

    try {
      const did = await loadDidSdk();
      const auth = { type: "key" as const, clientKey: DID_CLIENT_KEY };

      const callbacks = {
        onSrcObjectReady(value: MediaStream) {
          if (videoRef.current) {
            videoRef.current.srcObject = value;
            void videoRef.current.play().catch(() => {
              // Autoplay can be blocked before user gesture. It's fine.
            });
          }
        },
        onConnectionStateChange(state: string) {
          if (state === "connected") setConnectionState("connected");
          else if (state === "disconnected" || state === "closed") setConnectionState("disconnected");
          else if (state === "failed") setConnectionState("error");
        },
        onVideoStateChange(state: string) {
          setSpeaking(state === "speaking");
        },
      };

      const agent = await did.createAgentManager(DID_AGENT_ID, { auth, callbacks });
      agentRef.current = agent;
      await agent.connect();
      setConnectionState("connected");
    } catch (err) {
      console.error("[DID SDK] connect error:", err);
      setConnectionState("error");
    } finally {
      connectInFlightRef.current = false;
    }
  }, [loadDidSdk]);

  const disconnectAgent = useCallback(async () => {
    try {
      await agentRef.current?.disconnect();
    } catch { /* ignore */ }
    agentRef.current = null;
    connectInFlightRef.current = false;
    setConnectionState("idle");
  }, []);

  useEffect(() => {
    if (!DID_BRIDGE_ENABLED || !DID_CLIENT_KEY || !DID_AGENT_ID) return;

    const warmup = () => {
      void loadDidSdk();
      void connectAgent();
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let timeoutId: number | undefined;
    let idleId: number | undefined;
    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(warmup, { timeout: 1400 });
    } else {
      timeoutId = window.setTimeout(warmup, 450);
    }

    return () => {
      if (idleId !== undefined && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [connectAgent, loadDidSdk]);

  useEffect(() => {
    return () => { void disconnectAgent(); };
  }, [disconnectAgent]);

  useEffect(() => {
    if (connectionState !== "connected") return;
    const id = window.setInterval(() => {
      const pending = pendingSpeakRef.current;
      if (!pending || !agentRef.current) return;
      pendingSpeakRef.current = null;
      void agentRef.current.speak({ type: "text", input: pending }).catch(() => {
        pendingSpeakRef.current = pending;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [connectionState]);

  const handleSendMessage = useCallback(async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || thinking) return;

    setInterimTranscript("");
    setMessages((prev) => [
      ...prev,
      { id: createMessageId(), role: "user", content: cleanText },
    ]);
    setThinking(true);

    try {
      const rawReply = await sendChatMessage(sessionIdRef.current, cleanText);
      const { text: visibleText, suggestions } = parseOpenClawResponse(rawReply);
      const displayText = visibleText || rawReply;
      const filled =
        suggestions && Object.keys(suggestions).length > 0
          ? applySuggestions(suggestions)
          : [];

      if (suggestions && Object.keys(suggestions).length > 0) {
        // Parsed suggestion block was applied to matching form fields.
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: displayText,
          appliedFields: filled.length > 0 ? filled : undefined,
        },
      ]);

      if (displayText.trim()) {
        if (agentRef.current && connectionState === "connected") {
          void agentRef.current
            .speak({ type: "text", input: displayText })
            .catch(() => {
              pendingSpeakRef.current = displayText;
              if (!agentRef.current) {
                void connectAgent();
              }
            });
        } else {
          pendingSpeakRef.current = displayText;
          void connectAgent();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fel";
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: `Kunde inte nå Aida: ${msg}`,
          isError: true,
        },
      ]);
    } finally {
      setThinking(false);
    }
  }, [thinking, connectionState, connectAgent]);

  const startListening = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRec();
    recognition.lang = "sv-SE";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      setInterimTranscript(text);

      if (result.isFinal && text.trim()) {
        void handleSendMessage(text.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("[STT] error:", event.error);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [handleSendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    setListening(false);
    setInterimTranscript("");
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    if (videoRef.current?.srcObject) {
      void videoRef.current.play().catch(() => {
        // Browser may still block autoplay; stream is already prepared.
      });
    }
    void connectAgent();
  }, [connectAgent]);

  const handleClose = useCallback(() => {
    setOpen(false);
    stopListening();
  }, [stopListening]);

  const handleTextSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    void handleSendMessage(textInput.trim());
    setTextInput("");
  }, [textInput, handleSendMessage]);

  // ── Form blur tracking (preserved from old widget) ──
  const sendFieldBlurToBridge = useCallback(
    async (fieldName: string, fieldValue: string) => {
      try {
        const formContext = MERGE_OC_DID ? collectFormContext() : undefined;
        await fetch("/api/did/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "field_blur",
            sessionId: sessionIdRef.current,
            fieldName,
            fieldValue,
            source: "did-field-blur",
            ...(formContext ? { formContext } : {}),
          }),
        });
      } catch { /* silent */ }
    },
    [],
  );

  useEffect(() => {
    if (!MERGE_OC_DID) return;
    const interval = setInterval(() => {
      const ctx = collectFormContext();
      if (Object.keys(ctx).length === 0) return;
      fetch("/api/did/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "form_sync",
          sessionId: sessionIdRef.current,
          formContext: ctx,
        }),
      }).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) return;
      if (!canTrackBlur(target)) return;
      const fieldValue = pickBlurValue(target);
      if (!fieldValue) return;

      const fieldName =
        target.name || target.id || target.getAttribute("aria-label") || "field";
      const now = Date.now();
      const previousValue = lastFieldValuesRef.current.get(fieldName);
      const previousTime = lastFieldTimesRef.current.get(fieldName) ?? 0;

      if (previousValue === fieldValue && now - previousTime < 1000) return;

      lastFieldValuesRef.current.set(fieldName, fieldValue);
      lastFieldTimesRef.current.set(fieldName, now);
      void sendFieldBlurToBridge(fieldName, fieldValue);
    };

    document.addEventListener("focusout", onFocusOut, true);
    return () => document.removeEventListener("focusout", onFocusOut, true);
  }, [sendFieldBlurToBridge]);

  if (!DID_BRIDGE_ENABLED || !DID_CLIENT_KEY || !DID_AGENT_ID) return null;

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
          : "Startar";

  const stateDotClass =
    connectionState === "connected"
      ? "bg-emerald-500"
      : connectionState === "connecting"
        ? "bg-amber-500 animate-pulse"
        : connectionState === "error"
          ? "bg-red-500"
          : "bg-gray-400";

  if (!open) {
    return (
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-5 sm:right-5">
        <button
          onClick={handleOpen}
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0"
          aria-label="Prata med Aida"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          <span className={cn("absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-background", stateDotClass)} />
        </button>
        <div className="mt-2 rounded-full border border-border/60 bg-card/95 px-3 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur">
          {connectionState === "connected" ? "Aida är redo" : "Startar Aida..."}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 flex w-[calc(100vw-1.5rem)] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-300 sm:bottom-5 sm:right-5 max-h-[min(82vh,680px)]">
      <div className="flex items-center justify-between border-b border-border/50 bg-linear-to-r from-primary/15 via-primary/5 to-transparent px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-foreground">Aida</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Röstassistent för flytten</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/80 px-2 py-1 text-[10px] font-medium text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", stateDotClass)} />
            {stateLabel}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          aria-label="Stäng"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/45 to-transparent" />
        {connectionState !== "connected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center text-xs text-white/90 backdrop-blur-sm">
            <span className={cn("h-2.5 w-2.5 rounded-full", stateDotClass)} />
            <span>
              {connectionState === "connecting"
                ? "Kopplar upp avataren..."
                : connectionState === "error"
                  ? "Kunde inte ansluta till Aida"
                  : "Förbereder Aida..."}
            </span>
          </div>
        )}
      </div>

      <div className="border-b border-border/40 bg-muted/20 px-4 py-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void handleSendMessage(prompt)}
              disabled={thinking}
              className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[88%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed shadow-sm",
                message.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : message.isError
                    ? "rounded-bl-md border border-red-500/25 bg-red-500/10 text-foreground"
                    : "rounded-bl-md bg-muted/75 text-foreground",
              )}
            >
              <p>{message.content}</p>
              {message.appliedFields && message.appliedFields.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {message.appliedFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      {FIELD_LABELS[field] || field}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {interimTranscript && listening && (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-foreground/90">
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

      <div className="border-t border-border/50 bg-card/85 px-3 py-2.5">
        <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
          {sttSupported && (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={thinking}
              className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-all ${
                listening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              } disabled:opacity-40`}
              aria-label={listening ? "Sluta lyssna" : "Tala"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            </button>
          )}
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Skriv till Aida eller använd mikrofonen..."
            className="h-9 flex-1 rounded-xl border border-border/60 bg-muted/40 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 transition-colors focus:border-primary/40 focus:bg-background disabled:opacity-50"
            disabled={thinking}
          />
          <button
            type="submit"
            disabled={thinking || !textInput.trim()}
            className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Tips: du kan fråga fritt eller be Aida fylla saknade fält.
        </p>
      </div>
    </div>
  );
}
