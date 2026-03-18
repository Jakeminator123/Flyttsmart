import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

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
import {
  runExplicitWebSearch,
  shouldRunExplicitWebSearch,
} from "@/lib/aida/explicit-web-search";
import {
  classifyMessage,
  isGreetingOnlyMessage,
  isSiteCapabilitiesQuestion,
} from "@/lib/aida/classify";
import {
  runComparison,
  getActiveTaskKeys,
  type CompareResult,
} from "@/lib/comparison/compare";
import {
  pruneExpiredSessions,
  pushMessage,
  getHistory,
  hydrateFromClient,
  updateFormField,
  getFormContext,
} from "@/lib/did/session-store";
import { extractTokenUsage, trackUsage, type UsageFlow } from "@/lib/usage/tracker";

const DID_BRIDGE_SECRET = process.env.DID_BRIDGE_SECRET ?? "";
const MAX_SESSION_ID_CHARS = 120;
const MAX_USER_MESSAGE_CHARS = 2000;
const MAX_FORM_FIELDS_PER_REQUEST = 120;
const MAX_FORM_VALUE_CHARS = 300;
const MAX_HISTORY_ITEMS_FROM_CLIENT = 20;
const MAX_HISTORY_CONTENT_CHARS = 1500;

const GATEWAY_BASE_URL = getOpenClawGatewayBaseUrl();
const AGENT_ID = getOpenClawAgentId();
const { gatewayToken: GATEWAY_TOKEN } = getOpenClawTokens();
const GATEWAY_TIMEOUT_MS_RAW = Number(process.env.OPENCLAW_CHAT_TIMEOUT_MS ?? "25000");
const OPENCLAW_GATEWAY_TIMEOUT_MS =
  Number.isFinite(GATEWAY_TIMEOUT_MS_RAW) && GATEWAY_TIMEOUT_MS_RAW >= 5000
    ? GATEWAY_TIMEOUT_MS_RAW
    : 25000;

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}

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

// ─── Helpers ────────────────────────────────────────────

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-did-bridge-secret",
  };
}

function extractAuthSecret(req: NextRequest, body: Record<string, unknown>) {
  const headerSecret =
    req.headers.get("x-did-bridge-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const bodySecret = typeof body.secret === "string" ? body.secret : "";
  return headerSecret || bodySecret;
}

function extractUserMessage(body: Record<string, unknown>): string {
  const candidates = [
    body.message,
    body.text,
    body.input,
    (body as any)?.messages?.[(body as any)?.messages?.length - 1]?.content,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, MAX_USER_MESSAGE_CHARS);
    }
  }
  return "";
}

function extractFieldValue(body: Record<string, unknown>): string {
  return typeof body.fieldValue === "string"
    ? body.fieldValue.trim().slice(0, MAX_FORM_VALUE_CHARS)
    : "";
}

function sanitizeSessionId(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_SESSION_ID_CHARS);
}

function isSafeFormFieldName(value: string): boolean {
  return /^[a-zA-Z0-9_.:-]{1,64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function gatewayFlowFromIntent(intent: string): UsageFlow {
  if (intent === "simple") return "gateway_simple";
  if (intent === "comparison") return "gateway_comparison";
  return "gateway_general";
}

function buildSystemMessage(
  formContext?: Record<string, unknown> | null,
  enrichedData?: string | null,
  siteAccess?: Record<string, unknown> | null,
  mifContext?: Record<string, unknown> | null,
) {
  let base =
    "Du ar Aida, en hjalpsam flyttassistent for Flytt.io. " +
    "Svara pa samma sprak som anvandaren skriver eller talar. " +
    "Om anvandaren skriver pa engelska, svara pa engelska. Om svenska, svara pa svenska. " +
    "Standardsprak ar svenska om inget annat framgar.\n\n" +
    "Du pratar med anvandaren via en rost-avatar. Holl svaren korta och naturliga " +
    "– max 2-3 meningar. Undvik markdown-formatering, lankar och kodblock, " +
    "forutom suggestion-block nar du fyller formularfalt. " +
    "Svara som om du talar, inte skriver.\n\n" +
    "## Formularforslag (viktigt)\n" +
    "Nar anvandaren ber dig fylla i ett falt, ska du foresla varden via suggestion-block.\n" +
    "Svara med en kort forklaring + exakt detta format:\n" +
    "```suggestion\n" +
    "{\"firstName\":\"Jakob\"}\n" +
    "```\n" +
    "Tillatna faltnamn: firstName, lastName, personalNumber, fromStreet, fromPostal, fromCity, " +
    "toStreet, toPostal, toCity, apartmentNumber, propertyDesignation, propertyOwner, email, phone, moveDate.\n" +
    "Om anvandaren skriver naturligt sprak (t.ex. 'fyll i Jakob i fornamn'), mappa till korrekt faltnamn " +
    "(fornamn -> firstName) och returnera suggestion-block. Svara inte att du saknar mojlighet om faltet finns i listan.\n\n" +
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
    "Anvandaren far bekrafta innan mejlet skickas.\n" +
    "VIKTIGT: Sag ALDRIG 'mejl skickat', 'jag har mejlat', 'e-post skickat' eller liknande. " +
    "Du kan BARA foresla att skicka mejl via email_request-block. " +
    "Anvandaren maste sjalv trycka pa en bekraftelseknapp for att mejlet ska skickas. " +
    "Du har INGEN formaga att skicka mejl direkt.\n\n" +
    "## Formularets steg-struktur\n" +
    "Formularet har 4 steg: 1) Start och identifiering (namn, personnummer, e-post, telefon), " +
    "2) Adresser (fran/till-adress), 3) Flyttdetaljer (datum, lagenhetsnr, fastighetsbeteckning), " +
    "4) Bekrafta.\n" +
    "Anvandaren ser bara falt for det aktuella steget i DOM. " +
    "Falt fran tidigare steg ar SPARADE i sessionen och finns i formularkontexten nedan. " +
    "Checklistan ar inte langre ett eget steg i formularet utan skapas efter registrering och visas i dashboarden. " +
    "Anta INTE att falt saknas bara for att de inte syns — kolla hela kontexten.\n\n" +
    "## Proaktivt beteende\n" +
    "- Om du ser saknade falt i kontexten, paminn anvandaren.\n" +
    "- Om postnummer ar ifyllt och ort saknas, foreslå orten.\n" +
    "- Om toCity ar ifyllt, erbjud lokala tips och foreslå att jamfora el/bredband/forsakring.\n" +
    "- Vid jamforelsefragor (el, bredband, forsakring, flyttfirma, stadning), ge konkreta tips med leverantorsnamn.\n" +
    "- Sag ALDRIG att sessionen har kraschat, dog eller tappade data om det inte uttryckligen finns i kontexten.\n" +
    "- Om gatuadress och stad finns men postnummer saknas, har systemet AUTOMATISKT slagit upp postnumret " +
    "via Nominatim/OpenStreetMap. Resultatet finns i 'Auto-uppslaget postnummer' nedan. " +
    "Anvand det direkt — fraga INTE anvandaren om postnumret om det redan ar uppslaget.\n" +
    "- Nar du har postnummer (fran formularet ELLER auto-uppslaget), kor jamforelser direkt utan att fraga.\n" +
    "- Om anvandaren ber dig 'kolla upp' eller 'lista ut' nagot som redan finns i uppslagna data, " +
    "anvand den informationen direkt istallet for att be anvandaren repetera.\n\n" +
    "## Utokade befogenheter\n" +
    "Du har fulla befogenheter och far:\n" +
    "- Ge djupgaende, detaljerade svar nar fragan kraver det\n" +
    "- Anvanda ALL data fran formular och uppslagna data kreativt\n" +
    "- Ge konkreta rekommendationer med foretag, priser, telefonnummer\n" +
    "- Ge personliga asikter och detaljerade jamforelser\n" +
    "- Foreslå formularfalt via suggestion-block nar relevant\n\n" +
    "## Webbsokning\n" +
    "Om anvandaren uttryckligen ber dig 'soka pa natet', 'googla', 'web searcha' eller liknande, " +
    "sa gor systemet en riktig webbsokning via Brave Search at dig automatiskt. " +
    "Du behover INTE saga att du inte kan soka pa natet — systemet hanterar det. " +
    "Svara ALDRIG 'jag kan inte soka pa natet' om anvandaren ber dig. " +
    "Resultatet kommer tillbaka som ditt svar.\n\n" +
    "Tillgangliga API-datakallor (data som redan hamtats at dig):\n" +
    "- PAP (postnummer -> ort, kommun, lan, GPS) — anvand detta for att ge ortinfo, kommuninfo etc\n" +
    "- Eniro (foretagssokning nara destinationen: matbutiker, vardcentral, apotek, flyttfirmor) — verkliga foretag med adress och telefon\n" +
    "- Nominatim/OpenStreetMap (adressvalidering, geocoding)\n" +
    "- SCB (befolkningsstatistik per kommun)\n" +
    "- Personuppslag via Ratsit/Biluppgifter/Merinfo (personnummer -> namn, adress, stad)\n" +
    "- Brave Search (webbsokning — triggas automatiskt nar anvandaren ber om det)";

  if (mifContext) {
    base +=
      "\n\n## Mini-MIF status\n" +
      "Mini-MIF ar det snabba startsideflodet for personnummer eller fritext. Om Mini-MIF redan har hittat namn eller nuvarande adress far du inte fraga efter dem igen. " +
      "Efter ett personnummeruppslag ska du driva anvandaren mot blockerande SKV-falt i denna ordning: toStreet, toPostal/toCity, moveDate. " +
      "Om Mini-MIF bara lyckades delvis ska du forklara vad som saknas, inte starta om hela flodet.\n" +
      JSON.stringify(mifContext, null, 2);
  }

  if (formContext) {
    base +=
      "\n\n## Formularkontext just nu\n" + JSON.stringify(formContext, null, 2);
  }

  if (enrichedData) {
    base += enrichedData;
  }

  if (siteAccess) {
    base +=
      "\n\nOm du behover besoka sajten bakom Vercel-skydd, anvand:\n" +
      JSON.stringify(siteAccess, null, 2);
  }

  return base;
}

// ─── Route handlers ─────────────────────────────────────

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));

  try {
    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400, headers: corsHeaders },
        );
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: corsHeaders },
      );
    }
    const sameOriginRequest = req.headers.get("origin") === req.nextUrl.origin;

    if (DID_BRIDGE_SECRET && !sameOriginRequest) {
      const providedSecret = extractAuthSecret(req, body);
      if (!providedSecret || providedSecret !== DID_BRIDGE_SECRET) {
        return NextResponse.json(
          { error: "Unauthorized DID bridge request" },
          { status: 401, headers: corsHeaders },
        );
      }
    }

    const sessionId =
      sanitizeSessionId(body.sessionId) ||
      sanitizeSessionId(body.conversationId) ||
      `did-${crypto.randomUUID()}`;
    const mifContext = isRecord(body.mifContext) ? body.mifContext : null;

    // Accept bulk form context from client
    if (body.formContext && typeof body.formContext === "object") {
      let accepted = 0;
      for (const [k, v] of Object.entries(body.formContext as Record<string, unknown>)) {
        if (accepted >= MAX_FORM_FIELDS_PER_REQUEST) break;
        if (!isSafeFormFieldName(k)) continue;
        if (typeof v !== "string") continue;
        const safeValue = v.trim().slice(0, MAX_FORM_VALUE_CHARS);
        if (!safeValue) continue;
        updateFormField(sessionId, k, safeValue);
        accepted += 1;
      }
    }

    if (isRecord(mifContext?.fields)) {
      let accepted = 0;
      for (const [k, v] of Object.entries(mifContext.fields)) {
        if (accepted >= MAX_FORM_FIELDS_PER_REQUEST) break;
        if (!isSafeFormFieldName(k)) continue;
        if (typeof v !== "string") continue;
        const safeValue = v.trim().slice(0, MAX_FORM_VALUE_CHARS);
        if (!safeValue) continue;
        updateFormField(sessionId, k, safeValue);
        accepted += 1;
      }
    }

    // Rehydrate server history from client on cold start
    if (Array.isArray(body.clientHistory)) {
      const safe = (body.clientHistory as unknown[])
        .slice(-MAX_HISTORY_ITEMS_FROM_CLIENT)
        .filter(
          (m): m is { role: string; content: string } =>
            typeof m === "object" &&
            m !== null &&
            typeof (m as any).role === "string" &&
            typeof (m as any).content === "string",
        )
        .map(({ role, content }) => ({
          role,
          content: content.trim().slice(0, MAX_HISTORY_CONTENT_CHARS),
        }))
        .filter(({ content }) => content.length > 0);
      if (safe.length > 0) hydrateFromClient(sessionId, safe);
    }

    pruneExpiredSessions();

    const eventType = typeof body.eventType === "string" ? body.eventType : "";

    // ── Form sync (context-only, no chat response) ───
    if (eventType === "form_sync") {
      return NextResponse.json(
        { ok: true, mode: "form_sync", sessionId },
        { headers: corsHeaders },
      );
    }

    // ── Field blur event ──────────────────────────────
    if (eventType === "field_blur") {
      const fieldName =
        (typeof body.fieldName === "string" && body.fieldName) || "field";
      const fieldValue = extractFieldValue(body);

      if (fieldValue) updateFormField(sessionId, fieldName, fieldValue);
      return NextResponse.json(
        { ok: true, mode: "field_blur", shouldSpeak: false, sessionId, fieldName },
        { headers: corsHeaders },
      );
    }

    // ── Chat message ──────────────────────────────────
    const userMessage = extractUserMessage(body);
    if (!userMessage) {
      return NextResponse.json(
        { error: "message/text/input is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (isGreetingOnlyMessage(userMessage)) {
      const greetingReply =
        "Hej! Jag är med. Säg bara var du vill ha guidning i flyttflödet så hjälper jag direkt.";
      pushMessage(sessionId, "user", userMessage);
      pushMessage(sessionId, "assistant", greetingReply);
      return NextResponse.json(
        {
          role: "assistant",
          provider: "did-local-greeting",
          agentId: AGENT_ID,
          sessionId,
          reply: greetingReply,
          content: greetingReply,
          text: greetingReply,
        },
        { headers: corsHeaders },
      );
    }

    if (isSiteCapabilitiesQuestion(userMessage)) {
      const capabilitiesReply =
        "Här kan du göra din flyttanmälan steg för steg, få hjälp med formulärfälten och sedan fortsätta till dashboard med checklista, påminnelser och jämförelser. Jag kan guida dig genom varje steg och hjälpa dig vidare om du kör fast.";
      pushMessage(sessionId, "user", userMessage);
      pushMessage(sessionId, "assistant", capabilitiesReply);
      return NextResponse.json(
        {
          role: "assistant",
          provider: "did-local-capabilities",
          agentId: AGENT_ID,
          sessionId,
          reply: capabilitiesReply,
          content: capabilitiesReply,
          text: capabilitiesReply,
        },
        { headers: corsHeaders },
      );
    }

    if (shouldRunExplicitWebSearch(userMessage)) {
      pushMessage(sessionId, "user", userMessage);
      try {
        const searchReply =
          (await runExplicitWebSearch(userMessage, {
            route: "/api/did/chat",
            sessionId,
          })) ||
          "Jag kunde inte fa fram nagot tydligt webbsokresultat just nu. Forsok igen med en mer specifik fraga.";
        pushMessage(sessionId, "assistant", searchReply);
        return NextResponse.json(
          {
            role: "assistant",
            provider: "did-local-web-search",
            agentId: AGENT_ID,
            sessionId,
            reply: searchReply,
            content: searchReply,
            text: searchReply,
          },
          { headers: corsHeaders },
        );
      } catch (error) {
        const searchError =
          error instanceof Error ? error.message : "Webbsokning misslyckades";
        const fallback =
          "Jag kunde inte gora webbsokningen just nu. Forsok igen om en liten stund.";
        pushMessage(sessionId, "assistant", fallback);
        return NextResponse.json(
          {
            role: "assistant",
            provider: "did-local-web-search-fallback",
            agentId: AGENT_ID,
            sessionId,
            error: searchError,
            reply: fallback,
            content: fallback,
            text: fallback,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // ── Deterministic autofill fallback ───────────────
    // Handles direct commands like "fyll i Jakob i fornamn"
    // even if the model forgets to emit suggestion blocks.
    const directSuggestion = parseDirectSuggestion(userMessage);
    if (directSuggestion) {
      updateFormField(sessionId, directSuggestion.field, directSuggestion.value);
      const suggestionBlock = JSON.stringify(
        { [directSuggestion.field]: directSuggestion.value },
        null,
        0,
      );
      const directReply =
        `Absolut, jag fyller i ${directSuggestion.label}.\n` +
        `\`\`\`suggestion\n${suggestionBlock}\n\`\`\``;

      pushMessage(sessionId, "user", userMessage);
      pushMessage(sessionId, "assistant", directReply);

      return NextResponse.json(
        {
          role: "assistant",
          provider: "did-local-autofill",
          agentId: AGENT_ID,
          sessionId,
          reply: directReply,
          content: directReply,
          text: directReply,
          directSuggestion: {
            field: directSuggestion.field,
            value: directSuggestion.value,
          },
        },
        { headers: corsHeaders },
      );
    }

    if (!GATEWAY_BASE_URL || !GATEWAY_TOKEN) {
      return NextResponse.json(
        {
          error:
            "OpenClaw gateway is not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN.",
        },
        { status: 503, headers: corsHeaders },
      );
    }

    pushMessage(sessionId, "user", userMessage);

    let formCtx = getFormContext(sessionId);
    const siteAccess = buildOpenClawSiteAccess(req);

    const { intent, comparisonTasks } = classifyMessage(userMessage);

    let enrichedText: string | null = null;
    let comparisonData = "";

    if (intent === "simple") {
      // Fast path: skip enrichment + comparison for knowledge questions / greetings
    } else if (intent === "comparison" && formCtx) {
      const apiBaseUrl = req.nextUrl.origin;
      const [enrichResult, compResult] = await Promise.all([
        enrichContext({ fields: formCtx }, apiBaseUrl, userMessage),
        prefetchComparisons(comparisonTasks, formCtx),
      ]);
      enrichedText = enrichResult?.text || null;
      comparisonData = compResult;
      if (enrichResult?.resolvedFields) {
        for (const [k, v] of Object.entries(enrichResult.resolvedFields)) {
          if (v) updateFormField(sessionId, k, v);
        }
        if (Object.keys(enrichResult.resolvedFields).length > 0) {
          formCtx = getFormContext(sessionId);
        }
      }
    } else {
      const apiBaseUrl = req.nextUrl.origin;
      const enrichResult = await enrichContext(
        { fields: formCtx ?? {} },
        apiBaseUrl,
        userMessage
      );
      enrichedText = enrichResult?.text || null;
      if (enrichResult?.resolvedFields) {
        for (const [k, v] of Object.entries(enrichResult.resolvedFields)) {
          if (v) updateFormField(sessionId, k, v);
        }
        if (Object.keys(enrichResult.resolvedFields).length > 0) {
          formCtx = getFormContext(sessionId);
        }
      }
    }

    const history = getHistory(sessionId);
    const openaiMessages = [
      {
        role: "system",
        content: buildSystemMessage(formCtx, enrichedText, siteAccess, mifContext) + comparisonData,
      },
      ...history,
    ];

    const chatModel = getModelForIntent(intent);
    const gatewayFlow = gatewayFlowFromIntent(intent);
    const gatewayStarted = Date.now();

    async function callGateway(msgs: Array<{ role: string; content: string }>) {
      const timeoutSignal =
        typeof (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout === "function"
          ? (AbortSignal as { timeout: (ms: number) => AbortSignal }).timeout(OPENCLAW_GATEWAY_TIMEOUT_MS)
          : undefined;
      const res = await fetch(`${GATEWAY_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GATEWAY_TOKEN}`,
          "x-openclaw-agent-id": AGENT_ID,
        },
        body: JSON.stringify({
          model: chatModel,
          stream: false,
          user: sessionId,
          messages: msgs,
        }),
        signal: timeoutSignal,
      });
      return res;
    }

    let gatewayResponse = await callGateway(openaiMessages);

    if (!gatewayResponse.ok) {
      const detail = await gatewayResponse.text().catch(() => "");
      console.error(
        `[DID/OpenClaw] gateway ${gatewayResponse.status}: ${detail.slice(0, 300)}`,
      );

      if (gatewayResponse.status >= 500 || gatewayResponse.status === 429) {
        console.warn("[DID/OpenClaw] retrying with shorter context...");
        await new Promise((r) => setTimeout(r, 1500));
        const shortMessages = [
          openaiMessages[0],
          ...openaiMessages.slice(-3),
        ];
        gatewayResponse = await callGateway(shortMessages);
      }

      if (!gatewayResponse.ok) {
        const retryDetail = await gatewayResponse.text().catch(() => "");
        trackUsage({
          provider: "openclaw_gateway",
          flow: gatewayFlow,
          route: "/api/did/chat",
          model: chatModel,
          sessionId,
          durationMs: Date.now() - gatewayStarted,
          ok: false,
        });
        return NextResponse.json(
          {
            error: "OpenClaw gateway request failed",
            status: gatewayResponse.status,
            detail: retryDetail,
            reply: `Aida kunde inte svara just nu (${gatewayResponse.status}). Försök igen.`,
            content: `Aida kunde inte svara just nu (${gatewayResponse.status}). Försök igen.`,
            text: `Aida kunde inte svara just nu (${gatewayResponse.status}). Försök igen.`,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    const gatewayJson = await gatewayResponse.json().catch(() => null);
    const gatewayUsage = extractTokenUsage((gatewayJson as any)?.usage);
    trackUsage({
      provider: "openclaw_gateway",
      flow: gatewayFlow,
      route: "/api/did/chat",
      model: chatModel,
      sessionId,
      inputTokens: gatewayUsage.inputTokens,
      outputTokens: gatewayUsage.outputTokens,
      totalTokens: gatewayUsage.totalTokens,
      durationMs: Date.now() - gatewayStarted,
      ok: true,
    });
    let reply = extractOpenClawText(gatewayJson);

    if (!reply) {
      console.warn(
        "[DID/OpenClaw] empty response from gateway, raw:",
        JSON.stringify(gatewayJson)?.slice(0, 500),
      );
      reply = "Förlåt, jag kunde inte formulera ett svar just nu. Kan du ställa frågan igen?";
    }

    pushMessage(sessionId, "assistant", reply);

    return NextResponse.json(
      {
        role: "assistant",
        provider: "openclaw",
        agentId: AGENT_ID,
        sessionId,
        reply,
        content: reply,
        text: reply,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json(
        {
          error: "OpenClaw gateway timeout",
          reply: "Aida tog för lång tid att svara. Försök igen direkt så fortsätter vi.",
          content: "Aida tog för lång tid att svara. Försök igen direkt så fortsätter vi.",
          text: "Aida tog för lång tid att svara. Försök igen direkt så fortsätter vi.",
        },
        { status: 504, headers: corsHeaders },
      );
    }
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[DID/OpenClaw] bridge error:", detail, error);
    return NextResponse.json(
      {
        error: `Aida stötte på ett internt fel: ${detail}`,
        reply: `Något gick fel på serversidan. Försök igen om en stund.`,
        content: `Något gick fel på serversidan. Försök igen om en stund.`,
        text: `Något gick fel på serversidan. Försök igen om en stund.`,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
