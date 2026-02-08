"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  MapPin,
  Mail,
  Phone,
  Hash,
  ArrowRight,
  Bug,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface DecodedData {
  name: string | null;
  personalNumber: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  timestamp: number;
}

function StartContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "decoded" | "redirecting" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [decodedData, setDecodedData] = useState<DecodedData | null>(null);
  const [rawParams, setRawParams] = useState({ d: "", sig: "" });

  useEffect(() => {
    const d = searchParams.get("d");
    const sig = searchParams.get("sig");

    setRawParams({ d: d || "", sig: sig || "" });

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

        // Store in sessionStorage for the form
        sessionStorage.setItem("qr_prefill", JSON.stringify(data));
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message || "Kunde inte avkoda QR-koden.");
      }
    }

    decodeQr();
  }, [searchParams]);

  function handleContinue() {
    setStatus("redirecting");
    router.push("/adressandring");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-hero-gradient-from to-background px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* Status card */}
        <Card className="shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium text-foreground">
                  Läser QR-kod...
                </p>
                <p className="text-sm text-muted-foreground">
                  Verifierar signatur och avkodar dina uppgifter.
                </p>
              </>
            )}

            {status === "redirecting" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium text-foreground">
                  Går till formuläret...
                </p>
              </>
            )}

            {(status === "decoded") && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground">
                  QR-kod verifierad!
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  Dina uppgifter har avkodats. Granska nedan och gå vidare till
                  formuläret.
                </p>
              </>
            )}

            {status === "error" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-lg font-medium text-foreground">
                  Något gick fel
                </p>
                <p className="text-center text-sm text-muted-foreground">
                  {errorMsg}
                </p>
                <Button asChild className="mt-2">
                  <Link href="/adressandring">Gå till formuläret manuellt</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Debug / decoded data panel */}
        {decodedData && status === "decoded" && (
          <Card className="border-primary/30 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bug className="h-4 w-4 text-primary" />
                  Avkodad QR-data
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Debug
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {decodedData.name && (
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Namn</p>
                    <p className="text-sm font-semibold">{decodedData.name}</p>
                  </div>
                </div>
              )}

              {decodedData.personalNumber && (
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Hash className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Personnummer</p>
                    <p className="text-sm font-semibold">
                      {decodedData.personalNumber}
                    </p>
                  </div>
                </div>
              )}

              {decodedData.address && (
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Adress</p>
                    <p className="text-sm font-semibold">
                      {decodedData.address}
                    </p>
                  </div>
                </div>
              )}

              {decodedData.email && (
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">E-post</p>
                    <p className="text-sm font-semibold">{decodedData.email}</p>
                  </div>
                </div>
              )}

              {decodedData.phone && (
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefon</p>
                    <p className="text-sm font-semibold">{decodedData.phone}</p>
                  </div>
                </div>
              )}

              <Separator />

              <Button onClick={handleContinue} className="w-full gap-2" size="lg">
                Gå vidare till formuläret
                <ArrowRight className="h-4 w-4" />
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Uppgifterna förifylls automatiskt i formuläret.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Raw debug info (collapsible) */}
        {(rawParams.d || status === "error") && (
          <details className="rounded-lg border bg-card p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Bug className="h-3 w-3" />
              Teknisk debug-info
            </summary>
            <div className="mt-2 space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">Status: </span>
                <Badge variant="outline" className="text-xs">
                  {status}
                </Badge>
              </div>
              {rawParams.d && (
                <div>
                  <span className="text-muted-foreground">Encoded (d): </span>
                  <code className="break-all text-foreground">
                    {rawParams.d.substring(0, 60)}...
                  </code>
                </div>
              )}
              {rawParams.sig && (
                <div>
                  <span className="text-muted-foreground">Signature (sig): </span>
                  <code className="break-all text-foreground">
                    {rawParams.sig}
                  </code>
                </div>
              )}
              {decodedData?.timestamp && (
                <div>
                  <span className="text-muted-foreground">Tidsstämpel: </span>
                  <span>{new Date(decodedData.timestamp * 1000).toLocaleString("sv-SE")}</span>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-hero-gradient-from to-background px-4">
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
