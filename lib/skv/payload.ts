export interface SkvSourceData {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  personalNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  toStreet?: string | null;
  toPostal?: string | null;
  toCity?: string | null;
  moveDate?: string | null;
  apartmentNumber?: string | null;
  propertyDesignation?: string | null;
  propertyOwner?: string | null;
}

export interface NormalizedSkvPayload {
  inflyttningsdatum: string;
  gatuadress: string;
  postnummer: string;
  postort: string;
  lagenhetsnummer: string;
  fastighetsbeteckning: string;
  fastighetsagare: string;
  telefonnummer: string;
  email: string;
  name: string;
  personalNumber: string;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function cleanPostal(value: string | null | undefined): string {
  return clean(value).replace(/\s+/g, "");
}

function cleanPhone(value: string | null | undefined): string {
  return clean(value).replace(/[^\d+]/g, "");
}

export function buildNormalizedSkvPayload(data: SkvSourceData): NormalizedSkvPayload {
  const firstName = clean(data.firstName);
  const lastName = clean(data.lastName);
  const name = clean(data.name) || `${firstName} ${lastName}`.trim();

  return {
    inflyttningsdatum: clean(data.moveDate),
    gatuadress: clean(data.toStreet),
    postnummer: cleanPostal(data.toPostal),
    postort: clean(data.toCity),
    lagenhetsnummer: clean(data.apartmentNumber),
    fastighetsbeteckning: clean(data.propertyDesignation),
    fastighetsagare: clean(data.propertyOwner),
    telefonnummer: cleanPhone(data.phone),
    email: clean(data.email),
    name,
    personalNumber: clean(data.personalNumber),
  };
}
