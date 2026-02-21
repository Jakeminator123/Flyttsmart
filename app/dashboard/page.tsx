"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  User,
  CalendarDays,
  MapPin,
  ArrowRight,
  Loader2,
  QrCode,
  Sparkles,
  FileText,
  Lock,
} from "lucide-react";
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
import { QrDisplay } from "@/components/qr-display";
import { SkvGuide } from "@/components/skv-guide";
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget";
import { useOpenClawMirror } from "@/hooks/use-openclaw-mirror";

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

function DashboardContent() {
  const searchParams = useSearchParams();
  const moveId = searchParams.get("id");
  const [data, setData] = useState<MoveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OpenClaw real-time mirroring for dashboard events
  const { mirrorEvent } = useOpenClawMirror({ formType: "dashboard" });

  useEffect(() => {
    if (!moveId) {
      setError("Inget flytt-ID angivet. Gå tillbaka och registrera en flytt.");
      setLoading(false);
      return;
    }

    async function fetchMove() {
      try {
        const res = await fetch(`/api/move?id=${moveId}`);
        if (!res.ok) throw new Error("Flytten hittades inte");
        const result = await res.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMove();
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

  async function handleGenerateQr() {
    const res = await fetch("/api/qr/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: user.name,
        personalNumber: user.personalNumber,
        address: `${move.toStreet}, ${move.toPostal} ${move.toCity}`,
        email: user.email,
        phone: user.phone,
      }),
    });

    const result = await res.json();
    return { qrImage: result.qrImage, url: result.url };
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-hero-gradient-from to-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Startsidan
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
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Min flytt
          </h1>
          <p className="mt-1 text-muted-foreground">
            Hej {user.name.split(" ")[0]}! Här kan du följa din flytt och din
            checklista.
          </p>
        </div>

        {/* Status overview */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Flyttar till</p>
                <p className="text-sm font-semibold text-foreground">
                  {move.toCity || "–"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Inflyttningsdatum
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {move.moveDate || "–"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Checklista</p>
                <p className="text-sm font-semibold text-foreground">
                  {checklist.filter((c) => c.completed).length}/
                  {checklist.length} klara
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Översikt</span>
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1.5 text-xs">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Checklista</span>
            </TabsTrigger>
            <TabsTrigger value="skatteverket" className="gap-1.5 text-xs">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Skatteverket</span>
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-1.5 text-xs">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">QR-kod</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <MoveTimeline status={status} />
                </CardContent>
              </Card>

              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Uppgifter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.phone}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Från</p>
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
                        <p className="text-xs text-primary font-medium">Till</p>
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
          </TabsContent>

          {/* Checklist */}
          <TabsContent value="checklist">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">
                    Din flyttchecklista
                  </CardTitle>
                </div>
                <CardDescription>
                  Bocka av allt som är klart. Checklistan är anpassad efter ditt
                  inflyttningsdatum {move.moveDate}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checklist.length > 0 ? (
                  <ChecklistView items={checklist} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Ingen checklista genererad. Gå tillbaka och generera en.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Skatteverket guide */}
          <TabsContent value="skatteverket">
            <SkvGuide
              moveData={{
                name: user.name,
                personalNumber: user.personalNumber || undefined,
                email: user.email || undefined,
                phone: user.phone || undefined,
                fromStreet: move.fromStreet || undefined,
                fromPostal: move.fromPostal || undefined,
                fromCity: move.fromCity || undefined,
                toStreet: move.toStreet || undefined,
                toPostal: move.toPostal || undefined,
                toCity: move.toCity || undefined,
                moveDate: move.moveDate || undefined,
                householdType: move.householdType || undefined,
              }}
            />
          </TabsContent>

          {/* QR code */}
          <TabsContent value="qr">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Din QR-kod</CardTitle>
                </div>
                <CardDescription>
                  Skapa en personlig QR-kod med dina uppgifter. Perfekt att spara
                  eller dela.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QrDisplay onGenerate={handleGenerateQr} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* OpenClaw Chat Widget */}
      <OpenClawChatWidget
        formType="dashboard"
        formData={data ? {
          userName: data.user.name,
          moveStatus: data.move.status,
          fromCity: data.move.fromCity || "",
          toCity: data.move.toCity || "",
          moveDate: data.move.moveDate || "",
        } : {}}
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
