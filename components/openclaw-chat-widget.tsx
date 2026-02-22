"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Minus,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseOpenClawResponse } from "@/lib/openclaw/response";

// ─── Types ─────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestions?: Record<string, string> | null;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "Förnamn",
  lastName: "Efternamn",
  personalNumber: "Personnummer",
  fromStreet: "Nuvarande gata",
  fromPostal: "Nuvarande postnummer",
  fromCity: "Nuvarande ort",
  toStreet: "Ny gata",
  toPostal: "Nytt postnummer",
  toCity: "Ny ort",
  apartmentNumber: "Lägenhetsnummer",
  propertyDesignation: "Fastighetsbeteckning",
  propertyOwner: "Fastighetsägare",
  email: "E-post",
  phone: "Telefon",
  moveDate: "Flyttdatum",
};

interface OpenClawChatWidgetProps {
  formType: string;
  formData?: Record<string, string | boolean | number>;
  currentStep?: number;
  /** Called when the user accepts a field suggestion from the agent */
  onSuggestion?: (field: string, value: string) => void;
}

// ─── Session ID helper ─────────────────────────────────

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "openclaw_session_id";
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// ─── Component ─────────────────────────────────────────

export function OpenClawChatWidget({
  formType,
  formData,
  currentStep,
  onSuggestion,
}: OpenClawChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hej! Jag är Aida, din personliga flyttassistent. Jag följer med i formuläret du fyller i och kan hjälpa dig med frågor om flytt, adressändring eller vad du än undrar över.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>("");

  // Initialise shared session ID
  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, minimized]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/openclaw/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          formContext: {
            formType,
            fields: formData ?? {},
            currentStep: currentStep ?? null,
          },
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const errMsg = errBody?.content || errBody?.error || `Status ${res.status}`;
        throw new Error(errMsg);
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "" },
        ]);

        if (reader) {
          let done = false;
          while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    assistantContent += parsed.content;
                    setMessages((prev) => {
                      const next = [...prev];
                      next[next.length - 1] = {
                        role: "assistant",
                        content: assistantContent,
                      };
                      return next;
                    });
                  }
                } catch {
                  // skip invalid JSON
                }
              }
            }
          }
        }

        if (assistantContent) {
          const { text, suggestions } = parseOpenClawResponse(assistantContent);
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: text || assistantContent,
              suggestions,
            };
            return next;
          });
        }
      } else {
        const data = await res.json();
        const raw = data.content || data.reply || "Inget svar från agenten.";
        const { text, suggestions } = parseOpenClawResponse(raw);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: text || raw,
            suggestions,
          },
        ]);
      }

      if (minimized) setHasUnread(true);
    } catch (err) {
      const errorDetail = err instanceof Error ? err.message : "Okant fel";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Anslutningen till Aida misslyckades: ${errorDetail}. Försök igen om en stund.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    setMinimized(false);
    setHasUnread(false);
  }

  function handleClose() {
    setOpen(false);
    setMinimized(false);
  }

  function handleMinimize() {
    setMinimized(true);
  }

  function handleRestore() {
    setMinimized(false);
    setHasUnread(false);
  }

  return (
    <>
      {/* ── Floating trigger button ─────────────────────── */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-5 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/30 active:scale-95"
          aria-label="Öppna Aida-assistent"
        >
          <MessageCircle className="h-6 w-6" />
          {hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              !
            </span>
          )}
        </button>
      )}

      {/* ── Minimized bar ─────────────���─────────────────── */}
      {open && minimized && (
        <button
          onClick={handleRestore}
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 rounded-full border border-border/60 bg-card px-4 py-2.5 shadow-lg transition-all duration-300 hover:shadow-xl"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            Aida
          </span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {hasUnread && (
            <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="ml-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Stäng chatt"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </button>
      )}

      {/* ── Chat panel ──────────────────────────────────── */}
      {open && !minimized && (
        <div
          className={cn(
            "fixed bottom-5 left-5 z-50 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl",
            "animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-300",
            "max-h-[min(580px,calc(100vh-3rem))]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-linear-to-r from-primary/5 to-primary/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none text-foreground">
                  Aida
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Din personliga flyttassistent
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleMinimize}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Minimera chatt"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Stäng chatt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Context indicator bar */}
          <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-muted-foreground">
              Formulärkontext: <span className="font-medium text-foreground">{formType}</span>
              {currentStep != null && (
                <> &middot; Steg {currentStep}</>
              )}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2.5",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted/80 text-foreground"
                  )}
                >
                  {msg.content || (
                    <div className="flex items-center gap-1.5 py-0.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40 [animation-delay:300ms]" />
                    </div>
                  )}
                  {msg.suggestions && onSuggestion && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/30 pt-2">
                      {Object.entries(msg.suggestions).map(([field, value]) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => {
                            onSuggestion(field, value);
                            setMessages((prev) =>
                              prev.map((m, idx) =>
                                idx === i
                                  ? {
                                      ...m,
                                      suggestions: Object.fromEntries(
                                        Object.entries(m.suggestions ?? {}).filter(
                                          ([k]) => k !== field,
                                        ),
                                      ),
                                    }
                                  : m,
                              ),
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15 active:scale-95"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {FIELD_LABELS[field] ?? field}: {value}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t bg-card/80 px-3 py-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Fråga Aida..."
                className="h-10 flex-1 rounded-xl border border-border/60 bg-muted/40 px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 transition-colors focus:border-primary/40 focus:bg-background disabled:opacity-50"
                disabled={loading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-xl p-0 shadow-sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
