export type SuggestionSource = "postal" | "ai" | "openclaw";

export type AutofillMode = "auto" | "manual";

export interface AutofillConfig {
  enabled: boolean;
  devOnly: boolean;
  mode: AutofillMode;
  debug: boolean;
  sources: Record<SuggestionSource, boolean>;
}

const bool = (v: string | undefined, fallback: boolean): boolean => {
  if (!v) return fallback;
  return v.trim().toLowerCase() === "true" || v === "1";
};

export function getAutofillConfig(): AutofillConfig {
  const enabled = bool(process.env.NEXT_PUBLIC_AUTOFILL_ENABLED, true);
  const devOnly = bool(process.env.NEXT_PUBLIC_AUTOFILL_DEV_ONLY, true);
  const debug = bool(process.env.NEXT_PUBLIC_AUTOFILL_DEBUG, false);
  const mode: AutofillMode =
    process.env.NEXT_PUBLIC_AUTOFILL_MODE === "auto" ? "auto" : "manual";

  const sources: Record<SuggestionSource, boolean> = {
    postal: bool(process.env.NEXT_PUBLIC_AUTOFILL_SOURCE_POSTAL, true),
    ai: bool(process.env.NEXT_PUBLIC_AUTOFILL_SOURCE_AI, true),
    openclaw: bool(process.env.NEXT_PUBLIC_AUTOFILL_SOURCE_OPENCLAW, true),
  };

  return { enabled, devOnly, debug, mode, sources };
}

export function isAutofillActive(config: AutofillConfig): boolean {
  return config.enabled && (!config.devOnly || process.env.NODE_ENV === "development");
}

export const SUGGESTION_PRIORITY: Record<SuggestionSource, number> = {
  postal: 3,
  ai: 2,
  openclaw: 1,
};

export const SUGGESTION_SOURCE_LABEL: Record<SuggestionSource, string> = {
  postal: "Postnummer-uppslag",
  ai: "AI-förslag",
  openclaw: "Aida-förslag",
};
