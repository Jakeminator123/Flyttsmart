import type { NextRequest } from "next/server";
import { getLiveTaskKeys, getStubTaskKeys, getApiTaskKeys } from "@/lib/comparison/compare";

const DEFAULT_DEV_GATEWAY_URL = "http://127.0.0.1:18789";
const DEFAULT_REDIRECT_PATH = "/adressandring";

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
  return firstNonEmpty(process.env.OPENCLAW_CHAT_MODEL, `openclaw:${agentId}`);
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
    return firstNonEmpty(process.env.OPENCLAW_CHAT_MODEL_SIMPLE, powerful);
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
