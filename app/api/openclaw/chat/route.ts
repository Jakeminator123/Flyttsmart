import { NextRequest, NextResponse } from "next/server";

const AGENT_URL = process.env.OPENCLAW_AGENT_URL ?? "";
const AGENT_TOKEN = process.env.OPENCLAW_AGENT_TOKEN ?? "";
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const DEFAULT_REDIRECT_PATH = "/adressandring";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, messages, formContext } = body;

    if (!sessionId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "sessionId and messages array are required" },
        { status: 400 }
      );
    }

    // If no agent URL is configured, return a helpful fallback
    if (!AGENT_URL) {
      return NextResponse.json({
        content:
          "Hej! Jag ar AIda, men jag ar inte helt konfigurerad annu. Be administratoren satta OPENCLAW_AGENT_URL i miljovariablerna.",
        role: "assistant",
      });
    }

    // Build the chat endpoint — append /chat if the base URL doesn't include it
    const chatUrl = AGENT_URL.endsWith("/chat")
      ? AGENT_URL
      : `${AGENT_URL.replace(/\/$/, "")}/chat`;

    const accessEndpoint = `${req.nextUrl.origin}/api/openclaw/access`;
    const bypassCookieUrl =
      BYPASS_SECRET && AGENT_TOKEN
        ? `${accessEndpoint}?token=${encodeURIComponent(
            AGENT_TOKEN
          )}&redirect=${encodeURIComponent(DEFAULT_REDIRECT_PATH)}`
        : null;

    const agentResponse = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AGENT_TOKEN}`,
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify({
        sessionId,
        messages: messages.slice(-15), // Keep recent context
        formContext: formContext ?? null,
        // Provide bypass token so OpenClaw can access protected pages
        siteAccess: BYPASS_SECRET
          ? {
              baseUrl: req.nextUrl.origin,
              bypassHeader: "x-vercel-protection-bypass",
              bypassToken: BYPASS_SECRET,
              accessEndpoint,
              defaultRedirectPath: DEFAULT_REDIRECT_PATH,
              bypassCookieUrl,
            }
          : undefined,
      }),
    });

    if (!agentResponse.ok) {
      const errText = await agentResponse.text().catch(() => "Unknown");
      console.error(`[OpenClaw] Chat error ${agentResponse.status}: ${errText}`);
      return NextResponse.json(
        {
          content:
            "AIda kunde inte svara just nu. Forsok igen om en stund.",
        },
        { status: 502 }
      );
    }

    const contentType = agentResponse.headers.get("content-type") || "";

    // If the agent streams SSE, pipe it through
    if (
      contentType.includes("text/event-stream") &&
      agentResponse.body
    ) {
      return new Response(agentResponse.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Otherwise return as JSON
    const data = await agentResponse.json().catch(() => ({
      content: "Inget svar fran agenten.",
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("[OpenClaw] Chat proxy error:", error);
    return NextResponse.json(
      {
        content:
          "Ett fel uppstod i anslutningen till AIda. Forsok igen.",
      },
      { status: 500 }
    );
  }
}
