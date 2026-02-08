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
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{
    confidence: number;
    suggestions: string[];
  } | null>(null);
  const [qrPrefilled, setQrPrefilled] = useState(false);

  const progressValue = (currentStep / STEPS.length) * 100;

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
    if (!form.moveDate) return;
    setChecklistLoading(true);
    try {
      const res = await fetch("/api/ai/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveDate: form.moveDate,
          scenario: form.householdType || "apartment, single person",
          hasChildren: form.hasChildren,
        }),
      });

      const data = await res.json();
      setChecklist(data.items || []);
    } catch {
      setChecklist([]);
    } finally {
      setChecklistLoading(false);
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-hero-gradient-from to-background px-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mx-auto max-w-md text-center">
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
          <div className="mt-8 flex gap-3 justify-center">
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
    <div className="min-h-screen bg-linear-to-b from-hero-gradient-from to-background">
      {/* Top bar */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-xl">
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

      <main className="mx-auto max-w-3xl px-4 py-8 lg:py-12">
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
                {/* QR Scanner */}
                <QrScanner
                  onScan={handleQrScan}
                  className="border-primary/20"
                />

                <div className="relative">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    eller fyll i manuellt
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
                  <Badge className="gap-1 bg-primary/10 text-primary">
                    <Sparkles className="h-3 w-3" />
                    AI-genererad
                  </Badge>
                </div>
                <CardTitle className="font-heading text-xl">
                  Din personliga checklista
                </CardTitle>
                <CardDescription>
                  AI har skapat en tidsatt checklista baserad på din flytt den{" "}
                  {form.moveDate || "–"}. Granska och anpassa efter behov.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checklistLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      AI skapar din checklista...
                    </p>
                  </div>
                ) : checklist.length > 0 ? (
                  <ChecklistView items={checklist} />
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
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
