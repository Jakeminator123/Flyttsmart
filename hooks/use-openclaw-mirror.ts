"use client";

import { useCallback, useRef, useEffect } from "react";

// ─── Types ─────────────────────────────────────────────

export type OpenClawEvent =
  | "field_change"
  | "step_change"
  | "submit"
  | "qr_scan"
  | "checklist_generated"
  | "tab_change";

export interface OpenClawPayload {
  sessionId: string;
  event: OpenClawEvent;
  formType: string;
  fields: Record<string, string | boolean | number>;
  currentStep?: number;
  meta: {
    url: string;
    timestamp: string;
    userAgent: string;
  };
}

interface UseOpenClawMirrorOptions {
  /** Identifier for the form page, e.g. "adressandring", "demo" */
  formType: string;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
}

// ─── HMAC helper (Web Crypto API) ──────────────────────

async function signPayload(body: string, secret: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle === "undefined") return "";
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
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

// ─── Webhook secret (injected at build time) ───────────
// Only NEXT_PUBLIC_ prefixed vars are available client-side.
// If not set, HMAC signing is skipped and the server-side
// verification also skips (testing mode).
const WEBHOOK_SECRET =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_OPENCLAW_WEBHOOK_SECRET ?? "")
    : "";

// ─── Hook ──────────────────────────────────────────────

export function useOpenClawMirror({
  formType,
  debounceMs = 300,
}: UseOpenClawMirrorOptions) {
  const sessionId = useRef<string>("");
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Initialise session ID on mount
  useEffect(() => {
    sessionId.current = getSessionId();
  }, []);

  /**
   * Fire-and-forget POST to our webhook proxy.
   */
  const sendPayload = useCallback(
    async (payload: OpenClawPayload) => {
      try {
        const body = JSON.stringify(payload);
        const signature = WEBHOOK_SECRET
          ? await signPayload(body, WEBHOOK_SECRET)
          : "";

        // Use sendBeacon for unload scenarios, fetch otherwise
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          // sendBeacon doesn't support custom headers, so fall through to fetch
        }

        await fetch("/api/openclaw/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-openclaw-signature": signature,
          },
          body,
          // Don't block the page
          keepalive: true,
        });
      } catch {
        // Swallow errors — webhook failures must never break the user experience
      }
    },
    []
  );

  /**
   * Build a standard payload with meta information.
   */
  const buildPayload = useCallback(
    (
      event: OpenClawEvent,
      fields: Record<string, string | boolean | number>,
      currentStep?: number
    ): OpenClawPayload => ({
      sessionId: sessionId.current,
      event,
      formType,
      fields,
      currentStep,
      meta: {
        url: typeof window !== "undefined" ? window.location.href : "",
        timestamp: new Date().toISOString(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
    }),
    [formType]
  );

  /**
   * Mirror a single field change with debouncing (per field key).
   */
  const mirrorField = useCallback(
    (
      fieldName: string,
      fieldValue: string | boolean | number,
      allFields?: Record<string, string | boolean | number>
    ) => {
      // Clear any existing timer for this field
      const existing = debounceTimers.current.get(fieldName);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        const fields = allFields
          ? { ...allFields, [fieldName]: fieldValue }
          : { [fieldName]: fieldValue };

        sendPayload(
          buildPayload("field_change", fields)
        );
        debounceTimers.current.delete(fieldName);
      }, debounceMs);

      debounceTimers.current.set(fieldName, timer);
    },
    [debounceMs, sendPayload, buildPayload]
  );

  /**
   * Mirror a step navigation event (sends all current fields).
   */
  const mirrorStepChange = useCallback(
    (step: number, allFields: Record<string, string | boolean | number>) => {
      sendPayload(buildPayload("step_change", allFields, step));
    },
    [sendPayload, buildPayload]
  );

  /**
   * Mirror a form submission (sends all fields).
   */
  const mirrorSubmit = useCallback(
    (allFields: Record<string, string | boolean | number>) => {
      sendPayload(buildPayload("submit", allFields));
    },
    [sendPayload, buildPayload]
  );

  /**
   * Mirror a custom event (QR scan, checklist generated, tab change, etc.).
   */
  const mirrorEvent = useCallback(
    (
      event: OpenClawEvent,
      fields: Record<string, string | boolean | number>,
      currentStep?: number
    ) => {
      sendPayload(buildPayload(event, fields, currentStep));
    },
    [sendPayload, buildPayload]
  );

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return {
    sessionId: sessionId.current,
    mirrorField,
    mirrorStepChange,
    mirrorSubmit,
    mirrorEvent,
    /** Expose the raw session ID getter for the chat widget */
    getSessionId,
  };
}
