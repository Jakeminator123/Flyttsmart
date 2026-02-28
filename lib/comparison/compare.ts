import { getOpenAIClient } from "@/lib/ai/openai";
import { postalToElArea } from "./elarea";
import { electricityApiHandler } from "./providers/electricity";
import { moversApiHandler, cleaningApiHandler } from "./providers/local-services";
import { broadbandApiHandler } from "./providers/broadband";

const WEB_SEARCH_ENABLED =
  (process.env.WEB_SEARCH_COMPARE ?? "").trim().toLowerCase() === "y";

const COMPARE_MODEL = process.env.COMPARE_MODEL ?? "gpt-4.1-mini";

const ENABLED_TASKS_RAW = (process.env.COMPARE_TASKS_ENABLED ?? "").trim();

export interface CompareInput {
  taskKey: string;
  toPostal?: string;
  toCity?: string;
  moveDate?: string;
  toStreet?: string;
}

export interface CompareProvider {
  name: string;
  price: string;
  pros: string[];
  cons: string[];
  url?: string;
}

export interface CompareResult {
  taskKey: string;
  category: string;
  summary: string;
  providers: CompareProvider[];
  tip: string;
  sources: string[];
  cached: boolean;
  mode: "web_search" | "stub" | "api";
  elArea?: string;
}

const COMPARE_CACHE = new Map<string, { data: CompareResult; ts: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

type TaskMode = "web_search" | "stub" | "api";

type TaskConfig = {
  category: string;
  defaultMode: TaskMode;
  searchQuery: (input: CompareInput, extra?: { elArea?: string }) => string;
  systemPrompt: string;
  stubSummary: string;
  stubHints: string[];
  apiHandler?: (input: CompareInput, elArea?: string) => Promise<CompareResult | null>;
};

export type CompareTaskAdminInfo = {
  taskKey: string;
  category: string;
  defaultMode: TaskMode;
  resolvedMode: TaskMode;
  stubHints: string[];
};

const ALL_TASKS: Record<string, TaskConfig> = {
  electricity_contract: {
    category: "El",
    defaultMode: "web_search",
    searchQuery: (input, extra) => {
      const area = extra?.elArea ? ` elomrade ${extra.elArea}` : "";
      return `billigaste elavtal ${input.toCity || "Sverige"}${area} ${new Date().getFullYear()} jamforelse rorligt fast pris`;
    },
    systemPrompt:
      "Du ar en svensk expert pa elavtal. " +
      "Returnera ENBART giltig JSON (ingen markdown, inga kodblock). " +
      'Format: {"summary":"kort sammanfattning","providers":[{"name":"...","price":"...","pros":["..."],"cons":["..."],"url":"..."}],"tip":"ett konkret tips","sources":["url1","url2"]}. ' +
      "Ge 3-5 leverantorer med aktuella priser for det relevanta elomradet. " +
      "Svara pa svenska.",
    stubSummary: "Jamfor elavtal: rorligt eller fast pris, paslag och bindningstid.",
    stubHints: ["Rorligt eller fast", "Paslag", "Bindningstid"],
    apiHandler: electricityApiHandler,
  },
  broadband_order_install: {
    category: "Bredband",
    defaultMode: "web_search",
    searchQuery: (input) =>
      `basta bredband ${input.toCity || "Sverige"} ${input.toPostal || ""} ${new Date().getFullYear()} jamforelse fiber pris`,
    systemPrompt:
      "Du ar en svensk bredbandsexpert. " +
      "Returnera ENBART giltig JSON (ingen markdown, inga kodblock). " +
      'Format: {"summary":"kort sammanfattning","providers":[{"name":"...","price":"...","pros":["..."],"cons":["..."],"url":"..."}],"tip":"ett konkret tips","sources":["url1","url2"]}. ' +
      "Ge 3-5 bredbandsalternativ med pris, hastighet och bindningstid. " +
      "Fokusera pa tillganglighet for adressen/omradet om postnummer anges. " +
      "Svara pa svenska.",
    stubSummary: "Jamfor bredband: pris efter kampanj, bindningstid och routerkostnad.",
    stubHints: ["Pris efter kampanj", "Bindningstid", "Routerkostnad"],
    apiHandler: broadbandApiHandler,
  },
  home_insurance: {
    category: "Hemforsakring",
    defaultMode: "web_search",
    searchQuery: (input) =>
      `hemforsakring jamforelse ${input.toCity || "Sverige"} ${new Date().getFullYear()} basta pris lagenhet villa`,
    systemPrompt:
      "Du ar en svensk forsakringsradgivare. " +
      "Returnera ENBART giltig JSON (ingen markdown, inga kodblock). " +
      'Format: {"summary":"kort sammanfattning","providers":[{"name":"...","price":"...","pros":["..."],"cons":["..."],"url":"..."}],"tip":"ett konkret tips","sources":["url1","url2"]}. ' +
      "Ge 3-5 hemforsakringsalternativ med pris, sjalvrisk och skyddsniva. " +
      "Svara pa svenska.",
    stubSummary: "Jamfor hemforsakring: bostadstyp, sjalvrisk och drulle/skyddsniva.",
    stubHints: ["Bostadstyp och boarea", "Sjalvrisk", "Drulle/skyddsniva"],
  },
  movers_or_trailer: {
    category: "Flyttfirma",
    defaultMode: "web_search",
    searchQuery: (input) =>
      `basta flyttfirma ${input.toCity || "Sverige"} ${new Date().getFullYear()} pris jamforelse omdome`,
    systemPrompt:
      "Du ar en svensk expert pa flyttjanster. " +
      "Returnera ENBART giltig JSON (ingen markdown, inga kodblock). " +
      'Format: {"summary":"kort sammanfattning","providers":[{"name":"...","price":"...","pros":["..."],"cons":["..."],"url":"..."}],"tip":"ett konkret tips","sources":["url1","url2"]}. ' +
      "Ge 3-5 flyttfirmor med timpris eller fast pris, forsakring och omdomen. " +
      "Svara pa svenska.",
    stubSummary: "Jamfor flyttfirma: timpris eller fast pris, forsakring och omdomen.",
    stubHints: ["Flyttfirma: timpris eller fast pris", "Forsakring", "Omdomen"],
    apiHandler: moversApiHandler,
  },
  cleaning_service: {
    category: "Flyttstadning",
    defaultMode: "web_search",
    searchQuery: (input) =>
      `basta flyttstadning ${input.toCity || "Sverige"} ${new Date().getFullYear()} pris garanti RUT-avdrag`,
    systemPrompt:
      "Du ar en svensk expert pa flyttstadning. " +
      "Returnera ENBART giltig JSON (ingen markdown, inga kodblock). " +
      'Format: {"summary":"kort sammanfattning","providers":[{"name":"...","price":"...","pros":["..."],"cons":["..."],"url":"..."}],"tip":"ett konkret tips","sources":["url1","url2"]}. ' +
      "Ge 3-5 stadfirmor med pris, garanti, RUT-avdragsmojlighet och vad som ingar. " +
      "Svara pa svenska.",
    stubSummary: "Jamfor stadfirmor: pris, garanti och vad som ingar.",
    stubHints: ["Stadfirma: pris", "Garanti", "Vad som ingar"],
    apiHandler: cleaningApiHandler,
  },

  storage_gap: {
    category: "Magasinering",
    defaultMode: "stub",
    searchQuery: (input) =>
      `magasinering ${input.toCity || "Sverige"} pris`,
    systemPrompt: "",
    stubSummary: "Jamfor magasinering: storlek (m3), klimatkontroll och forsakring.",
    stubHints: ["Magasinering: m3", "Klimatkontroll", "Forsakring"],
  },
  broadband_tech_check: {
    category: "Bredbandsteknik",
    defaultMode: "stub",
    searchQuery: (input) =>
      `bredband teknik ${input.toPostal || ""} ${input.toCity || "Sverige"}`,
    systemPrompt: "",
    stubSummary: "Kontrollera tillgangliga leverantorer, installationstid och Wi-Fi 6-stod pa din nya adress.",
    stubHints: ["Tillgangliga leverantorer pa adressen", "Installationstid", "Stod for Wi-Fi 6/mesh"],
  },
  mail_forwarding: {
    category: "Eftersandning",
    defaultMode: "stub",
    searchQuery: (_input) =>
      `eftersandning post ${new Date().getFullYear()} pris`,
    systemPrompt: "",
    stubSummary: "Jamfor eftersandning: langd (3/6/12 man), pris och vad som ingar.",
    stubHints: ["Eftersandningens langd (3/6/12 man)", "Pris", "Vad som ingar"],
  },
};

/**
 * Resolve which mode a task runs in.
 *
 * Priority order:
 *  1. Per-task env override:  COMPARE_MODE_ELECTRICITY_CONTRACT=api|web_search|stub
 *  2. COMPARE_TASKS_ENABLED list (if set, tasks not in the list are stubbed)
 *  3. WEB_SEARCH_COMPARE master switch (if "n", all web_search tasks fall back to stub)
 *  4. defaultMode from ALL_TASKS config
 */
function resolveMode(taskKey: string): TaskMode {
  const config = ALL_TASKS[taskKey];
  if (!config) return "stub";

  const envKey = `COMPARE_MODE_${taskKey.toUpperCase()}`;
  const envOverride = (process.env[envKey] ?? "").trim().toLowerCase();
  if (envOverride === "api") return "api";
  if (envOverride === "web_search") return WEB_SEARCH_ENABLED ? "web_search" : "stub";
  if (envOverride === "stub") return "stub";

  if (ENABLED_TASKS_RAW) {
    const enabledList = ENABLED_TASKS_RAW.split(",").map((s) => s.trim());
    if (!enabledList.includes(taskKey)) return "stub";
  }

  if (config.defaultMode === "web_search" && !WEB_SEARCH_ENABLED) return "stub";

  return config.defaultMode;
}

export function getAllTaskKeys(): string[] {
  return Object.keys(ALL_TASKS);
}

export function getLiveTaskKeys(): string[] {
  return Object.keys(ALL_TASKS).filter((k) => resolveMode(k) === "web_search");
}

export function getStubTaskKeys(): string[] {
  return Object.keys(ALL_TASKS).filter((k) => resolveMode(k) === "stub");
}

export function getApiTaskKeys(): string[] {
  return Object.keys(ALL_TASKS).filter((k) => resolveMode(k) === "api");
}

/** All non-stub task keys (both web_search and api). */
export function getActiveTaskKeys(): string[] {
  return Object.keys(ALL_TASKS).filter((k) => resolveMode(k) !== "stub");
}

export function isCompareEnabled(): boolean {
  return WEB_SEARCH_ENABLED;
}

export function getSupportedTaskKeys(): string[] {
  return getAllTaskKeys();
}

export function getCompareCacheTtlMs(): number {
  return CACHE_TTL_MS;
}

export function getComparisonAdminConfig() {
  const tasks: CompareTaskAdminInfo[] = Object.entries(ALL_TASKS).map(
    ([taskKey, config]) => ({
      taskKey,
      category: config.category,
      defaultMode: config.defaultMode,
      resolvedMode: resolveMode(taskKey),
      stubHints: config.stubHints,
    })
  );

  return {
    webSearchEnabled: WEB_SEARCH_ENABLED,
    compareModel: COMPARE_MODEL,
    cacheTtlMs: CACHE_TTL_MS,
    tasks,
    liveTaskKeys: tasks
      .filter((t) => t.resolvedMode === "web_search")
      .map((t) => t.taskKey),
    apiTaskKeys: tasks
      .filter((t) => t.resolvedMode === "api")
      .map((t) => t.taskKey),
    stubTaskKeys: tasks
      .filter((t) => t.resolvedMode === "stub")
      .map((t) => t.taskKey),
  };
}

function extractJson(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);

  return null;
}

function buildStubResult(taskKey: string, config: TaskConfig, elArea?: string): CompareResult {
  return {
    taskKey,
    category: config.category,
    summary: config.stubSummary,
    providers: [],
    tip: "Detaljerad jamforelse ar inte aktiverad for denna kategori annu. Anvand comparisonHints som vägledning.",
    sources: [],
    cached: false,
    mode: "stub",
    ...(elArea ? { elArea } : {}),
  };
}

export async function runComparison(input: CompareInput): Promise<CompareResult> {
  const taskConfig = ALL_TASKS[input.taskKey];
  if (!taskConfig) {
    return {
      taskKey: input.taskKey,
      category: "Okand",
      summary: `Jamforelse for "${input.taskKey}" stods inte. Tillgangliga: ${getAllTaskKeys().join(", ")}`,
      providers: [],
      tip: "",
      sources: [],
      cached: false,
      mode: "stub",
    };
  }

  const elAreaInfo = input.toPostal ? postalToElArea(input.toPostal) : null;
  const elAreaStr = elAreaInfo ? `${elAreaInfo.area} (${elAreaInfo.label})` : undefined;

  const mode = resolveMode(input.taskKey);

  if (mode === "stub") {
    return buildStubResult(input.taskKey, taskConfig, elAreaStr);
  }

  const cacheKey = `${input.taskKey}:${input.toPostal || ""}:${input.toCity || ""}`;
  const cached = COMPARE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  if (mode === "api" && taskConfig.apiHandler) {
    try {
      const apiResult = await taskConfig.apiHandler(input, elAreaStr);
      if (apiResult) {
        COMPARE_CACHE.set(cacheKey, { data: apiResult, ts: Date.now() });
        return apiResult;
      }
      console.warn(`[compare] ${input.taskKey} apiHandler returned null, falling back to web_search`);
    } catch (err) {
      console.error(`[compare] ${input.taskKey} apiHandler error, falling back to web_search:`, err);
    }
  }

  const client = getOpenAIClient();
  const searchQuery = taskConfig.searchQuery(input, { elArea: elAreaInfo?.area });

  const promptParts = [
    `Sok efter: ${searchQuery}`,
    input.toPostal ? `Postnummer: ${input.toPostal}` : null,
    input.toCity ? `Ort: ${input.toCity}` : null,
    input.moveDate ? `Flyttdatum: ${input.moveDate}` : null,
    input.toStreet ? `Adress: ${input.toStreet}` : null,
    elAreaInfo ? `Elnatsomrade: ${elAreaInfo.area} (${elAreaInfo.label}, ${elAreaInfo.city})` : null,
  ];
  const userPrompt = promptParts.filter(Boolean).join("\n");

  try {
    const response = await (client as any).responses.create({
      model: COMPARE_MODEL,
      input: [
        { role: "system", content: taskConfig.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{ type: "web_search" }],
    });

    const outputText =
      response.output_text ??
      response.output
        ?.filter((item: any) => item.type === "message")
        .flatMap((item: any) => item.content ?? [])
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text)
        .join("") ??
      "";

    if (!outputText) throw new Error("Empty response from web search");

    const jsonStr = extractJson(outputText);
    if (!jsonStr) throw new Error("Could not extract JSON from response");

    const parsed = JSON.parse(jsonStr);

    const result: CompareResult = {
      taskKey: input.taskKey,
      category: taskConfig.category,
      summary: parsed.summary ?? "",
      providers: Array.isArray(parsed.providers)
        ? parsed.providers.slice(0, 5).map((p: any) => ({
            name: String(p.name ?? ""),
            price: String(p.price ?? ""),
            pros: Array.isArray(p.pros) ? p.pros.map(String) : [],
            cons: Array.isArray(p.cons) ? p.cons.map(String) : [],
            url: typeof p.url === "string" ? p.url : undefined,
          }))
        : [],
      tip: parsed.tip ?? "",
      sources: Array.isArray(parsed.sources) ? parsed.sources.map(String) : [],
      cached: false,
      mode: "web_search",
      ...(elAreaStr ? { elArea: elAreaStr } : {}),
    };

    COMPARE_CACHE.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error(`[compare] ${input.taskKey} error:`, err);

    return {
      taskKey: input.taskKey,
      category: taskConfig.category,
      summary: `Kunde inte hamta jamforelsedata for ${taskConfig.category} just nu.`,
      providers: [],
      tip: "Forsok igen om en stund.",
      sources: [],
      cached: false,
      mode: "web_search",
      ...(elAreaStr ? { elArea: elAreaStr } : {}),
    };
  }
}
