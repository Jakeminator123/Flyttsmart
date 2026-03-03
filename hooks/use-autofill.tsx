"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  getAutofillConfig,
  isAutofillActive,
  SUGGESTION_PRIORITY,
  SUGGESTION_SOURCE_LABEL,
  type SuggestionSource,
  type AutofillConfig,
} from "@/lib/autofill/config";
import type { OpenClawEvent } from "@/hooks/use-openclaw-mirror";

export interface FieldSuggestion {
  value: string;
  source: SuggestionSource;
}

interface UseAutofillOptions<F extends string> {
  form: Record<F, string | boolean>;
  currentStep: number;
  updateForm: (field: F, value: string | boolean) => void;
  mirrorEvent: (
    event: OpenClawEvent,
    fields: Record<string, string | boolean | number>,
    step?: number
  ) => void;
}

interface UseAutofillReturn<F extends string> {
  config: AutofillConfig;
  active: boolean;
  fieldSuggestions: Partial<Record<F, FieldSuggestion>>;
  autofillLoading: boolean;
  queueSuggestion: (field: F, value: string, source: SuggestionSource) => void;
  acceptSuggestion: (field: F) => void;
  dismissSuggestion: (field: F) => void;
  handleAutofill: () => Promise<void>;
  renderSuggestionBanner: (field: F) => React.ReactNode;
}

export function useAutofill<F extends string>({
  form,
  currentStep,
  updateForm,
  mirrorEvent,
}: UseAutofillOptions<F>): UseAutofillReturn<F> {
  const config = useMemo(() => getAutofillConfig(), []);
  const active = useMemo(() => isAutofillActive(config), [config]);

  const [fieldSuggestions, setFieldSuggestions] = useState<
    Partial<Record<F, FieldSuggestion>>
  >({});
  const [autofillLoading, setAutofillLoading] = useState(false);

  const fromPostalAbortRef = useRef<AbortController | null>(null);
  const toPostalAbortRef = useRef<AbortController | null>(null);
  const pnrLookupAbortRef = useRef<AbortController | null>(null);

  const log = useCallback(
    (action: string, detail: Record<string, unknown>) => {
      if (!config.debug) return;
      console.log(
        `%c[autofill] ${action}`,
        "color:#0ea5e9;font-weight:bold",
        detail
      );
    },
    [config.debug]
  );

  const queueSuggestion = useCallback(
    (field: F, rawValue: string, source: SuggestionSource) => {
      if (!active) return;
      if (!config.sources[source]) {
        log("blocked", { field, source, reason: "source disabled" });
        return;
      }
      const value = rawValue.trim();
      if (!value) return;

      log("queued", { field, value, source, mode: config.mode });

      if (config.mode === "auto") {
        mirrorEvent(
          "suggestion_shown",
          { field, value, source, mode: "auto" },
          currentStep
        );
        updateForm(field, value);
        log("auto-accepted", { field, value, source });
        mirrorEvent(
          "suggestion_accepted",
          { field, value, source, mode: "auto" },
          currentStep
        );
        return;
      }

      setFieldSuggestions((prev) => {
        const existing = prev[field];
        if (
          existing &&
          SUGGESTION_PRIORITY[existing.source] > SUGGESTION_PRIORITY[source]
        ) {
          log("skipped", {
            field,
            value,
            source,
            reason: `existing ${existing.source} has higher priority`,
          });
          return prev;
        }
        mirrorEvent(
          "suggestion_shown",
          { field, value, source, mode: "manual" },
          currentStep
        );
        return { ...prev, [field]: { value, source } };
      });
    },
    [active, config.mode, config.sources, currentStep, log, mirrorEvent, updateForm]
  );

  const acceptSuggestion = useCallback(
    (field: F) => {
      const suggestion = fieldSuggestions[field];
      if (!suggestion) return;
      log("accepted", { field, value: suggestion.value, source: suggestion.source });
      updateForm(field, suggestion.value);
      mirrorEvent(
        "suggestion_accepted",
        { field, value: suggestion.value, source: suggestion.source },
        currentStep
      );
      setFieldSuggestions((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [currentStep, fieldSuggestions, mirrorEvent, updateForm]
  );

  const dismissSuggestion = useCallback((field: F) => {
    log("dismissed", { field });
    setFieldSuggestions((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, [log]);

  // Personnummer -> namn + adress (pnr_lookup)
  const personalNumber = String(form["personalNumber" as F] ?? "").replace(/\s|-/g, "");
  const pnrValid = personalNumber.length === 12 && /^\d{12}$/.test(personalNumber);

  // Postal code -> city auto-lookup (only when city is empty)
  const fromPostal = String(form["fromPostal" as F] ?? "").replace(/\s+/g, "");
  const fromCity = String(form["fromCity" as F] ?? "");
  const toPostal = String(form["toPostal" as F] ?? "").replace(/\s+/g, "");
  const toCity = String(form["toCity" as F] ?? "");

  useEffect(() => {
    if (!active || !config.sources.pnr_lookup || !pnrValid) return;
    const pnr = `${personalNumber.slice(0, 8)}-${personalNumber.slice(8)}`;

    pnrLookupAbortRef.current?.abort();
    const controller = new AbortController();
    pnrLookupAbortRef.current = controller;

    fetch("/api/enrich/person", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalNumber: pnr }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.found) return;
        if (data.firstName) queueSuggestion("firstName" as F, data.firstName, "pnr_lookup");
        if (data.lastName) queueSuggestion("lastName" as F, data.lastName, "pnr_lookup");
        if (data.fromStreet) queueSuggestion("fromStreet" as F, data.fromStreet, "pnr_lookup");
        if (data.fromCity) queueSuggestion("fromCity" as F, data.fromCity, "pnr_lookup");
        if (data.fromPostal) queueSuggestion("fromPostal" as F, data.fromPostal, "pnr_lookup");
      })
      .catch(() => {});

    return () => controller.abort();
  }, [active, config.sources.pnr_lookup, pnrValid, personalNumber, queueSuggestion]);

  useEffect(() => {
    if (!active || !config.sources.postal) return;
    if (fromPostal.length !== 5 || !/^\d{5}$/.test(fromPostal)) return;
    if (fromCity) return;

    fromPostalAbortRef.current?.abort();
    const controller = new AbortController();
    fromPostalAbortRef.current = controller;

    fetch(`/api/enrich/postal?postalCode=${fromPostal}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.city) queueSuggestion("fromCity" as F, data.city, "postal");
      })
      .catch(() => {});

    return () => controller.abort();
  }, [active, config.sources.postal, fromPostal, fromCity, queueSuggestion]);

  useEffect(() => {
    if (!active || !config.sources.postal) return;
    if (toPostal.length !== 5 || !/^\d{5}$/.test(toPostal)) return;
    if (toCity) return;

    toPostalAbortRef.current?.abort();
    const controller = new AbortController();
    toPostalAbortRef.current = controller;

    fetch(`/api/enrich/postal?postalCode=${toPostal}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.city) queueSuggestion("toCity" as F, data.city, "postal");
      })
      .catch(() => {});

    return () => controller.abort();
  }, [active, config.sources.postal, toPostal, toCity, queueSuggestion]);

  // AI autofill (manual trigger)
  const handleAutofill = useCallback(async () => {
    if (!active || !config.sources.ai) return;
    setAutofillLoading(true);
    try {
      const res = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.suggestions) {
        for (const [key, value] of Object.entries(data.suggestions)) {
          if (typeof value !== "string" || !value.trim()) continue;
          queueSuggestion(key as F, value, "ai");
        }
      }
    } catch {
      // Autofill failed silently
    } finally {
      setAutofillLoading(false);
    }
  }, [active, config.sources.ai, form, queueSuggestion]);

  const renderSuggestionBanner = useCallback(
    (field: F): React.ReactNode => {
      const suggestion = fieldSuggestions[field];
      if (!suggestion || !active) return null;

      return (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-medium">
                Förslag ({SUGGESTION_SOURCE_LABEL[suggestion.source]}):{" "}
              </span>
              <span>{suggestion.value}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => acceptSuggestion(field)}
                className="rounded border border-red-400 bg-white px-2 py-0.5 font-medium text-red-700 hover:bg-red-100"
              >
                Acceptera
              </button>
              <button
                type="button"
                onClick={() => dismissSuggestion(field)}
                className="rounded border border-red-300 bg-white px-2 py-0.5 text-red-600 hover:bg-red-100"
              >
                Avvisa
              </button>
            </div>
          </div>
        </div>
      );
    },
    [acceptSuggestion, active, dismissSuggestion, fieldSuggestions]
  );

  return {
    config,
    active,
    fieldSuggestions,
    autofillLoading,
    queueSuggestion,
    acceptSuggestion,
    dismissSuggestion,
    handleAutofill,
    renderSuggestionBanner,
  };
}
