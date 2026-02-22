import { NextRequest, NextResponse } from "next/server";
import {
  buildOpenClawSiteAccess,
  getOpenClawAgentId,
  getOpenClawChatModel,
  getOpenClawGatewayBaseUrl,
  getOpenClawTokens,
} from "@/lib/openclaw/server-config";
import { extractOpenClawText } from "@/lib/openclaw/response";

const DID_BRIDGE_SECRET = process.env.DID_BRIDGE_SECRET ?? "";
const TEST_TAL_ENABLED = (process.env.TEST_TAL ?? "").toLowerCase() === "y";

const GATEWAY_BASE_URL = getOpenClawGatewayBaseUrl();
const AGENT_ID = getOpenClawAgentId();
const CHAT_MODEL = getOpenClawChatModel(AGENT_ID);
const { gatewayToken: GATEWAY_TOKEN } = getOpenClawTokens();

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
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
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
  siteAccess?: Record<string, unknown> | null
) {
  let base =
    "Du ar Aida, en hjalpsam svensk flyttassistent for Flytt.io. " +
    "Svara alltid pa svenska, kort och tydligt. Hjalp anvandaren med flytt, adressandring och checklistor.";

  if (formContext) {
    base +=
      "\n\nAktuell formularkontext:\n" + JSON.stringify(formContext, null, 2);
  }

  if (siteAccess) {
    base +=
      "\n\nOm du maste besoka skyddad deployment, anvand:\n" +
      JSON.stringify(siteAccess, null, 2);
  }

  return base;
}

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
          { status: 401, headers: corsHeaders }
        );
      }
    }

    const sessionId =
      (typeof body.sessionId === "string" && body.sessionId) ||
      (typeof body.conversationId === "string" && body.conversationId) ||
      `did-${crypto.randomUUID()}`;

    const eventType = typeof body.eventType === "string" ? body.eventType : "";
    if (eventType === "field_blur") {
      if (!TEST_TAL_ENABLED) {
        return NextResponse.json(
          {
            ok: true,
            mode: "test_tal_disabled",
            shouldSpeak: false,
            sessionId,
          },
          { headers: corsHeaders }
        );
      }

      const fieldValue = extractFieldValue(body);
      const lastWord = toLastWord(fieldValue);

      if (!lastWord) {
        return NextResponse.json(
          {
            ok: true,
            mode: "empty_value",
            shouldSpeak: false,
            sessionId,
          },
          { headers: corsHeaders }
        );
      }

      return NextResponse.json(
        {
          role: "assistant",
          provider: "did-test-tal",
          agentId: AGENT_ID,
          sessionId,
          fieldName:
            (typeof body.fieldName === "string" && body.fieldName) || "field",
          reply: lastWord,
          content: lastWord,
          text: lastWord,
          shouldSpeak: true,
          mode: "test_tal_echo",
        },
        { headers: corsHeaders }
      );
    }

    const userMessage = extractUserMessage(body);
    if (!userMessage) {
      return NextResponse.json(
        { error: "message/text/input is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!GATEWAY_BASE_URL || !GATEWAY_TOKEN) {
      return NextResponse.json(
        {
          error:
            "OpenClaw gateway is not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN.",
        },
        { status: 503, headers: corsHeaders }
      );
    }

    const formContext =
      (body.formContext as Record<string, unknown> | undefined) ??
      (body.context as Record<string, unknown> | undefined) ??
      null;

    const siteAccess = buildOpenClawSiteAccess(req);

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
        messages: [
          {
            role: "system",
            content: buildSystemMessage(formContext, siteAccess),
          },
          { role: "user", content: userMessage },
        ],
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
        { status: 502, headers: corsHeaders }
      );
    }

    const gatewayJson = await gatewayResponse.json().catch(() => null);
    const reply =
      extractOpenClawText(gatewayJson) ?? "Aida kunde inte generera ett svar.";

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
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[DID/OpenClaw] bridge error:", error);
    return NextResponse.json(
      { error: "Invalid DID bridge request" },
      { status: 400, headers: corsHeaders }
    );
  }
}
