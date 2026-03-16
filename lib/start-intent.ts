export const START_INTENT_STORAGE_KEY = "adressandring-start-intent"

export interface StartIntentFields {
  toStreet?: string
  toPostal?: string
  toCity?: string
  moveDate?: string
}

export interface StartIntentPayload {
  rawInput: string
  fields: StartIntentFields
  detected: Array<keyof StartIntentFields>
  summary: string[]
}

const MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  mars: 3,
  april: 4,
  apr: 4,
  maj: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  augusti: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function normalizePostal(postal?: string) {
  if (!postal) return undefined
  const digits = postal.replace(/\s+/g, "")
  if (!/^\d{5}$/.test(digits)) return undefined
  return `${digits.slice(0, 3)} ${digits.slice(3)}`
}

function toIsoDate(year: number, month: number, day: number) {
  const candidate = new Date(year, month - 1, day)
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return undefined
  }

  const yyyy = candidate.getFullYear()
  const mm = String(candidate.getMonth() + 1).padStart(2, "0")
  const dd = String(candidate.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function parseNamedDate(input: string) {
  const match = input.match(
    /\b(\d{1,2})\s+(januari|jan|februari|feb|mars|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|sept|oktober|okt|november|nov|december|dec)\b(?:\s+(\d{4}))?/i,
  )
  if (!match) return undefined

  const [, dayRaw, monthRaw, yearRaw] = match
  const month = MONTHS[monthRaw.toLowerCase()]
  const day = Number(dayRaw)
  if (!month || !Number.isFinite(day)) return undefined

  const now = new Date()
  const year = yearRaw ? Number(yearRaw) : now.getFullYear()
  let iso = toIsoDate(year, month, day)

  if (!iso) return undefined

  if (!yearRaw && iso < now.toISOString().split("T")[0]) {
    iso = toIsoDate(year + 1, month, day)
  }

  return iso
}

function parseNumericDate(input: string) {
  const match = input.match(/\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/)
  if (!match) return undefined

  if (match[1] && match[2] && match[3]) {
    return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]))
  }

  const day = Number(match[4])
  const month = Number(match[5])
  const yearRaw = Number(match[6])
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw

  return toIsoDate(year, month, day)
}

function parsePostalAndCity(input: string) {
  const match = input.match(/\b(\d{3}\s?\d{2})\s+([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö -]+)$/)
  if (!match) return {}

  return {
    toPostal: normalizePostal(match[1]),
    toCity: titleCase(normalizeWhitespace(match[2])),
  }
}

function parseCityWithoutPostal(input: string) {
  const tillMatch = input.match(
    /\btill\s+([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö -]+?)(?=\s+i\s+(?:januari|jan|februari|feb|mars|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|sept|oktober|okt|november|nov|december|dec)\b|$)/i,
  )
  if (tillMatch) {
    return titleCase(normalizeWhitespace(tillMatch[1]))
  }

  const addressMatch = input.match(
    /^(?!vi\b|borja\b|börja\b|starta\b|hj[aä]lp\b)(.+?\d+[A-Za-z]?)(?:,\s*|\s+)([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö -]+)$/i,
  )
  if (addressMatch) {
    return titleCase(normalizeWhitespace(addressMatch[2]))
  }

  return undefined
}

function parseStreet(input: string, city?: string, postal?: string) {
  let text = normalizeWhitespace(input)
  if (!text) return undefined

  text = text.replace(
    /\b(\d{1,2})\s+(januari|jan|februari|feb|mars|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|sept|oktober|okt|november|nov|december|dec)\b(?:\s+\d{4})?/gi,
    "",
  )
  text = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
  text = text.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, "")

  if (postal) {
    text = text.replace(postal, "")
  }

  if (city) {
    const cityPattern = new RegExp(`(?:,?\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*$`, "i")
    text = text.replace(cityPattern, "")
  }

  text = text.replace(/\bvi flyttar\b/gi, "")
  text = text.replace(/\bflytt till\b/gi, "")
  text = text.replace(/\btill\b/gi, "")
  text = normalizeWhitespace(text.replace(/,\s*$/, ""))

  if (!text || !/\d/.test(text)) return undefined
  return text
}

export function parseStartIntent(rawInput: string): StartIntentPayload {
  const raw = normalizeWhitespace(rawInput)
  const fields: StartIntentFields = {}

  if (!raw) {
    return {
      rawInput: "",
      fields,
      detected: [],
      summary: [],
    }
  }

  const moveDate = parseNamedDate(raw) ?? parseNumericDate(raw)
  if (moveDate) fields.moveDate = moveDate

  const postalAndCity = parsePostalAndCity(raw)
  if (postalAndCity.toPostal) fields.toPostal = postalAndCity.toPostal
  if (postalAndCity.toCity) fields.toCity = postalAndCity.toCity

  if (!fields.toCity) {
    const city = parseCityWithoutPostal(raw)
    if (city) fields.toCity = city
  }

  const street = parseStreet(raw, fields.toCity, fields.toPostal)
  if (street) fields.toStreet = street

  const detected = (Object.keys(fields) as Array<keyof StartIntentFields>).filter(
    (key) => Boolean(fields[key]),
  )

  const summary = [
    fields.toStreet ? "ny adress" : null,
    fields.toPostal ? "postnummer" : null,
    fields.toCity ? "ort" : null,
    fields.moveDate ? "inflyttningsdatum" : null,
  ].filter((item): item is string => Boolean(item))

  return {
    rawInput: raw,
    fields,
    detected,
    summary,
  }
}
