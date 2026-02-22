"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  CalendarDays,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  User,
  Mail,
  Phone,
  Shield,
  ClipboardList,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { SkatteverketGuide } from "@/components/skatteverket-guide";
import { BookmarkletButton } from "@/components/bookmarklet-button";
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget";
import { useOpenClawMirror } from "@/hooks/use-openclaw-mirror";

const SKV_URL =
  "https://www7.skatteverket.se/portal/login?route=flyttanmalan";

interface DecodedData {
  name: string | null;
  personalNumber: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  toStreet: string | null;
  toPostal: string | null;
  toCity: string | null;
  moveDate: string | null;
  timestamp: number;
}

function StartContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "decoded" | "error">(
    "loading"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [decodedData, setDecodedData] = useState<DecodedData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // OpenClaw real-time form mirroring
  const { mirrorEvent } = useOpenClawMirror({ formType: "start" });

  useEffect(() => {
    const d = searchParams.get("d");
    const sig = searchParams.get("sig");

    if (!d || !sig) {
      setStatus("error");
      setErrorMsg("Ogiltig QR-kod – saknar data eller signatur i URL:en.");
      return;
    }

    async function decodeQr() {
      try {
        const res = await fetch("/api/qr/decode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ encoded: d, signature: sig }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Ogiltigt svar från servern");
        }

        const { data } = await res.json();
        setDecodedData(data);
        setStatus("decoded");

        // Mirror QR decoded data to OpenClaw
        mirrorEvent("qr_scan", {
          name: data.name || "",
          personalNumber: data.personalNumber || "",
          toStreet: data.toStreet || "",
          toPostal: data.toPostal || "",
          toCity: data.toCity || "",
          moveDate: data.moveDate || "",
          email: data.email || "",
          phone: data.phone || "",
        });

        sessionStorage.setItem("qr_prefill", JSON.stringify(data));
      } catch (err: unknown) {
        setStatus("error");
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Kunde inte avkoda QR-koden."
        );
      }
    }

    decodeQr();
  }, [searchParams, mirrorEvent]);

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function copyAllData() {
    if (!decodedData) return;
    const lines = [
      decodedData.name && `Namn: ${decodedData.name}`,
      decodedData.personalNumber && `Personnummer: ${decodedData.personalNumber}`,
      decodedData.toStreet && `Ny gatuadress: ${decodedData.toStreet}`,
      decodedData.toPostal && `Postnummer: ${decodedData.toPostal}`,
      decodedData.toCity && `Ort: ${decodedData.toCity}`,
      decodedData.moveDate && `Flyttdatum: ${decodedData.moveDate}`,
      decodedData.email && `E-post: ${decodedData.email}`,
      decodedData.phone && `Telefon: ${decodedData.phone}`,
    ]
      .filter(Boolean)
      .join("\n");

    await navigator.clipboard.writeText(lines);
    setCopiedField("all");
  }

  const formattedDate = decodedData?.moveDate
    ? new Date(decodedData.moveDate).toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Compact data rows for the reference card
  const dataRows: { icon: typeof MapPin; label: string; value: string; key: string }[] = [];
  if (decodedData) {
    if (decodedData.toStreet)
      dataRows.push({ icon: MapPin, label: "Ny adress", value: `${decodedData.toStreet}, ${decodedData.toPostal || ""} ${decodedData.toCity || ""}`.trim(), key: "address" });
    if (decodedData.moveDate)
      dataRows.push({ icon: CalendarDays, label: "Flyttdatum", value: formattedDate || decodedData.moveDate, key: "date" });
    if (decodedData.name)
      dataRows.push({ icon: User, label: "Namn", value: decodedData.name, key: "name" });
    if (decodedData.email)
      dataRows.push({ icon: Mail, label: "E-post", value: decodedData.email, key: "email" });
    if (decodedData.phone)
      dataRows.push({ icon: Phone, label: "Telefon", value: decodedData.phone, key: "phone" });
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-linear-to-b from-hero-gradient-from to-background px-4 py-8 overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-1 -top-1/4 -right-1/4 h-125 w-125" />
        <div className="section-orb-2 -bottom-1/4 -left-1/3 h-150 w-150" />
        <div className="section-orb-accent top-1/3 left-1/4 h-100 w-100" />
        <div className="absolute inset-0 dot-grid opacity-[0.08]" />
      </div>

      <div className="relative w-full max-w-md space-y-4">
        {/* Loading */}
        {status === "loading" && (
          <Card className="shadow-xl">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium text-foreground">
                Läser QR-kod...
              </p>
              <p className="text-sm text-muted-foreground">
                Verifierar signatur och avkodar dina uppgifter.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {status === "error" && (
          <Card className="shadow-xl">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-lg font-medium text-foreground">
                Något gick fel
              </p>
              <p className="text-center text-sm text-muted-foreground">
                {errorMsg}
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/adressandring">Fyll i manuellt</Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={SKV_URL} target="_blank" rel="noopener noreferrer">
                    Skatteverket
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decoded – Compact reference card */}
        {status === "decoded" && decodedData && (
          <>
            {/* Success header */}
            <Card className="shadow-xl">
              <CardContent className="flex flex-col items-center gap-2 py-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  Dina uppgifter är redo!
                </p>
              </CardContent>
            </Card>

            {!showGuide ? (
              <>
                {/* Compact data card */}
                <Card className="border-primary/30 shadow-lg">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Dina uppgifter</CardTitle>
                      <Badge className="bg-primary/10 text-primary text-xs">
                        QR-data
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Tryck på en rad för att kopiera.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {dataRows.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => {
                          const raw =
                            row.key === "date" && decodedData.moveDate
                              ? decodedData.moveDate
                              : row.key === "address" && decodedData.toStreet
                                ? `${decodedData.toStreet}, ${decodedData.toPostal || ""} ${decodedData.toCity || ""}`.trim()
                                : row.value;
                          copyToClipboard(raw, row.key);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg border border-primary/20 bg-card p-2.5 text-left transition-colors active:bg-primary/10"
                      >
                        <row.icon className="h-4 w-4 shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-primary">
                            {row.label}
                          </p>
                          <p className="text-sm font-semibold text-foreground truncate">
                            {row.value}
                          </p>
                        </div>
                        {copiedField === row.key ? (
                          <Check className="h-4 w-4 shrink-0 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    ))}

                    <Separator className="my-2" />

                    {/* Action buttons */}
                    <Button
                      onClick={copyAllData}
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                    >
                      {copiedField === "all" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <ClipboardList className="h-3.5 w-3.5" />
                      )}
                      {copiedField === "all"
                        ? "Kopierade alla uppgifter!"
                        : "Kopiera alla uppgifter"}
                    </Button>

                    <Button
                      asChild
                      className="w-full gap-2"
                      size="lg"
                    >
                      <a
                        href={SKV_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Öppna Skatteverket
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>

                    <Button
                      onClick={() => setShowGuide(true)}
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-xs"
                    >
                      Steg-för-steg guide
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Bookmarklet section */}
                <BookmarkletButton
                  data={{
                    name: decodedData.name,
                    personalNumber: decodedData.personalNumber,
                    toStreet: decodedData.toStreet,
                    toPostal: decodedData.toPostal,
                    toCity: decodedData.toCity,
                    moveDate: decodedData.moveDate,
                    email: decodedData.email,
                    phone: decodedData.phone,
                  }}
                />
              </>
            ) : (
              /* Full Skatteverket guide */
              <SkatteverketGuide
                data={{
                  name: decodedData.name,
                  personalNumber: decodedData.personalNumber,
                  toStreet: decodedData.toStreet,
                  toPostal: decodedData.toPostal,
                  toCity: decodedData.toCity,
                  moveDate: decodedData.moveDate,
                }}
              />
            )}

            {/* Security footer */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>HMAC-signerad data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span>Verifierad</span>
              </div>
            </div>

            {/* Link to form */}
            <div className="text-center">
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href="/adressandring">
                  Eller fyll i formuläret här
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </Button>
          </div>
          </>
        )}
      </div>

      {/* OpenClaw Chat Widget */}
      <OpenClawChatWidget
        formType="start"
        formData={decodedData ? {
          name: decodedData.name || "",
          personalNumber: decodedData.personalNumber || "",
          toStreet: decodedData.toStreet || "",
          toPostal: decodedData.toPostal || "",
          toCity: decodedData.toCity || "",
          moveDate: decodedData.moveDate || "",
          email: decodedData.email || "",
          phone: decodedData.phone || "",
        } : {}}
      />
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-screen items-center justify-center bg-linear-to-b from-hero-gradient-from to-background px-4 overflow-hidden">
          <Card className="w-full max-w-sm shadow-xl">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium text-foreground">Laddar...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <StartContent />
    </Suspense>
  );
}
