export interface AdressandringFormData {
  firstName: string
  lastName: string
  personalNumber: string
  email: string
  phone: string
  fromStreet: string
  fromPostal: string
  fromCity: string
  toStreet: string
  toPostal: string
  toCity: string
  apartmentNumber: string
  propertyDesignation: string
  propertyOwner: string
  moveDate: string
  householdType: string
  reason: string
  hasChildren: boolean
}

export type AdressandringStep1FieldKey =
  | "firstName"
  | "lastName"
  | "personalNumber"
  | "email"
  | "phone"

export type AdressandringStep1Fields = Pick<
  AdressandringFormData,
  AdressandringStep1FieldKey
>

export interface AdressandringValidationResult {
  confidence: number
  suggestions: string[]
}

export const STEP1_FIELD_KEYS: AdressandringStep1FieldKey[] = [
  "firstName",
  "lastName",
  "personalNumber",
  "email",
  "phone",
]

export const emptyAdressandringForm: AdressandringFormData = {
  firstName: "",
  lastName: "",
  personalNumber: "",
  email: "",
  phone: "",
  fromStreet: "",
  fromPostal: "",
  fromCity: "",
  toStreet: "",
  toPostal: "",
  toCity: "",
  apartmentNumber: "",
  propertyDesignation: "",
  propertyOwner: "",
  moveDate: "",
  householdType: "",
  reason: "",
  hasChildren: false,
}

export const emptyAdressandringStep1Fields: AdressandringStep1Fields = {
  firstName: "",
  lastName: "",
  personalNumber: "",
  email: "",
  phone: "",
}

export function pickAdressandringStep1Fields(
  value:
    | Partial<Record<keyof AdressandringFormData, string | boolean | undefined>>
    | Record<string, unknown>
    | null
    | undefined,
): AdressandringStep1Fields {
  const source = value ?? {}

  return {
    firstName:
      typeof source.firstName === "string" ? source.firstName : "",
    lastName: typeof source.lastName === "string" ? source.lastName : "",
    personalNumber:
      typeof source.personalNumber === "string" ? source.personalNumber : "",
    email: typeof source.email === "string" ? source.email : "",
    phone: typeof source.phone === "string" ? source.phone : "",
  }
}

export function mergeAdressandringStep1Fields(
  current: AdressandringStep1Fields,
  incoming: Partial<Record<AdressandringStep1FieldKey, string>>,
): AdressandringStep1Fields {
  const next = { ...current }

  for (const key of STEP1_FIELD_KEYS) {
    if (next[key].trim()) continue
    const value = incoming[key]
    if (typeof value === "string" && value.trim()) {
      next[key] = value.trim()
    }
  }

  return next
}
