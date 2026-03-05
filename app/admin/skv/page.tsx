"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  FileText,
  QrCode,
  ShieldCheck,
  Clock,
  RefreshCw,
  AlertTriangle,
  PlayCircle,
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
  runCount: number;
  runningCount: number;
  matchedCount: number;
  failedCount: number;
}

interface SkvRun {
  id: number;
  moveId: number | null;
  jobId: string;
  status: string;
  message: string | null;
  remote: boolean;
  cloneQrEnabled: boolean;
  screenshotPath: string | null;
  sourceData: unknown;
  normalizedPayload: unknown;
  details: unknown;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  moveStatus: string | null;
  moveDate: string | null;
  fromCity: string | null;
  toCity: string | null;
  userName: string | null;
  userEmail: string | null;
}

export default function SkvPage() {
  const [stats, setStats] = useState<SkvStats | null>(null);
  const [runs, setRuns] = useState<SkvRun[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    setLoadingStats(true);
    fetch("/api/admin/skv/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  const fetchRuns = useCallback(() => {
    setLoadingRuns(true);
    fetch("/api/admin/skv/runs?limit=200")
      .then((r) => {
        if (!r.ok) throw new Error("Kunde inte hämta SKV-körningar");
        return r.json();
      })
      .then((data) => {
        const nextRuns = (data?.runs ?? []) as SkvRun[];
        setRuns(nextRuns);
        setRunsError(null);
        setSelectedJobId((prev) => {
          if (prev && nextRuns.some((run) => run.jobId === prev)) return prev;
          return nextRuns[0]?.jobId ?? null;
        });
      })
      .catch((error: unknown) => {
        setRunsError(error instanceof Error ? error.message : "Okänt fel");
      })
      .finally(() => setLoadingRuns(false));
  }, []);

  const refreshAll = useCallback(() => {
    fetchStats();
    fetchRuns();
  }, [fetchRuns, fetchStats]);

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      queued: "Köad",
      running: "Pågår",
      matched: "Klar",
      timeout: "Timeout",
      error: "Fel",
      cancelled: "Avbruten",
      unknown: "Okänd",
    };
    return map[status] ?? status;
  }

  function statusClass(status: string) {
    const map: Record<string, string> = {
      queued: "bg-muted text-muted-foreground",
      running: "bg-blue-100 text-blue-700",
      matched: "bg-green-100 text-green-700",
      timeout: "bg-amber-100 text-amber-700",
      error: "bg-red-100 text-red-700",
      cancelled: "bg-orange-100 text-orange-700",
      unknown: "bg-muted text-muted-foreground",
    };
    return map[status] ?? map.unknown;
  }

  function prettyJson(value: unknown) {
    if (value === null || value === undefined) return "–";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const selectedRun = runs.find((run) => run.jobId === selectedJobId) ?? null;

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
            {loadingStats ? (
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
            {loadingStats ? (
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
            <CardTitle className="text-sm font-medium">SKV-körningar</CardTitle>
            <PlayCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{stats?.runCount ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clone QR</CardTitle>
            <QrCode className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <Badge variant={stats?.cloneQrToSiteEnabled ? "default" : "secondary"}>
                {stats?.cloneQrToSiteEnabled ? "Aktiv" : "Inaktiv"}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pågående</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{stats?.runningCount ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Klara</CardTitle>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{stats?.matchedCount ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fel / timeout</CardTitle>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{stats?.failedCount ?? 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" size="sm" onClick={refreshAll}>
        <RefreshCw className="mr-2 size-4" />
        Uppdatera
      </Button>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Körningslogg
            </CardTitle>
            <CardDescription>
              Historik för startade SKV-int7-jobb (påbörjade, klara, fel, timeout).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRuns ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : runsError ? (
              <p className="text-sm text-destructive">{runsError}</p>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga SKV-körningar sparade ännu.</p>
            ) : (
              <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedJobId(run.jobId)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedJobId === run.jobId ? "bg-muted" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="font-mono text-xs">{run.jobId}</p>
                      <Badge variant="secondary" className={statusClass(run.status)}>
                        {statusLabel(run.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString("sv-SE")} ·{" "}
                      {run.remote ? "Remote" : "Local"} · {run.userName ?? "Okänd användare"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.fromCity ?? "–"} → {run.toCity ?? "–"}
                      {run.moveStatus ? ` · Flyttstatus: ${run.moveStatus}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              Körningsdetalj
            </CardTitle>
            <CardDescription>
              Sparad payload och resultat från externa Playwright-autofyllaren.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedRun ? (
              <p className="text-sm text-muted-foreground">Välj en körning i listan.</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Jobb-ID</p>
                  <p className="font-mono text-xs">{selectedRun.jobId}</p>
                  <Badge variant="secondary" className={statusClass(selectedRun.status)}>
                    {statusLabel(selectedRun.status)}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Startad: {selectedRun.startedAt ? new Date(selectedRun.startedAt).toLocaleString("sv-SE") : "–"}</p>
                  <p>Avslutad: {selectedRun.endedAt ? new Date(selectedRun.endedAt).toLocaleString("sv-SE") : "–"}</p>
                  <p>Uppdaterad: {new Date(selectedRun.updatedAt).toLocaleString("sv-SE")}</p>
                  {selectedRun.message && <p>Meddelande: {selectedRun.message}</p>}
                  {selectedRun.screenshotPath && <p>Screenshot: {selectedRun.screenshotPath}</p>}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Payload till SKV</p>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
                    {prettyJson(selectedRun.normalizedPayload)}
                  </pre>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Resultat från Playwright</p>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
                    {prettyJson(selectedRun.details)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
            {loadingStats ? (
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
