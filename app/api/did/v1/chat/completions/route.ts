import { NextRequest, NextResponse } from "next/server";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import {
  buildOpenClawSiteAccess,
  getOpenClawAgentId,
  getOpenClawChatModel,
  getOpenClawGatewayBaseUrl,
  getOpenClawTokens,
} from "@/lib/openclaw/server-config";
import { enrichContext, FIELD_KNOWLEDGE } from "@/lib/aida/enrich";
import { getFormContext } from "@/lib/did/session-store";

const GATEWAY_BASE_URL = getOpenClawGatewayBaseUrl();
const AGENT_ID = getOpenClawAgentId();
const CHAT_MODEL = getOpenClawChatModel(AGENT_ID);
const { gatewayToken: GATEWAY_TOKEN } = getOpenClawTokens();

const DID_BRIDGE_SECRET = process.env.DID_BRIDGE_SECRET ?? "";

interface IncomingMessage {
  role: string;
  content: string;
}

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-API-Key, x-api-key, api-key, " +
      "OpenAI-Api-Key, x-openai-api-key, Content-Encoding",
  };
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const asAny = part as Record<string, unknown>;
      const type = typeof asAny.type === "string" ? asAny.type : "";
      const text = typeof asAny.text === "string" ? asAny.text : "";
      if ((type === "text" || type === "input_text" || !type) && text.trim()) {
        parts.push(text.trim());
      }
    }
    return parts.join("\n").trim();
  }

  if (content && typeof content === "object") {
    const text = (content as Record<string, unknown>).text;
    if (typeof text === "string") return text.trim();
  }

  return "";
}

function normalizeMessages(raw: unknown): IncomingMessage[] {
  if (!Array.isArray(raw)) return [];
  const normalized: IncomingMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const asAny = item as Record<string, unknown>;
    const role = typeof asAny.role === "string" ? asAny.role : "";
    const content = extractTextContent(asAny.content);
    if (!role || !content) continue;
    normalized.push({ role, content });
  }
  return normalized;
}

async function parseRequestBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentEncoding = (req.headers.get("content-encoding") ?? "")
    .toLowerCase()
    .trim();

  if (!contentEncoding || contentEncoding === "identity") {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  }

  const compressed = Buffer.from(await req.arrayBuffer());
  let decoded = compressed;

  if (contentEncoding.includes("br")) {
    decoded = brotliDecompressSync(compressed);
  } else if (contentEncoding.includes("gzip")) {
    decoded = gunzipSync(compressed);
  } else if (contentEncoding.includes("deflate")) {
    decoded = inflateSync(compressed);
  } else {
    throw new Error(`Unsupported content-encoding: ${contentEncoding}`);
  }

  const parsed = JSON.parse(decoded.toString("utf8"));
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}

function validateDidAuth(req: NextRequest): boolean {
  if (!DID_BRIDGE_SECRET) return true;

  const apiKey =
    req.headers.get("x-api-key") ??
    req.headers.get("api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  return apiKey === DID_BRIDGE_SECRET;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  if (!validateDidAuth(req)) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "401", type: "Unauthorized", status: 401 } },
      { status: 401, headers },
    );
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await parseRequestBody(req);
    } catch {
      return NextResponse.json(
        { error: "Invalid or unsupported request body encoding" },
        { status: 400, headers },
      );
    }

    const messages = normalizeMessages(body.messages);
    const wantsStream = body.stream !== false;

    const sessionId =
      (typeof body.user === "string" && body.user) ||
      req.headers.get("x-did-distinct-id") ||
      `did-${crypto.randomUUID()}`;

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg?.content?.trim()) {
      return NextResponse.json(
        { error: "No user message found in messages array" },
        { status: 400, headers },
      );
    }

    if (!GATEWAY_BASE_URL || !GATEWAY_TOKEN) {
      const errorMsg = "OpenClaw gateway is not configured.";
      if (wantsStream) {
        return sseErrorResponse(errorMsg, headers);
      }
      return NextResponse.json({ error: errorMsg }, { status: 503, headers });
    }

    const formCtx = getFormContext(sessionId);
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
        stream: wantsStream,
        user: sessionId,
        messages: outMessages,
      }),
    });

    if (!gatewayResponse.ok) {
      const detail = await gatewayResponse.text().catch(() => "");
      console.error(`[DID/Custom-LLM] OpenClaw ${gatewayResponse.status}: ${detail}`);
      const errorMsg = `Upstream error: ${gatewayResponse.status}`;
      if (wantsStream) {
        return sseErrorResponse(errorMsg, headers);
      }
      return NextResponse.json(
        { error: "upstream_error", detail },
        { status: 502, headers },
      );
    }

    const contentType = gatewayResponse.headers.get("content-type") ?? "";

    if (wantsStream && contentType.includes("text/event-stream") && gatewayResponse.body) {
      return streamOpenClawToDid(gatewayResponse.body, headers);
    }

    const gatewayJson = await gatewayResponse.json().catch(() => null);
    const reply =
      gatewayJson?.choices?.[0]?.message?.content ??
      "Aida kunde inte generera ett svar.";

    if (wantsStream) {
      return syntheticSseResponse(reply, headers);
    }

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
    console.error("[DID/Custom-LLM] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

function sseHeaders(extra: Record<string, string>) {
  return {
    ...extra,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

function streamOpenClawToDid(
  upstreamBody: ReadableStream<Uint8Array>,
  extraHeaders: Record<string, string>,
): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const reader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();

          if (dataStr === "[DONE]") {
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            continue;
          }

          try {
            const data = JSON.parse(dataStr);

            const delta = data.choices?.[0]?.delta;
            if (delta?.content) {
              const chunk = {
                id: data.id ?? `chatcmpl-${crypto.randomUUID()}`,
                object: "chat.completion.chunk",
                created: data.created ?? Math.floor(Date.now() / 1000),
                model: data.model ?? CHAT_MODEL,
                choices: [{ index: 0, delta: { content: delta.content }, finish_reason: null }],
              };
              await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              continue;
            }

            if (data.type === "response.output_text.delta" && data.delta) {
              const chunk = {
                id: `chatcmpl-${crypto.randomUUID()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: CHAT_MODEL,
                choices: [{ index: 0, delta: { content: data.delta }, finish_reason: null }],
              };
              await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              continue;
            }

            if (data.type === "response.completed" || data.choices?.[0]?.finish_reason === "stop") {
              const stopChunk = {
                id: `chatcmpl-${crypto.randomUUID()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: CHAT_MODEL,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
              };
              await writer.write(encoder.encode(`data: ${JSON.stringify(stopChunk)}\n\n`));
              await writer.write(encoder.encode("data: [DONE]\n\n"));
            }
          } catch {
            // skip unparseable SSE lines
          }
        }
      }
    } catch (e) {
      console.error("[DID/Custom-LLM] stream relay error:", e);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, { headers: sseHeaders(extraHeaders) });
}

function syntheticSseResponse(
  text: string,
  extraHeaders: Record<string, string>,
): Response {
  const encoder = new TextEncoder();
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  const chunks: string[] = [];

  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (!word) continue;
    const chunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: CHAT_MODEL,
      choices: [{ index: 0, delta: { content: word }, finish_reason: null }],
    };
    chunks.push(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  const stopChunk = {
    id,
    object: "chat.completion.chunk",
    created,
    model: CHAT_MODEL,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };
  chunks.push(`data: ${JSON.stringify(stopChunk)}\n\n`);
  chunks.push("data: [DONE]\n\n");

  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(body, { headers: sseHeaders(extraHeaders) });
}

function sseErrorResponse(
  message: string,
  extraHeaders: Record<string, string>,
): Response {
  const encoder = new TextEncoder();
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  const chunk = {
    id,
    object: "chat.completion.chunk",
    created,
    model: CHAT_MODEL,
    choices: [{ index: 0, delta: { content: message }, finish_reason: null }],
  };
  const stopChunk = {
    id,
    object: "chat.completion.chunk",
    created,
    model: CHAT_MODEL,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };

  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(stopChunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(body, { headers: sseHeaders(extraHeaders) });
}
