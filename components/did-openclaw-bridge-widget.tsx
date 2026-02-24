"use client";

import { useEffect, useRef, useCallback, useState } from "react";

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

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

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

export function DidOpenClawBridgeWidget() {
  const sessionIdRef = useRef("");
  const agentRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastFieldValuesRef = useRef<Map<string, string>>(new Map());
  const lastFieldTimesRef = useRef<Map<string, number>>(new Map());

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [textInput, setTextInput] = useState("");
  const [sttSupported, setSttSupported] = useState(false);

  useEffect(() => {
    sessionIdRef.current = getDidSessionId();
    setSttSupported(getSpeechRecognition() !== null);
  }, []);

  const connectAgent = useCallback(async () => {
    if (agentRef.current || !DID_CLIENT_KEY || !DID_AGENT_ID) return;
    setConnectionState("connecting");

    try {
      const did = await import("@d-id/client-sdk");
      const auth = { type: "key" as const, clientKey: DID_CLIENT_KEY };

      const callbacks = {
        onSrcObjectReady(value: MediaStream) {
          if (videoRef.current) {
            videoRef.current.srcObject = value;
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
        onNewMessage(messages: any[], type: string) {
          if (type === "answer" && messages.length > 0) {
            const last = messages[messages.length - 1];
            if (last?.content) setLastReply(last.content);
          }
        },
      };

      const agent = await did.createAgentManager(DID_AGENT_ID, { auth, callbacks });
      agentRef.current = agent;
      await agent.connect();
    } catch (err) {
      console.error("[DID SDK] connect error:", err);
      setConnectionState("error");
    }
  }, []);

  const disconnectAgent = useCallback(async () => {
    try {
      await agentRef.current?.disconnect();
    } catch { /* ignore */ }
    agentRef.current = null;
    setConnectionState("idle");
  }, []);

  useEffect(() => {
    return () => { void disconnectAgent(); };
  }, [disconnectAgent]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || thinking) return;
    setTranscript(text);
    setThinking(true);
    setLastReply("");

    try {
      const reply = await sendChatMessage(sessionIdRef.current, text);
      setLastReply(reply);

      if (agentRef.current && connectionState === "connected") {
        try {
          await agentRef.current.speak({ type: "text", input: reply });
        } catch {
          // speak() may fail if agent isn't fully ready
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fel";
      setLastReply(`Kunde inte nå Aida: ${msg}`);
    } finally {
      setThinking(false);
    }
  }, [thinking, connectionState]);

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
      setTranscript(text);

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
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [handleSendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleOpen = useCallback(async () => {
    setOpen(true);
    if (!agentRef.current) {
      await connectAgent();
    }
  }, [connectAgent]);

  const handleClose = useCallback(async () => {
    setOpen(false);
    stopListening();
    await disconnectAgent();
  }, [disconnectAgent, stopListening]);

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

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95"
        aria-label="Prata med Aida"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
    );
  }

  const stateLabel =
    connectionState === "connecting" ? "Ansluter..." :
    connectionState === "connected" ? (speaking ? "Aida talar..." : listening ? "Lyssnar..." : thinking ? "Tänker..." : "Redo") :
    connectionState === "error" ? "Anslutningsfel" :
    "Startar...";

  const stateColor =
    connectionState === "connected" ? "bg-emerald-500" :
    connectionState === "connecting" ? "bg-amber-500 animate-pulse" :
    connectionState === "error" ? "bg-red-500" :
    "bg-gray-400";

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-[360px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[min(520px,calc(100vh-3rem))]">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-linear-to-r from-primary/5 to-primary/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${stateColor}`} />
          <span className="text-sm font-semibold text-foreground">Aida</span>
          <span className="text-[11px] text-muted-foreground">{stateLabel}</span>
        </div>
        <button
          onClick={handleClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Stäng"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      {/* Video */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        {connectionState !== "connected" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white/80">
            {connectionState === "connecting" ? "Ansluter till Aida..." : connectionState === "error" ? "Kunde inte ansluta" : ""}
          </div>
        )}
      </div>

      {/* Transcript + reply area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-[60px] max-h-[120px]">
        {transcript && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Du:</span> {transcript}
          </p>
        )}
        {thinking && (
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:300ms]" />
          </div>
        )}
        {lastReply && !thinking && (
          <p className="text-xs text-foreground">
            <span className="font-medium">Aida:</span> {lastReply}
          </p>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-card/80 px-3 py-2">
        <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
          {sttSupported && (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={thinking || connectionState !== "connected"}
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
            placeholder="Skriv till Aida..."
            className="h-9 flex-1 rounded-xl border border-border/60 bg-muted/40 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 transition-colors focus:border-primary/40 focus:bg-background disabled:opacity-50"
            disabled={thinking || connectionState !== "connected"}
          />
          <button
            type="submit"
            disabled={thinking || !textInput.trim() || connectionState !== "connected"}
            className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
