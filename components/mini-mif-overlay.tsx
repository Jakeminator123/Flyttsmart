"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, CheckCircle2, Fingerprint, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { parseStartIntent } from "@/lib/start-intent"
import { normalizePersonalNumber } from "@/lib/personal-number"
import {
  createMiniMifContext,
  describeMiniMifMissing,
  mergeStoredPrefill,
  readStoredAdressandringPrefill,
  writeMiniMifContext,
  writeStoredAdressandringPrefill,
  type MiniMifContext,
} from "@/lib/mif/prefill"

interface MiniMifOverlayProps {
  open: boolean
  initialValue?: string
  onOpenChange: (open: boolean) => void
}

type ResolveState = {
  context: MiniMifContext
  warning?: string | null
}

const QUICK_EXAMPLES = [
  "19900101-1234",
  "Vi flyttar 1 juni till Malmö",
  "Ny adress blir Storgatan 12 i Göteborg",
]

const FIELD_LABELS: Record<string, string> = {
  firstName: "förnamn",
  lastName: "efternamn",
  personalNumber: "personnummer",
  fromStreet: "nuvarande adress",
  fromPostal: "nuvarande postnummer",
  fromCity: "nuvarande ort",
  toStreet: "ny adress",
  toPostal: "nytt postnummer",
  toCity: "ny ort",
  moveDate: "inflyttningsdatum",
}

export function MiniMifOverlay({
  open,
  initialValue = "",
  onOpenChange,
}: MiniMifOverlayProps) {
  const router = useRouter()
  const [input, setInput] = useState(initialValue)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<ResolveState | null>(null)

  useEffect(() => {
    if (open) {
      setInput(initialValue)
      setError(null)
      setResolved(null)
      setLoading(false)
    }
  }, [initialValue, open])

  const normalizedPnr = useMemo(() => normalizePersonalNumber(input), [input])
  const missingLabels = describeMiniMifMissing(
    resolved?.context.missingCritical ?? [],
  )
  const foundLabels = (resolved?.context.found ?? []).map(
    (field) => FIELD_LABELS[field] ?? field,
  )

  function persistContext(context: MiniMifContext, source: "pnr_lookup" | "start_intent") {
    const current = readStoredAdressandringPrefill()
    const nextPrefill = mergeStoredPrefill(current, {
      fields: context.fields,
      source,
      miniMif: context,
    })
    writeStoredAdressandringPrefill(nextPrefill)
    writeMiniMifContext(context)
  }

  async function resolveInput() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setResolved(null)

    try {
      if (normalizedPnr) {
        const res = await fetch("/api/enrich/person", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personalNumber: normalizedPnr }),
        })

        const body = await res.json().catch(() => null)
        const fields: Record<string, string> = { personalNumber: normalizedPnr }
        if (body?.firstName) fields.firstName = body.firstName
        if (body?.lastName) fields.lastName = body.lastName
        if (body?.fromStreet) fields.fromStreet = body.fromStreet
        if (body?.fromCity) fields.fromCity = body.fromCity
        if (body?.fromPostal) fields.fromPostal = body.fromPostal

        const summary: string[] = []
        if (fields.firstName || fields.lastName) summary.push("namn")
        if (fields.fromStreet) summary.push("nuvarande adress")
        if (fields.fromCity || fields.fromPostal) summary.push("nuvarande ort")

        const warning =
          !res.ok || body?.found === false
            ? body?.error || body?.details || "Vi kunde inte hämta mer uppgifter från personnumret ännu."
            : null

        const context = createMiniMifContext({
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
        })

        persistContext(context, "pnr_lookup")
        setResolved({ context, warning })
        return
      }

      const parsedStartIntent = parseStartIntent(trimmed)
      const context = createMiniMifContext({
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
      })

      persistContext(context, "start_intent")
      setResolved({ context })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Okänt fel"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleContinue() {
    onOpenChange(false)
    router.push("/adressandring")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!loading}
        className="card-3d max-w-2xl rounded-[32px] border border-border/70 bg-card/92 p-0 shadow-2xl shadow-primary/10 backdrop-blur-xl"
      >
        <div className="overflow-hidden rounded-[32px]">
          <div className="border-b border-border/60 bg-linear-to-br from-primary/10 via-background to-background px-6 py-6">
            <DialogHeader className="text-left">
              <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-medium text-primary">
                <Fingerprint className="h-3.5 w-3.5" />
                Mini-MIF
              </div>
              <DialogTitle className="text-2xl tracking-tight">
                Börja med personnummer eller fri text
              </DialogTitle>
              <DialogDescription className="max-w-xl text-sm leading-relaxed">
                Personnummer är snabbaste vägen. Då kan vi ofta hämta namn och nuvarande
                adress direkt. Du kan annars skriva fritt vad du vet om flytten, så plockar vi ut det som går.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-6">
            {!resolved ? (
              <>
                <div className="rounded-[28px] border border-border/70 bg-background/85 p-4 shadow-lg shadow-primary/5">
                  <div className="space-y-2">
                    <label
                      htmlFor="mini-mif-input"
                      className="text-sm font-semibold text-foreground"
                    >
                      Personnummer eller fri text
                    </label>
                    <Textarea
                      id="mini-mif-input"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder={'Ex. "19900101-1234" eller "Vi flyttar 1 juni till Malmö och behöver hjälp med resten"'}
                      className="min-h-28 rounded-2xl border-border/70 bg-background/85 px-4 py-3 text-base"
                      disabled={loading}
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Skriv vad som helst här. Personnummer ger snabbast träff, men fri text fungerar för adress, ort, datum och annan kontext.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {QUICK_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setInput(example)}
                      className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Så tolkar vi din input
                  </label>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1.5">
                      {normalizedPnr
                        ? "Personnummer upptäckt: vi försöker hämta namn och nuvarande adress."
                        : "Fri text: vi försöker plocka ut ny adress, ort och inflyttningsdatum."}
                    </span>
                    <span className="rounded-full border border-border/60 bg-muted/20 px-3 py-1.5">
                      Fritext är alltid tillåten som fallback.
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false)
                      router.push("/adressandring")
                    }}
                    disabled={loading}
                  >
                    Hoppa över
                  </Button>
                  <Button
                    type="button"
                    onClick={resolveInput}
                    disabled={!input.trim() || loading}
                    className="gap-2 rounded-full px-6"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {loading ? "Hämtar uppgifter..." : "Hämta det vi kan"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="space-y-2">
                      <p className="text-base font-semibold text-foreground">
                        {resolved.context.mode === "personnummer"
                          ? "Personnummer sparat och analyserat"
                          : "Fri text analyserad"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {resolved.context.summary.length > 0
                          ? `Vi kunde ta med ${resolved.context.summary.join(", ")}.`
                          : "Vi sparade det vi kunde och låter formuläret ta nästa steg."}
                      </p>
                      {resolved.warning && (
                        <p className="text-sm text-amber-700">
                          {resolved.warning}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Hittade uppgifter
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {foundLabels.length > 0 ? (
                        foundLabels.map((field) => (
                          <span
                            key={field}
                            className="rounded-full border border-primary/20 bg-background px-3 py-1 text-xs text-foreground"
                          >
                            {field}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Inga säkra fält ännu.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Fortfarande viktigt för SKV
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {missingLabels.length > 0 ? (
                        missingLabels.map((field) => (
                          <span
                            key={field}
                            className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground"
                          >
                            {field}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Du har redan klarat de blockerande fälten.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setResolved(null)
                      setError(null)
                    }}
                  >
                    Ändra input
                  </Button>
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="gap-2 rounded-full px-6"
                  >
                    Fortsätt till formuläret
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
