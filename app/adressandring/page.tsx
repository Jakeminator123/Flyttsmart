"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Shield,
  Lock,
  Home,
  FileText,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { AdressandringStepOneFields } from "@/components/forms/adressandring-step-one-fields";
import type { ChecklistItem } from "@/components/checklist-view";
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget";
import { DidOpenClawBridgeWidget } from "@/components/did-openclaw-bridge-widget";
import { useOpenClawMirror } from "@/hooks/use-openclaw-mirror";
import { useAutofill } from "@/hooks/use-autofill";
import {
  emptyAdressandringForm,
  type AdressandringFormData,
  type AdressandringValidationResult,
} from "@/lib/forms/adressandring";
import {
  parseStartIntent,
  type StartIntentPayload,
} from "@/lib/start-intent";
import {
  clearStoredAdressandringPrefill,
  readMiniMifContext,
  readStoredAdressandringPrefill,
  type MiniMifContext,
} from "@/lib/mif/prefill";

const STEPS = [
  {
    id: 1,
    label: "Start",
    icon: Shield,
    description: "Person, kontakt och en trygg början.",
  },
  {
    id: 2,
    label: "Adresser",
    icon: Home,
    description: "Nuvarande adress och vart du flyttar.",
  },
  {
    id: 3,
    label: "Flytt & klart",
    icon: FileText,
    description: "Sista detaljerna innan du skickar in.",
  },
];

const HOUSEHOLD_TYPE_LABELS: Record<string, string> = {
  myself: "Jag själv",
  family: "Hela familjen",
  partner: "Jag och partner",
  child: "Jag och barn",
};

export default function AdressandringPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moveId, setMoveId] = useState<number | null>(null);
  const [form, setForm] = useState<AdressandringFormData>(emptyAdressandringForm);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<AdressandringValidationResult | null>(null);
  const [startIntent, setStartIntent] = useState<StartIntentPayload | null>(null);
  const [miniMifContext, setMiniMifContext] = useState<MiniMifContext | null>(null);
  const [showAutofillPanel, setShowAutofillPanel] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isLocalMode =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";

    setShowAutofillPanel(!isLocalMode);
  }, []);

  // OpenClaw real-time form mirroring
  const { mirrorField, mirrorStepChange, mirrorSubmit, mirrorEvent } =
    useOpenClawMirror({ formType: "adressandring" });

  const updateForm = useCallback(
    (field: keyof AdressandringFormData, value: string | boolean) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        mirrorField(field, value, next as unknown as Record<string, string | boolean | number>);
        return next;
      });
    },
    [mirrorField]
  );

  const {
    config: autofillConfig,
    active: autofillActive,
    autofillLoading,
    queueSuggestion,
    handleAutofill,
    renderSuggestionBanner,
  } = useAutofill<keyof AdressandringFormData>({
    form: form as unknown as Record<keyof AdressandringFormData, string | boolean>,
    currentStep,
    updateForm,
    mirrorEvent,
  });

  const progressValue = (currentStep / STEPS.length) * 100;
  const activeStepMeta = STEPS.find((step) => step.id === currentStep) ?? STEPS[0];

  // Prefill from startsida/demo (sessionStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let prefillForMirror: Partial<AdressandringFormData> | null = null;
    let startIntentForMirror: StartIntentPayload | null = null;
    const startQuery =
      new URLSearchParams(window.location.search).get("start")?.trim() ?? "";

    try {
      if (startQuery) {
        const parsedStartIntent = parseStartIntent(startQuery);
        setStartIntent(parsedStartIntent);
        startIntentForMirror = parsedStartIntent;

        if (Object.keys(parsedStartIntent.fields).length > 0) {
          setForm((prev) => ({ ...prev, ...parsedStartIntent.fields }));
          prefillForMirror = parsedStartIntent.fields;
        }
      }

      const storedPrefill = readStoredAdressandringPrefill();
      if (storedPrefill) {
        if (Object.keys(storedPrefill.fields).length > 0) {
          setForm((prev) => ({ ...prev, ...storedPrefill.fields }));
          prefillForMirror = storedPrefill.fields as Partial<AdressandringFormData>;
        }
        if (storedPrefill.miniMif) {
          setMiniMifContext(storedPrefill.miniMif);
          if (storedPrefill.miniMif.startIntent?.rawInput) {
            setStartIntent(parseStartIntent(storedPrefill.miniMif.startIntent.rawInput));
          }
        }
      }

      const fallbackMiniMif = readMiniMifContext();
      if (fallbackMiniMif) {
        if (
          (!storedPrefill || Object.keys(storedPrefill.fields).length === 0) &&
          Object.keys(fallbackMiniMif.fields).length > 0
        ) {
          setForm((prev) => ({ ...prev, ...fallbackMiniMif.fields }));
          prefillForMirror = fallbackMiniMif.fields as Partial<AdressandringFormData>;
        }
        if (!storedPrefill?.miniMif) {
          setMiniMifContext(fallbackMiniMif);
          if (fallbackMiniMif.startIntent?.rawInput) {
            setStartIntent(parseStartIntent(fallbackMiniMif.startIntent.rawInput));
          }
        }
      }
    } catch {
      /* ignore malformed session payloads */
    } finally {
      clearStoredAdressandringPrefill();
    }

    if (startIntentForMirror) {
      mirrorEvent(
        "field_change",
        {
          rawInput: startIntentForMirror.rawInput,
          ...startIntentForMirror.fields,
        },
        1
      );
    }

    if (prefillForMirror) {
      mirrorEvent(
        "field_change",
        prefillForMirror as Record<string, string | boolean | number>,
        1
      );
    }
  }, [mirrorEvent]);

  // AI validate person data
  async function handleValidate() {
    setValidating(true);
    try {
      const res = await fetch("/api/ai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${form.firstName} ${form.lastName}`.trim(),
          address: form.fromStreet,
          postal: form.fromPostal,
          city: form.fromCity,
          personalNumber: form.personalNumber,
          email: form.email,
          phone: form.phone,
        }),
      });

      const result = await res.json();
      setValidation({
        confidence: result.confidence || 0,
        suggestions: result.suggestions || [],
      });
    } catch {
      setValidation(null);
    } finally {
      setValidating(false);
    }
  }

  // Generate checklist from deterministic template
  async function generateChecklist(): Promise<ChecklistItem[]> {
    if (!form.moveDate) {
      setChecklistError(
        "Du måste ange ett inflyttningsdatum i steg 3 innan checklistan kan genereras."
      );
      return [];
    }
    setChecklistError(null);
    try {
      const res = await fetch("/api/checklist/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveDate: form.moveDate,
          toCity: form.toCity || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Servern svarade med ett fel. Försök igen.");
      }

      const data = await res.json();
      const items = data.items || [];
      if (items.length === 0) {
        throw new Error("Ingen checklista returnerades. Försök igen.");
      }
      setChecklist(items);
      return items;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Kunde inte generera checklistan.";
      setChecklistError(msg);
      setChecklist([]);
      return [];
    }
  }

  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      let checklistToSubmit = checklist;
      if (checklistToSubmit.length === 0) {
        checklistToSubmit = await generateChecklist();
      }

      const res = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${form.firstName} ${form.lastName}`.trim(),
          firstName: form.firstName,
          lastName: form.lastName,
          personalNumber: form.personalNumber,
          email: form.email,
          phone: form.phone,
          fromStreet: form.fromStreet,
          fromPostal: form.fromPostal,
          fromCity: form.fromCity,
          toStreet: form.toStreet,
          toPostal: form.toPostal,
          toCity: form.toCity,
          apartmentNumber: form.apartmentNumber,
          propertyDesignation: form.propertyDesignation,
          propertyOwner: form.propertyOwner,
          moveDate: form.moveDate,
          householdType: form.householdType,
          reason: form.reason,
          hasChildren: form.hasChildren,
          checklist: checklistToSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Kunde inte registrera flytten.");
      }
      setMoveId(data.moveId);
      setSubmitted(true);
      mirrorSubmit(form as unknown as Record<string, string | boolean | number>);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ett oväntat fel uppstod. Försök igen."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (currentStep === 1 && form.firstName) {
      handleValidate();
    }
    if (currentStep < STEPS.length) {
      const nextStep = currentStep + 1;
      mirrorStepChange(nextStep, form as unknown as Record<string, string | boolean | number>);
      setCurrentStep((s) => s + 1);
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      mirrorStepChange(prevStep, form as unknown as Record<string, string | boolean | number>);
      setCurrentStep((s) => s - 1);
    }
  }

  // ── Success state ────────────────────────────────────────────────────
  // Enkel bekräftelse – Skatteverket-guide, bookmarklet och "Vad händer nu?"
  // visas i dashboarden efter att användaren skickat in via SKV (Playwright,
  // bookmarklet eller manuell guide).
  if (submitted) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-hero-gradient-from to-background px-4 overflow-hidden">
        {/* Animated background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="section-orb-1 -top-1/4 -right-1/4 h-125 w-125" />
          <div className="section-orb-accent -bottom-1/4 -left-1/3 h-150 w-150" />
          <div className="absolute inset-0 dot-grid opacity-[0.08]" />
        </div>
        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-700 mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Tack, {form.firstName}!
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Din flytt är registrerad hos Flytt.io. Gå till dashboarden för att
            fortsätta med BankID och Skatteverket.
          </p>

          <div className="mt-8 flex gap-3 justify-center">
            <Button asChild className="rounded-full px-8" size="lg">
              <Link href={`/dashboard${moveId ? `?id=${moveId}` : ""}`}>
                Till dashboarden
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full px-8"
              size="lg"
            >
              <Link href="/">Startsidan</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-hero-gradient-from via-background to-background">
      <div className="pointer-events-none absolute inset-0 hero-mesh opacity-45" />
      <div className="pointer-events-none absolute inset-0 hero-mesh-accent opacity-30" />
      <div className="pointer-events-none absolute inset-0 noise-overlay opacity-[0.03]" />
      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-1 -top-1/4 -right-1/3 h-150 w-150" />
        <div className="section-orb-2 bottom-1/4 -left-1/4 h-125 w-125" />
        <div className="section-orb-accent top-1/2 right-1/4 h-100 w-100" />
        <div className="absolute inset-0 dot-grid opacity-[0.08]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/30 bg-background/60 backdrop-blur-xl supports-backdrop-filter:bg-background/45">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3.5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm shadow-primary/5 transition-all duration-300 hover:border-primary/20 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Link>
          <Link
            href="/"
            aria-label="Flytt.io - Till startsidan"
            className="rounded-full px-2 py-1 transition-transform duration-300 hover:scale-[1.02]"
          >
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-primary/10 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm shadow-primary/5">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Krypterad</span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl px-4 py-8 lg:py-10">
        <div className="card-hover mb-8 rounded-[30px] border border-border/60 bg-card/80 p-5 shadow-xl shadow-primary/6 backdrop-blur-xl sm:p-6">
          <Badge
            variant="outline"
            className="rounded-full border-primary/15 bg-background/85 px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary"
          >
            Trygg flyttanmälan i tre steg
          </Badge>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                Börja din flytt i lugn takt
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Fyll bara i det du vet just nu. Vi håller ihop personuppgifter,
                adresser och sista bekräftelsen i ett och samma lugna flöde.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
                AI-hjälp när det behövs
              </span>
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
                BankID nära nästa steg
              </span>
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
                Alltid gratis
              </span>
            </div>
          </div>
        </div>

        {/* Step indicators */}
        <div className="mb-8 rounded-[30px] border border-border/60 bg-card/78 p-4 shadow-lg shadow-primary/6 backdrop-blur-xl sm:p-5">
          <div className="grid gap-3 md:grid-cols-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (step.id < currentStep) setCurrentStep(step.id);
                  }}
                  className={cn(
                    "card-hover rounded-[24px] border p-4 text-left transition-all duration-300",
                    isActive
                      ? "border-primary/30 bg-linear-to-br from-primary via-primary to-ring text-primary-foreground shadow-xl shadow-primary/18"
                      : isComplete
                        ? "cursor-pointer border-primary/15 bg-card/92 shadow-md shadow-primary/5 hover:border-primary/25"
                        : "cursor-default border-border/70 bg-background/70"
                  )}
                  disabled={step.id > currentStep}
                  aria-current={isActive ? "step" : undefined}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                        isActive
                          ? "border-white/15 bg-white/10 text-white"
                          : isComplete
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          isActive
                            ? "text-primary-foreground"
                            : "text-foreground"
                        )}
                      >
                        {step.label}
                      </p>
                      <p
                        className={cn(
                          "text-xs leading-relaxed",
                          isActive
                            ? "text-primary-foreground/75"
                            : "text-muted-foreground"
                        )}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Progress value={progressValue} className="h-1.5 flex-1 bg-primary/10" />
            <p className="shrink-0 text-xs font-medium text-muted-foreground">
              Steg {currentStep} av {STEPS.length}
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Just nu: <span className="font-medium text-foreground">{activeStepMeta.label}</span>{" "}
            – {activeStepMeta.description}
          </p>
        </div>

        {startIntent && (
          <div className="card-hover mb-6 rounded-[28px] border border-primary/20 bg-card/92 p-4 shadow-lg shadow-primary/5 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Vi tog med din starttext från startsidan
                </p>
                <p className="text-sm text-muted-foreground">
                  "{startIntent.rawInput}"
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {startIntent.summary.length > 0
                    ? `Vi fyllde i ${startIntent.summary.join(", ")} där det kändes säkert. Bekräfta och komplettera resten steg för steg.`
                    : "Vi kunde inte fylla i något säkert ännu, men du är igång. Fortsätt steg för steg så hjälper vi dig vidare."}
                </p>
              </div>
            </div>
          </div>
        )}

        {miniMifContext && miniMifContext.mode === "personnummer" && (
          <div className="card-hover mb-6 rounded-[28px] border border-emerald-200/80 bg-card/92 p-4 shadow-lg shadow-emerald-500/5 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Mini-MIF hämtade det vi kunde från personnumret
                </p>
                <p className="text-sm text-muted-foreground">
                  {miniMifContext.summary.length > 0
                    ? `Vi fyllde i ${miniMifContext.summary.join(", ")} direkt.`
                    : "Vi sparade personnumret och försöker använda det i nästa steg."}
                </p>
                {miniMifContext.missingCritical.length > 0 && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Fortfarande viktigt för SKV: {miniMifContext.missingCritical.join(", ")}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form card */}
        <Card className="card-hover overflow-hidden rounded-[30px] border border-border/70 bg-card/88 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          {/* ── Step 1: Identification ──────────────────────────────── */}
          {currentStep === 1 && (
            <>
              <CardHeader className="border-b border-border/60 bg-linear-to-r from-primary/6 via-card/98 to-card/95 pb-5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 1 av {STEPS.length}
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl">
                  Person och kontakt
                </CardTitle>
                <CardDescription>
                  Börja med det viktigaste. Har vi personnummer kan vi ofta hjälpa dig snabbare vidare.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <AdressandringStepOneFields
                  fields={{
                    firstName: form.firstName,
                    lastName: form.lastName,
                    personalNumber: form.personalNumber,
                    email: form.email,
                    phone: form.phone,
                  }}
                  onFieldChange={updateForm}
                  renderSuggestionBanner={renderSuggestionBanner}
                  validating={validating}
                  validation={validation}
                />
              </CardContent>
            </>
          )}

          {/* ── Step 2: Addresses ──────────────────────────────────── */}
          {currentStep === 2 && (
            <>
              <CardHeader className="border-b border-border/60 bg-linear-to-r from-primary/6 via-card/98 to-card/95 pb-5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 2 av {STEPS.length}
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl">
                  Adresser
                </CardTitle>
                <CardDescription>
                  Bekräfta din nuvarande adress och fyll i den nya. Autofyll kan hjälpa dig med resten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/35 p-4 sm:p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Home className="h-4 w-4 text-primary" />
                    Nuvarande adress
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      {renderSuggestionBanner("fromStreet")}
                      <Label htmlFor="fromStreet">Gatuadress</Label>
                      <Input
                        id="fromStreet"
                        placeholder="Storgatan 1, lgh 1001"
                        value={form.fromStreet}
                        onChange={(e) =>
                          updateForm("fromStreet", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      {renderSuggestionBanner("fromPostal")}
                      <Label htmlFor="fromPostal">Postnummer</Label>
                      <Input
                        id="fromPostal"
                        placeholder="123 45"
                        value={form.fromPostal}
                        onChange={(e) =>
                          updateForm("fromPostal", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      {renderSuggestionBanner("fromCity")}
                      <Label htmlFor="fromCity">Ort</Label>
                      <Input
                        id="fromCity"
                        placeholder="Stockholm"
                        value={form.fromCity}
                        onChange={(e) => updateForm("fromCity", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/35 p-4 sm:p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Home className="h-4 w-4 text-primary" />
                    Ny adress
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      {renderSuggestionBanner("toStreet")}
                      <Label htmlFor="toStreet">Gatuadress</Label>
                      <Input
                        id="toStreet"
                        placeholder="Kungsgatan 5, lgh 302"
                        value={form.toStreet}
                        onChange={(e) => updateForm("toStreet", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      {renderSuggestionBanner("toPostal")}
                      <Label htmlFor="toPostal">Postnummer</Label>
                      <Input
                        id="toPostal"
                        placeholder="111 22"
                        value={form.toPostal}
                        onChange={(e) => updateForm("toPostal", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      {renderSuggestionBanner("toCity")}
                      <Label htmlFor="toCity">Ort</Label>
                      <Input
                        id="toCity"
                        placeholder="Göteborg"
                        value={form.toCity}
                        onChange={(e) => updateForm("toCity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      {renderSuggestionBanner("apartmentNumber")}
                      <Label htmlFor="apartmentNumber">Lägenhetsnummer</Label>
                      <Input
                        id="apartmentNumber"
                        placeholder="t.ex. 1302"
                        value={form.apartmentNumber}
                        onChange={(e) =>
                          updateForm("apartmentNumber", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      {renderSuggestionBanner("propertyDesignation")}
                      <Label htmlFor="propertyDesignation">
                        Fastighetsbeteckning (valfritt)
                      </Label>
                      <Input
                        id="propertyDesignation"
                        placeholder="t.ex. Rudan mindre 10"
                        value={form.propertyDesignation}
                        onChange={(e) =>
                          updateForm("propertyDesignation", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      {renderSuggestionBanner("propertyOwner")}
                      <Label htmlFor="propertyOwner">
                        Fastighetsägare (valfritt)
                      </Label>
                      <Input
                        id="propertyOwner"
                        placeholder="t.ex. Egen / BRF Solsidan"
                        value={form.propertyOwner}
                        onChange={(e) =>
                          updateForm("propertyOwner", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* AI autofill suggestion */}
                {showAutofillPanel && (
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5">
                    <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                    <p className="flex-1 text-xs text-muted-foreground">
                      {autofillActive
                        ? `Autofyll är aktiv (${autofillConfig.mode === "auto" ? "auto" : "manuell accept"}). Förslag visas ovanför fält.`
                        : "Autofyll är avstängd i denna miljö."}
                    </p>
                    <Button
                      onClick={handleAutofill}
                      disabled={autofillLoading || !autofillActive}
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 text-xs"
                    >
                      {autofillLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {autofillLoading ? "Tar fram förslag..." : "Hämta AI-förslag"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* ── Step 3: Move Details ───────────────────────────────── */}
          {currentStep === 3 && (
            <>
              <CardHeader className="border-b border-border/60 bg-linear-to-r from-primary/6 via-card/98 to-card/95 pb-5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 3 av {STEPS.length}
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl">
                  Flytt och bekräfta
                </CardTitle>
                <CardDescription>
                  Fyll i de sista flyttdetaljerna och kontrollera sammanfattningen innan du skickar in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="rounded-2xl border border-border/70 bg-muted/35 p-4 sm:p-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      {renderSuggestionBanner("moveDate")}
                      <Label htmlFor="moveDate">Inflyttningsdatum</Label>
                      <Input
                        id="moveDate"
                        type="date"
                        value={form.moveDate}
                        onChange={(e) => updateForm("moveDate", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="householdType">Vem flyttar?</Label>
                      <Select
                        value={form.householdType}
                        onValueChange={(v) => updateForm("householdType", v)}
                      >
                        <SelectTrigger id="householdType" className="w-full">
                          <SelectValue placeholder="Välj alternativ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="myself">Jag själv</SelectItem>
                          <SelectItem value="family">Hela familjen</SelectItem>
                          <SelectItem value="partner">
                            Jag och min partner
                          </SelectItem>
                          <SelectItem value="child">Mitt barn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Anledning till flytt</Label>
                  <Select
                    value={form.reason}
                    onValueChange={(v) => updateForm("reason", v)}
                  >
                    <SelectTrigger id="reason" className="w-full">
                      <SelectValue placeholder="Välj anledning" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">Arbete</SelectItem>
                      <SelectItem value="studies">Studier</SelectItem>
                      <SelectItem value="family">Familj</SelectItem>
                      <SelectItem value="housing">Bostadsbyte</SelectItem>
                      <SelectItem value="other">Annat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="hasChildren"
                      checked={form.hasChildren}
                      onCheckedChange={(val) =>
                        updateForm("hasChildren", val === true)
                      }
                    />
                    <Label
                      htmlFor="hasChildren"
                      className="cursor-pointer text-sm text-muted-foreground"
                    >
                      Jag har barn som också flyttar
                    </Label>
                  </div>
                </div>
                {checklistError && !form.moveDate && (
                  <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{checklistError}</span>
                  </div>
                )}

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Checklistan skapas automatiskt efter att du skickat in
                  </div>
                  <p className="mt-1">
                    Du får checklista, påminnelser och erbjudanden i dashboarden
                    i stället för att behöva ta det som ett eget steg redan nu.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/35 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Personuppgifter
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {form.firstName || form.lastName
                        ? `${form.firstName} ${form.lastName}`.trim()
                        : "Lägg till namn i steg 1"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.email || "Ingen e-post angiven ännu"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.phone || "Inget telefonnummer angivet ännu"}
                    </p>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/35 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Flyttdetaljer
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {form.moveDate || "Välj inflyttningsdatum"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {HOUSEHOLD_TYPE_LABELS[form.householdType] || form.householdType || "Välj vem som flyttar"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Checklista och påminnelser skapas automatiskt efter registrering
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/35 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Nuvarande adress
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {form.fromStreet || "Komplettera nuvarande adress i steg 2"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[form.fromPostal, form.fromCity].filter(Boolean).join(" ") || "Postnummer och ort saknas"}
                    </p>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-primary">
                      Ny adress
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {form.toStreet || "Komplettera den nya adressen i steg 2"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[form.toPostal, form.toCity].filter(Boolean).join(" ") || "Postnummer och ort saknas"}
                    </p>
                    {form.apartmentNumber && (
                      <p className="text-xs text-muted-foreground">
                        Lägenhetsnummer: {form.apartmentNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className="section-divider" />

                <div className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Helt gratis
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Flytt.io tar aldrig betalt av dig
                    </p>
                  </div>
                  <p className="font-heading text-2xl font-bold text-green-600">
                    0 kr
                  </p>
                </div>

                <div className="section-divider" />

                {submitError && (
                  <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={agreed}
                      onCheckedChange={(val) => setAgreed(val === true)}
                    />
                    <Label
                      htmlFor="terms"
                      className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
                    >
                      Jag godkänner{" "}
                      <span className="font-medium text-primary underline underline-offset-2">
                        användarvillkoren
                      </span>{" "}
                      och{" "}
                      <span className="font-medium text-primary underline underline-offset-2">
                        integritetspolicyn
                      </span>
                      . Jag samtycker till att Flytt.io behandlar mina uppgifter
                      för att genomföra flytten.
                    </Label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <span>GDPR-säkrad</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    <span>SSL-krypterad</span>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Footer with navigation */}
          <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-linear-to-r from-card/95 via-card/80 to-card/95 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="w-full gap-1.5 rounded-full border-border/70 bg-background/80 px-5 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </Button>

            {currentStep < STEPS.length ? (
              <Button
                onClick={handleNext}
                className="shimmer-btn w-full gap-1.5 rounded-full px-6 shadow-lg shadow-primary/20 sm:w-auto"
              >
                Nästa
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!agreed || submitting}
                className="shimmer-btn w-full gap-1.5 rounded-full px-6 shadow-lg shadow-primary/25 sm:w-auto"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {submitting ? "Skickar..." : "Bekräfta och skicka"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>

      {/* D-ID voice+video agent (primary when MERGE_OC_DID is on) */}
      <DidOpenClawBridgeWidget />

      {/* OpenClaw text chat (hidden when D-ID bridge takes over) */}
      {process.env.NEXT_PUBLIC_MERGE_OC_DID !== "y" && (
        <OpenClawChatWidget
          formType="adressandring"
          formData={form as unknown as Record<string, string | boolean | number>}
          currentStep={currentStep}
          onSuggestion={(field, value) => {
            queueSuggestion(field as keyof AdressandringFormData, value, "openclaw");
          }}
        />
      )}
    </div>
  );
}
