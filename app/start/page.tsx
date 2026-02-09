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

const SKV_URL =
  "https://www.skatteverket.se/privat/folkbokforing/flyttanmalan.html";

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

        // Also store in sessionStorage for the form (backwards compatibility)
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
  }, [searchParams]);

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const newAddress = decodedData?.toStreet
    ? `${decodedData.toStreet}, ${decodedData.toPostal || ""} ${decodedData.toCity || ""}`.trim()
    : null;

  const formattedDate = decodedData?.moveDate
    ? new Date(decodedData.moveDate).toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-linear-to-b from-hero-gradient-from to-background px-4 py-8 overflow-hidden">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-1 -top-1/4 -right-1/4 h-125 w-125" />
        <div className="section-orb-2 -bottom-1/4 -left-1/3 h-150 w-150" />
        <div className="section-orb-accent top-1/3 left-1/4 h-100 w-100" />
        <div className="absolute inset-0 dot-grid opacity-[0.08]" />
      </div>

      <div className="relative w-full max-w-md space-y-4">
        {/* Status: Loading */}
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

        {/* Status: Error */}
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

        {/* Status: Decoded – Reference card */}
        {status === "decoded" && decodedData && (
          <>
            {/* Success indicator */}
            <Card className="shadow-xl">
              <CardContent className="flex flex-col items-center gap-3 py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                </div>
                <p className="text-lg font-semibold text-foreground">
                  Dina uppgifter är redo!
                </p>
                <p className="text-center text-sm text-muted-foreground">
                  All data från QR-koden har avkodats. Välj hur du vill
                  fortsätta nedan.
                </p>
              </CardContent>
            </Card>

            {/* Quick action: Reference card or full guide */}
            {!showGuide ? (
              <>
                {/* Key info: New address + move date */}
                <Card className="border-primary/30 shadow-lg">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        Snabbreferens
                      </CardTitle>
                      <Badge className="bg-primary/10 text-primary text-xs">
                        QR-data
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Tryck på ett fält för att kopiera till urklipp.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* New address */}
                    {newAddress && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(newAddress, "address")}
                        className="flex w-full items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-left transition-colors active:bg-primary/10"
                      >
                        <MapPin className="h-5 w-5 shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                            Ny adress
                          </p>
                          <p className="text-sm font-bold text-foreground">
                            {decodedData.toStreet}
                          </p>
                          <p className="text-sm text-foreground">
                            {decodedData.toPostal} {decodedData.toCity}
                          </p>
                        </div>
                        {copiedField === "address" ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    )}

                    {/* Move date */}
                    {formattedDate && (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(decodedData.moveDate!, "date")
                        }
                        className="flex w-full items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-left transition-colors active:bg-primary/10"
                      >
                        <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                            Flyttdatum
                          </p>
                          <p className="text-sm font-bold text-foreground">
                            {formattedDate}
                          </p>
                        </div>
                        {copiedField === "date" ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    )}

                    <Separator />

                    {/* Two CTA buttons */}
                    <div className="space-y-2">
                      <Button
                        onClick={() => setShowGuide(true)}
                        className="w-full gap-2"
                        size="lg"
                      >
                        Steg-för-steg Skatteverket-guide
                        <ArrowRight className="h-4 w-4" />
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        className="w-full gap-2"
                        size="sm"
                      >
                        <a
                          href={SKV_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Öppna Skatteverket direkt
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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

            {/* Personal info (secondary, collapsed) */}
            <details className="rounded-xl border bg-card shadow-sm">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-foreground">
                <User className="h-4 w-4 text-primary" />
                Dina personuppgifter
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform [[open]>&]:rotate-90" />
              </summary>
              <div className="space-y-2 border-t px-4 py-3">
                {decodedData.name && (
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-foreground">{decodedData.name}</span>
                  </div>
                )}
                {decodedData.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-foreground">
                      {decodedData.email}
                    </span>
                  </div>
                )}
                {decodedData.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-foreground">
                      {decodedData.phone}
                    </span>
                  </div>
                )}
                {decodedData.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Nuvarande: {decodedData.address}
                    </span>
                  </div>
                )}
              </div>
            </details>

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

            {/* Also link to our form */}
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