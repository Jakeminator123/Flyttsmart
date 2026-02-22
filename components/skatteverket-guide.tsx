"use client"

import { useState } from "react"
import {
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Shield,
  MapPin,
  CalendarDays,
  Building2,
  CheckCircle2,
  Users,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const SKV_URL =
  "https://www.skatteverket.se/privat/folkbokforing/flyttanmalan.html"

interface GuideField {
  label: string
  value: string | null | undefined
  key: string
}

interface SkatteverketGuideProps {
  data: {
    name?: string | null
    personalNumber?: string | null
    toStreet?: string | null
    toPostal?: string | null
    toCity?: string | null
    apartmentNumber?: string | null
    propertyDesignation?: string | null
    propertyOwner?: string | null
    moveDate?: string | null
    householdType?: string | null
  }
  className?: string
}

export function SkatteverketGuide({ data, className }: SkatteverketGuideProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formattedDate = data.moveDate
    ? new Date(data.moveDate).toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null

  const householdLabel =
    data.householdType === "myself"
      ? "Jag själv"
      : data.householdType === "family"
        ? "Hela familjen"
        : data.householdType === "partner"
          ? "Jag och min partner"
          : data.householdType === "child"
            ? "Mitt barn"
            : data.householdType || null

  const steps: {
    title: string
    description: string
    icon: typeof Shield
    fields?: GuideField[]
    action?: React.ReactNode
  }[] = [
    {
      title: "Logga in med BankID",
      description:
        "Öppna Skatteverkets flyttanmälan och logga in. Ditt namn och personnummer hämtas automatiskt från BankID.",
      icon: Shield,
      action: (
        <Button asChild className="w-full gap-2" size="sm">
          <a href={SKV_URL} target="_blank" rel="noopener noreferrer">
            Öppna Skatteverket
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      ),
    },
    {
      title: "Fyll i ny adress",
      description:
        "Kopiera fälten nedan och klistra in på Skatteverkets sida.",
      icon: MapPin,
      fields: [
        { label: "Gatuadress", value: data.toStreet, key: "street" },
        { label: "Postnummer", value: data.toPostal, key: "postal" },
        { label: "Ort", value: data.toCity, key: "city" },
        { label: "Lägenhetsnummer", value: data.apartmentNumber, key: "apartment" },
        { label: "Fastighetsbeteckning", value: data.propertyDesignation, key: "propertyDesignation" },
        { label: "Fastighetsägare", value: data.propertyOwner, key: "propertyOwner" },
      ],
    },
    {
      title: "Ange flyttdatum",
      description: "Fyll i datumet du flyttar in till din nya bostad.",
      icon: CalendarDays,
      fields: [
        {
          label: "Inflyttningsdatum",
          value: formattedDate || data.moveDate,
          key: "date",
        },
      ],
    },
    {
      title: "Välj vilka som flyttar",
      description: "Ange om du flyttar ensam eller med familjemedlemmar.",
      icon: Users,
      fields: householdLabel
        ? [{ label: "Hushåll", value: householdLabel, key: "household" }]
        : undefined,
    },
    {
      title: "Granska och skicka",
      description:
        "Kontrollera alla uppgifter och klicka 'Skicka in flyttanmälan' på Skatteverkets sida.",
      icon: CheckCircle2,
    },
  ]

  return (
    <Card className={cn("border-primary/30", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Skatteverket-guide
          </CardTitle>
          <Badge className="bg-primary/10 text-primary text-xs">
            Steg-för-steg
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Följ stegen nedan medan du har Skatteverkets sida öppen. Tryck på ett
          fält för att kopiera.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, i) => {
          const isActive = i === activeStep
          const isDone = i < activeStep

          return (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-3 transition-all duration-300 cursor-pointer",
                isActive
                  ? "border-primary/40 bg-primary/5"
                  : isDone
                    ? "border-border/30 bg-muted/30"
                    : "border-border/30 opacity-50"
              )}
              onClick={() => setActiveStep(i)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isDone
                      ? "bg-green-100 text-green-700"
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {step.title}
                  </p>

                  {isActive && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  )}

                  {isActive && step.fields && (
                    <div className="mt-2.5 space-y-1.5">
                      {step.fields.map(
                        (field) =>
                          field.value && (
                            <button
                              key={field.key}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(field.value!, field.key)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg border border-primary/20 bg-card p-2.5 text-left transition-colors active:bg-primary/10"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-primary">
                                  {field.label}
                                </p>
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {field.value}
                                </p>
                              </div>
                              {copiedField === field.key ? (
                                <Check className="h-4 w-4 shrink-0 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                            </button>
                          )
                      )}
                    </div>
                  )}

                  {isActive && step.action && (
                    <div className="mt-2.5">{step.action}</div>
                  )}

                  {isActive && i < steps.length - 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveStep(i + 1)
                      }}
                      className="mt-2 gap-1 text-xs h-7 px-2"
                    >
                      Klar, nästa
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}