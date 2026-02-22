import { NextRequest, NextResponse } from "next/server";

const AGENT_URL = process.env.OPENCLAW_AGENT_URL ?? ""; // gateway base, e.g. https://assistant.openclaw.ai
const AGENT_TOKEN = process.env.OPENCLAW_AGENT_TOKEN ?? "";
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const DEFAULT_REDIRECT_PATH = "/adressandring";

/**
 * Convert our chat messages to OpenResponses input items.
 */
function toOpenResponsesInput(
  messages: { role: string; content: string }[]
) {
  return messages.map((m) => ({
    type: "message" as const,
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));
}

/**
 * Build a system-level instruction string that includes form context
 * so the agent knows what the user is doing on the page.
 */
function buildInstructions(formContext?: Record<string, unknown> | null) {
  let base =
    "Du ar AIda, en hjalpsam svensk flyttassistent for Flyttsmart. " +
    "Svara alltid pa svenska. Hjalp anvandaren med adressandring, flytt och relaterade fragor.";

  if (formContext) {
    base +=
      "\n\nAnvandaren har foljande formularkontext just nu:\n" +
      JSON.stringify(formContext, null, 2);
  }

  return base;
}

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

    // OpenResponses API endpoint
    const responsesUrl = `${AGENT_URL.replace(/\/$/, "")}/v1/responses`;

    // Build siteAccess info for the instructions so the agent can access protected pages
    const accessEndpoint = `${req.nextUrl.origin}/api/openclaw/access`;
    let siteAccessNote = "";
    if (BYPASS_SECRET) {
      siteAccessNote =
        `\n\nFor att komma at skyddade sidor, anvand headern "x-vercel-protection-bypass: ${BYPASS_SECRET}" ` +
        `eller hamta en cookie via: ${accessEndpoint}?token=${encodeURIComponent(AGENT_TOKEN)}&redirect=${encodeURIComponent(DEFAULT_REDIRECT_PATH)}`;
    }

    const instructions = buildInstructions(formContext) + siteAccessNote;

    const agentResponse = await fetch(responsesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AGENT_TOKEN}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        stream: true,
        user: sessionId,
        instructions,
        input: toOpenResponsesInput(messages.slice(-15)),
      }),
    });

    if (!agentResponse.ok) {
      const errText = await agentResponse.text().catch(() => "Unknown");
      console.error(
        `[OpenClaw] Chat error ${agentResponse.status}: ${errText}`
      );
      return NextResponse.json(
        {
          content: "AIda kunde inte svara just nu. Forsok igen om en stund.",
        },
        { status: 502 }
      );
    }

    const contentType = agentResponse.headers.get("content-type") || "";

    // If the agent streams SSE, transform OpenResponses events to our simple format
    if (
      contentType.includes("text/event-stream") &&
      agentResponse.body
    ) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Process the OpenResponses SSE stream in background
      (async () => {
        try {
          const reader = agentResponse.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            let currentEvent = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                const dataStr = line.slice(6);

                if (dataStr === "[DONE]") {
                  await writer.write(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }

                try {
                  const data = JSON.parse(dataStr);

                  if (
                    currentEvent === "response.output_text.delta" ||
                    data.type === "response.output_text.delta"
                  ) {
                    // Forward as simple content chunk for the widget
                    await writer.write(
                      encoder.encode(
                        `data: ${JSON.stringify({ content: data.delta })}\n\n`
                      )
                    );
                  } else if (
                    currentEvent === "response.completed" ||
                    data.type === "response.completed"
                  ) {
                    await writer.write(
                      encoder.encode("data: [DONE]\n\n")
                    );
                  }
                } catch {
                  // Skip unparseable lines
                }
              }
            }
          }
        } catch (e) {
          console.error("[OpenClaw] Stream processing error:", e);
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming: extract output text from OpenResponses format
    const data = await agentResponse.json().catch(() => null);

    if (data?.output) {
      // OpenResponses returns output as an array of items
      const textParts: string[] = [];
      for (const item of data.output) {
        if (item.type === "message" && item.content) {
          for (const c of item.content) {
            if (c.type === "output_text" && c.text) {
              textParts.push(c.text);
            }
          }
        }
      }
      return NextResponse.json({
        content: textParts.join("") || "Inget svar fran agenten.",
        role: "assistant",
      });
    }

    return NextResponse.json({
      content: data?.content || "Inget svar fran agenten.",
      role: "assistant",
    });
  } catch (error) {
    console.error("[OpenClaw] Chat proxy error:", error);
    return NextResponse.json(
      {
        content: "Ett fel uppstod i anslutningen till AIda. Forsok igen.",
      },
      { status: 500 }
    );
  }
}
