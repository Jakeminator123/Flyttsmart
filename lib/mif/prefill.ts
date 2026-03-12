export const ADDRESS_PREFILL_STORAGE_KEY = "adressandring-prefill"
export const MINI_MIF_CONTEXT_STORAGE_KEY = "mini-mif-context"
export const MINI_MIF_EVENT = "mini-mif-context-updated"

export type MiniMifSource = "pnr_lookup" | "start_intent" | "manual"
export type MiniMifMode = "personnummer" | "free_text"

export interface MiniMifContext {
  mode: MiniMifMode
  input: string
  fields: Record<string, string>
  fieldSources: Record<string, MiniMifSource>
  found: string[]
  missingCritical: string[]
  summary: string[]
  personLookup?: {
    found: boolean
    source?: string
    confidence?: "high" | "medium" | "low"
    missing?: string[]
    displayName?: string | null
  } | null
  startIntent?: {
    rawInput: string
    summary: string[]
  } | null
  updatedAt: string
}

export interface StoredAdressandringPrefill {
  fields: Record<string, string>
  fieldSources: Record<string, MiniMifSource>
  miniMif?: MiniMifContext | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function sanitizeFields(fields: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([key, value]) => [key, value.trim()]),
  )
}

function sanitizeSources(
  sources: Record<string, unknown>,
  fallback: MiniMifSource = "manual",
): Record<string, MiniMifSource> {
  return Object.fromEntries(
    Object.entries(sources).map(([key, value]) => {
      if (value === "pnr_lookup" || value === "start_intent" || value === "manual") {
        return [key, value]
      }
      return [key, fallback]
    }),
  )
}

export function buildCriticalMissing(fields: Record<string, string>): string[] {
  const missing: string[] = []

  if (!fields.firstName && !fields.lastName) {
    missing.push("name")
  }
  if (!fields.toStreet) {
    missing.push("toStreet")
  }
  if (!fields.toPostal && !fields.toCity) {
    missing.push("toPostalOrCity")
  }
  if (!fields.moveDate) {
    missing.push("moveDate")
  }

  return missing
}

export function createMiniMifContext(input: {
  mode: MiniMifMode
  rawInput: string
  fields: Record<string, string>
  fieldSources: Record<string, MiniMifSource>
  summary?: string[]
  personLookup?: MiniMifContext["personLookup"]
  startIntent?: MiniMifContext["startIntent"]
}): MiniMifContext {
  const fields = sanitizeFields(input.fields)
  return {
    mode: input.mode,
    input: input.rawInput.trim(),
    fields,
    fieldSources: sanitizeSources(input.fieldSources, input.mode === "personnummer" ? "pnr_lookup" : "start_intent"),
    found: Object.keys(fields),
    missingCritical: buildCriticalMissing(fields),
    summary: input.summary?.filter(Boolean) ?? [],
    personLookup: input.personLookup ?? null,
    startIntent: input.startIntent ?? null,
    updatedAt: new Date().toISOString(),
  }
}

export function mergeStoredPrefill(
  current: StoredAdressandringPrefill | null | undefined,
  incoming: {
    fields: Record<string, string>
    source: MiniMifSource
    miniMif?: MiniMifContext | null
  },
): StoredAdressandringPrefill {
  const currentFields = current?.fields ?? {}
  const currentSources = current?.fieldSources ?? {}
  const incomingFields = sanitizeFields(incoming.fields)

  const fields = { ...currentFields, ...incomingFields }
  const fieldSources = {
    ...currentSources,
    ...Object.fromEntries(
      Object.keys(incomingFields).map((field) => [field, incoming.source]),
    ),
  }

  return {
    fields,
    fieldSources,
    miniMif: incoming.miniMif ?? current?.miniMif ?? null,
  }
}

export function readStoredAdressandringPrefill(): StoredAdressandringPrefill | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(ADDRESS_PREFILL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)

    if (isRecord(parsed) && isRecord(parsed.fields)) {
      return {
        fields: sanitizeFields(parsed.fields),
        fieldSources: isRecord(parsed.fieldSources) ? sanitizeSources(parsed.fieldSources) : {},
        miniMif: isRecord(parsed.miniMif) ? (parsed.miniMif as MiniMifContext) : null,
      }
    }

    if (isRecord(parsed)) {
      return {
        fields: sanitizeFields(parsed),
        fieldSources: {},
        miniMif: null,
      }
    }
  } catch {
    return null
  }

  return null
}

export function writeStoredAdressandringPrefill(prefill: StoredAdressandringPrefill): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(ADDRESS_PREFILL_STORAGE_KEY, JSON.stringify(prefill))
}

export function clearStoredAdressandringPrefill(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(ADDRESS_PREFILL_STORAGE_KEY)
}

export function readMiniMifContext(): MiniMifContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(MINI_MIF_CONTEXT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    if (!isRecord(parsed.fields) || !isRecord(parsed.fieldSources)) return null

    return {
      mode: parsed.mode === "personnummer" ? "personnummer" : "free_text",
      input: typeof parsed.input === "string" ? parsed.input : "",
      fields: sanitizeFields(parsed.fields),
      fieldSources: sanitizeSources(parsed.fieldSources),
      found: Array.isArray(parsed.found) ? parsed.found.filter((item): item is string => typeof item === "string") : [],
      missingCritical: Array.isArray(parsed.missingCritical)
        ? parsed.missingCritical.filter((item): item is string => typeof item === "string")
        : [],
      summary: Array.isArray(parsed.summary) ? parsed.summary.filter((item): item is string => typeof item === "string") : [],
      personLookup: isRecord(parsed.personLookup) ? (parsed.personLookup as MiniMifContext["personLookup"]) : null,
      startIntent: isRecord(parsed.startIntent) ? (parsed.startIntent as MiniMifContext["startIntent"]) : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    }
  } catch {
    return null
  }
}

export function writeMiniMifContext(context: MiniMifContext): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(MINI_MIF_CONTEXT_STORAGE_KEY, JSON.stringify(context))
  window.dispatchEvent(new CustomEvent(MINI_MIF_EVENT, { detail: context }))
}

export function describeMiniMifMissing(missingCritical: string[]): string[] {
  return missingCritical.map((field) => {
    if (field === "name") return "namn"
    if (field === "toStreet") return "ny gatuadress"
    if (field === "toPostalOrCity") return "ny ort eller postnummer"
    if (field === "moveDate") return "inflyttningsdatum"
    return field
  })
}
