import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { CHAT_ASSISTANT_SYSTEM } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = getOpenAIClient();

    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 600,
      stream: true,
      messages: [
        { role: "system", content: CHAT_ASSISTANT_SYSTEM },
        ...messages.slice(-10), // Keep last 10 messages for context
      ],
    });

    // Stream response via Server-Sent Events
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("AI chat error:", error);

    // Fallback response when OpenAI is not configured
    if (error.message?.includes("OPENAI_API_KEY")) {
      return new Response(
        JSON.stringify({
          content:
            "Hej! AI-assistenten är inte konfigurerad ännu. Lägg till din OPENAI_API_KEY i .env.local för att aktivera chattfunktionen.",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Chat failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
