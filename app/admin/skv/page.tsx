"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  QrCode,
  ShieldCheck,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface SkvStats {
  qrTokenCount: number;
  recentTokens: {
    id: number;
    createdAt: string;
    usedAt: string | null;
    expiresAt: string;
  }[];
  configAvailable: boolean;
  cloneQrToSiteEnabled: boolean;
  skvServiceUrl: string;
  remoteSkvService: boolean;
}

export default function SkvPage() {
  const [stats, setStats] = useState<SkvStats | null>(null);
  const [loading, setLoading] = useState(true);

  function fetchStats() {
    setLoading(true);
    fetch("/api/admin/skv/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SKV</h1>
        <p className="text-muted-foreground">
          Skatteverket-integrationen – INT7, BankID QR och payload
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">QR-tokens</CardTitle>
            <QrCode className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">
                {stats?.qrTokenCount ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SKV Config</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <Badge variant={stats?.configAvailable ? "default" : "secondary"}>
                {stats?.configAvailable ? "Tillgänglig" : "Ej konfigurerad"}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">QR Signing</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <Badge variant={stats?.configAvailable ? "default" : "destructive"}>
                {stats?.configAvailable ? "Aktiv" : "Saknas"}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clone QR</CardTitle>
            <QrCode className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <Badge variant={stats?.cloneQrToSiteEnabled ? "default" : "secondary"}>
                {stats?.cloneQrToSiteEnabled ? "Aktiv" : "Inaktiv"}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" size="sm" onClick={fetchStats}>
        <RefreshCw className="mr-2 size-4" />
        Uppdatera
      </Button>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              INT7-flöde
            </CardTitle>
            <CardDescription>
              Automatiserad flyttanmälan via Skatteverkets INT7-system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 font-mono text-xs">
              <div className="rounded-lg bg-muted p-4">
                <p className="mb-2 text-muted-foreground">Flöde:</p>
                <ol className="space-y-1">
                  <li>1. Användaren fyller i formuläret</li>
                  <li>2. POST /api/skv/int7/start → startar BankID</li>
                  <li>3. GET /api/skv/clone/qr/[jobId] → QR-mirroring</li>
                  <li>4. GET /api/skv/clone/state/[jobId] → statusuppdateringar</li>
                  <li>5. POST /api/skv/payload → genererar SKV-payload</li>
                </ol>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="mb-2 text-muted-foreground">Endpoints:</p>
                {[
                  "/api/skv/int7/start",
                  "/api/skv/clone/qr/[jobId]",
                  "/api/skv/clone/state/[jobId]",
                  "/api/skv/payload",
                  "/api/skv/config",
                ].map((ep) => (
                  <p key={ep}>{ep}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Senaste QR-tokens
            </CardTitle>
            <CardDescription>De senast skapade BankID QR-tokens</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : stats && stats.recentTokens.length > 0 ? (
              <div className="space-y-2">
                {stats.recentTokens.map((token) => {
                  const isExpired = new Date(token.expiresAt) < new Date();
                  const isUsed = !!token.usedAt;
                  return (
                    <div
                      key={token.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-mono text-xs">
                          Token #{token.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Skapad:{" "}
                          {new Date(token.createdAt).toLocaleString("sv-SE")}
                        </p>
                      </div>
                      <Badge
                        variant={
                          isUsed
                            ? "default"
                            : isExpired
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {isUsed ? "Använd" : isExpired ? "Utgången" : "Aktiv"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Inga QR-tokens registrerade.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bookmarklet & Autofill</CardTitle>
          <CardDescription>
            SKV-payload kan injiceras via bookmarklet eller autofill-API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="font-medium">SKV service URL</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {stats?.skvServiceUrl || "Ej satt"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Läget är {stats?.remoteSkvService ? "remote service" : "lokalt/ej konfigurerat"}.
                </p>
              </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">POST /api/skv/payload</p>
              <p className="text-muted-foreground">
                Genererar en payload som kan skickas till Skatteverkets formulär
                för att fylla i flyttanmälan automatiskt.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Bookmarklet</p>
              <p className="text-muted-foreground">
                Användaren drar en bookmarklet till bokmärkesfältet. Klicka på
                den medan du är på Skatteverkets sida för att autofylla
                formuläret.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
