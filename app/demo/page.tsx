"use client";

import { useState } from "react";
import Link from "next/link";
import {
  QrCode,
  Smartphone,
  ArrowLeft,
  Loader2,
  Wifi,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";
import { QrDisplay } from "@/components/qr-display";

const DEMO_DATA = {
  name: "Anna Andersson",
  personalNumber: "19900101-1234",
  address: "Storgatan 1, 123 45 Stockholm",
  email: "anna@exempel.se",
  phone: "070-123 45 67",
};

export default function DemoPage() {
  const [name, setName] = useState(DEMO_DATA.name);
  const [personalNumber, setPersonalNumber] = useState(DEMO_DATA.personalNumber);
  const [address, setAddress] = useState(DEMO_DATA.address);
  const [email, setEmail] = useState(DEMO_DATA.email);
  const [phone, setPhone] = useState(DEMO_DATA.phone);
  const [qrImage, setQrImage] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [networkIp, setNetworkIp] = useState("");

  async function generateQr() {
    setLoading(true);
    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, personalNumber, address, email, phone }),
      });
      const data = await res.json();

      // If user has entered a network IP, replace localhost in the URL
      let url = data.url;
      if (networkIp) {
        url = url.replace("localhost:3000", `${networkIp}:3000`);
      }

      setQrUrl(url);

      // Re-generate QR image with the potentially modified URL
      if (networkIp && url !== data.url) {
        const QRCode = (await import("qrcode")).default;
        const img = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: { dark: "#002e6d", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
        setQrImage(img);
      } else {
        setQrImage(data.qrImage);
      }
    } catch (err) {
      console.error("Failed to generate QR:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-hero-gradient-from to-background">
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Link>
          <Logo size="sm" />
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            Demo
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 lg:py-12 space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            QR-kod Demo
          </h1>
          <p className="mt-2 text-muted-foreground">
            Testa QR-kodsystemet. Generera en QR-kod, skanna den med mobilen och
            se hur datan flödar genom systemet.
          </p>
        </div>

        {/* Network IP for mobile */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Mobiltest</CardTitle>
            </div>
            <CardDescription>
              För att skanna QR-koden med din mobil måste din telefon kunna nå
              datorn. Ange datorns lokala IP (t.ex. 192.168.1.x) så uppdateras
              QR-kodens URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="networkIp" className="text-xs">
                  Datorns lokala IP-adress
                </Label>
                <Input
                  id="networkIp"
                  placeholder="192.168.1.100"
                  value={networkIp}
                  onChange={(e) => setNetworkIp(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <Wifi className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Hitta din IP: kör <code className="rounded bg-muted px-1">ipconfig</code> i
                terminalen och leta efter IPv4-adressen. Se till att mobilen är
                på samma WiFi-nätverk.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Data entry */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Persondata i QR-koden</CardTitle>
            </div>
            <CardDescription>
              Redigera testdatan som kodas in i QR-koden. Detta simulerar en
              riktig användares uppgifter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Namn</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Personnummer</Label>
                <Input
                  value={personalNumber}
                  onChange={(e) => setPersonalNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Adress</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">E-post</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={generateQr}
              disabled={loading || !name}
              className="w-full gap-2"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <QrCode className="h-5 w-5" />
              )}
              {loading ? "Genererar..." : "Skapa QR-kod"}
            </Button>
          </CardContent>
        </Card>

        {/* QR Result */}
        {qrImage && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Din test-QR-kod</CardTitle>
              <CardDescription>
                Skanna denna med din mobils kamera. Telefonen öppnar länken i
                webbläsaren och du ser debug-info om vad som avkodats.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <QrDisplay qrImage={qrImage} qrUrl={qrUrl} />

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  QR-kodens URL:
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border bg-muted p-2 text-xs break-all">
                    {qrUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyUrl}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Vad händer vid skanning:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Mobilen öppnar URL:en i webbläsaren</li>
                  <li>Sidan <code>/start</code> avkodar QR-datan via API</li>
                  <li>En debug-ruta visar all avkodad data</li>
                  <li>Datan sparas i sessionen och formuläret förifylls</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
