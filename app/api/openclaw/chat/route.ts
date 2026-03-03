import { NextRequest, NextResponse } from "next/server";
import {
  buildOpenClawSiteAccess,
  getOpenClawAgentId,
  getOpenClawGatewayBaseUrl,
  getOpenClawTokens,
  getModelForIntent,
} from "@/lib/openclaw/server-config";
import { extractOpenClawText } from "@/lib/openclaw/response";
import { enrichContext, FIELD_KNOWLEDGE } from "@/lib/aida/enrich";
import { parseDirectSuggestion } from "@/lib/aida/direct-suggestion";
import { classifyMessage, isGreetingOnlyMessage } from "@/lib/aida/classify";
import {
  runComparison,
  getActiveTaskKeys,
  type CompareResult,
} from "@/lib/comparison/compare";

const GATEWAY_BASE_URL = getOpenClawGatewayBaseUrl();
const AGENT_ID = getOpenClawAgentId();
const { gatewayToken: GATEWAY_TOKEN } = getOpenClawTokens();

// ─── Comparison pre-fetch ────────────────────────────────

async function prefetchComparisons(
  taskKeys: string[],
  formCtx: Record<string, string> | null,
): Promise<string> {
  if (taskKeys.length === 0 || !formCtx) return "";
  const toPostal = formCtx.toPostal;
  const toCity = formCtx.toCity;
  if (!toPostal && !toCity) return "";

  const activeKeys = new Set(getActiveTaskKeys());
  const activeTasks = taskKeys.filter((k) => activeKeys.has(k));
  if (activeTasks.length === 0) return "";

  const results: CompareResult[] = [];
  await Promise.all(
    activeTasks.map(async (taskKey) => {
      try {
        const r = await runComparison({
          taskKey,
          toPostal,
          toCity,
          moveDate: formCtx.moveDate,
          toStreet: formCtx.toStreet,
        });
        results.push(r);
      } catch { /* skip failed comparison */ }
    }),
  );

  if (results.length === 0) return "";

  const sections = results.map((r) => {
    const providerLines = r.providers
      .map(
        (p) =>
          `  - ${p.name}: ${p.price}` +
          (p.pros.length ? ` | Fordelar: ${p.pros.join(", ")}` : "") +
          (p.cons.length ? ` | Nackdelar: ${p.cons.join(", ")}` : ""),
      )
      .join("\n");
    return (
      `### ${r.category} (${r.taskKey}, mode: ${r.mode})\n` +
      `Sammanfattning: ${r.summary}\n` +
      (providerLines ? `Leverantörer:\n${providerLines}\n` : "") +
      (r.tip ? `Tips: ${r.tip}\n` : "") +
      (r.elArea ? `Elområde: ${r.elArea}\n` : "") +
      (r.sources.length ? `Källor: ${r.sources.join(", ")}` : "")
    );
  });

  return (
    "\n\n## Faktisk jämförelsedata (hämtad från Flytt.io API:er — använd BARA denna data, hitta INTE PÅ priser)\n\n" +
    sections.join("\n\n")
  );
}

// ─── System prompt (aligned with DID chat) ───────────────

function buildSystemMessage(
  formContext?: Record<string, unknown> | null,
  enrichedData?: string,
  siteAccess?: Record<string, unknown> | null
) {
  let base =
    "Du ar Aida, en hjalpsam svensk flyttassistent for Flytt.io. " +
    "Svara alltid pa svenska. Hjalp anvandaren med adressandring, flytt och relaterade fragor.\n\n" +
    "## Formularforslag (viktigt)\n" +
    "Nar anvandaren ber dig fylla i ett falt, ska du foresla varden via suggestion-block.\n" +
    "Svara med en kort forklaring + exakt detta format:\n" +
    "```suggestion\n" +
    "{\"firstName\":\"Jakob\"}\n" +
    "```\n" +
    "Tillatna faltnamn: firstName, lastName, personalNumber, fromStreet, fromPostal, fromCity, " +
    "toStreet, toPostal, toCity, apartmentNumber, propertyDesignation, propertyOwner, email, phone, moveDate.\n" +
    "Om anvandaren skriver naturligt sprak (t.ex. 'fyll i Jakob i fornamn'), mappa till korrekt faltnamn " +
    "(fornamn -> firstName) och returnera suggestion-block. Svara inte att du saknar mojlighet om faltet finns i listan.\n" +
    "Foreslå BARA falt du ar saker pa. Skriv en forklaring INNAN suggestion-blocket.\n\n" +
    "## Faltkunskap\n" + FIELD_KNOWLEDGE + "\n\n" +
    "## Jamforelsesystem\n" +
    "Systemet hamtar AUTOMATISKT jamforelsedata fran Flytt.io APIer nar anvandaren fragar om el, bredband, " +
    "forsakring, flyttfirma eller stadning. Resultaten visas under 'Faktisk jamforelsedata' nedan.\n" +
    "Vissa kategorier anvander dedikerade APIer: el fran elprisetjustnu.se (exakta spotpriser), " +
    "lokala flytt/stadfirmor fran Eniro (riktiga foretag med adress och telefon), " +
    "och bredband fran PTS bredbandskartlaggning (tillgangliga tekniker och operatorer per kommun). " +
    "Dessa markeras med 'mode: api' i datan nedan. Data fran api-laget ar verklig, inte uppskattningar.\n" +
    "VIKTIGT: Nar du svarar pa jamforelsefragor, anvand BARA data fran 'Faktisk jamforelsedata'. " +
    "HITTA INTE PA priser, leverantorer eller villkor. Om ingen jamforelsedata finns, " +
    "be anvandaren fylla i postnummer/ort forst sa data kan hamtas.\n\n" +
    "Elnatsomrade harlds automatiskt fran postnummer (SE1-SE4). " +
    "Namn alltid omradet nar el diskuteras, t.ex. 'Du tillhor elomrade SE3.'\n\n" +
    "## E-post-sammanfattning\n" +
    "Nar anvandaren ber om att fa ett mejl, en sammanfattning, eller en oversikt skickad:\n" +
    "1. Svara med en kort forklaring.\n" +
    "2. Inkludera ett email_request-block i EXAKT detta format:\n" +
    "```email_request\n" +
    "{\"to\":\"\",\"subject\":\"Sammanfattning av din flytt\",\"includeFields\":true,\"includeChecklist\":true}\n" +
    "```\n" +
    "Fyll i 'to' med anvandarens e-post om den finns i formularkontexten (email-faltet). Annars lamna tom.\n" +
    "Anvandaren far bekrafta innan mejlet skickas.\n\n" +
    "## Formularets steg-struktur\n" +
    "Formularet har 5 steg: 1) Identifiering (namn, personnummer, e-post, telefon), " +
    "2) Adresser (fran/till-adress), 3) Flyttdetaljer (datum, lagenhetsnr, fastighetsbeteckning), " +
    "4) Checklista (uppgifter att gora), 5) Bekrafta.\n" +
    "Anvandaren ser bara falt for det aktuella steget i DOM. " +
    "Falt fran tidigare steg ar SPARADE i sessionen och finns i formularkontexten nedan. " +
    "Anta INTE att falt saknas bara for att de inte syns — kolla hela kontexten.\n\n" +
    "## Proaktivt beteende\n" +
    "- Om du ser saknade falt i kontexten, paminn anvandaren och forklara vad de betyder.\n" +
    "- Om postnummer ar ifyllt och ort saknas, foreslå orten via suggestion-block (data finns i uppslagna data).\n" +
    "- Om toCity ar ifyllt, erbjud lokala tips och foreslå att jamfora el/bredband/forsakring.\n" +
    "- Vid jamforelsefragor, anvand BARA data fran 'Faktisk jamforelsedata'. Hitta INTE PA.\n" +
    "- Nar anvandaren fragar vad ett falt ar, forklara tydligt med exempel och var man hittar uppgiften.\n" +
    "- Om gatuadress och stad finns men postnummer saknas, har systemet AUTOMATISKT slagit upp postnumret " +
    "via Nominatim/OpenStreetMap. Resultatet finns i 'Auto-uppslaget postnummer' nedan. " +
    "Anvand det direkt — fraga INTE anvandaren om postnumret om det redan ar uppslaget.\n" +
    "- Nar du har postnummer (fran formularet ELLER auto-uppslaget), kor jamforelser direkt utan att fraga.\n\n" +
    "## Tillgangliga datakallor i denna session\n" +
    "- PAP: postnummer till ort/kommun\n" +
    "- Nominatim: adressvalidering och geodata\n" +
    "- Eniro: foretagslistor nara destinationen + lokala flytt/stadfirmor (mode: api)\n" +
    "- SCB: befolkningsdata per kommun\n" +
    "- PTS: bredbandsdata per kommun (tillgangliga tekniker, operatorer, fibertackning)\n" +
    "- Personuppslag (Ratsit/Biluppgifter/Merinfo): personnummer -> namn, adress, stad (koers automatiskt om personnummer finns men namn/adress saknas)";

  if (formContext) {
    base +=
      "\n\n## Formularkontext just nu\n" +
      JSON.stringify(formContext, null, 2);
  }

  if (enrichedData) {
    base += enrichedData;
  }

  if (siteAccess) {
    base +=
      "\n\nOm du behover besoka sajten bakom Vercel-skydd, anvand siteAccess:\n" +
      JSON.stringify(siteAccess, null, 2);
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

    const latestUserMessage = [...messages]
      .reverse()
      .find(
        (m: { role?: unknown; content?: unknown }) =>
          m &&
          m.role !== "assistant" &&
          typeof m.content === "string" &&
          m.content.trim()
      ) as { content: string } | undefined;

    const directSuggestion = latestUserMessage
      ? parseDirectSuggestion(latestUserMessage.content)
      : null;

    if (directSuggestion) {
      const suggestionBlock = JSON.stringify(
        { [directSuggestion.field]: directSuggestion.value },
        null,
        0
      );
      const directReply =
        `Absolut, jag föreslår ${directSuggestion.label} direkt.\n` +
        `\`\`\`suggestion\n${suggestionBlock}\n\`\`\``;

      return NextResponse.json({
        role: "assistant",
        content: directReply,
        provider: "openclaw-local-autofill",
        directSuggestion: {
          field: directSuggestion.field,
          value: directSuggestion.value,
        },
      });
    }

    if (latestUserMessage && isGreetingOnlyMessage(latestUserMessage.content)) {
      const greetingReply =
        "Hej! Jag är med. Säg bara vad du vill göra i flyttformuläret så hjälper jag direkt.";
      return NextResponse.json({
        role: "assistant",
        content: greetingReply,
        provider: "openclaw-local-greeting",
      });
    }

    if (!GATEWAY_BASE_URL) {
      return NextResponse.json({
        content:
          "Hej! Jag ar Aida, men jag ar inte helt konfigurerad annu. " +
          "Be administratoren satta OPENCLAW_GATEWAY_URL eller OPENCLAW_AGENT_URL i miljovariablerna.",
        role: "assistant",
      });
    }

    if (!GATEWAY_TOKEN) {
      return NextResponse.json({
        content:
          "Hej! Jag ar Aida, men jag saknar gateway-token. " +
          "Be administratoren satta OPENCLAW_GATEWAY_TOKEN (eller OPENCLAW_AGENT_TOKEN i enkel setup).",
        role: "assistant",
      });
    }

    const siteAccess = buildOpenClawSiteAccess(req);
    const chatUrl = `${GATEWAY_BASE_URL}/v1/chat/completions`;

    const { intent, comparisonTasks } = latestUserMessage
      ? classifyMessage(latestUserMessage.content)
      : { intent: "general" as const, comparisonTasks: [] as string[] };

    const formFields = formContext?.fields as Record<string, string> | undefined;

    let enrichedData: string | undefined;
    let comparisonData = "";

    const apiBaseUrl = req.nextUrl.origin;

    if (intent === "simple") {
      // Fast path: skip enrichment + comparison for simple knowledge questions
    } else if (intent === "comparison") {
      const [enrichResult, compResult] = await Promise.all([
        enrichContext(formContext, apiBaseUrl, latestUserMessage?.content),
        prefetchComparisons(comparisonTasks, formFields ?? null),
      ]);
      enrichedData = enrichResult?.text || undefined;
      comparisonData = compResult;
    } else {
      const enrichResult = await enrichContext(formContext, apiBaseUrl, latestUserMessage?.content);
      enrichedData = enrichResult?.text || undefined;
    }

    const openaiMessages = [
      { role: "system", content: buildSystemMessage(formContext, enrichedData, siteAccess) + comparisonData },
      ...messages.slice(-15).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const agentResponse = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "x-openclaw-agent-id": AGENT_ID,
      },
      body: JSON.stringify({
        model: getModelForIntent(intent),
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
          content: `Aida kunde inte svara just nu (${agentResponse.status}). Forsok igen om en stund.`,
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

    const reply = extractOpenClawText(data) || data?.content || "Inget svar fran agenten.";

    return NextResponse.json({
      content: reply,
      role: "assistant",
    });
  } catch (error) {
    console.error("[v0] OpenClaw chat proxy error:", error);
    return NextResponse.json(
      {
        content: "Ett fel uppstod i anslutningen till Aida. Forsok igen.",
      },
      { status: 500 }
    );
  }
}
