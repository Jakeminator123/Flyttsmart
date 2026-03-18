import { sql } from "drizzle-orm";
import { getDb, runSql } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";

export type UsageProvider =
  | "openai"
  | "brave"
  | "pap"
  | "eniro"
  | "nominatim"
  | "scb"
  | "ratsit"
  | "openclaw_gateway"
  | "elpris"
  | "other";

export type UsageFlow =
  | "web_search"
  | "web_search_fallback"
  | "enrichment"
  | "comparison"
  | "gateway_simple"
  | "gateway_general"
  | "gateway_comparison"
  | "keepalive"
  | "other";

export interface UsageEventInput {
  provider: UsageProvider;
  flow: UsageFlow;
  route: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: string;
  durationMs?: number;
  ok?: boolean;
  sessionId?: string;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

type OpenAiRates = { inputPerM: number; outputPerM: number };

const OPENAI_MODEL_RATES: Array<{ match: RegExp; rates: OpenAiRates }> = [
  { match: /gpt-4\.1-mini/i, rates: { inputPerM: 0.4, outputPerM: 1.6 } },
  { match: /gpt-5\.1-codex/i, rates: { inputPerM: 3, outputPerM: 15 } },
  { match: /gpt-5\.3-codex/i, rates: { inputPerM: 3, outputPerM: 15 } },
];

let ensureUsageTablePromise: Promise<void> | null = null;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toSafeInt(value: unknown): number | undefined {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined) return undefined;
  return Math.max(0, Math.round(parsed));
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function getOpenAiRates(model?: string): OpenAiRates | null {
  const m = (model ?? "").trim();
  if (!m) return null;
  const found = OPENAI_MODEL_RATES.find((item) => item.match.test(m));
  return found?.rates ?? null;
}

function getBravePerQueryCostUsd(): number {
  const fromEnv = toFiniteNumber(process.env.BRAVE_COST_PER_QUERY_USD);
  if (fromEnv !== undefined && fromEnv >= 0) return fromEnv;
  return 0;
}

export function extractTokenUsage(rawUsage: unknown): TokenUsage {
  if (!rawUsage || typeof rawUsage !== "object") return {};
  const usage = rawUsage as Record<string, unknown>;

  const inputTokens =
    toSafeInt(usage.input_tokens) ??
    toSafeInt(usage.prompt_tokens) ??
    toSafeInt(usage.promptTokens);
  const outputTokens =
    toSafeInt(usage.output_tokens) ??
    toSafeInt(usage.completion_tokens) ??
    toSafeInt(usage.completionTokens);
  const totalTokens =
    toSafeInt(usage.total_tokens) ??
    toSafeInt(usage.totalTokens) ??
    (inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function estimateCostUsd(input: UsageEventInput): string {
  if (input.estimatedCostUsd && input.estimatedCostUsd.trim()) {
    return input.estimatedCostUsd.trim();
  }

  if (input.provider === "brave") {
    return formatUsd(getBravePerQueryCostUsd());
  }

  if (input.provider !== "openai") return "0";

  const rates = getOpenAiRates(input.model);
  if (!rates) return "0";

  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  if (inputTokens <= 0 && outputTokens <= 0) return "0";

  const cost =
    (inputTokens / 1_000_000) * rates.inputPerM +
    (outputTokens / 1_000_000) * rates.outputPerM;
  return formatUsd(cost);
}

async function ensureUsageTableExists() {
  if (!ensureUsageTablePromise) {
    ensureUsageTablePromise = (async () => {
      await runSql(sql.raw(`
        CREATE TABLE IF NOT EXISTS usage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL,
          flow TEXT NOT NULL,
          route TEXT NOT NULL,
          model TEXT,
          input_tokens INTEGER,
          output_tokens INTEGER,
          total_tokens INTEGER,
          estimated_cost_usd TEXT,
          duration_ms INTEGER,
          ok INTEGER NOT NULL DEFAULT 1,
          session_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `));
      await runSql(
        sql.raw(
          "CREATE INDEX IF NOT EXISTS usage_events_provider_created_at_idx ON usage_events(provider, created_at)",
        ),
      );
      await runSql(
        sql.raw(
          "CREATE INDEX IF NOT EXISTS usage_events_flow_created_at_idx ON usage_events(flow, created_at)",
        ),
      );
      await runSql(
        sql.raw(
          "CREATE INDEX IF NOT EXISTS usage_events_route_created_at_idx ON usage_events(route, created_at)",
        ),
      );
    })().catch((error) => {
      ensureUsageTablePromise = null;
      throw error;
    });
  }
  return ensureUsageTablePromise;
}

async function persistUsage(input: UsageEventInput) {
  await ensureUsageTableExists();
  const db = getDb();

  const normalizedInputTokens = toSafeInt(input.inputTokens);
  const normalizedOutputTokens = toSafeInt(input.outputTokens);
  const normalizedTotalTokens =
    toSafeInt(input.totalTokens) ??
    (normalizedInputTokens !== undefined || normalizedOutputTokens !== undefined
      ? (normalizedInputTokens ?? 0) + (normalizedOutputTokens ?? 0)
      : undefined);

  const payload: typeof usageEvents.$inferInsert = {
    provider: input.provider,
    flow: input.flow,
    route: input.route,
    model: input.model?.trim() || null,
    inputTokens: normalizedInputTokens,
    outputTokens: normalizedOutputTokens,
    totalTokens: normalizedTotalTokens,
    estimatedCostUsd: estimateCostUsd({
      ...input,
      inputTokens: normalizedInputTokens,
      outputTokens: normalizedOutputTokens,
      totalTokens: normalizedTotalTokens,
    }),
    durationMs: toSafeInt(input.durationMs),
    ok: input.ok ?? true,
    sessionId: input.sessionId?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  await db.insert(usageEvents).values(payload);
}

export function trackUsage(input: UsageEventInput): void {
  void persistUsage(input).catch((error) => {
    console.warn("[usage] failed to record usage event:", error);
  });
}
