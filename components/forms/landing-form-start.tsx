"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Shield } from "lucide-react"
import { AdressandringStepOneFields } from "@/components/forms/adressandring-step-one-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  emptyAdressandringStep1Fields,
  mergeAdressandringStep1Fields,
  pickAdressandringStep1Fields,
  STEP1_FIELD_KEYS,
  type AdressandringStep1FieldKey,
  type AdressandringStep1Fields,
} from "@/lib/forms/adressandring"
import {
  buildCriticalMissing,
  describeMiniMifMissing,
  readStoredAdressandringPrefill,
  writeStoredAdressandringPrefill,
  type MiniMifSource,
  type MiniMifContext,
} from "@/lib/mif/prefill"

const FIELD_LABELS: Record<string, string> = {
  firstName: "förnamn",
  lastName: "efternamn",
  personalNumber: "personnummer",
  email: "e-post",
  phone: "telefonnummer",
  fromStreet: "nuvarande adress",
  fromPostal: "nuvarande postnummer",
  fromCity: "nuvarande ort",
  toStreet: "ny adress",
  toPostal: "nytt postnummer",
  toCity: "ny ort",
  moveDate: "inflyttningsdatum",
}

type LandingFormStartProps = {
  miniMifContext: MiniMifContext | null
  warning?: string | null
  className?: string
}

export function LandingFormStart({
  miniMifContext,
  warning,
  className,
}: LandingFormStartProps) {
  const initialMiniMifFieldsRef = useRef(miniMifContext?.fields)
  const [fields, setFields] = useState<AdressandringStep1Fields>(
    emptyAdressandringStep1Fields,
  )

  useEffect(() => {
    const stored = readStoredAdressandringPrefill()
    const storedFields = pickAdressandringStep1Fields(stored?.fields)
    const miniMifFields = pickAdressandringStep1Fields(initialMiniMifFieldsRef.current)

    setFields(
      mergeAdressandringStep1Fields(
        mergeAdressandringStep1Fields(emptyAdressandringStep1Fields, storedFields),
        miniMifFields,
      ),
    )
  }, [])

  useEffect(() => {
    if (!miniMifContext) return
    const nextFields = pickAdressandringStep1Fields(miniMifContext.fields)
    setFields((current) => mergeAdressandringStep1Fields(current, nextFields))
  }, [miniMifContext])

  useEffect(() => {
    const current = readStoredAdressandringPrefill()
    const preservedFields = Object.fromEntries(
      Object.entries(current?.fields ?? {}).filter(
        ([key]) => !STEP1_FIELD_KEYS.includes(key as AdressandringStep1FieldKey),
      ),
    )
    const preservedSources = Object.fromEntries(
      Object.entries(current?.fieldSources ?? {}).filter(
        ([key]) => !STEP1_FIELD_KEYS.includes(key as AdressandringStep1FieldKey),
      ),
    )
    const manualFields = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value.trim().length > 0),
    )
    const manualSources: Record<string, MiniMifSource> = Object.fromEntries(
      Object.keys(manualFields).map((key) => [key, "manual" as const]),
    )

    writeStoredAdressandringPrefill({
      fields: {
        ...preservedFields,
        ...manualFields,
      },
      fieldSources: {
        ...preservedSources,
        ...manualSources,
      },
      miniMif: miniMifContext ?? current?.miniMif ?? null,
    })
  }, [fields, miniMifContext])

  const combinedFields = useMemo(
    () => ({
      ...(miniMifContext?.fields ?? {}),
      ...Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value.trim().length > 0),
      ),
    }),
    [fields, miniMifContext],
  )

  const foundLabels = useMemo(
    () =>
      Object.keys(combinedFields).map((field) => FIELD_LABELS[field] ?? field),
    [combinedFields],
  )

  const missingLabels = useMemo(
    () => describeMiniMifMissing(buildCriticalMissing(combinedFields)),
    [combinedFields],
  )

  const handleFieldChange = (
    field: AdressandringStep1FieldKey,
    value: string,
  ) => {
    setFields((current) => ({ ...current, [field]: value }))
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[30px] border border-border/60 bg-background/82 shadow-lg shadow-primary/6",
        className,
      )}
    >
      <div className="border-b border-border/50 bg-linear-to-r from-primary/12 via-primary/5 to-transparent px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-primary/15 bg-background/85 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary"
          >
            Formulärstart
          </Badge>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] text-muted-foreground">
            <Shield className="h-3 w-3 text-primary" />
            Sparas till nästa steg
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold text-foreground">
          Starta med dina uppgifter
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Fyll i det du redan vet. Uppgifterna följer med när du går vidare i
          formuläret, så du slipper börja om.
        </p>
      </div>

      <div className="space-y-5 px-5 py-5">
        {warning && (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            {warning}
          </div>
        )}

        <AdressandringStepOneFields
          fields={fields}
          onFieldChange={handleFieldChange}
          compact
          idPrefix="landing-"
        />

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Klart hittills
            </p>
            <div className="mt-3 flex min-h-16 flex-wrap gap-2">
              {foundLabels.length > 0 ? (
                foundLabels.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-foreground"
                  >
                    {field}
                  </span>
                ))
              ) : (
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Dina uppgifter dyker upp här när du fyller i dem eller när
                  Aida tolkar din text.
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Nästa steg i formuläret
            </p>
            <div className="mt-3 flex min-h-16 flex-wrap gap-2">
              {missingLabels.length > 0 ? (
                missingLabels.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {field}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Starten ser redan bra ut.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-border/50 bg-card/65 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Du kompletterar adress, datum och bekräftelse i nästa steg.
          </p>
          <Button asChild className="rounded-full px-6">
            <Link href="/adressandring">
              Fortsätt till formuläret
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  )
}
