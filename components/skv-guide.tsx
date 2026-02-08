"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  FileText,
  QrCode,
  ChevronDown,
  ChevronUp,
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
import { cn } from "@/lib/utils";
import { QrDisplay } from "@/components/qr-display";

interface SkvGuideProps {
  moveData: {
    name: string;
    personalNumber?: string;
    email?: string;
    phone?: string;
    fromStreet?: string;
    fromPostal?: string;
    fromCity?: string;
    toStreet?: string;
    toPostal?: string;
    toCity?: string;
    moveDate?: string;
    householdType?: string;
  };
  className?: string;
}

function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!value) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-8 w-8 shrink-0 p-0"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

export function SkvGuide({ moveData, className }: SkvGuideProps) {
  const [expanded, setExpanded] = useState(false);
  const [qrImage, setQrImage] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");

  async function generateSkvQr() {
    const res = await fetch("/api/qr/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: moveData.name,
        personalNumber: moveData.personalNumber,
        address: `${moveData.toStreet}, ${moveData.toPostal} ${moveData.toCity}`,
        email: moveData.email,
        phone: moveData.phone,
      }),
    });

    const data = await res.json();
    setQrImage(data.qrImage);
    setQrUrl(data.url);
    return { qrImage: data.qrImage, url: data.url };
  }

  const steps = [
    {
      number: 1,
      title: "Gå till Skatteverkets e-tjänst",
      description: 'Öppna Skatteverkets webbplats och välj "Flytta/folkbokföring".',
      action: (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          asChild
        >
          <a
            href="https://www.skatteverket.se/privat/folkbokforing/flyttanmalan.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Öppna Skatteverket
          </a>
        </Button>
      ),
    },
    {
      number: 2,
      title: "Logga in med BankID",
      description:
        "Identifiera dig med BankID på Skatteverkets sajt. (Vi kan inte logga in åt dig av säkerhetsskäl.)",
    },
    {
      number: 3,
      title: "Fyll i din nya adress",
      description:
        "Kopiera uppgifterna nedan och klistra in dem i Skatteverkets formulär.",
    },
    {
      number: 4,
      title: "Bekräfta och skicka",
      description:
        "Granska uppgifterna en sista gång och bekräfta din flyttanmälan.",
    },
  ];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">
            Flyttanmälan till Skatteverket
          </CardTitle>
        </div>
        <CardDescription>
          Din guide för att göra flyttanmälan hos Skatteverket med dina ifyllda
          uppgifter. Kopiera och klistra in – vi har förberett allt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Steps */}
        {steps.map((step, i) => (
          <div key={step.number} className="flex gap-3">
            <div className="flex shrink-0 flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step.number}
              </div>
              {i < steps.length - 1 && (
                <div className="mt-1 h-full w-0.5 bg-border" />
              )}
            </div>
            <div className="pb-6">
              <p className="text-sm font-semibold text-foreground">
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {step.description}
              </p>
              {step.action && <div className="mt-2">{step.action}</div>}
            </div>
          </div>
        ))}

        <Separator />

        {/* Copyable fields */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between py-2 text-sm font-semibold text-foreground"
          >
            <span className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              Dina uppgifter (kopiera)
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <CopyField label="Namn" value={moveData.name} />
              <CopyField
                label="Personnummer"
                value={moveData.personalNumber || ""}
              />
              <CopyField
                label="Ny gatuadress"
                value={moveData.toStreet || ""}
              />
              <CopyField
                label="Nytt postnummer"
                value={moveData.toPostal || ""}
              />
              <CopyField label="Ny ort" value={moveData.toCity || ""} />
              <CopyField
                label="Inflyttningsdatum"
                value={moveData.moveDate || ""}
              />
              <CopyField label="E-post" value={moveData.email || ""} />
              <CopyField label="Telefon" value={moveData.phone || ""} />
            </div>
          )}
        </div>

        <Separator />

        {/* QR code with all data */}
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <QrCode className="h-4 w-4 text-primary" />
            QR-kod med dina uppgifter
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Spara denna QR-kod. Du kan skanna den senare för att snabbt
            hämta dina uppgifter igen.
          </p>
          <QrDisplay
            qrImage={qrImage}
            qrUrl={qrUrl}
            onGenerate={generateSkvQr}
          />
        </div>
      </CardContent>
    </Card>
  );
}
