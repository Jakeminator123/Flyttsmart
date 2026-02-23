import { NextRequest, NextResponse } from "next/server";
import {
  buildOpenClawSiteAccess,
  getOpenClawAgentId,
  getOpenClawChatModel,
  getOpenClawGatewayBaseUrl,
  getOpenClawTokens,
} from "@/lib/openclaw/server-config";
import { extractOpenClawText } from "@/lib/openclaw/response";
import { enrichContext, FIELD_KNOWLEDGE } from "@/lib/aida/enrich";

const DID_BRIDGE_SECRET = process.env.DID_BRIDGE_SECRET ?? "";
const TEST_TAL_ENABLED = (process.env.TEST_TAL ?? "").toLowerCase() === "y";

const GATEWAY_BASE_URL = getOpenClawGatewayBaseUrl();
const AGENT_ID = getOpenClawAgentId();
const CHAT_MODEL = getOpenClawChatModel(AGENT_ID);
const { gatewayToken: GATEWAY_TOKEN } = getOpenClawTokens();

// ─── In-memory per-session conversation store ───────────
// Keeps the last N messages so the DID bridge has conversation continuity.
const SESSION_HISTORY = new Map<
  string,
  Array<{ role: string; content: string; ts: number }>
>();
const MAX_HISTORY = 20;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, msgs] of SESSION_HISTORY) {
    const newest = msgs.at(-1)?.ts ?? 0;
    if (now - newest > SESSION_TTL_MS) SESSION_HISTORY.delete(id);
  }
}

function pushMessage(
  sessionId: string,
  role: string,
  content: string,
) {
  if (!SESSION_HISTORY.has(sessionId)) SESSION_HISTORY.set(sessionId, []);
  const history = SESSION_HISTORY.get(sessionId)!;
  history.push({ role, content, ts: Date.now() });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

function getHistory(sessionId: string) {
  return (SESSION_HISTORY.get(sessionId) ?? []).map(({ role, content }) => ({
    role,
    content,
  }));
}

// ─── Per-session form context aggregator ────────────────
// Field blur events build up a picture of the form state.
const SESSION_FORM_CTX = new Map<
  string,
  Record<string, string>
>();

function updateFormField(sessionId: string, field: string, value: string) {
  if (!SESSION_FORM_CTX.has(sessionId)) SESSION_FORM_CTX.set(sessionId, {});
  SESSION_FORM_CTX.get(sessionId)![field] = value;
}

function getFormContext(sessionId: string): Record<string, string> | null {
  const ctx = SESSION_FORM_CTX.get(sessionId);
  return ctx && Object.keys(ctx).length > 0 ? ctx : null;
}

// ─── Helpers ────────────────────────────────────────────

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-did-bridge-secret",
  };
}

function extractAuthSecret(req: NextRequest, body: Record<string, unknown>) {
  const headerSecret =
    req.headers.get("x-did-bridge-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const bodySecret = typeof body.secret === "string" ? body.secret : "";
  return headerSecret || bodySecret;
}

function extractUserMessage(body: Record<string, unknown>): string {
  const candidates = [
    body.message,
    body.text,
    body.input,
    (body as any)?.messages?.[(body as any)?.messages?.length - 1]?.content,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractFieldValue(body: Record<string, unknown>): string {
  return typeof body.fieldValue === "string" ? body.fieldValue.trim() : "";
}

function toLastWord(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words[words.length - 1] ?? "";
}

function buildSystemMessage(
  formContext?: Record<string, unknown> | null,
  enrichedData?: string | null,
  siteAccess?: Record<string, unknown> | null,
) {
  let base =
    "Du ar Aida, en hjalpsam svensk flyttassistent for Flytt.io. " +
    "Svara alltid pa svenska, kort och tydligt. Hjalp anvandaren med flytt, adressandring och checklistor.\n\n" +
    "Du pratar med anvandaren via en rost-avatar. Holl svaren korta och naturliga " +
    "– max 2-3 meningar. Undvik markdown-formatering, lankar och kodblock. " +
    "Svara som om du talar, inte skriver.\n\n" +
    "## Faltkunskap\n" + FIELD_KNOWLEDGE + "\n\n" +
    "## Proaktivt beteende\n" +
    "- Om du ser saknade falt i kontexten, paminn anvandaren.\n" +
    "- Om postnummer ar ifyllt och ort saknas, foreslå orten.\n" +
    "- Om toCity ar ifyllt, erbjud lokala tips.\n" +
    "- Vid jamforelsefragor (el, bredband, forsakring, flyttfirma), ge konkreta tips.";

  if (formContext) {
    base +=
      "\n\n## Formularkontext just nu\n" + JSON.stringify(formContext, null, 2);
  }

  if (enrichedData) {
    base += enrichedData;
  }

  if (siteAccess) {
    base +=
      "\n\nOm du behover besoka sajten bakom Vercel-skydd, anvand:\n" +
      JSON.stringify(siteAccess, null, 2);
  }

  return base;
}

// ─── Route handlers ─────────────────────────────────────

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sameOriginRequest = req.headers.get("origin") === req.nextUrl.origin;

    if (DID_BRIDGE_SECRET && !sameOriginRequest) {
      const providedSecret = extractAuthSecret(req, body);
      if (!providedSecret || providedSecret !== DID_BRIDGE_SECRET) {
        return NextResponse.json(
          { error: "Unauthorized DID bridge request" },
          { status: 401, headers: corsHeaders },
        );
      }
    }

    const sessionId =
      (typeof body.sessionId === "string" && body.sessionId) ||
      (typeof body.conversationId === "string" && body.conversationId) ||
      `did-${crypto.randomUUID()}`;

    // Accept bulk form context from client
    if (body.formContext && typeof body.formContext === "object") {
      for (const [k, v] of Object.entries(body.formContext as Record<string, unknown>)) {
        if (typeof v === "string") updateFormField(sessionId, k, v);
      }
    }

    pruneExpiredSessions();

    const eventType = typeof body.eventType === "string" ? body.eventType : "";

    // ── Form sync (context-only, no chat response) ───
    if (eventType === "form_sync") {
      return NextResponse.json(
        { ok: true, mode: "form_sync", sessionId },
        { headers: corsHeaders },
      );
    }

    // ── Field blur event ──────────────────────────────
    if (eventType === "field_blur") {
      const fieldName =
        (typeof body.fieldName === "string" && body.fieldName) || "field";
      const fieldValue = extractFieldValue(body);

      if (fieldValue) updateFormField(sessionId, fieldName, fieldValue);

      if (!TEST_TAL_ENABLED) {
        return NextResponse.json(
          { ok: true, mode: "test_tal_disabled", shouldSpeak: false, sessionId },
          { headers: corsHeaders },
        );
      }

      const lastWord = toLastWord(fieldValue);
      if (!lastWord) {
        return NextResponse.json(
          { ok: true, mode: "empty_value", shouldSpeak: false, sessionId },
          { headers: corsHeaders },
        );
      }

      return NextResponse.json(
        {
          role: "assistant",
          provider: "did-test-tal",
          agentId: AGENT_ID,
          sessionId,
          fieldName,
          reply: lastWord,
          content: lastWord,
          text: lastWord,
          shouldSpeak: true,
          mode: "test_tal_echo",
        },
        { headers: corsHeaders },
      );
    }

    // ── Chat message ──────────────────────────────────
    const userMessage = extractUserMessage(body);
    if (!userMessage) {
      return NextResponse.json(
        { error: "message/text/input is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!GATEWAY_BASE_URL || !GATEWAY_TOKEN) {
      return NextResponse.json(
        {
          error:
            "OpenClaw gateway is not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN.",
        },
        { status: 503, headers: corsHeaders },
      );
    }

    pushMessage(sessionId, "user", userMessage);

    const formCtx = getFormContext(sessionId);
    const enrichedData = formCtx ? await enrichContext({ fields: formCtx }) : null;
    const siteAccess = buildOpenClawSiteAccess(req);

    const history = getHistory(sessionId);
    const openaiMessages = [
      { role: "system", content: buildSystemMessage(formCtx, enrichedData, siteAccess) },
      ...history,
    ];

    const gatewayResponse = await fetch(`${GATEWAY_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "x-openclaw-agent-id": AGENT_ID,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        stream: false,
        user: sessionId,
        messages: openaiMessages,
      }),
    });

    if (!gatewayResponse.ok) {
      const detail = await gatewayResponse.text().catch(() => "");
      return NextResponse.json(
        {
          error: "OpenClaw gateway request failed",
          status: gatewayResponse.status,
          detail,
        },
        { status: 502, headers: corsHeaders },
      );
    }

    const gatewayJson = await gatewayResponse.json().catch(() => null);
    const reply =
      extractOpenClawText(gatewayJson) ?? "Aida kunde inte generera ett svar.";

    pushMessage(sessionId, "assistant", reply);

    return NextResponse.json(
      {
        role: "assistant",
        provider: "openclaw",
        agentId: AGENT_ID,
        sessionId,
        reply,
        content: reply,
        text: reply,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("[DID/OpenClaw] bridge error:", error);
    return NextResponse.json(
      { error: "Invalid DID bridge request" },
      { status: 400, headers: corsHeaders },
    );
  }
}
