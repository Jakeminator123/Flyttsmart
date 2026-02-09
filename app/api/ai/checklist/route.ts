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
    const items = Array.isArray(parsed)
      ? parsed
      : parsed.checklist || parsed.items || [];

    return NextResponse.json({ items, source: "ai" });
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error("AI checklist error:", errMsg);

    // Fallback checklist if OpenAI is not available
    const body = await req.clone().json().catch(() => ({}));
    return NextResponse.json({
      items: getFallbackChecklist(body.moveDate),
      source: "fallback",
    });
  }
}

/**
 * Comprehensive static fallback checklist when AI is unavailable.
 * Uses moveDate to calculate realistic due dates.
 */
function getFallbackChecklist(moveDate?: string) {
  const move = moveDate ? new Date(moveDate) : new Date();
  const daysBefore = (n: number) => {
    const d = new Date(move);
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
  };
  const daysAfter = (n: number) => {
    const d = new Date(move);
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  };
  const moveDay = move.toISOString().split("T")[0];

  return [
    // > 1 month before
    {
      title: "Boka flyttfirma eller flyttbil",
      description:
        "Jämför priser från minst 3 företag och boka i god tid – populära datum går snabbt.",
      dueDate: daysBefore(35),
      category: "practical",
      sortOrder: 1,
    },
    {
      title: "Säga upp/överlåt nuvarande hyresavtal",
      description:
        "Kontakta hyresvärd. Uppsägningstid är oftast 3 månader för förstahandskontrakt.",
      dueDate: daysBefore(35),
      category: "administration",
      sortOrder: 2,
    },
    {
      title: "Inventera och rensa – sälj/skänk/släng",
      description:
        "Gå igenom varje rum. Sälj på Blocket/Marketplace, skänk till secondhand, boka grovavfall.",
      dueDate: daysBefore(30),
      category: "practical",
      sortOrder: 3,
    },
    // 1 month before
    {
      title: "Teckna eller flytta elavtal",
      description:
        "Kontakta elleverantör. Se till att el finns på nya adressen från inflyttningsdagen.",
      dueDate: daysBefore(28),
      category: "administration",
      sortOrder: 4,
    },
    {
      title: "Beställ bredband till nya adressen",
      description:
        "Leveranstid kan vara 2–4 veckor beroende på leverantör och fastighet.",
      dueDate: daysBefore(28),
      category: "administration",
      sortOrder: 5,
    },
    {
      title: "Uppdatera hemförsäkring",
      description:
        "Ändra adress, bostadstyp och yta. Ny bostad kan kräva annat skydd.",
      dueDate: daysBefore(25),
      category: "administration",
      sortOrder: 6,
    },
    {
      title: "Ordna parkeringstillstånd/garage",
      description:
        "Om nya bostaden har parkeringsplats – ansök eller skriv dig på kö.",
      dueDate: daysBefore(25),
      category: "administration",
      sortOrder: 7,
    },
    // 2 weeks before
    {
      title: "Skaffa flyttlådor och packmaterial",
      description:
        "Köp eller låna lådor, bubbelplast, tejp och märkpennor.",
      dueDate: daysBefore(14),
      category: "practical",
      sortOrder: 8,
    },
    {
      title: "Börja packa rum du inte använder dagligen",
      description:
        "Märk varje låda med rum och innehåll. Börja med förråd, garderober, bokhyllor.",
      dueDate: daysBefore(14),
      category: "practical",
      sortOrder: 9,
    },
    {
      title: "Boka flyttstädning av gamla bostaden",
      description:
        "Professionell flyttstädning kostar ca 2 000–5 000 kr. Boka tidigt.",
      dueDate: daysBefore(14),
      category: "cleaning",
      sortOrder: 10,
    },
    // 1 week before
    {
      title: "Gör flyttanmälan till Skatteverket",
      description:
        "Kan göras digitalt via skatteverket.se eller via Flytt.io. Anmäl senast flyttdagen.",
      dueDate: daysBefore(7),
      category: "administration",
      sortOrder: 11,
    },
    {
      title: "Anmäl eftersändning av post (Postnord)",
      description:
        "Kostar ca 299 kr och gäller i 12 månader. Gör det på postnord.se.",
      dueDate: daysBefore(7),
      category: "administration",
      sortOrder: 12,
    },
    {
      title: "Meddela arbetsgivare, skola, vårdcentral",
      description:
        "Uppdatera adress hos viktiga kontakter – jobb, vård, försäkringskassan.",
      dueDate: daysBefore(7),
      category: "administration",
      sortOrder: 13,
    },
    {
      title: "Packa det mesta – lämna bara det nödvändigaste framme",
      description:
        "Ha en separat väska med kläder, hygienartiklar och laddare för sista dagarna.",
      dueDate: daysBefore(7),
      category: "practical",
      sortOrder: 14,
    },
    // 3-4 days before
    {
      title: "Tömma och rengöra kyl och frys",
      description:
        "Ät upp det du kan, frys ner resten eller ge bort. Stäng av frys 24h innan flytt.",
      dueDate: daysBefore(4),
      category: "cleaning",
      sortOrder: 15,
    },
    {
      title: "Montera ner möbler och lampor",
      description:
        "Ta isär sängar, skrivbord och hyllor. Samla skruvar i märkta påsar.",
      dueDate: daysBefore(3),
      category: "practical",
      sortOrder: 16,
    },
    // 1 day before
    {
      title: "Sista packningen + städning av gamla bostaden",
      description:
        "Dubbelkolla alla skåp, förråd och källare. Torka av ytor.",
      dueDate: daysBefore(1),
      category: "cleaning",
      sortOrder: 17,
    },
    {
      title: "Förbered \"öppna först\"-låda",
      description:
        "Kaffe, koppar, toalettpapper, verktyg, laddare, handdukar, sängkläder.",
      dueDate: daysBefore(1),
      category: "practical",
      sortOrder: 18,
    },
    // Moving day
    {
      title: "Flyttdag – gör en sista genomgång",
      description:
        "Kontrollera alla rum, balkonger och förråd. Lämna nycklar till hyresvärd.",
      dueDate: moveDay,
      category: "practical",
      sortOrder: 19,
    },
    // After move
    {
      title: "Kontrollera att el, vatten och bredband fungerar",
      description:
        "Testa alla uttag, kranar och internetuppkoppling i nya bostaden.",
      dueDate: daysAfter(1),
      category: "post_move",
      sortOrder: 20,
    },
    {
      title: "Packa upp och organisera rum för rum",
      description:
        "Börja med kök och sovrum. Bryt ner lådor efterhand.",
      dueDate: daysAfter(3),
      category: "post_move",
      sortOrder: 21,
    },
    {
      title: "Besiktiga gamla bostaden med hyresvärd",
      description:
        "Boka tid för nyckelöverlämning och slutbesiktning.",
      dueDate: daysAfter(5),
      category: "post_move",
      sortOrder: 22,
    },
    {
      title: "Uppdatera adress hos banker, abonnemang och myndigheter",
      description:
        "Bank, Försäkringskassa, tandläkare, gym, streamingtjänster m.m.",
      dueDate: daysAfter(7),
      category: "administration",
      sortOrder: 23,
    },
  ];
}
