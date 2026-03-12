"use client";

import { useEffect, useState, Suspense, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Home,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  PlayCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/logo";
import { MoveTimeline, type MoveStatus } from "@/components/move-timeline";
import { ChecklistView, type ChecklistItem } from "@/components/checklist-view";
import { SkatteverketGuide } from "@/components/skatteverket-guide";
import { BookmarkletButton } from "@/components/bookmarklet-button";
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget";
import { BankIdQrMirror } from "@/components/bankid-qr-mirror";

interface MoveData {
  move: {
    id: number;
    userId: number;
    fromStreet: string | null;
    fromPostal: string | null;
    fromCity: string | null;
    toStreet: string | null;
    toPostal: string | null;
    toCity: string | null;
    apartmentNumber: string | null;
    propertyDesignation: string | null;
    propertyOwner: string | null;
    moveDate: string | null;
    householdType: string | null;
    reason: string | null;
    status: string;
    createdAt: string;
  };
  user: {
    id: number;
    name: string;
    personalNumber: string | null;
    email: string | null;
    phone: string | null;
  };
  checklist: ChecklistItem[];
}

function daysUntilMove(moveDate: string | null) {
  if (!moveDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(moveDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const moveId = searchParams.get("id");
  const [data, setData] = useState<MoveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skvStarting, setSkvStarting] = useState(false);
  const [skvStatus, setSkvStatus] = useState<string | null>(null);
  const [cloneQrStateUrl, setCloneQrStateUrl] = useState<string | null>(null);
  const [cloneQrImageUrl, setCloneQrImageUrl] = useState<string | null>(null);
  const [int7StatusUrl, setInt7StatusUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!moveId) {
      setError("Inget flytt-ID angivet. Gå tillbaka och registrera en flytt.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/move?id=${moveId}`);
        if (!res.ok) throw new Error("Flytten hittades inte");
        setData(await res.json());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Okänt fel");
      } finally {
        setLoading(false);
      }
    })();
  }, [moveId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg font-medium text-foreground">
          {error || "Flytten hittades inte"}
        </p>
        <Button asChild>
          <Link href="/adressandring">Registrera en flytt</Link>
        </Button>
      </div>
    );
  }

  const { move, user, checklist } = data;
  const status = (move.status || "draft") as MoveStatus;
  const days = daysUntilMove(move.moveDate);
  const completedCount = checklist.filter((c) => c.completed).length;
  const compareReadyCount = checklist.filter(
    (c) => Boolean(c.taskKey) || (Array.isArray(c.comparisonHints) && c.comparisonHints.length > 0),
  ).length;
  const helpFlagCount = checklist.filter((c) => c.needHelp).length;
  const firstName = user.name.split(" ")[0];

  async function handleStartSkv() {
    if (!data) return;
    setSkvStarting(true);
    setSkvStatus(null);
    try {
      const [first = "", ...rest] = data.user.name.split(" ");
      const res = await fetch("/api/skv/int7/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveId: data.move.id,
          formData: {
            name: data.user.name,
            firstName: first,
            lastName: rest.join(" "),
            personalNumber: data.user.personalNumber,
            email: data.user.email,
            phone: data.user.phone,
            toStreet: data.move.toStreet,
            toPostal: data.move.toPostal,
            toCity: data.move.toCity,
            apartmentNumber: data.move.apartmentNumber,
            propertyDesignation: data.move.propertyDesignation,
            propertyOwner: data.move.propertyOwner,
            moveDate: data.move.moveDate,
          },
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || "Kunde inte starta Skatteverket-flödet.");
      }
      setInt7StatusUrl(typeof body?.statusUrl === "string" ? body.statusUrl : null);
      if (body?.cloneQrEnabled && body?.cloneQrStateUrl) {
        setCloneQrStateUrl(body.cloneQrStateUrl);
        setCloneQrImageUrl(body.cloneQrImageUrl ?? null);
        setSkvStatus("Skanna BankID-QR nedan för att logga in.");
      } else {
        setSkvStatus("Flödet startat. Verifiera med BankID.");
      }
    } catch {
      setSkvStatus(
        "Kunde inte starta. Kontrollera att backend körs och försök igen.",
      );
    } finally {
      setSkvStarting(false);
    }
  }

  function blockSkvKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-hero-gradient-from to-background">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Startsidan</span>
          </Link>
          <Link href="/" aria-label="Flytt.io - Till startsidan">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Säkert</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 lg:py-12">
        {/* ── Welcome ─────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hej {firstName}!
          </h1>
          <p className="mt-1 text-muted-foreground">
            {days !== null && days > 0
              ? `${days} dagar kvar till flytten.`
              : days === 0
                ? "Idag är flyttdagen!"
                : "Här ser du din flytt och checklista."}
          </p>
        </div>

        {/* ── Status cards ────────────────────────────────────── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card className="group transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Flyttar till</p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {move.toCity || "–"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Inflyttningsdatum
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {move.moveDate || "–"}
                </p>
                {days !== null && days > 0 && (
                  <p className="text-[10px] text-primary font-medium">
                    {days} dagar kvar
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="group transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Checklista</p>
                <p className="text-sm font-semibold text-foreground">
                  {completedCount}/{checklist.length} klara
                </p>
                {checklist.length > 0 && (
                  <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${Math.round((completedCount / checklist.length) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────── */}
        <Tabs defaultValue="skatteverket" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
              <Home className="h-4 w-4" />
              Översikt
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardList className="h-4 w-4" />
              AI-checklista
            </TabsTrigger>
            <TabsTrigger value="skatteverket" className="gap-1.5 text-xs sm:text-sm">
              <Landmark className="h-4 w-4" />
              Skatteverket
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ──────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Flytt-status</CardTitle>
                  <CardDescription className="text-xs">
                    Var du befinner dig i processen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MoveTimeline status={status} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dina uppgifter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      {user.email && (
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                      {user.phone && (
                        <p className="text-xs text-muted-foreground">
                          {user.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Från
                        </p>
                        <p className="text-sm font-medium">
                          {move.fromStreet || "–"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {move.fromPostal} {move.fromCity}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-primary">
                          Till
                        </p>
                        <p className="text-sm font-semibold">
                          {move.toStreet || "–"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {move.toPostal} {move.toCity}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Snabbåtgärder</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 py-4 text-xs"
                    asChild
                  >
                    <a
                      href="https://www.skatteverket.se/privat/folkbokforing/flyttanmalan.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Landmark className="h-5 w-5 text-primary" />
                      <span className="font-medium">Flyttanmälan</span>
                      <span className="text-muted-foreground">Skatteverket</span>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 py-4 text-xs"
                    asChild
                  >
                    <a
                      href="https://www.postnord.se/ta-emot/eftersandning-och-adressandring"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium">Eftersändning</span>
                      <span className="text-muted-foreground">PostNord</span>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 py-4 text-xs"
                    asChild
                  >
                    <a
                      href="https://www.1177.se/andra-kontaktuppgifter/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      <span className="font-medium">Kontaktuppgifter</span>
                      <span className="text-muted-foreground">1177.se</span>
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Checklist ─────────────────────────────────────── */}
          <TabsContent value="checklist" className="space-y-6">
            <div className="rounded-2xl border bg-linear-to-br from-primary/5 via-background to-accent/10 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                  Efter flytten
                </Badge>
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {completedCount}/{checklist.length} klara
                </Badge>
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {compareReadyCount} kan jämföras
                </Badge>
                {helpFlagCount > 0 && (
                  <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-700">
                    {helpFlagCount} markerade för hjälp
                  </Badge>
                )}
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">
                Din AI-checklista efter registreringen
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Här samlas det som faktiskt skapar värde efter flytten: vad som är
                klart, vad som är näst på tur och vilka delar som är värda att
                jämföra när du är redo. Öppna jämför-knapparna bara där det är
                relevant för dig.
              </p>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">
                    Din flyttchecklista
                  </CardTitle>
                </div>
                <CardDescription>
                  Använd checklistan som din efterflytt-plan. Öppna jämför där du
                  vill se el, bredband och fler relevanta val.{" "}
                  {move.moveDate && (
                    <span>
                      Anpassad efter inflyttning{" "}
                      <strong>{move.moveDate}</strong>.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checklist.length > 0 ? (
                  <ChecklistView
                    items={checklist}
                    readOnly
                    moveContext={{
                      toPostal: move.toPostal ?? undefined,
                      toCity: move.toCity ?? undefined,
                      moveDate: move.moveDate ?? undefined,
                      toStreet: move.toStreet ?? undefined,
                    }}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Ingen flyttlista sparad ännu.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Skatteverket ──────────────────────────────────── */}
          <TabsContent value="skatteverket" className="space-y-6">
            {/* Intro */}
            <div className="rounded-2xl border bg-linear-to-br from-primary/5 via-background to-primary/5 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Landmark className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Nästa steg: Skatteverket och BankID
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Fortsätt från din registrering med snabbaste vägen överst
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Du måste anmäla din flytt till Skatteverket senast en vecka efter
                inflyttning. Vi har redan förberett uppgifterna så att du kan
                gå vidare med BankID eller ta den manuella vägen vid behov.
              </p>
            </div>

            {/* Method cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Option 1: Automatic BankID */}
              <Card className="border-primary/30 relative overflow-hidden">
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground text-[10px]">
                    Rekommenderad
                  </Badge>
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">
                      Automatisk via BankID
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Vi startar Skatteverkets BankID-flöde och förbereder allt
                    automatiskt. Skanna QR-koden för att fortsätta.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    onKeyDown={blockSkvKeyboard}
                    onClick={handleStartSkv}
                    disabled={skvStarting}
                    className="w-full gap-2"
                  >
                    {skvStarting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                    {skvStarting
                      ? "Startar..."
                      : "Fortsätt med BankID"}
                  </Button>
                  {skvStatus && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {skvStatus}
                    </p>
                  )}
                  {cloneQrStateUrl && cloneQrImageUrl && (
                    <div className="mt-3">
                      <BankIdQrMirror
                        cloneQrStateUrl={cloneQrStateUrl}
                        cloneQrImageUrl={cloneQrImageUrl}
                        statusUrl={int7StatusUrl ?? undefined}
                        onDismiss={() => {
                          setCloneQrStateUrl(null);
                          setCloneQrImageUrl(null);
                          setInt7StatusUrl(null);
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Option 2: Open SKV directly */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">
                      Gör det själv med våra uppgifter
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Öppna Skatteverkets sida och använd bookmarklet eller kopiera
                    fälten steg för steg.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    asChild
                  >
                    <a
                      href="https://www.skatteverket.se/privat/folkbokforing/flyttanmalan.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Landmark className="h-4 w-4" />
                      Öppna Skatteverket
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Step-by-step guide */}
            <SkatteverketGuide
              data={{
                name: user.name,
                personalNumber: user.personalNumber || undefined,
                toStreet: move.toStreet || undefined,
                toPostal: move.toPostal || undefined,
                toCity: move.toCity || undefined,
                apartmentNumber: move.apartmentNumber || undefined,
                propertyDesignation: move.propertyDesignation || undefined,
                propertyOwner: move.propertyOwner || undefined,
                moveDate: move.moveDate || undefined,
                householdType: move.householdType || undefined,
              }}
            />

            {/* Bookmarklet */}
            <BookmarkletButton
              data={{
                name: user.name,
                personalNumber: user.personalNumber,
                toStreet: move.toStreet,
                toPostal: move.toPostal,
                toCity: move.toCity,
                apartmentNumber: move.apartmentNumber,
                propertyDesignation: move.propertyDesignation,
                propertyOwner: move.propertyOwner,
                moveDate: move.moveDate,
                email: user.email,
                phone: user.phone,
              }}
            />
          </TabsContent>
        </Tabs>
      </main>

      <OpenClawChatWidget
        formType="dashboard"
        formData={
          data
            ? {
                userName: data.user.name,
                personalNumber: data.user.personalNumber || "",
                email: data.user.email || "",
                phone: data.user.phone || "",
                moveStatus: data.move.status,
                toStreet: data.move.toStreet || "",
                toPostal: data.move.toPostal || "",
                apartmentNumber: data.move.apartmentNumber || "",
                propertyDesignation: data.move.propertyDesignation || "",
                propertyOwner: data.move.propertyOwner || "",
                fromCity: data.move.fromCity || "",
                toCity: data.move.toCity || "",
                moveDate: data.move.moveDate || "",
              }
            : {}
        }
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
