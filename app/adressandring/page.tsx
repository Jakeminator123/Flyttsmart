"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Shield,
  Lock,
  Home,
  CalendarDays,
  ListChecks,
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
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ChecklistView, type ChecklistItem } from "@/components/checklist-view";
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget";
import { useOpenClawMirror } from "@/hooks/use-openclaw-mirror";
import { useAutofill } from "@/hooks/use-autofill";

import { SkatteverketGuide } from "@/components/skatteverket-guide";
import { BookmarkletButton } from "@/components/bookmarklet-button";

const STEPS = [
  { id: 1, label: "Identifiering", icon: Shield },
  { id: 2, label: "Adresser", icon: Home },
  { id: 3, label: "Flyttdetaljer", icon: CalendarDays },
  { id: 4, label: "Checklista", icon: ListChecks },
  { id: 5, label: "Bekräfta", icon: FileText },
];

interface FormData {
  // Person
  firstName: string;
  lastName: string;
  personalNumber: string;
  email: string;
  phone: string;
  // Addresses
  fromStreet: string;
  fromPostal: string;
  fromCity: string;
  toStreet: string;
  toPostal: string;
  toCity: string;
  apartmentNumber: string;
  propertyDesignation: string;
  propertyOwner: string;
  // Move details
  moveDate: string;
  householdType: string;
  reason: string;
  hasChildren: boolean;
}

const emptyForm: FormData = {
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
};

export default function AdressandringPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moveId, setMoveId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklistSource, setChecklistSource] = useState<"template" | null>(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{
    confidence: number;
    suggestions: string[];
  } | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    setIsDevMode(window.location.hostname === "localhost");
  }, []);

  // OpenClaw real-time form mirroring
  const { mirrorField, mirrorStepChange, mirrorSubmit, mirrorEvent } =
    useOpenClawMirror({ formType: "adressandring" });

  const updateForm = useCallback(
    (field: keyof FormData, value: string | boolean) => {
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
  } = useAutofill<keyof FormData>({
    form: form as unknown as Record<keyof FormData, string | boolean>,
    currentStep,
    updateForm,
    mirrorEvent,
  });

  const progressValue = (currentStep / STEPS.length) * 100;

  // Dev prefill from demo page (sessionStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("adressandring-prefill");
      if (!raw) return;
      const prefill = JSON.parse(raw) as Partial<FormData>;
      sessionStorage.removeItem("adressandring-prefill");
      if (Object.keys(prefill).length > 0) {
        setForm((prev) => ({ ...prev, ...prefill }));
      }
    } catch {
      sessionStorage.removeItem("adressandring-prefill");
    }
  }, []);

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
  async function generateChecklist() {
    if (!form.moveDate) {
      setChecklistError(
        "Du måste ange ett inflyttningsdatum i steg 3 innan checklistan kan genereras."
      );
      return;
    }
    setChecklistLoading(true);
    setChecklistError(null);
    setChecklistSource(null);
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
      setChecklistSource("template");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Kunde inte generera checklistan.";
      setChecklistError(msg);
      setChecklist([]);
    } finally {
      setChecklistLoading(false);
    }
  }

  function handleChecklistItemChange(
    index: number,
    changes: Partial<ChecklistItem>
  ) {
    const currentItem = checklist[index];
    if (currentItem) {
      const basePayload = {
        taskKey: currentItem.taskKey || `index_${index}`,
        title: currentItem.title,
        section: currentItem.section || "",
      };
      if (typeof changes.needHelp === "boolean") {
        mirrorEvent(
          changes.needHelp ? "task_open" : "task_close",
          { ...basePayload, needHelp: changes.needHelp },
          currentStep
        );
      }
      if (typeof changes.wantCompare === "boolean") {
        mirrorEvent(
          changes.wantCompare ? "compare_open" : "compare_close",
          { ...basePayload, wantCompare: changes.wantCompare },
          currentStep
        );
      }
    }

    setChecklist((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...changes };
        if (changes.status) {
          next.completed = changes.status === "done";
        }
        return next;
      })
    );
  }

  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
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
          checklist,
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
    if (currentStep === 3) {
      generateChecklist();
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
            Din flytt har registrerats hos Flytt.io. Vi tar hand om resten.
          </p>
          <Separator className="my-8" />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vad händer nu?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  1
                </Badge>
                <span>
                  Din personliga checklista är redo med {checklist.length}{" "}
                  aktiviteter
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  2
                </Badge>
                <span>
                  Du kan följa din flytt och checklista på din dashboard
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  3
                </Badge>
                <span>
                  Vi hjälper dig med flyttanmälan till Skatteverket
                </span>
              </div>
            </CardContent>
          </Card>
          {/* Skatteverket guide + QR */}
          <div className="mt-6 space-y-4 text-left">
            <SkatteverketGuide
              data={{
                name: `${form.firstName} ${form.lastName}`.trim(),
                personalNumber: form.personalNumber,
                toStreet: form.toStreet,
                toPostal: form.toPostal,
                toCity: form.toCity,
                apartmentNumber: form.apartmentNumber,
                propertyDesignation: form.propertyDesignation,
                propertyOwner: form.propertyOwner,
                moveDate: form.moveDate,
                householdType: form.householdType,
              }}
            />

            {/* Bookmarklet for Skatteverket auto-fill */}
            <BookmarkletButton
              data={{
                name: `${form.firstName} ${form.lastName}`.trim(),
                personalNumber: form.personalNumber,
                toStreet: form.toStreet,
                toPostal: form.toPostal,
                toCity: form.toCity,
                apartmentNumber: form.apartmentNumber,
                propertyDesignation: form.propertyDesignation,
                propertyOwner: form.propertyOwner,
                moveDate: form.moveDate,
                email: form.email,
                phone: form.phone,
              }}
            />

          </div>

          <div className="mt-6 flex gap-3 justify-center">
            <Button asChild className="rounded-full px-8" size="lg">
              <Link href={`/dashboard${moveId ? `?id=${moveId}` : ""}`}>
                Min flytt
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
    <div className="relative min-h-screen bg-linear-to-b from-hero-gradient-from to-background overflow-hidden">
      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-1 -top-1/4 -right-1/3 h-150 w-150" />
        <div className="section-orb-2 bottom-1/4 -left-1/4 h-125 w-125" />
        <div className="section-orb-accent top-1/2 right-1/4 h-100 w-100" />
        <div className="absolute inset-0 dot-grid opacity-[0.06]" />
      </div>

      {/* Top bar */}
      <header className="relative border-b border-border/50 bg-card/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Link>
          <Link href="/" aria-label="Flytt.io - Till startsidan">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Krypterad</span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-8 lg:py-12">
        {/* Step indicators */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
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
                    "flex flex-col items-center gap-1.5 transition-all duration-300",
                    isActive
                      ? "scale-105"
                      : isComplete
                        ? "cursor-pointer opacity-80 hover:opacity-100"
                        : "opacity-40 cursor-default"
                  )}
                  disabled={step.id > currentStep}
                  aria-current={isActive ? "step" : undefined}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                        : isComplete
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "hidden text-xs font-medium sm:block",
                      isActive
                        ? "text-primary"
                        : isComplete
                          ? "text-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
          <Progress value={progressValue} className="h-1.5" />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Steg {currentStep} av {STEPS.length}
          </p>
        </div>

        {/* Form card */}
        <Card className="shadow-xl shadow-primary/5 border-border/60">
          {/* ── Step 1: Identification ──────────────────────────────── */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 1
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl">
                  Identifiering
                </CardTitle>
                <CardDescription>
                  Ange dina personuppgifter nedan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Dev mode: prefill with test data */}
                {isDevMode && (
                    <div className="rounded-lg border border-dashed border-yellow-400 bg-yellow-50 p-3">
                      <p className="text-xs font-semibold text-yellow-800 mb-2">
                        Dev mode – Fyll med testdata:
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs border-yellow-400 text-yellow-800 hover:bg-yellow-100"
                        onClick={() => {
                          const nextForm: FormData = {
                            firstName: "Anna",
                            lastName: "Andersson",
                            personalNumber: "19900101-1234",
                            email: "anna@exempel.se",
                            phone: "070-123 45 67",
                            fromStreet: "Storgatan 1, lgh 1001",
                            fromPostal: "111 22",
                            fromCity: "Stockholm",
                            toStreet: "Kungsgatan 5, lgh 302",
                            toPostal: "411 19",
                            toCity: "Göteborg",
                            apartmentNumber: "1302",
                            propertyDesignation: "Rudan mindre 10",
                            propertyOwner: "Egen",
                            moveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                            householdType: "myself",
                            reason: "work",
                            hasChildren: false,
                          };
                          setForm(nextForm);
                          mirrorEvent(
                            "field_change",
                            nextForm as unknown as Record<string, string | boolean | number>,
                            currentStep
                          );
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Fyll med testdata
                      </Button>
                    </div>
                  )}

                {/* Manual entry */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    {renderSuggestionBanner("firstName")}
                    <Label htmlFor="firstName">Förnamn</Label>
                    <Input
                      id="firstName"
                      placeholder="Anna"
                      value={form.firstName}
                      onChange={(e) => updateForm("firstName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    {renderSuggestionBanner("lastName")}
                    <Label htmlFor="lastName">Efternamn</Label>
                    <Input
                      id="lastName"
                      placeholder="Andersson"
                      value={form.lastName}
                      onChange={(e) => updateForm("lastName", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {renderSuggestionBanner("personalNumber")}
                  <Label htmlFor="personalNumber">Personnummer</Label>
                  <Input
                    id="personalNumber"
                    placeholder="YYYYMMDD-XXXX"
                    value={form.personalNumber}
                    onChange={(e) =>
                      updateForm("personalNumber", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Används för att verifiera din identitet.
                  </p>
                </div>
                <Separator />
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    {renderSuggestionBanner("email")}
                    <Label htmlFor="email">E-postadress</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="anna@exempel.se"
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    {renderSuggestionBanner("phone")}
                    <Label htmlFor="phone">Telefonnummer</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="070-123 45 67"
                      value={form.phone}
                      onChange={(e) => updateForm("phone", e.target.value)}
                    />
                  </div>
                </div>

                {/* AI validation feedback */}
                {validating && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">
                      AI validerar dina uppgifter...
                    </span>
                  </div>
                )}
                {validation && !validating && (
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      validation.confidence >= 70
                        ? "border-green-200 bg-green-50"
                        : "border-yellow-200 bg-yellow-50"
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI-validering: {validation.confidence}% konfidenspoäng
                    </div>
                    {validation.suggestions.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {validation.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* ── Step 2: Addresses ──────────────────────────────────── */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 2
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl">
                  Adresser
                </CardTitle>
                <CardDescription>
                  Ange din nuvarande adress och din nya adress.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
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

                <Separator />

                <div className="space-y-4">
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
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
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
              </CardContent>
            </>
          )}

          {/* ── Step 3: Move Details ───────────────────────────────── */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 3
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl">
                  Flyttdetaljer
                </CardTitle>
                <CardDescription>
                  Ange datum, vem som flyttar och scenario.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
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
                <Separator />
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="hasChildren"
                    checked={form.hasChildren}
                    onCheckedChange={(val) =>
                      updateForm("hasChildren", val === true)
                    }
                  />
                  <Label
                    htmlFor="hasChildren"
                    className="text-sm cursor-pointer"
                  >
                    Jag har barn som också flyttar
                  </Label>
                </div>
                {checklistError && !form.moveDate && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{checklistError}</span>
                  </div>
                )}

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Flyttlistan laddas i nästa steg
                  </div>
                  <p className="mt-1">
                    Du får en komplett checklista med kolumnerna Behöver hjälp,
                    Vill jämföra och Status.
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 4: Checklist matrix ───────────────────────────── */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 4
                  </Badge>
                  {checklistSource === "template" && (
                    <Badge className="gap-1 bg-primary/10 text-primary">
                      <ListChecks className="h-3 w-3" />
                      Mallbaserad
                    </Badge>
                  )}
                </div>
                <CardTitle className="font-heading text-xl">
                  Din flyttlista
                </CardTitle>
                <CardDescription>
                  Markera vilka moment du vill ha hjalp med, vad du vill jamfora
                  och hur langt du har kommit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checklistLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Laddar flyttlistan...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Detta kan ta några sekunder
                    </p>
                  </div>
                ) : checklist.length > 0 ? (
                  <ChecklistView
                    items={checklist}
                    onItemChange={handleChecklistItemChange}
                    moveContext={{
                      toPostal: form.toPostal || undefined,
                      toCity: form.toCity || undefined,
                      moveDate: form.moveDate || undefined,
                      toStreet: form.toStreet || undefined,
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    {checklistError ? (
                      <>
                        <AlertCircle className="h-8 w-8 text-destructive" />
                        <p className="text-sm font-medium text-destructive">
                          {checklistError}
                        </p>
                        <Button
                          onClick={() => {
                            if (!form.moveDate) {
                              setCurrentStep(3);
                            } else {
                              generateChecklist();
                            }
                          }}
                          variant="outline"
                          className="gap-2"
                        >
                          {!form.moveDate ? (
                            <>
                              <ArrowLeft className="h-4 w-4" />
                              Gå till steg 3
                            </>
                          ) : (
                            <>
                              <ListChecks className="h-4 w-4" />
                              Försök igen
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <ListChecks className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Ingen checklista genererad ännu.
                        </p>
                        <Button
                          onClick={generateChecklist}
                          variant="outline"
                          className="gap-2"
                        >
                          <ListChecks className="h-4 w-4" />
                          Ladda flyttlista
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* ── Step 5: Confirm ────────────────────────────────────── */}
          {currentStep === 5 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 5
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl">
                  Granska och bekräfta
                </CardTitle>
                <CardDescription>
                  Kontrollera att alla uppgifter stämmer innan du skickar in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Personuppgifter
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {form.firstName} {form.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.phone}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Flyttdetaljer
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {form.moveDate || "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.householdType || "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Checklista: {checklist.length} aktiviteter
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Nuvarande adress
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {form.fromStreet || "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.fromPostal} {form.fromCity}
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">
                      Ny adress
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {form.toStreet || "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.toPostal} {form.toCity}
                    </p>
                    {form.apartmentNumber && (
                      <p className="text-xs text-muted-foreground">
                        Lägenhetsnummer: {form.apartmentNumber}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Free service banner */}
                <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4">
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

                <Separator />

                {submitError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={agreed}
                    onCheckedChange={(val) => setAgreed(val === true)}
                  />
                  <Label
                    htmlFor="terms"
                    className="text-sm leading-relaxed text-muted-foreground cursor-pointer"
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
          <CardFooter className="flex items-center justify-between border-t border-border pt-6">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </Button>

            {currentStep < STEPS.length ? (
              <Button
                onClick={handleNext}
                className="gap-1.5 rounded-full px-6"
              >
                Nästa
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!agreed || submitting}
                className="gap-1.5 rounded-full px-6 shadow-lg shadow-primary/25"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {submitting ? "Skickar..." : "Skicka in"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>

      {/* OpenClaw chat widget */}
      <OpenClawChatWidget
        formType="adressandring"
        formData={form as unknown as Record<string, string | boolean | number>}
        currentStep={currentStep}
        onSuggestion={(field, value) => {
          queueSuggestion(field as keyof FormData, value, "openclaw");
        }}
      />
    </div>
  );
}
