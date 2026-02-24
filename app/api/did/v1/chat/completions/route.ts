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

const GATEWAY_BASE_URL = getOpenClawGatewayBaseUrl();
const AGENT_ID = getOpenClawAgentId();
const CHAT_MODEL = getOpenClawChatModel(AGENT_ID);
const { gatewayToken: GATEWAY_TOKEN } = getOpenClawTokens();

const SESSION_FORM_CTX = new Map<string, Record<string, string>>();

function buildSystemPrompt(
  formCtx: Record<string, string> | null,
  enrichedData: string | null,
  siteAccess: Record<string, unknown> | null,
) {
  let base =
    "Du ar Aida, en hjalpsam svensk flyttassistent for Flytt.io. " +
    "Svara alltid pa svenska, kort och tydligt. Hjalp anvandaren med flytt, adressandring och checklistor.\n\n" +
    "Du pratar med anvandaren via en rost-avatar. Holl svaren korta och naturliga " +
    "- max 2-3 meningar. Undvik markdown-formatering, lankar och kodblock. " +
    "Svara som om du talar, inte skriver.\n\n" +
    "## Faltkunskap\n" + FIELD_KNOWLEDGE + "\n\n" +
    "## Proaktivt beteende\n" +
    "- Om du ser saknade falt i kontexten, paminn anvandaren.\n" +
    "- Om postnummer ar ifyllt och ort saknas, foreslå orten.\n" +
    "- Om toCity ar ifyllt, erbjud lokala tips.\n" +
    "- Vid jamforelsefragor (el, bredband, forsakring, flyttfirma), ge konkreta tips.";

  if (formCtx) {
    base += "\n\n## Formularkontext just nu\n" + JSON.stringify(formCtx, null, 2);
  }
  if (enrichedData) {
    base += enrichedData;
  }
  if (siteAccess) {
    base += "\n\nOm du behover besoka sajten bakom Vercel-skydd, anvand:\n" +
      JSON.stringify(siteAccess, null, 2);
  }
  return base;
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  try {
    const body = await req.json();
    const messages: Array<{ role: string; content: string }> = body.messages ?? [];
    const sessionId = (typeof body.user === "string" && body.user) || `did-${crypto.randomUUID()}`;

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg?.content?.trim()) {
      return NextResponse.json(
        { error: "No user message found in messages array" },
        { status: 400, headers },
      );
    }

    const formCtx = SESSION_FORM_CTX.get(sessionId) ?? null;
    const enrichedData = formCtx ? await enrichContext({ fields: formCtx }) : null;
    const siteAccess = buildOpenClawSiteAccess(req);

    const systemPrompt = buildSystemPrompt(formCtx, enrichedData, siteAccess);

    const outMessages = [
      { role: "system", content: systemPrompt },
      ...messages.filter((m) => m.role !== "system"),
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
        messages: outMessages,
      }),
    });

    if (!gatewayResponse.ok) {
      const detail = await gatewayResponse.text().catch(() => "");
      return NextResponse.json(
        { error: "upstream_error", detail },
        { status: 502, headers },
      );
    }

    const gatewayJson = await gatewayResponse.json().catch(() => null);
    const reply = extractOpenClawText(gatewayJson) ?? "Aida kunde inte generera ett svar.";

    return NextResponse.json(
      {
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: CHAT_MODEL,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: reply },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      },
      { headers },
    );
  } catch (error) {
    console.error("[DID/OpenAI-compat] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
