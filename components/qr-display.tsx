"use client";

import { useState } from "react";
import Image from "next/image";
import { Download, Copy, Check, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QrDisplayProps {
  className?: string;
  /** Pre-generated QR image data URL */
  qrImage?: string;
  /** Pre-generated QR URL */
  qrUrl?: string;
  /** Generate on demand by calling this */
  onGenerate?: () => Promise<{ qrImage: string; url: string }>;
}

export function QrDisplay({
  className,
  qrImage: initialImage,
  qrUrl: initialUrl,
  onGenerate,
}: QrDisplayProps) {
  const [qrImage, setQrImage] = useState(initialImage || "");
  const [qrUrl, setQrUrl] = useState(initialUrl || "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!onGenerate) return;
    setLoading(true);
    try {
      const result = await onGenerate();
      setQrImage(result.qrImage);
      setQrUrl(result.url);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyUrl() {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!qrImage) return;
    const link = document.createElement("a");
    link.download = "flytt-qr-kod.png";
    link.href = qrImage;
    link.click();
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Din QR-kod</CardTitle>
        </div>
        <CardDescription>
          Spara eller dela din personliga QR-kod. Den innehåller dina uppgifter
          för snabb ifyllnad.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {qrImage ? (
          <>
            <div className="rounded-xl border bg-white p-4">
              <Image
                src={qrImage}
                alt="Personlig QR-kod"
                width={280}
                height={280}
                className="h-auto w-full max-w-70"
                unoptimized
              />
            </div>
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Kopierad!" : "Kopiera länk"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Ladda ner
              </Button>
            </div>
          </>
        ) : onGenerate ? (
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <QrCode className="h-5 w-5" />
            )}
            {loading ? "Skapar QR-kod..." : "Skapa din QR-kod"}
          </Button>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Ingen QR-kod genererad ännu.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
