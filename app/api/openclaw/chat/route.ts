import { NextRequest, NextResponse } from "next/server";

// OPENCLAW_AGENT_URL must be the gateway base URL, e.g. https://assistant.openclaw.ai
// NOT the session URL (no /sessions/... suffix)
const AGENT_URL = process.env.OPENCLAW_AGENT_URL ?? "";
const AGENT_TOKEN = process.env.OPENCLAW_AGENT_TOKEN ?? "";

/**
 * Build a system message that includes form context
 * so the agent knows what the user is doing on the page.
 */
function buildSystemMessage(formContext?: Record<string, unknown> | null) {
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
          "Hej! Jag ar AIda, men jag ar inte helt konfigurerad annu. " +
          "Be administratoren satta OPENCLAW_AGENT_URL i miljovariablerna.",
        role: "assistant",
      });
    }

    // Use OpenAI Chat Completions endpoint (simpler SSE format)
    const baseUrl = AGENT_URL.replace(/\/+$/, "").replace(
      /\/sessions\/.*$/,
      ""
    );
    const chatUrl = `${baseUrl}/v1/chat/completions`;

    // Build messages array in OpenAI format
    const openaiMessages = [
      { role: "system", content: buildSystemMessage(formContext) },
      ...messages.slice(-15).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const agentResponse = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AGENT_TOKEN}`,
        "x-openclaw-agent-id": "main",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        stream: true,
        user: sessionId,
        messages: openaiMessages,
      }),
    });

    if (!agentResponse.ok) {
      const errText = await agentResponse.text().catch(() => "Unknown");
      console.error(
        `[v0] OpenClaw chat error ${agentResponse.status}: ${errText}`
      );
      return NextResponse.json(
        {
          content: `AIda kunde inte svara just nu (${agentResponse.status}). Forsok igen om en stund.`,
        },
        { status: 502 }
      );
    }

    const contentType = agentResponse.headers.get("content-type") || "";

    // Stream SSE -- OpenAI Chat Completions format:
    // data: {"choices":[{"delta":{"content":"..."}}]}
    if (
      contentType.includes("text/event-stream") &&
      agentResponse.body
    ) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

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

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const dataStr = line.slice(6).trim();

              if (dataStr === "[DONE]") {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const data = JSON.parse(dataStr);

                // OpenAI Chat Completions SSE format
                const delta = data.choices?.[0]?.delta;
                if (delta?.content) {
                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({ content: delta.content })}\n\n`
                    )
                  );
                }

                // Also handle OpenResponses format (in case gateway uses it)
                if (data.type === "response.output_text.delta" && data.delta) {
                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({ content: data.delta })}\n\n`
                    )
                  );
                }

                if (data.type === "response.completed") {
                  await writer.write(encoder.encode("data: [DONE]\n\n"));
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }
        } catch (e) {
          console.error("[v0] Stream processing error:", e);
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

    // Non-streaming JSON fallback
    const data = await agentResponse.json().catch(() => null);

    // OpenAI format
    if (data?.choices?.[0]?.message?.content) {
      return NextResponse.json({
        content: data.choices[0].message.content,
        role: "assistant",
      });
    }

    // OpenResponses format
    if (data?.output) {
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
      if (textParts.length > 0) {
        return NextResponse.json({
          content: textParts.join(""),
          role: "assistant",
        });
      }
    }

    return NextResponse.json({
      content: data?.content || "Inget svar fran agenten.",
      role: "assistant",
    });
  } catch (error) {
    console.error("[v0] OpenClaw chat proxy error:", error);
    return NextResponse.json(
      {
        content: "Ett fel uppstod i anslutningen till AIda. Forsok igen.",
      },
      { status: 500 }
    );
  }
}
