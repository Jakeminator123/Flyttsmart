import { normalizePersonalNumber } from "@/lib/personal-number"
import { parseStartIntent } from "@/lib/start-intent"
import {
  createMiniMifContext,
  mergeStoredPrefill,
  readStoredAdressandringPrefill,
  writeMiniMifContext,
  writeStoredAdressandringPrefill,
  type MiniMifContext,
  type MiniMifSource,
} from "@/lib/mif/prefill"

export interface MiniMifResolveResult {
  context: MiniMifContext
  source: MiniMifSource
  warning?: string | null
}

export async function resolveMiniMifInput(input: string): Promise<MiniMifResolveResult> {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("Input krävs för att starta Aida")
  }

  const normalizedPnr = normalizePersonalNumber(trimmed)
  if (normalizedPnr) {
    const fields: Record<string, string> = { personalNumber: normalizedPnr }
    let body: any = null
    let warning: string | null = null

    try {
      const res = await fetch("/api/enrich/person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalNumber: normalizedPnr }),
      })

      body = await res.json().catch(() => null)
      if (!res.ok || body?.found === false) {
        warning =
          body?.error || body?.details || "Vi kunde inte hämta mer uppgifter från personnumret ännu."
      }
    } catch {
      warning = "Vi sparade personnumret, men kunde inte hämta fler uppgifter just nu."
    }

    if (body?.firstName) fields.firstName = body.firstName
    if (body?.lastName) fields.lastName = body.lastName
    if (body?.fromStreet) fields.fromStreet = body.fromStreet
    if (body?.fromCity) fields.fromCity = body.fromCity
    if (body?.fromPostal) fields.fromPostal = body.fromPostal

    const summary: string[] = ["personnummer"]
    if (fields.firstName || fields.lastName) summary.push("namn")
    if (fields.fromStreet) summary.push("nuvarande adress")
    if (fields.fromCity || fields.fromPostal) summary.push("nuvarande ort")

    return {
      source: "pnr_lookup",
      warning,
      context: createMiniMifContext({
        mode: "personnummer",
        rawInput: trimmed,
        fields,
        fieldSources: Object.fromEntries(
          Object.keys(fields).map((field) => [field, "pnr_lookup"]),
        ),
        summary,
        personLookup: {
          found: Boolean(body?.found),
          source: typeof body?.source === "string" ? body.source : undefined,
          confidence:
            body?.confidence === "high" || body?.confidence === "medium" || body?.confidence === "low"
              ? body.confidence
              : undefined,
          missing: Array.isArray(body?.missing)
            ? body.missing.filter((item: unknown): item is string => typeof item === "string")
            : undefined,
          displayName:
            typeof body?.displayName === "string"
              ? body.displayName
              : [fields.firstName, fields.lastName].filter(Boolean).join(" ") || null,
        },
      }),
    }
  }

  const parsedStartIntent = parseStartIntent(trimmed)
  return {
    source: "start_intent",
    context: createMiniMifContext({
      mode: "free_text",
      rawInput: trimmed,
      fields: parsedStartIntent.fields as Record<string, string>,
      fieldSources: Object.fromEntries(
        Object.keys(parsedStartIntent.fields).map((field) => [field, "start_intent"]),
      ),
      summary: parsedStartIntent.summary,
      startIntent: {
        rawInput: parsedStartIntent.rawInput,
        summary: parsedStartIntent.summary,
      },
    }),
  }
}

export function persistMiniMifResult(result: MiniMifResolveResult) {
  const current = readStoredAdressandringPrefill()
  const nextPrefill = mergeStoredPrefill(current, {
    fields: result.context.fields,
    source: result.source,
    miniMif: result.context,
  })

  writeStoredAdressandringPrefill(nextPrefill)
  writeMiniMifContext(result.context)

  return nextPrefill
}
