"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Minimize2, X, Send, Loader2 } from "lucide-react";

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
      "hidden",
      "password",
      "button",
      "submit",
      "reset",
      "file",
      "checkbox",
      "radio",
      "range",
      "color",
      "image",
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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [testTalEnabled, setTestTalEnabled] = useState(false);
  const [lastReply, setLastReply] = useState("");
  const [error, setError] = useState("");
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
    return () => {
      cancelled = true;
    };
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
          source: "did-field-blur-test",
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || `Status ${response.status}`);
      }

      if (body?.shouldSpeak && typeof body?.reply === "string") {
        setLastReply(body.reply);
        speakText(body.reply);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Okant fel";
      setError(`Blur-test fel: ${detail}`);
    }
  }

  async function sendBridgeProbe() {
    const message = input.trim();
    if (!message || loading) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/did/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          message,
          source: "did-widget-probe",
          formContext: { formType: "did-voice" },
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || `Status ${response.status}`);
      }

      const reply = body?.reply || body?.content || body?.text || "";
      setLastReply(reply || "Tomt svar fran bridge.");
      setInput("");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Okant fel";
      setError(`Bridge-fel: ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!testTalEnabled) return;

    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        )
      ) {
        return;
      }

      if (!canTrackBlur(target)) return;

      const fieldValue = pickBlurValue(target);
      if (!fieldValue) return;

      const fieldName =
        target.name || target.id || target.getAttribute("aria-label") || "field";
      const now = Date.now();
      const previousValue = lastFieldValuesRef.current.get(fieldName);
      const previousTime = lastFieldTimesRef.current.get(fieldName) ?? 0;

      // Skip duplicate blur events for the same field/value in quick succession.
      if (previousValue === fieldValue && now - previousTime < 1000) {
        return;
      }

      lastFieldValuesRef.current.set(fieldName, fieldValue);
      lastFieldTimesRef.current.set(fieldName, now);
      void sendFieldBlurToBridge(fieldName, fieldValue);
    };

    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [testTalEnabled]);

  if (!DID_BRIDGE_ENABLED || !DID_SHARE_URL) {
    return null;
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-xl transition-transform hover:scale-105 active:scale-95"
          aria-label="Oppna D-ID rostagent"
        >
          <Mic className="h-5 w-5" />
        </button>
      )}

      {open && minimized && (
        <button
          onClick={() => setMinimized(false)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-2 shadow-lg"
        >
          <Mic className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground">D-ID Voice</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            via OpenClaw
          </span>
        </button>
      )}

      {open && !minimized && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(760px,calc(100vh-2.5rem))] w-[min(450px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b bg-linear-to-r from-primary/5 to-primary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">D-ID Voice</p>
                <p className="text-[11px] text-muted-foreground">
                  Roster i D-ID, hjarnan i OpenClaw
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized(true)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Minimera panel"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setMinimized(false);
                }}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Stang panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <iframe
            src={DID_SHARE_URL}
            className="h-[60%] w-full border-0"
            allow="camera;microphone;display-capture;autoplay;clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation allow-downloads"
            title="D-ID Agent Voice Panel"
          />

          <div className="space-y-2 border-t p-3">
            <p className="text-xs text-muted-foreground">
              Snabbtest av D-ID → OpenClaw-bridge:
            </p>
            <p className="text-[11px] text-muted-foreground">
              TEST_TAL:{" "}
              <span className={testTalEnabled ? "text-emerald-600" : "text-muted-foreground"}>
                {testTalEnabled ? "aktiv (blur talar sista ordet)" : "avstangd"}
              </span>
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendBridgeProbe();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Testfraga till OpenClaw..."
                className="h-9 flex-1 rounded-lg border border-border/60 bg-muted/40 px-3 text-sm text-foreground outline-none focus:border-primary/40"
                disabled={loading}
              />
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                disabled={loading || !input.trim()}
                aria-label="Skicka testfraga"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                {error}
              </p>
            )}
            {lastReply && (
              <p className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-foreground">
                <span className="font-medium">OpenClaw svar:</span> {lastReply}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
