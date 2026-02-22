"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Minimize2, X } from "lucide-react";

const DID_SHARE_URL = process.env.NEXT_PUBLIC_DID_AGENT_SHARE_URL ?? "";
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
    const optionText = target.selectedOptions?.[0]?.text?.trim();
    return optionText || target.value.trim();
  }
  return target.value.trim();
}

function canTrackBlur(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (target instanceof HTMLInputElement) {
    const blockedTypes = new Set([
      "hidden", "password", "button", "submit", "reset",
      "file", "checkbox", "radio", "range", "color", "image",
    ]);
    if (blockedTypes.has(target.type)) return false;
  }
  return true;
}

function speakText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!text.trim()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "sv-SE";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function DidOpenClawBridgeWidget() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [testTalEnabled, setTestTalEnabled] = useState(false);
  const sessionIdRef = useRef("");
  const lastFieldValuesRef = useRef<Map<string, string>>(new Map());
  const lastFieldTimesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    sessionIdRef.current = getDidSessionId();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadHealthConfig() {
      try {
        const response = await fetch("/api/openclaw/health");
        const body = await response.json().catch(() => null);
        if (!cancelled) {
          setTestTalEnabled(Boolean(body?.config?.testTalEnabled));
        }
      } catch {
        if (!cancelled) setTestTalEnabled(false);
      }
    }
    loadHealthConfig();
    return () => { cancelled = true; };
  }, []);

  async function sendFieldBlurToBridge(fieldName: string, fieldValue: string) {
    try {
      const response = await fetch("/api/did/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "field_blur",
          sessionId: sessionIdRef.current,
          fieldName,
          fieldValue,
          source: "did-field-blur",
        }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.shouldSpeak && typeof body?.reply === "string") {
        speakText(body.reply);
      }
    } catch {
      // Silent fail for field blur events
    }
  }

  useEffect(() => {
    if (!testTalEnabled) return;

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
  }, [testTalEnabled]);

  if (!DID_BRIDGE_ENABLED || !DID_SHARE_URL) return null;

  return (
    <>
      {/* Floating mic button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20 active:scale-95"
          aria-label="Prata med Aida"
        >
          <Mic className="h-5 w-5" />
        </button>
      )}

      {/* Minimized pill */}
      {open && minimized && (
        <button
          onClick={() => setMinimized(false)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2.5 shadow-lg transition-all duration-300 hover:shadow-xl"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Mic className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">Aida Röst</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>
      )}

      {/* Expanded voice panel */}
      {open && !minimized && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(680px,calc(100vh-2.5rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-linear-to-r from-primary/5 to-primary/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
                <Mic className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Aida Röst</p>
                <p className="text-[11px] text-muted-foreground">
                  Prata med din flyttassistent
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized(true)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Minimera"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setOpen(false); setMinimized(false); }}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Stäng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* D-ID iframe */}
          <iframe
            src={DID_SHARE_URL}
            className="flex-1 w-full border-0"
            allow="camera;microphone;display-capture;autoplay;clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation allow-downloads"
            title="Aida röstassistent"
          />
        </div>
      )}
    </>
  );
}
