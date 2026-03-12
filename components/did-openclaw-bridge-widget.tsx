"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { parseOpenClawResponse, type EmailRequestBlock } from "@/lib/openclaw/response";
import { cn } from "@/lib/utils";
import { useDIDStream } from "@/lib/did-stream-context";
import {
  MINI_MIF_EVENT,
  readMiniMifContext,
  type MiniMifContext,
} from "@/lib/mif/prefill";

const DID_CLIENT_KEY = process.env.NEXT_PUBLIC_DID_CLIENT_KEY ?? "";
const DID_AGENT_ID = process.env.NEXT_PUBLIC_DID_AGENT_ID ?? "";
const DID_BRIDGE_ENABLED = process.env.NEXT_PUBLIC_DID_BRIDGE_ENABLED === "true";
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

const FORM_CTX_STORAGE_KEY = "aida_form_context";

function loadPersistedFormContext(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(FORM_CTX_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch { /* corrupt data */ }
  return {};
}

function persistFormContext(ctx: Record<string, string>) {
  try {
    sessionStorage.setItem(FORM_CTX_STORAGE_KEY, JSON.stringify(ctx));
  } catch { /* storage full or unavailable */ }
}

function collectFormContext(): Record<string, string> {
  const persisted = typeof window !== "undefined" ? loadPersistedFormContext() : {};
  const domCtx: Record<string, string> = {};
  if (typeof document !== "undefined") {
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
      if (value) domCtx[name] = value;
    }
  }

  const merged = { ...persisted, ...domCtx };
  if (Object.keys(merged).length > 0) persistFormContext(merged);
  return merged;
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

const AIDA_PLACEHOLDER_SRC = "/media/images/aida-placeholder.svg";
const AIDA_CONNECT_CTA_DELAY_MS = 8000;

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

type BridgeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  appliedFields?: string[];
  isError?: boolean;
  emailRequest?: EmailRequestBlock;
};

async function sendChatMessage(
  sessionId: string,
  message: string,
  recentMessages?: Array<{ role: string; content: string }>,
): Promise<string> {
  const formContext = collectFormContext();
  const clientHistory = recentMessages?.slice(-10).map(({ role, content }) => ({
    role,
    content,
  }));
  const res = await fetch("/api/did/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      message,
      source: "did-sdk-voice",
      formContext,
      mifContext: readMiniMifContext(),
      ...(clientHistory?.length ? { clientHistory } : {}),
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

function AidaPortrait({
  className,
  imageClassName,
  alt = "Illustration av Aida",
}: {
  className?: string;
  imageClassName?: string;
  alt?: string;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <img
        src={AIDA_PLACEHOLDER_SRC}
        alt={alt}
        className={cn("h-full w-full object-cover", imageClassName)}
      />
    </div>
  );
}

export function DidOpenClawBridgeWidget() {
  const sessionIdRef = useRef("");
  const agentRef = useRef<any>(null);
  const badgeVideoRef = useRef<HTMLVideoElement>(null);
  const panelVideoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const sdkModuleRef = useRef<any>(null);
  const connectInFlightRef = useRef(false);
  const autoConnectRequestedRef = useRef(false);
  const pendingSpeakRef = useRef<string | null>(null);
  const srcObjectRef = useRef<MediaStream | null>(null);
  const lastFieldValuesRef = useRef<Map<string, string>>(new Map());
  const lastFieldTimesRef = useRef<Map<string, number>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const didStreamCtx = useDIDStream();

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
        "Hej! Jag är Aida, din röstguide. Jag kan lotsa dig genom flytten, och OpenClaw hjälper mig i bakgrunden med svar, förslag och sammanhang.",
    },
  ]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailOverrideTo, setEmailOverrideTo] = useState("");
  const [avatarReady, setAvatarReady] = useState(false);
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [miniMifContext, setMiniMifContext] = useState<MiniMifContext | null>(null);
  const messagesRef = useRef(messages);
  const prefersReducedMotion = useReducedMotion();
  messagesRef.current = messages;

  const getVisibleVideoElement = useCallback(() => {
    if (open) return panelVideoRef.current ?? badgeVideoRef.current;
    return badgeVideoRef.current ?? panelVideoRef.current;
  }, [open]);

  const syncVideoPlayback = useCallback(() => {
    const videoEl = getVisibleVideoElement();
    if (!videoEl) return;

    if (srcObjectRef.current) {
      if (videoEl.srcObject !== srcObjectRef.current) {
        videoEl.src = "";
        videoEl.srcObject = srcObjectRef.current;
      }
      void videoEl.play().catch(() => {});
      return;
    }

    const idleVideo = agentRef.current?.agent?.presenter?.idle_video;
    if (idleVideo && videoEl.src !== idleVideo) {
      videoEl.srcObject = null;
      videoEl.src = idleVideo;
      void videoEl.play().catch(() => {});
    }
  }, [getVisibleVideoElement]);

  useEffect(() => {
    sessionIdRef.current = getDidSessionId();
    setSttSupported(getSpeechRecognition() !== null);
    setMiniMifContext(readMiniMifContext());
  }, []);

  useEffect(() => {
    const syncMiniMif = () => setMiniMifContext(readMiniMifContext());
    syncMiniMif();
    window.addEventListener(MINI_MIF_EVENT, syncMiniMif as EventListener);
    window.addEventListener("storage", syncMiniMif);
    return () => {
      window.removeEventListener(MINI_MIF_EVENT, syncMiniMif as EventListener);
      window.removeEventListener("storage", syncMiniMif);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, interimTranscript]);

  const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDidSdk = useCallback(async () => {
    if (sdkModuleRef.current) return sdkModuleRef.current;
    sdkModuleRef.current = await import("@d-id/client-sdk");
    return sdkModuleRef.current;
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (agentRef.current && connectionState === "connected") {
        void agentRef.current.disconnect().catch(() => {});
        srcObjectRef.current = null;
        connectInFlightRef.current = false;
        setConnectionState("idle");
      }
    }, IDLE_TIMEOUT_MS);
  }, [connectionState]);

  const connectStream = useCallback(async () => {
    if (!agentRef.current || connectInFlightRef.current) return;
    if (connectionState === "connected") return;
    connectInFlightRef.current = true;
    setConnectionState("connecting");

    try {
      await agentRef.current.connect();
      setConnectionState("connected");
      resetIdleTimer();
    } catch (err) {
      console.error("[DID SDK] connect error:", err);
      setConnectionState("error");
    } finally {
      connectInFlightRef.current = false;
    }
  }, [connectionState, resetIdleTimer]);

  const initAgent = useCallback(async () => {
    if (agentRef.current || connectInFlightRef.current || !DID_CLIENT_KEY || !DID_AGENT_ID) return;
    connectInFlightRef.current = true;

    try {
      const did = await loadDidSdk();
      const auth = { type: "key" as const, clientKey: DID_CLIENT_KEY };

      const callbacks = {
        onSrcObjectReady(value: MediaStream) {
          srcObjectRef.current = value;
          setAvatarReady(true);
          didStreamCtx.setStream(value);
          didStreamCtx.setAvatarReady(true);
          syncVideoPlayback();
        },
        onConnectionStateChange(state: string) {
          if (state === "connected") setConnectionState("connected");
          else if (state === "disconnected" || state === "closed") setConnectionState("idle");
          else if (state === "failed") setConnectionState("error");
        },
        onVideoStateChange(state: string) {
          if (state === "STOP") {
            setSpeaking(false);
            const videoEl = getVisibleVideoElement();
            if (videoEl && agentRef.current?.agent?.presenter?.idle_video) {
              videoEl.srcObject = null;
              videoEl.src = agentRef.current.agent.presenter.idle_video;
              void videoEl.play().catch(() => {});
            }
          } else {
            setSpeaking(state === "speaking");
            syncVideoPlayback();
          }
        },
      };

      const streamOptions = {
        compatibilityMode: "auto" as const,
        streamWarmup: true,
      };

      const agent = await did.createAgentManager(DID_AGENT_ID, {
        auth,
        callbacks,
        streamOptions,
      });
      agentRef.current = agent;
      syncVideoPlayback();
      setConnectionState("idle");
    } catch (err) {
      console.error("[DID SDK] init error:", err);
      setConnectionState("error");
    } finally {
      connectInFlightRef.current = false;
    }
  }, [getVisibleVideoElement, loadDidSdk, syncVideoPlayback]);

  const disconnectAgent = useCallback(async () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    try {
      await agentRef.current?.disconnect();
    } catch { /* ignore */ }
    agentRef.current = null;
    srcObjectRef.current = null;
    connectInFlightRef.current = false;
    setConnectionState("idle");
  }, []);

  useEffect(() => {
    if (!DID_BRIDGE_ENABLED || !DID_CLIENT_KEY || !DID_AGENT_ID) return;

    const warmup = () => {
      void (async () => {
        await initAgent();
        if (!autoConnectRequestedRef.current && agentRef.current) {
          autoConnectRequestedRef.current = true;
          void connectStream();
        }
      })();
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
  }, [connectStream, initAgent]);

  useEffect(() => {
    return () => { void disconnectAgent(); };
  }, [disconnectAgent]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncVideoPlayback();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [open, connectionState, speaking, syncVideoPlayback]);

  useEffect(() => {
    if (connectionState === "connected") {
      setShowManualConnect(false);
      return;
    }
    if (connectionState === "error") {
      setShowManualConnect(true);
      return;
    }
    if (avatarReady) return;
    setShowManualConnect(false);
    const timer = window.setTimeout(() => {
      setShowManualConnect(true);
    }, AIDA_CONNECT_CTA_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [avatarReady, connectionState]);

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
      const recentMsgs = messagesRef.current
        .filter((m) => !m.isError)
        .map(({ role, content }) => ({ role, content }));
      const rawReply = await sendChatMessage(sessionIdRef.current, cleanText, recentMsgs);
      const { text: visibleText, suggestions, emailRequest } = parseOpenClawResponse(rawReply);
      const displayText = visibleText || rawReply;
      const filled =
        suggestions && Object.keys(suggestions).length > 0
          ? applySuggestions(suggestions)
          : [];

      if (suggestions && Object.keys(suggestions).length > 0) {
        // Parsed suggestion block was applied to matching form fields.
      }

      const resolvedEmailRequest = emailRequest
        ? {
            ...emailRequest,
            to: emailRequest.to || collectFormContext().email || "",
          }
        : undefined;

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: displayText,
          appliedFields: filled.length > 0 ? filled : undefined,
          emailRequest: resolvedEmailRequest,
        },
      ]);

      if (displayText.trim()) {
        if (agentRef.current && connectionState === "connected") {
          resetIdleTimer();
          void agentRef.current
            .speak({ type: "text", input: displayText })
            .catch(() => {
              pendingSpeakRef.current = displayText;
            });
        } else {
          pendingSpeakRef.current = displayText;
          void connectStream();
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
  }, [thinking, connectionState, connectStream]);

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

  const handleSendEmail = useCallback(async (msgId: string, emailReq: EmailRequestBlock) => {
    const toAddress = emailOverrideTo.trim() || emailReq.to;
    if (!toAddress || !toAddress.includes("@")) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: (m.content || "") + "\n\nAnge en giltig e-postadress.", emailRequest: emailReq }
            : m
        )
      );
      return;
    }

    setSendingEmail(true);
    try {
      const formCtx = collectFormContext();
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toAddress,
          subject: emailReq.subject,
          fields: formCtx,
          sessionId: sessionIdRef.current,
          checklistItems: [],
          includeFields: emailReq.includeFields,
          includeChecklist: emailReq.includeChecklist,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                emailRequest: undefined,
                content: res.ok
                  ? `${m.content || ""}\n\nMejl skickat till ${toAddress}.`
                  : `${m.content || ""}\n\nKunde inte skicka: ${data.error || "okänt fel"}.`,
              }
            : m
        )
      );
      setEmailOverrideTo("");
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: (m.content || "") + "\n\nNätverksfel vid e-postutskick." }
            : m
        )
      );
    } finally {
      setSendingEmail(false);
    }
  }, [emailOverrideTo]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    window.requestAnimationFrame(() => {
      syncVideoPlayback();
    });
    void connectStream();
  }, [connectStream, syncVideoPlayback]);

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
        const formContext = collectFormContext();
        await fetch("/api/did/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "field_blur",
            sessionId: sessionIdRef.current,
            fieldName,
            fieldValue,
            source: "did-field-blur",
            formContext,
            mifContext: readMiniMifContext(),
          }),
        });
      } catch { /* silent */ }
    },
    [],
  );

  useEffect(() => {
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
          mifContext: readMiniMifContext(),
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

  const badgeStatusText =
    connectionState === "connected"
      ? "Aida är redo att guida dig"
      : connectionState === "connecting"
        ? "Aida vaknar och kopplar upp sig"
        : connectionState === "error"
          ? "Aida behöver ett nytt försök"
          : "Aida laddar sin guideprofil";

  const badgeBodyText =
    miniMifContext?.personLookup?.found
      ? "Personnummer uppslaget. Aida fokuserar nu på det som fortfarande saknas för SKV."
      : avatarReady
        ? "D-ID-strömmen är klar. Tryck för att öppna Aida live."
        : "OpenClaw förbereder hjärnan medan avataren gör sig redo.";

  const badgeFooterText =
    connectionState === "connected"
      ? "Startklar för flyttguidning"
      : connectionState === "error"
        ? "Behöver en ny anslutning"
        : connectionState === "connecting"
          ? "Kopplar upp live-avatar"
          : "Laddar agent och avatar";

  const quickPrompts = miniMifContext?.missingCritical.length
    ? [
        "Vad saknas fortfarande för SKV?",
        "Hjälp mig fylla nästa blockerande fält",
        "Förklara vad vi behöver efter personnumret",
      ]
    : QUICK_PROMPTS;

  const miniMifStatusText = miniMifContext
    ? miniMifContext.personLookup?.found
      ? `Mini-MIF: namn hämtat${miniMifContext.fields.fromStreet ? " och nuvarande adress sparad" : ""}.`
      : miniMifContext.mode === "free_text"
        ? "Mini-MIF: fri text tolkad och sparad."
        : "Mini-MIF: personnummer sparat, men mer data behövs fortfarande."
    : null;

  if (!open) {
    return (
      <motion.div
        className="hidden"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: 0, y: 0, rotate: 0, scale: 1 }}
      >
        <div className="relative pt-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center">
            <div className="flex items-end gap-7">
              <span className="aida-lanyard-string h-9 w-px rotate-[7deg]" />
              <span className="aida-lanyard-string h-9 w-px -rotate-[7deg]" />
            </div>
            <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-card/95 shadow-md shadow-primary/10 backdrop-blur">
              <span className="h-2.5 w-2.5 rounded-full border border-primary/40" />
            </div>
          </div>

          <button
            onClick={handleOpen}
            tabIndex={-1}
            className="group relative block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Öppna Aida guide"
          >
            <div className="aida-flip-scene aspect-3/4">
              <motion.div
                className="aida-flip-card h-full w-full"
                animate={prefersReducedMotion ? undefined : { rotateY: avatarReady ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 92, damping: 18, mass: 0.95 }}
              >
                <div className="aida-flip-face overflow-hidden rounded-4xl border border-border/60 bg-[radial-gradient(circle_at_top,rgba(126,232,162,0.18),transparent_46%),linear-gradient(160deg,rgba(16,21,34,0.92),rgba(33,45,64,0.96))] shadow-[0_28px_60px_-24px_rgba(18,26,39,0.72)]">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_18%,transparent_78%,rgba(8,12,20,0.42))]" />
                  <div className="relative flex h-full flex-col px-4 pb-4 pt-4 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80">
                          Aida guide
                        </span>
                        <p className="mt-3 max-w-44 text-lg font-semibold leading-tight">
                          Din hängande guide väntar på att kliva fram.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-black/15 px-2 py-1 text-[10px] font-medium text-white/75 backdrop-blur">
                        <span className={cn("h-2 w-2 rounded-full", stateDotClass)} />
                        {stateLabel}
                      </span>
                    </div>

                    <AidaPortrait
                      className="relative mt-4 flex-1 rounded-[1.6rem] border border-white/10 bg-black/20 shadow-inner shadow-black/20"
                      imageClassName="object-cover object-top"
                    />

                    <div className="relative mt-4 rounded-[1.4rem] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-md">
                      <p className="text-sm font-medium text-white/95">{badgeStatusText}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/72">
                        {badgeBodyText}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="aida-flip-face aida-flip-face-back overflow-hidden rounded-4xl border border-border/60 bg-[#060814] shadow-[0_28px_60px_-24px_rgba(18,26,39,0.72)]">
                  <video
                    ref={badgeVideoRef}
                    autoPlay
                    playsInline
                    poster={AIDA_PLACEHOLDER_SRC}
                    muted={connectionState !== "connected"}
                    onLoadedMetadata={(e) => {
                      if (connectionState === "connected" || srcObjectRef.current) {
                        setAvatarReady(true);
                      }
                      void (e.currentTarget as HTMLVideoElement).play().catch(() => {});
                    }}
                    className="h-full w-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_28%,transparent_60%,rgba(1,4,10,0.72))]" />
                  <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
                    <span className="inline-flex rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur">
                      Live med D-ID
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-black/30 px-2 py-1 text-[10px] font-medium text-white/75 backdrop-blur">
                      <span className={cn("h-2 w-2 rounded-full", stateDotClass)} />
                      {stateLabel}
                    </span>
                  </div>
                  <div className="absolute inset-x-4 bottom-4 rounded-[1.4rem] border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md">
                    <p className="text-sm font-medium text-white">Aida är här.</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/72">
                      Tryck för att öppna hennes fulla guidepanel med röst, autofyllnad och chatt.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </button>

          <div className="mt-3 flex items-center justify-between gap-2 rounded-full border border-border/60 bg-card/92 px-3 py-2 shadow-lg shadow-primary/8 backdrop-blur-xl">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-foreground">Aida badge</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {badgeFooterText}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", stateDotClass)} />
              {stateLabel}
            </span>
          </div>

          {showManualConnect && !avatarReady && (
            <button
              type="button"
              onClick={() => void connectStream()}
              className="mt-2 inline-flex items-center rounded-full border border-border/60 bg-background/85 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/35 hover:text-primary"
            >
              Klicka för att ansluta Aida nu
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 flex w-[calc(100vw-1.5rem)] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-300 sm:bottom-5 sm:right-5 max-h-[min(90vh,720px)]">
      <div className="flex items-center justify-between border-b border-border/50 bg-linear-to-r from-primary/15 via-primary/5 to-transparent px-4 py-3">
        <div className="flex items-center gap-2.5">
          <AidaPortrait
            alt=""
            className="h-9 w-9 rounded-2xl border border-primary/15 bg-primary/10"
            imageClassName="object-cover object-top"
          />
          <div>
            <p className="text-sm font-semibold leading-none text-foreground">Aida</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Visuell guide med OpenClaw som hjärna</p>
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

      <div className="relative h-[220px] shrink-0 bg-black sm:h-[260px]">
        <video
          ref={panelVideoRef}
          autoPlay
          playsInline
          poster={AIDA_PLACEHOLDER_SRC}
          muted={connectionState !== "connected"}
          onLoadedMetadata={(e) => {
            if (connectionState === "connected" || srcObjectRef.current) {
              setAvatarReady(true);
            }
            void (e.currentTarget as HTMLVideoElement).play().catch(() => {});
          }}
          className="h-full w-full object-contain object-top"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/40 to-transparent" />
        {connectionState !== "connected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-linear-to-b from-gray-800/90 to-gray-900/95 text-center text-white/90">
            <AidaPortrait
              alt=""
              className="h-16 w-16 rounded-2xl border border-white/10 bg-white/10 backdrop-blur"
              imageClassName="object-cover object-top"
            />
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", stateDotClass)} />
              <span className="text-xs font-medium">
                {connectionState === "connecting"
                  ? "Kopplar upp guiden..."
                  : connectionState === "error"
                    ? "Kunde inte ansluta till Aida guide"
                    : "Förbereder Aida guide..."}
              </span>
            </div>
          </div>
        )}
      </div>

          <div className="border-b border-border/40 bg-muted/20 px-4 py-2">
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt) => (
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

      {miniMifStatusText && (
        <div className="border-b border-border/40 bg-emerald-500/5 px-4 py-2 text-[11px] text-muted-foreground">
          {miniMifStatusText}
        </div>
      )}

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
              {message.emailRequest && (
                <div className="mt-3 space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
                  <p className="text-[11px] font-medium text-primary">Skicka sammanfattning via mejl</p>
                  <p className="text-[11px] text-muted-foreground">{message.emailRequest.subject}</p>
                  <input
                    type="email"
                    placeholder="din@email.se"
                    defaultValue={message.emailRequest.to}
                    onChange={(e) => setEmailOverrideTo(e.target.value)}
                    className="h-8 w-full rounded-lg border border-border/60 bg-background px-2.5 text-[12px] outline-none focus:border-primary/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={sendingEmail}
                      onClick={() => void handleSendEmail(message.id, message.emailRequest!)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-sm disabled:opacity-50"
                    >
                      {sendingEmail ? "Skickar..." : "Bekräfta och skicka"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === message.id ? { ...m, emailRequest: undefined } : m
                          )
                        )
                      }
                      className="rounded-lg border border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Avbryt
                    </button>
                  </div>
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
            placeholder="Skriv till Aida guide eller använd mikrofonen..."
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
          Tips: ta fram Aida när du vill bli lotsad steg för steg eller har fastnat.
        </p>
      </div>
    </div>
  );
}
