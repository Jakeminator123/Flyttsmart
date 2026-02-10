"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Shield,
  Lock,
  QrCode,
  Home,
  CalendarDays,
  ListChecks,
  FileText,
  Loader2,
  Sparkles,
  AlertCircle,
  Smartphone,
  Copy,
  Check,
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
import { QrScanner } from "@/components/qr-scanner";
import { ChecklistView, type ChecklistItem } from "@/components/checklist-view";
import { AiChatBubble } from "@/components/ai-chat-bubble";
import { SkatteverketGuide } from "@/components/skatteverket-guide";
import { BookmarkletButton } from "@/components/bookmarklet-button";

const STEPS = [
  { id: 1, label: "Identifiering", icon: QrCode },
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
  const [checklistSource, setChecklistSource] = useState<
    "ai" | "fallback" | null
  >(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{
    confidence: number;
    suggestions: string[];
  } | null>(null);
  const [qrPrefilled, setQrPrefilled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileQrImage, setMobileQrImage] = useState<string | null>(null);
  const [mobileQrLoading, setMobileQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileQrUrl, setMobileQrUrl] = useState<string | null>(null);
  const [autofillLoading, setAutofillLoading] = useState(false);

  const progressValue = (currentStep / STEPS.length) * 100;

  // Detect mobile vs desktop
  useEffect(() => {
    const touch = navigator.maxTouchPoints > 0;
    const narrow = window.matchMedia("(max-width: 768px)").matches;
    setIsMobile(touch && narrow);
  }, []);

  // Auto-generate QR when entering step 5
  useEffect(() => {
    if (currentStep === 5 && !mobileQrImage && !mobileQrLoading && form.firstName) {
      generateMobileQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Check for QR prefill data on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("qr_prefill");
      if (stored) {
        const data = JSON.parse(stored);
        const nameParts = (data.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Parse address into parts
        let street = "";
        let postal = "";
        let city = "";
        if (data.address) {
          const parts = data.address.split(",").map((s: string) => s.trim());
          street = parts[0] || "";
          const rest = parts[1] || "";
          const postalMatch = rest.match(/^(\d{3}\s?\d{2})\s*(.*)/);
          if (postalMatch) {
            postal = postalMatch[1];
            city = postalMatch[2];
          } else {
            city = rest;
          }
        }

        setForm((prev) => ({
          ...prev,
          firstName,
          lastName,
          personalNumber: data.personalNumber || "",
          email: data.email || "",
          phone: data.phone || "",
          fromStreet: street,
          fromPostal: postal,
          fromCity: city,
        }));
        setQrPrefilled(true);
        sessionStorage.removeItem("qr_prefill");
      }
    } catch {
      // ignore errors
    }
  }, []);

  const updateForm = useCallback(
    (field: keyof FormData, value: string | boolean) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Handle QR scan result
  async function handleQrScan(rawData: string) {
    try {
      const res = await fetch("/api/qr/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawData }),
      });

      if (!res.ok) throw new Error("Invalid QR");

      const { data } = await res.json();
      const nameParts = (data.name || "").split(" ");

      let street = "",
        postal = "",
        city = "";
      if (data.address) {
        const parts = data.address.split(",").map((s: string) => s.trim());
        street = parts[0] || "";
        const rest = parts[1] || "";
        const postalMatch = rest.match(/^(\d{3}\s?\d{2})\s*(.*)/);
        if (postalMatch) {
          postal = postalMatch[1];
          city = postalMatch[2];
        } else {
          city = rest;
        }
      }

      setForm((prev) => ({
        ...prev,
        firstName: nameParts[0] || prev.firstName,
        lastName: nameParts.slice(1).join(" ") || prev.lastName,
        personalNumber: data.personalNumber || prev.personalNumber,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        fromStreet: street || prev.fromStreet,
        fromPostal: postal || prev.fromPostal,
        fromCity: city || prev.fromCity,
      }));
      setQrPrefilled(true);
    } catch {
      // QR decoding failed, user can fill in manually
    }
  }

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

  // Generate checklist via AI
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
      const res = await fetch("/api/ai/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveDate: form.moveDate,
          scenario: form.householdType || "apartment, single person",
          hasChildren: form.hasChildren,
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
      setChecklistSource(data.source || "ai");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Kunde inte generera checklistan.";
      setChecklistError(msg);
      setChecklist([]);
    } finally {
      setChecklistLoading(false);
    }
  }

  // Generate QR code for mobile handoff
  async function generateMobileQr() {
    setMobileQrLoading(true);
    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${form.firstName} ${form.lastName}`.trim(),
          personalNumber: form.personalNumber,
          address: form.fromStreet
            ? `${form.fromStreet}, ${form.fromPostal} ${form.fromCity}`
            : undefined,
          email: form.email,
          phone: form.phone,
          toStreet: form.toStreet,
          toPostal: form.toPostal,
          toCity: form.toCity,
          moveDate: form.moveDate,
        }),
      });

      const data = await res.json();
      if (data.qrImage) {
        setMobileQrImage(data.qrImage);
      }
      if (data.url) {
        setMobileQrUrl(data.url);
      }
    } catch {
      // QR generation failed silently
    } finally {
      setMobileQrLoading(false);
    }
  }

  // Copy address to clipboard
  async function copyNewAddress() {
    const addr = [form.toStreet, `${form.toPostal} ${form.toCity}`]
      .filter(Boolean)
      .join(", ");
    await navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // AI autofill – suggest missing fields based on what's already entered
  async function handleAutofill() {
    setAutofillLoading(true);
    try {
      const res = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          personalNumber: form.personalNumber,
          fromStreet: form.fromStreet,
          fromPostal: form.fromPostal,
          fromCity: form.fromCity,
          toStreet: form.toStreet,
          toPostal: form.toPostal,
          toCity: form.toCity,
        }),
      });

      const data = await res.json();
      if (data.suggestions) {
        setForm((prev) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(data.suggestions)) {
            if (value && !prev[key as keyof FormData]) {
              (next as Record<string, unknown>)[key] = value;
            }
          }
          return next as FormData;
        });
      }
    } catch {
      // Autofill failed silently
    } finally {
      setAutofillLoading(false);
    }
  }

  // Submit the move
  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${form.firstName} ${form.lastName}`.trim(),
          personalNumber: form.personalNumber,
          email: form.email,
          phone: form.phone,
          fromStreet: form.fromStreet,
          fromPostal: form.fromPostal,
          fromCity: form.fromCity,
          toStreet: form.toStreet,
          toPostal: form.toPostal,
          toCity: form.toCity,
          moveDate: form.moveDate,
          householdType: form.householdType,
          reason: form.reason,
          checklist,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMoveId(data.moveId);
        setSubmitted(true);
      }
    } catch {
      // Handle error silently for now
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (currentStep === 1 && form.firstName) {
      handleValidate();
    }
    if (currentStep === 3) {
      if (!form.moveDate) {
        setChecklistError(
          "Ange ett inflyttningsdatum innan du går vidare."
        );
        return;
      }
      setChecklistError(null);
      generateChecklist();
    }
    if (currentStep < STEPS.length) {
      setCurrentStep((s) => s + 1);
    }
  }

  function handlePrev() {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
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
                moveDate: form.moveDate,
                email: form.email,
                phone: form.phone,
              }}
            />

            {/* QR for mobile handoff */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <QrCode className="h-4 w-4 text-primary" />
                  Skicka till mobilen
                </CardTitle>
                <CardDescription className="text-xs">
                  Skanna QR-koden med din mobil för att få guiden och alla
                  uppgifter direkt i telefonen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mobileQrImage ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-xl border bg-white p-3 shadow-sm">
                      <img
                        src={mobileQrImage}
                        alt="QR-kod för Skatteverket"
                        className="h-40 w-40"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Rikta kameran mot koden
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={generateMobileQr}
                    disabled={mobileQrLoading}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    {mobileQrLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {mobileQrLoading ? "Genererar..." : "Visa QR-kod"}
                  </Button>
                )}

                {/* Copy new address shortcut */}
                {form.toStreet && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyNewAddress}
                    className="w-full gap-2"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied
                      ? "Kopierad!"
                      : `Kopiera: ${form.toStreet}, ${form.toPostal} ${form.toCity}`}
                  </Button>
                )}
              </CardContent>
            </Card>
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
                  {qrPrefilled && (
                    <Badge className="gap-1 bg-primary/10 text-primary">
                      <QrCode className="h-3 w-3" />
                      QR-ifylld
                    </Badge>
                  )}
                </div>
                <CardTitle className="font-heading text-xl">
                  Identifiering
                </CardTitle>
                <CardDescription>
                  Skanna en QR-kod för att fylla i automatiskt, eller ange dina
                  uppgifter manuellt.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* QR Scanner on mobile, info card on desktop */}
                {isMobile ? (
                  <QrScanner
                    onScan={handleQrScan}
                    className="border-primary/20"
                  />
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Fortsätt till Skatteverket via mobilen
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        Fyll i dina uppgifter nedan. I sista steget kan du
                        generera en QR-kod att skanna med mobilen — dina
                        uppgifter skickas till telefonen så du kan göra
                        flyttanmälan hos Skatteverket direkt.
                      </p>
                    </div>
                  </div>
                )}

                {/* Dev mode: prefill with test data */}
                {typeof window !== "undefined" &&
                  window.location.hostname === "localhost" && (
                    <div className="rounded-lg border border-dashed border-yellow-400 bg-yellow-50 p-3">
                      <p className="text-xs font-semibold text-yellow-800 mb-2">
                        Dev mode – Testa QR-förifyllning:
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs border-yellow-400 text-yellow-800 hover:bg-yellow-100"
                        onClick={() => {
                          setForm({
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
                            moveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                            householdType: "myself",
                            reason: "work",
                            hasChildren: false,
                          });
                          setQrPrefilled(true);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Fyll med testdata (simulera QR-scan)
                      </Button>
                    </div>
                  )}

                <div className="relative">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    {isMobile ? "eller fyll i manuellt" : "Fyll i dina uppgifter"}
                  </span>
                </div>

                {/* Manual entry */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Förnamn</Label>
                    <Input
                      id="firstName"
                      placeholder="Anna"
                      value={form.firstName}
                      onChange={(e) => updateForm("firstName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
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
                    {qrPrefilled && (
                      <Badge
                        variant="secondary"
                        className="ml-1 gap-1 text-xs"
                      >
                        <QrCode className="h-3 w-3" />
                        från QR
                      </Badge>
                    )}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
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
                      <Label htmlFor="toStreet">Gatuadress</Label>
                      <Input
                        id="toStreet"
                        placeholder="Kungsgatan 5, lgh 302"
                        value={form.toStreet}
                        onChange={(e) => updateForm("toStreet", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toPostal">Postnummer</Label>
                      <Input
                        id="toPostal"
                        placeholder="111 22"
                        value={form.toPostal}
                        onChange={(e) => updateForm("toPostal", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toCity">Ort</Label>
                      <Input
                        id="toCity"
                        placeholder="Göteborg"
                        value={form.toCity}
                        onChange={(e) => updateForm("toCity", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* AI autofill suggestion */}
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <p className="flex-1 text-xs text-muted-foreground">
                    Saknar du postnummer eller ort? AI kan försöka komplettera.
                  </p>
                  <Button
                    onClick={handleAutofill}
                    disabled={autofillLoading}
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-xs"
                  >
                    {autofillLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {autofillLoading ? "Fyller i..." : "AI-komplettera"}
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
                    AI-checklista genereras i nästa steg
                  </div>
                  <p className="mt-1">
                    Baserat på ditt inflyttningsdatum och scenario skapar vår AI
                    en personlig, tidsatt checklista.
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 4: AI Checklist ───────────────────────────────── */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary">
                    Steg 4
                  </Badge>
                  {checklistSource === "ai" && (
                    <Badge className="gap-1 bg-primary/10 text-primary">
                      <Sparkles className="h-3 w-3" />
                      AI-genererad
                    </Badge>
                  )}
                  {checklistSource === "fallback" && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-orange-600"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Standardchecklista
                    </Badge>
                  )}
                </div>
                <CardTitle className="font-heading text-xl">
                  Din personliga checklista
                </CardTitle>
                <CardDescription>
                  {checklistSource === "fallback"
                    ? "AI-tjänsten var inte tillgänglig. Här är en standardchecklista anpassad efter ditt flyttdatum."
                    : `AI har skapat en tidsatt checklista baserad på din flytt den ${form.moveDate || "–"}${form.toCity ? ` till ${form.toCity}` : ""}. Inkluderar områdestips!`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checklistLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      AI skapar din checklista...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Detta kan ta några sekunder
                    </p>
                  </div>
                ) : checklist.length > 0 ? (
                  <div className="space-y-4">
                    {checklistSource === "fallback" && (
                      <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                        <div>
                          <p className="font-medium text-orange-800">
                            Standardchecklista visas
                          </p>
                          <p className="mt-0.5 text-orange-700">
                            AI-tjänsten kunde inte nås. Du kan försöka generera
                            en AI-anpassad checklista igen.
                          </p>
                          <Button
                            onClick={generateChecklist}
                            variant="outline"
                            size="sm"
                            className="mt-2 gap-1.5"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Försök igen med AI
                          </Button>
                        </div>
                      </div>
                    )}
                    <ChecklistView items={checklist} />
                  </div>
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
                              <Sparkles className="h-4 w-4" />
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
                          <Sparkles className="h-4 w-4" />
                          Generera checklista
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
                  </div>
                </div>

                <Separator />

                {/* Mobile handoff via QR */}
                {!isMobile && (
                  <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        Gör flyttanmälan via mobilen
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Skanna QR-koden med din mobil för att få alla uppgifter
                      skickade dit. Mobilen visar ett referenskort med din nya
                      adress och flyttdatum, plus en direktlänk till
                      Skatteverkets flyttanmälan.
                    </p>

                    {mobileQrLoading && !mobileQrImage && (
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">
                          Genererar QR-kod...
                        </span>
                      </div>
                    )}

                    {mobileQrImage && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-xl border bg-white p-3 shadow-sm">
                          <img
                            src={mobileQrImage}
                            alt="QR-kod för mobilen"
                            className="h-48 w-48"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Öppna kameran på din telefon och rikta den mot koden
                        </p>
                      </div>
                    )}

                    {!mobileQrImage && !mobileQrLoading && (
                      <Button
                        onClick={generateMobileQr}
                        variant="outline"
                        className="w-full gap-2"
                      >
                        <QrCode className="h-4 w-4" />
                        Visa QR-kod för mobilen
                      </Button>
                    )}

                    {/* Dev mode: clickable test link */}
                    {mobileQrUrl &&
                      typeof window !== "undefined" &&
                      window.location.hostname === "localhost" && (
                        <div className="rounded-lg border border-dashed border-yellow-400 bg-yellow-50 p-3 text-xs">
                          <p className="font-semibold text-yellow-800">
                            Dev mode – Testa QR-flödet:
                          </p>
                          <a
                            href={mobileQrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block truncate text-primary underline underline-offset-2"
                          >
                            {mobileQrUrl}
                          </a>
                        </div>
                      )}
                  </div>
                )}

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

      {/* AI Chat Bubble */}
      <AiChatBubble />
    </div>
  );
}
