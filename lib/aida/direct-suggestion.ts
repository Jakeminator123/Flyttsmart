export type DirectSuggestion = {
  field: string;
  value: string;
  label: string;
};

const FIELD_ALIAS_DEFINITIONS = [
  { field: "firstName", label: "fornamn", aliases: ["firstName", "fornamn", "förnamn"] },
  { field: "lastName", label: "efternamn", aliases: ["lastName", "efternamn"] },
  { field: "personalNumber", label: "personnummer", aliases: ["personalNumber", "personnummer"] },
  { field: "fromStreet", label: "nuvarande gata", aliases: ["fromStreet", "nuvarande gata", "fran gata", "från gata"] },
  { field: "fromPostal", label: "nuvarande postnummer", aliases: ["fromPostal", "nuvarande postnummer", "fran postnummer", "från postnummer"] },
  { field: "fromCity", label: "nuvarande ort", aliases: ["fromCity", "nuvarande ort", "fran ort", "från ort"] },
  { field: "toStreet", label: "ny gata", aliases: ["toStreet", "ny gata"] },
  { field: "toPostal", label: "nytt postnummer", aliases: ["toPostal", "nytt postnummer", "nya postnummer"] },
  { field: "toCity", label: "ny ort", aliases: ["toCity", "ny ort", "nya ort"] },
  { field: "apartmentNumber", label: "lagenhetsnummer", aliases: ["apartmentNumber", "lagenhetsnummer", "lägenhetsnummer", "lgh"] },
  { field: "propertyDesignation", label: "fastighetsbeteckning", aliases: ["propertyDesignation", "fastighetsbeteckning"] },
  { field: "propertyOwner", label: "fastighetsagare", aliases: ["propertyOwner", "fastighetsagare", "fastighetsägare"] },
  { field: "email", label: "e-post", aliases: ["email", "e-post", "epost"] },
  { field: "phone", label: "telefon", aliases: ["phone", "telefon", "mobilnummer", "telefonnummer"] },
  { field: "moveDate", label: "flyttdatum", aliases: ["moveDate", "flyttdatum", "inflyttningsdatum"] },
] as const;

function normalizeSwedish(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cleanSuggestionValue(value: string): string {
  return value
    .trim()
    .replace(/^["'“”„`]+|["'“”„`]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function findFieldAlias(rawFieldText: string): { field: string; label: string } | null {
  const normalized = normalizeSwedish(rawFieldText);
  for (const def of FIELD_ALIAS_DEFINITIONS) {
    for (const alias of def.aliases) {
      if (normalized.includes(normalizeSwedish(alias))) {
        return { field: def.field, label: def.label };
      }
    }
  }
  return null;
}

export function parseDirectSuggestion(message: string): DirectSuggestion | null {
  const tryMatch = (
    regex: RegExp,
    valueIdx: number,
    fieldIdx: number
  ): DirectSuggestion | null => {
    const match = message.match(regex);
    if (!match) return null;
    const value = cleanSuggestionValue(match[valueIdx] ?? "");
    const fieldText = (match[fieldIdx] ?? "").trim();
    if (!value || !fieldText) return null;
    const resolved = findFieldAlias(fieldText);
    if (!resolved) return null;
    return { field: resolved.field, value, label: resolved.label };
  };

  return (
    tryMatch(/fyll\s+i\s+(.+?)\s+(?:i|på|pa|under)\s+(.+)/i, 1, 2) ??
    tryMatch(/(?:satt|sätt)\s+(.+?)\s+till\s+(.+)/i, 2, 1) ??
    tryMatch(/(?:andra|ändra)\s+(.+?)\s+till\s+(.+)/i, 2, 1) ??
    tryMatch(
      /(?:mitt|min|mina)?\s*(fornamn|förnamn|efternamn|personnummer|telefon|telefonnummer|mobilnummer|e-post|epost|email|flyttdatum)\s*(?:ska\s+vara|ar|är|=|:)\s+(.+)/i,
      2,
      1
    )
  );
}
