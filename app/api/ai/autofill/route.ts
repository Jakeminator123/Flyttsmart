import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { AUTOFILL_SYSTEM } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AUTOFILL_SYSTEM },
        {
          role: "user",
          content: `Complete/validate this partial data:\n${JSON.stringify(body, null, 2)}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({
        suggestions: {},
        corrections: [],
        confidence: 0,
      });
    }

    return NextResponse.json(JSON.parse(content));
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error("AI autofill error:", errMsg);

    // Graceful fallback – never break the user flow
    return NextResponse.json({
      suggestions: {},
      corrections: [
        "AI-komplettering ej tillgänglig. Fyll i fälten manuellt.",
      ],
      confidence: 0,
      fallback: true,
    });
  }
}