"use client"

import type { ReactNode } from "react"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type {
  AdressandringStep1FieldKey,
  AdressandringStep1Fields,
  AdressandringValidationResult,
} from "@/lib/forms/adressandring"

type AdressandringStepOneFieldsProps = {
  fields: AdressandringStep1Fields
  onFieldChange: (field: AdressandringStep1FieldKey, value: string) => void
  renderSuggestionBanner?: (field: AdressandringStep1FieldKey) => ReactNode
  validating?: boolean
  validation?: AdressandringValidationResult | null
  compact?: boolean
  idPrefix?: string
}

export function AdressandringStepOneFields({
  fields,
  onFieldChange,
  renderSuggestionBanner,
  validating = false,
  validation = null,
  compact = false,
  idPrefix = "",
}: AdressandringStepOneFieldsProps) {
  const fieldId = (name: string) => `${idPrefix}${name}`

  return (
    <div className={cn("space-y-6", compact && "space-y-5")}>
      <div className={cn("grid gap-5 sm:grid-cols-2", compact && "gap-4")}>
        <div className="space-y-2">
          {renderSuggestionBanner?.("firstName")}
          <Label htmlFor={fieldId("firstName")}>Förnamn</Label>
          <Input
            id={fieldId("firstName")}
            placeholder="Anna"
            value={fields.firstName}
            onChange={(event) => onFieldChange("firstName", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          {renderSuggestionBanner?.("lastName")}
          <Label htmlFor={fieldId("lastName")}>Efternamn</Label>
          <Input
            id={fieldId("lastName")}
            placeholder="Andersson"
            value={fields.lastName}
            onChange={(event) => onFieldChange("lastName", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        {renderSuggestionBanner?.("personalNumber")}
        <Label htmlFor={fieldId("personalNumber")}>Personnummer</Label>
        <Input
          id={fieldId("personalNumber")}
          placeholder="YYYYMMDD-XXXX"
          value={fields.personalNumber}
          onChange={(event) => onFieldChange("personalNumber", event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Används för att verifiera din identitet.
        </p>
      </div>

      <Separator />

      <div className={cn("grid gap-5 sm:grid-cols-2", compact && "gap-4")}>
        <div className="space-y-2">
          {renderSuggestionBanner?.("email")}
          <Label htmlFor={fieldId("email")}>E-postadress</Label>
          <Input
            id={fieldId("email")}
            type="email"
            placeholder="anna@exempel.se"
            value={fields.email}
            onChange={(event) => onFieldChange("email", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          {renderSuggestionBanner?.("phone")}
          <Label htmlFor={fieldId("phone")}>Telefonnummer</Label>
          <Input
            id={fieldId("phone")}
            type="tel"
            placeholder="070-123 45 67"
            value={fields.phone}
            onChange={(event) => onFieldChange("phone", event.target.value)}
          />
        </div>
      </div>

      {validating && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-muted-foreground">
            AI validerar dina uppgifter...
          </span>
        </div>
      )}

      {validation && !validating && (
        <div
          className={cn(
            "rounded-2xl border p-3.5 text-sm",
            validation.confidence >= 70
              ? "border-green-200 bg-green-50"
              : "border-yellow-200 bg-yellow-50",
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-validering: {validation.confidence}% konfidenspoäng
          </div>
          {validation.suggestions.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {validation.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-1.5">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
