import { NextRequest, NextResponse } from "next/server";
import {
  buildOpenClawSiteAccess,
  getOpenClawAgentId,
  getOpenClawChatModel,
  getOpenClawGatewayBaseUrl,
  getOpenClawTokens,
} from "@/lib/openclaw/server-config";
import { extractOpenClawText } from "@/lib/openclaw/response";
import { enrichContext, FIELD_KNOWLEDGE } from "@/lib/aida/enrich";
import { parseDirectSuggestion } from "@/lib/aida/direct-suggestion";
import {
  pruneExpiredSessions,
  pushMessage,
  getHistory,
  updateFormField,
  getFormContext,
  unlockSession,
  isUnlocked,
  getUnlockTimeLeft,
} from "@/lib/did/session-store";

const DID_BRIDGE_SECRET = process.env.DID_BRIDGE_SECRET ?? "";
const TEST_TAL_ENABLED = (process.env.TEST_TAL ?? "").toLowerCase() === "y";

const DEFAULT_UNLOCK_PASSPHRASE = "ulf-lundell_platon";

function resolveUnlockPassphrase(rawValue: string | undefined): string[] {
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  const source =
    trimmed.length > 0
      ? trimmed
      : rawValue === undefined
        ? DEFAULT_UNLOCK_PASSPHRASE
        : "";

  return source
    .split("_")
    .map((word) => word.trim().replace(/-/g, " ").toLowerCase())
    .filter(Boolean);
}

const UNLOCK_PASSPHRASE = resolveUnlockPassphrase(process.env.DID_CLAW_UNLOCK);

const UNLOCK_GREETING =
  "Öppna landskap, jag vill känna vinden från havet, jag vill se horisonten... " +
  "Du har nu 7 minuter med utökade befogenheter. Fråga mig vad som helst.";

function matchesPassphrase(message: string): boolean {
  if (UNLOCK_PASSPHRASE.length === 0) return false;
  const lower = message.toLowerCase();
  return UNLOCK_PASSPHRASE.every((phrase) => lower.includes(phrase));
}

const GATEWAY_BASE_URL = getOpenClawGatewayBaseUrl();
const AGENT_ID = getOpenClawAgentId();
const CHAT_MODEL = getOpenClawChatModel(AGENT_ID);
const { gatewayToken: GATEWAY_TOKEN } = getOpenClawTokens();

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
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractFieldValue(body: Record<string, unknown>): string {
  return typeof body.fieldValue === "string" ? body.fieldValue.trim() : "";
}

function toLastWord(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words[words.length - 1] ?? "";
}

function buildSystemMessage(
  formContext?: Record<string, unknown> | null,
  enrichedData?: string | null,
  siteAccess?: Record<string, unknown> | null,
  unlocked?: { active: boolean; secondsLeft: number },
) {
  let base =
    "Du ar Aida, en hjalpsam svensk flyttassistent for Flytt.io. " +
    "Svara alltid pa svenska, kort och tydligt. Hjalp anvandaren med flytt, adressandring och checklistor.\n\n" +
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
    "Sajten har ett jamforelseverktyg (/api/compare/{taskKey}) som kan hamta live-data.\n" +
    "Aktiva jamforelser (live web search): electricity_contract, broadband_order_install, " +
    "home_insurance, movers_or_trailer, cleaning_service.\n" +
    "Stubbade (hints, ej live): storage_gap, broadband_tech_check, mail_forwarding.\n\n" +
    "Nar anvandaren fragar 'jamfor bredband', 'vilken el ar billigast', 'behover jag flyttfirma' " +
    "eller liknande: ge ett konkret svar med leverantorsnamn och ungefärliga priser " +
    "om data finns i uppslagna data (enrichment). Annars sammanfatta vad checklistan rekommenderar.\n\n" +
    "Elnatsomrade harlds automatiskt fran postnummer (SE1-SE4). " +
    "Nämn alltid omradet nar el diskuteras, t.ex. 'Du tillhor elomrade SE3.'\n\n" +
    "## E-post-sammanfattning\n" +
    "Nar anvandaren ber om att fa ett mejl, en sammanfattning, eller en oversikt skickad:\n" +
    "1. Svara med en kort forklaring.\n" +
    "2. Inkludera ett email_request-block i EXAKT detta format:\n" +
    "```email_request\n" +
    "{\"to\":\"\",\"subject\":\"Sammanfattning av din flytt\",\"includeFields\":true,\"includeChecklist\":true}\n" +
    "```\n" +
    "Fyll i 'to' med anvandarens e-post om den finns i formularkontexten (email-faltet). Annars lamna tom.\n" +
    "Anvandaren far bekrafta innan mejlet skickas.\n\n" +
    "## Proaktivt beteende\n" +
    "- Om du ser saknade falt i kontexten, paminn anvandaren.\n" +
    "- Om postnummer ar ifyllt och ort saknas, foreslå orten.\n" +
    "- Om toCity ar ifyllt, erbjud lokala tips och foreslå att jamfora el/bredband/forsakring.\n" +
    "- Vid jamforelsefragor (el, bredband, forsakring, flyttfirma, stadning), ge konkreta tips med leverantorsnamn.";

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

  if (unlocked?.active) {
    const mins = Math.ceil(unlocked.secondsLeft / 60);
    base +=
      "\n\n## UTOKAD ACCESS (aktivt i " + mins + " minuter till)\n" +
      "Du har tillfalligt utokade befogenheter. Anvandaren har last upp dig via en hemlig fras.\n" +
      "Du far nu:\n" +
      "- Ge djupgaende, detaljerade svar utan langdbegransning\n" +
      "- Anvanda ALL data fran formular och uppslagna data kreativt\n" +
      "- Ge konkreta rekommendationer med foretag, priser, telefonnummer\n" +
      "- Diskutera ALLA amnen fritt (inte bara flytt)\n" +
      "- Ge personliga asikter och detaljerade jamforelser\n" +
      "- Foreslå formularfalt via suggestion-block nar relevant\n\n" +
      "Tillgangliga API-datakallor (data som redan hamtats at dig):\n" +
      "- PAP (postnummer -> ort, kommun, lan, GPS) — data finns i uppslagna data ovan\n" +
      "- Eniro (foretagssokning, matbutiker, vardcentral, apotek) — data finns i uppslagna data\n" +
      "- Nominatim/OpenStreetMap (adressvalidering, geocoding) — data finns i uppslagna data\n" +
      "- SCB (befolkningsstatistik per kommun) — data finns i uppslagna data\n\n" +
      "Var generoes, kreativ och hjalpsam. Begransningen pa 2-3 meningar ar upphavd.";
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
    const body = (await req.json()) as Record<string, unknown>;
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
      (typeof body.sessionId === "string" && body.sessionId) ||
      (typeof body.conversationId === "string" && body.conversationId) ||
      `did-${crypto.randomUUID()}`;

    // Accept bulk form context from client
    if (body.formContext && typeof body.formContext === "object") {
      for (const [k, v] of Object.entries(body.formContext as Record<string, unknown>)) {
        if (typeof v === "string") updateFormField(sessionId, k, v);
      }
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

      if (!TEST_TAL_ENABLED) {
        return NextResponse.json(
          { ok: true, mode: "test_tal_disabled", shouldSpeak: false, sessionId },
          { headers: corsHeaders },
        );
      }

      const lastWord = toLastWord(fieldValue);
      if (!lastWord) {
        return NextResponse.json(
          { ok: true, mode: "empty_value", shouldSpeak: false, sessionId },
          { headers: corsHeaders },
        );
      }

      return NextResponse.json(
        {
          role: "assistant",
          provider: "did-test-tal",
          agentId: AGENT_ID,
          sessionId,
          fieldName,
          reply: lastWord,
          content: lastWord,
          text: lastWord,
          shouldSpeak: true,
          mode: "test_tal_echo",
        },
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

    // ── Easter egg: unlock extended mode ────────────
    if (matchesPassphrase(userMessage)) {
      unlockSession(sessionId);
      pushMessage(sessionId, "user", userMessage);
      pushMessage(sessionId, "assistant", UNLOCK_GREETING);
      return NextResponse.json(
        {
          role: "assistant",
          provider: "openclaw",
          agentId: AGENT_ID,
          sessionId,
          reply: UNLOCK_GREETING,
          content: UNLOCK_GREETING,
          text: UNLOCK_GREETING,
          unlocked: true,
        },
        { headers: corsHeaders },
      );
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

    const formCtx = getFormContext(sessionId);
    const enrichedData = formCtx ? await enrichContext({ fields: formCtx }) : null;
    const siteAccess = buildOpenClawSiteAccess(req);

    const unlocked = isUnlocked(sessionId)
      ? { active: true, secondsLeft: getUnlockTimeLeft(sessionId) }
      : undefined;

    const history = getHistory(sessionId);
    const openaiMessages = [
      { role: "system", content: buildSystemMessage(formCtx, enrichedData, siteAccess, unlocked) },
      ...history,
    ];

    const gatewayResponse = await fetch(`${GATEWAY_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "x-openclaw-agent-id": AGENT_ID,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        stream: false,
        user: sessionId,
        messages: openaiMessages,
      }),
    });

    if (!gatewayResponse.ok) {
      const detail = await gatewayResponse.text().catch(() => "");
      return NextResponse.json(
        {
          error: "OpenClaw gateway request failed",
          status: gatewayResponse.status,
          detail,
        },
        { status: 502, headers: corsHeaders },
      );
    }

    const gatewayJson = await gatewayResponse.json().catch(() => null);
    const reply =
      extractOpenClawText(gatewayJson) ?? "Aida kunde inte generera ett svar.";

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
    console.error("[DID/OpenClaw] bridge error:", error);
    return NextResponse.json(
      { error: "Invalid DID bridge request" },
      { status: 400, headers: corsHeaders },
    );
  }
}
