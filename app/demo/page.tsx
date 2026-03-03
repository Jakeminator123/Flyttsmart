"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, FileText } from "lucide-react";
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
import { Logo } from "@/components/logo";
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget";
import { useOpenClawMirror } from "@/hooks/use-openclaw-mirror";

const DEMO_DATA = {
  name: "Anna Andersson",
  personalNumber: "19900101-1234",
  address: "Storgatan 1, 123 45 Stockholm",
  email: "anna@exempel.se",
  phone: "070-123 45 67",
};

const PREFILL_KEY = "adressandring-prefill";

export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      router.replace("/");
    }
  }, [router]);

  const [name, setName] = useState(DEMO_DATA.name);
  const [personalNumber, setPersonalNumber] = useState(DEMO_DATA.personalNumber);
  const [address, setAddress] = useState(DEMO_DATA.address);
  const [email, setEmail] = useState(DEMO_DATA.email);
  const [phone, setPhone] = useState(DEMO_DATA.phone);

  // OpenClaw real-time form mirroring
  const { mirrorField, mirrorSubmit } = useOpenClawMirror({ formType: "demo" });

  function updateAndMirror(
    setter: (v: string) => void,
    fieldName: string,
    value: string
  ) {
    setter(value);
    mirrorField(fieldName, value, {
      name,
      personalNumber,
      address,
      email,
      phone,
      [fieldName]: value,
    });
  }

  function handleSaveAndGo() {
    const [firstName = "", lastName = ""] = name.trim().split(/\s+/, 2);
    const prefill = {
      firstName: firstName || "Anna",
      lastName: lastName || "Andersson",
      personalNumber,
      email,
      phone,
      fromStreet: address,
    };
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
    mirrorSubmit({ name, personalNumber, address, email, phone });
    router.push("/adressandring");
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
            Dev Test
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 lg:py-12 space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Testdata
          </h1>
          <p className="mt-2 text-muted-foreground">
            Fyll i testdata och spara till sessionStorage för att förifylla
            adressändringsformuläret.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Persondata</CardTitle>
            </div>
            <CardDescription>
              Redigera testdatan som används för att förifylla formuläret på
              adressändringssidan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Namn</Label>
                <Input
                  value={name}
                  onChange={(e) => updateAndMirror(setName, "name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Personnummer</Label>
                <Input
                  value={personalNumber}
                  onChange={(e) =>
                    updateAndMirror(setPersonalNumber, "personalNumber", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Adress</Label>
              <Input
                value={address}
                onChange={(e) =>
                  updateAndMirror(setAddress, "address", e.target.value)
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">E-post</Label>
                <Input
                  value={email}
                  onChange={(e) =>
                    updateAndMirror(setEmail, "email", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input
                  value={phone}
                  onChange={(e) =>
                    updateAndMirror(setPhone, "phone", e.target.value)
                  }
                />
              </div>
            </div>

            <Button
              onClick={handleSaveAndGo}
              disabled={!name}
              className="w-full gap-2"
              size="lg"
            >
              Spara och gå till adressändring
            </Button>
          </CardContent>
        </Card>
      </main>

      <OpenClawChatWidget
        formType="demo"
        formData={{ name, personalNumber, address, email, phone }}
      />
    </div>
  );
}
