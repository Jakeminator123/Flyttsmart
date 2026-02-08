import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { CHECKLIST_SYSTEM } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { moveDate, scenario, hasChildren } = body;

    if (!moveDate) {
      return NextResponse.json(
        { error: "moveDate is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    const userPrompt = `Generate a moving checklist for:
- Move-in date: ${moveDate}
- Scenario: ${scenario || "apartment, single person"}
- Has children: ${hasChildren ? "yes" : "no"}

Return the checklist as a JSON array.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CHECKLIST_SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Empty AI response" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content);
    // The AI might wrap in { "checklist": [...] } or return bare array
    const items = Array.isArray(parsed) ? parsed : parsed.checklist || parsed.items || [];

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("AI checklist error:", error);

    // Fallback checklist if OpenAI is not available
    if (error.message?.includes("OPENAI_API_KEY")) {
      return NextResponse.json({
        items: getFallbackChecklist(req),
      });
    }

    return NextResponse.json(
      { error: "Checklist generation failed" },
      { status: 500 }
    );
  }
}

/**
 * Provides a static fallback checklist when AI is unavailable
 */
function getFallbackChecklist(_req: NextRequest) {
  const today = new Date();
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString().split("T")[0];
  };

  return [
    {
      title: "Boka flyttfirma eller flyttbil",
      description: "Jämför priser och boka i god tid.",
      dueDate: addDays(today, 7),
      category: "practical",
      sortOrder: 1,
    },
    {
      title: "Gör flyttanmälan till Skatteverket",
      description: "Ska göras senast 1 vecka efter flytt. Kan automatiseras via Flytt.io.",
      dueDate: addDays(today, 14),
      category: "administration",
      sortOrder: 2,
    },
    {
      title: "Teckna/flytta elavtal",
      description: "Se till att el finns på nya adressen från inflyttningsdagen.",
      dueDate: addDays(today, 10),
      category: "administration",
      sortOrder: 3,
    },
    {
      title: "Teckna/flytta hemförsäkring",
      description: "Uppdatera med ny adress och eventuellt ny bostadstyp.",
      dueDate: addDays(today, 10),
      category: "administration",
      sortOrder: 4,
    },
    {
      title: "Ordna bredband",
      description: "Beställ bredband i god tid, många leverantörer har lång väntetid.",
      dueDate: addDays(today, 14),
      category: "administration",
      sortOrder: 5,
    },
    {
      title: "Börja packa",
      description: "Börja med saker du inte använder dagligen.",
      dueDate: addDays(today, 21),
      category: "practical",
      sortOrder: 6,
    },
    {
      title: "Boka flyttstädning",
      description: "Boka professionell städning av gamla bostaden.",
      dueDate: addDays(today, 14),
      category: "cleaning",
      sortOrder: 7,
    },
    {
      title: "Kontrollera städning efter flytt",
      description: "Gå igenom gamla bostaden och kontrollera att allt är rent.",
      dueDate: addDays(today, 30),
      category: "post_move",
      sortOrder: 8,
    },
  ];
}
