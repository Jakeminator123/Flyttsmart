import type { NextRequest } from "next/server";
import { getLiveTaskKeys, getStubTaskKeys, getApiTaskKeys } from "@/lib/comparison/compare";

const DEFAULT_DEV_GATEWAY_URL = "http://127.0.0.1:18789";
const DEFAULT_REDIRECT_PATH = "/adressandring";
const DEFAULT_OPENCLAW_MODEL = "openai/gpt-5.1-codex";
const DEFAULT_SIMPLE_MODEL = "openai/gpt-4.1-mini";
const DEFAULT_ALLOWED_MODEL_PREFIXES = ["openai/"];

function sanitizeEnvValue(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\r|\\n/g, "")
    .replace(/[\r\n]/g, "")
    .replace(/(%0d|%0a)/gi, "");
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (!value) continue;
    const sanitized = sanitizeEnvValue(value);
    if (sanitized) return sanitized;
  }
  return "";
}

function boolFromEnv(value: string | undefined): boolean {
  const normalized = sanitizeEnvValue(value ?? "").toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "y" || normalized === "yes";
}

function parseAllowedModelPrefixes(): string[] {
  const raw = sanitizeEnvValue(process.env.OPENCLAW_ALLOWED_MODEL_PREFIXES ?? "");
  const parsed = raw
    .split(",")
    .map((prefix) => sanitizeEnvValue(prefix).toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_MODEL_PREFIXES;
}

export function getAllowedModelPrefixes(): string[] {
  return parseAllowedModelPrefixes();
}

export function isModelPolicyEnforced(): boolean {
  return boolFromEnv(process.env.OPENCLAW_MODEL_POLICY_ENFORCE);
}

export function isModelAllowed(model: string): boolean {
  const candidate = sanitizeEnvValue(model).toLowerCase();
  if (!candidate) return false;
  return parseAllowedModelPrefixes().some((prefix) => candidate.startsWith(prefix));
}

function enforceModelPolicy(candidate: string, fallback: string, source: string): string {
  const safeFallback = sanitizeEnvValue(fallback) || DEFAULT_OPENCLAW_MODEL;
  const safeCandidate = sanitizeEnvValue(candidate);
  if (!safeCandidate) return safeFallback;
  if (isModelAllowed(safeCandidate)) return safeCandidate;

  if (!isModelPolicyEnforced()) {
    console.warn(
      `[OpenClaw] disallowed model '${safeCandidate}' from ${source}; allowing because OPENCLAW_MODEL_POLICY_ENFORCE=false`,
    );
    return safeCandidate;
  }

  console.warn(
    `[OpenClaw] blocked disallowed model '${safeCandidate}' from ${source}; falling back to '${safeFallback}'`,
  );
  return safeFallback;
}

function normalizeGatewayUrl(value: string): string {
  if (!value) return "";

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withProtocol);
    let pathname = url.pathname.replace(/\/+$/, "");

    // Normalize common copy-paste mistakes from OpenClaw UI/session links.
    pathname = pathname.replace(/\/sessions\/.*$/, "");
    if (pathname === "/config") pathname = "";

    url.pathname = pathname;
    url.search = "";
    url.hash = "";

    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function getOpenClawGatewayBaseUrl(): string {
  const configured = firstNonEmpty(
    process.env.OPENCLAW_GATEWAY_URL,
    process.env.OPENCLAW_AGENT_URL
  );

  const fallback =
    process.env.NODE_ENV === "development" ? DEFAULT_DEV_GATEWAY_URL : "";

  return normalizeGatewayUrl(configured || fallback);
}

export function getOpenClawAgentId(): string {
  return firstNonEmpty(process.env.OPENCLAW_AGENT_ID, "main");
}

export function getOpenClawChatModel(agentId = getOpenClawAgentId()): string {
  const defaultModel = firstNonEmpty(
    process.env.OPENCLAW_MODEL_DEFAULT,
    process.env.OPENCLAW_MODEL_LOCK,
    DEFAULT_OPENCLAW_MODEL,
    `openclaw:${agentId}`,
  );
  const configured = firstNonEmpty(process.env.OPENCLAW_CHAT_MODEL, defaultModel);
  return enforceModelPolicy(configured, defaultModel, "OPENCLAW_CHAT_MODEL");
}

/**
 * Pick model based on message intent.
 *
 *   simple     → OPENCLAW_CHAT_MODEL_SIMPLE  (cheap & fast)
 *   comparison → OPENCLAW_CHAT_MODEL         (powerful, handles complex reasoning)
 *   general    → OPENCLAW_CHAT_MODEL         (powerful)
 *
 * Set in .env.local:
 *   OPENCLAW_CHAT_MODEL="openai/gpt-5.1-codex"
 *   OPENCLAW_CHAT_MODEL_SIMPLE="openai/gpt-4.1-mini"
 */
export function getModelForIntent(intent: string): string {
  const powerful = getOpenClawChatModel();
  if (intent === "simple") {
    const configuredSimple = firstNonEmpty(
      process.env.OPENCLAW_CHAT_MODEL_SIMPLE,
      DEFAULT_SIMPLE_MODEL,
      powerful,
    );
    return enforceModelPolicy(configuredSimple, powerful, "OPENCLAW_CHAT_MODEL_SIMPLE");
  }
  return powerful;
}

export function getOpenClawTokens() {
  const gatewayToken = firstNonEmpty(
    process.env.OPENCLAW_GATEWAY_TOKEN,
    process.env.OPENCLAW_AGENT_TOKEN
  );
  const hooksToken = firstNonEmpty(
    process.env.OPENCLAW_HOOKS_TOKEN,
    process.env.OPENCLAW_AGENT_TOKEN
  );
  const accessToken = firstNonEmpty(
    process.env.OPENCLAW_ACCESS_TOKEN,
    process.env.OPENCLAW_AGENT_TOKEN,
    process.env.OPENCLAW_HOOKS_TOKEN
  );
  const webhookSecret = firstNonEmpty(process.env.OPENCLAW_WEBHOOK_SECRET);
  const bypassSecret = firstNonEmpty(process.env.VERCEL_AUTOMATION_BYPASS_SECRET);

  return {
    gatewayToken,
    hooksToken,
    accessToken,
    webhookSecret,
    bypassSecret,
  };
}

export function buildOpenClawSiteAccess(req: NextRequest) {
  const { accessToken, bypassSecret } = getOpenClawTokens();

  if (!bypassSecret || !accessToken) {
    return null;
  }

  const baseUrl = req.nextUrl.origin;
  const accessEndpoint = `${baseUrl}/api/openclaw/access`;
  const compareLiveKeys = getLiveTaskKeys();
  const compareApiKeys = getApiTaskKeys();
  const compareStubKeys = getStubTaskKeys();
  const assistantTools = {
    postalLookupEndpoint: `${baseUrl}/api/enrich/postal`,
    postalLookupExample: `${baseUrl}/api/enrich/postal?postalCode=41119`,
    personLookupEndpoint: `${baseUrl}/api/enrich/person`,
    personLookupNote: "POST med { personalNumber: 'YYYYMMDD-NNNN' } → firstName, lastName, fromStreet, fromCity, etc.",
    healthDebugEndpoint: `${baseUrl}/api/openclaw/health?debug=1`,
    compareEndpoint: `${baseUrl}/api/compare/{taskKey}`,
    compareLiveKeys,
    compareApiKeys,
    compareStubKeys,
    compareSupportedKeys: [...compareApiKeys, ...compareLiveKeys, ...compareStubKeys],
    compareExample: `${baseUrl}/api/compare/electricity_contract?toPostal=41119&toCity=Goteborg`,
    notes: [
      "postalLookupEndpoint: resolve city/municipality from 5-digit postal code",
      "SCB data is injected server-side in chat context when SCB_ENABLED=true",
      `compareEndpoint: GET /api/compare/{taskKey}?toPostal=X&toCity=Y`,
      `compareLiveKeys use OpenAI web search: ${compareLiveKeys.join(", ") || "none"}`,
      `compareApiKeys use dedicated external APIs (e.g. elprisetjustnu.se for electricity): ${compareApiKeys.join(", ") || "none"}`,
      `compareStubKeys return static hints only: ${compareStubKeys.join(", ")}`,
      "elnatsomrade (SE1-SE4) is derived from postal code and included in compare results",
    ],
  };

  return {
    baseUrl,
    bypassHeader: "x-vercel-protection-bypass",
    bypassToken: bypassSecret,
    accessEndpoint,
    defaultRedirectPath: DEFAULT_REDIRECT_PATH,
    bypassCookieUrl: `${accessEndpoint}?token=${encodeURIComponent(
      accessToken
    )}&redirect=${encodeURIComponent(DEFAULT_REDIRECT_PATH)}`,
    assistantTools,
  };
}
