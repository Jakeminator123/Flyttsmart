"use client";

import { useEffect, useRef, useCallback } from "react";
import Script from "next/script";

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

export function DidOpenClawBridgeWidget() {
  const sessionIdRef = useRef("");
  const lastFieldValuesRef = useRef<Map<string, string>>(new Map());
  const lastFieldTimesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    sessionIdRef.current = getDidSessionId();
  }, []);

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
      } catch {
        // Silent fail
      }
    },
    [],
  );

  // Periodically sync full form context to the bridge session
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

  // Field blur tracking
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

  return (
    <Script
      src="https://agent.d-id.com/v2/index.js"
      type="module"
      data-name="did-agent"
      data-mode="fabio"
      data-client-key={DID_CLIENT_KEY}
      data-agent-id={DID_AGENT_ID}
      data-monitor="true"
      data-orientation="horizontal"
      data-position="right"
      strategy="lazyOnload"
    />
  );
}
