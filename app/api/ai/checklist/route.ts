import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { CHECKLIST_SYSTEM } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
    const { moveDate, scenario, hasChildren, toCity } = body;

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
- Destination city: ${toCity || "unknown"}

${toCity ? `Include 3-5 area_tips items with helpful, local tips about ${toCity}. Mention real places if you can.` : "Skip area_tips category."}

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
    // The AI might wrap in { "checklist": [...] }, { "items": [...] }, { "data": [...] }, etc.
    // With response_format: json_object, it MUST be an object, so find the first array value.
    let items: Record<string, unknown>[];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      items =
        parsed.checklist ||
        parsed.items ||
        (Object.values(parsed).find((v) => Array.isArray(v)) as
          | Record<string, unknown>[]
          | undefined) ||
        [];
    }

    return NextResponse.json({ items, source: "ai" });
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error("AI checklist error:", errMsg);

    // Fallback checklist if OpenAI is not available
    return NextResponse.json({
      items: getFallbackChecklist(body.moveDate, body.toCity),
      source: "fallback",
    });
  }
}

// ── Compact fallback data: [title, description, dayOffset, category, sortOrder] ──
// dayOffset: negative = before move, 0 = moving day, positive = after move
type FallbackItem = [string, string, number, string, number];

const FALLBACK_DATA: FallbackItem[] = [
  ["Ta in offerter från flyttfirmor", "Jämför minst 3 företag. Boka i god tid.", -90, "practical", 1],
  ["Ta in offerter från städfirmor", "Begär offerter för flyttstädning.", -90, "practical", 2],
  ["Säg upp/teckna fjärrvärmeavtal", "Kontakta leverantör vid byte.", -90, "administration", 3],
  ["Säg upp/teckna vatten och avlopp", "Se över avtal – gäller främst villa.", -90, "administration", 4],
  ["Säg upp/teckna nytt bredband", "Leveranstid 2–4 veckor.", -35, "administration", 5],
  ["Ansök om ledighet på flyttdagen", "Prata med arbetsgivare i god tid.", -30, "practical", 6],
  ["Boka städfirma", "Ca 2 000–5 000 kr. Boka tidigt.", -30, "practical", 7],
  ["Boka vänner som flytthjälp", "Fråga vänner och familj.", -30, "practical", 8],
  ["Säg upp/ansök om ny parkering", "Ansök eller skriv dig på kö.", -30, "administration", 9],
  ["Beställ/avbeställ sophämtning", "Kontakta kommunen vid villaboende.", -28, "administration", 10],
  ["Boka flyttbil", "Om inte flyttfirma – boka hyrbil/släp.", -28, "practical", 11],
  ["Boka flyttfirma", "Välj bästa offert. Bekräfta datum.", -28, "practical", 12],
  ["Börja rensa", "Gå igenom varje rum. Sälj/skänk/återvinn.", -28, "practical", 13],
  ["Flytta elavtal (kan automatiseras via Flytt.io)", "Se till att el finns på nya adressen.", -28, "administration", 14],
  ["Organisera packningen", "Planera rum-för-rum. Märk lådor.", -28, "practical", 15],
  ["Skaffa flyttkartonger", "Köp/låna lådor, bubbelplast, tejp.", -28, "practical", 16],
  ["Säg upp/teckna ny hemförsäkring", "Ändra adress och bostadstyp.", -28, "administration", 17],
  ["Se över belysning – välj LED", "Kolla belysning i nya bostaden.", -28, "practical", 18],
  ["Börja grovpacka", "Packa rum du inte använder dagligen.", -14, "practical", 19],
  ["Flyttanmälan Skatteverket (kan automatiseras via Flytt.io)", "Anmäl senast en vecka efter flytten.", -14, "administration", 20],
  ["Sälj, skänk eller återvinn", "Blocket, Sellpy, secondhand.", -14, "practical", 21],
  ["Packa", "Lämna bara det nödvändigaste framme.", -7, "practical", 22],
  ["Planera lastning", "Tunga saker längst in, säkra med spännband.", -4, "practical", 23],
  ["Organisera flyttlass", "Bestäm ordning för möbler/lådor.", -4, "practical", 24],
  ["Slutpacka", "Dubbelkolla alla skåp och förråd.", -3, "practical", 25],
  ["Informera flytthjälp", "Berätta start, uppgifter och planering.", -1, "practical", 26],
  ["Fika och mat till flytteamet", "Frukt, nötter, vatten – håll humöret uppe!", -1, "practical", 27],
  ["Toalettpapper och tvål", "Ha tillgängligt direkt vid ankomst.", -1, "practical", 28],
  ["Sista genomgång", "Kontrollera alla rum, balkonger, förråd. Lämna nycklar.", 0, "practical", 29],
  ["Kontrollera städningen", "Gå igenom gamla bostaden.", 1, "post_move", 30],
  ["Energieffektivt boende", "Sänk temp 1 grad, LED, stäng av standby.", 1, "post_move", 31],
  ["Städa badrum", "Toalettstol, handfat, kakel, golvbrunn, spegel.", 1, "cleaning", 32],
  ["Städa kök", "Spis, fläkt, ugn, diskbänk, kylskåp, skåp.", 1, "cleaning", 33],
  ["Städa övriga rum", "Golv, garderober, dörrar, fönster, element.", 1, "cleaning", 34],
  ["Packa upp rum för rum", "Börja med kök och sovrum.", 3, "post_move", 35],
  ["Uppdatera adress", "Bank, Försäkringskassa, tandläkare, gym m.m.", 7, "administration", 36],
];

const AREA_TIPS: FallbackItem[] = [
  ["Utforska grannskapet", "Hitta matbutik, apotek och kollektivtrafik.", 1, "area_tips", 37],
  ["Hitta restaurang eller café", "Kolla Google Maps efter populära ställen.", 2, "area_tips", 38],
  ["Närmaste återvinningsstation", "Hitta FTI-station – du har mycket kartong.", 1, "area_tips", 39],
  ["Registrera dig hos vårdcentral", "Byt via 1177.se – tar bara minuter.", 7, "area_tips", 40],
];

function getFallbackChecklist(moveDate?: string, toCity?: string) {
  const move = moveDate ? new Date(moveDate) : new Date();
  const offset = (days: number) => {
    const d = new Date(move);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const items = FALLBACK_DATA.map(([title, description, days, category, sortOrder]) => ({
    title,
    description,
    dueDate: offset(days),
    category,
    sortOrder,
  }));

  for (const [title, description, days, category, sortOrder] of AREA_TIPS) {
    items.push({
      title: toCity ? `${title} i ${toCity}` : title,
      description,
      dueDate: offset(days),
      category,
      sortOrder,
    });
  }

  return items;
}
