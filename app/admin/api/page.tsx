"use client";

import { useEffect, useState } from "react";
import {
  Code2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface EnvStatus {
  key: string;
  set: boolean;
  category: string;
}

interface EndpointStatus {
  path: string;
  method: string;
  description: string;
  category: string;
  status?: "ok" | "error" | "unchecked";
}

const endpoints: EndpointStatus[] = [
  { path: "/api/openclaw/health", method: "GET", description: "OpenClaw gateway health", category: "OpenClaw" },
  { path: "/api/openclaw/chat", method: "POST", description: "Chat proxy till OpenClaw", category: "OpenClaw" },
  { path: "/api/openclaw/access", method: "GET", description: "Site access/bypass cookie", category: "OpenClaw" },
  { path: "/api/openclaw/webhook", method: "POST", description: "Webhook-mottagare", category: "OpenClaw" },
  { path: "/api/did/chat", method: "POST", description: "D-ID → OpenClaw bridge", category: "D-ID" },
  { path: "/api/compare/[taskKey]", method: "GET", description: "Jämförelseverktyg", category: "Jämförelser" },
  { path: "/api/move", method: "POST/GET", description: "Flytt CRUD", category: "Flytt" },
  { path: "/api/ai/validate", method: "POST", description: "AI-validering", category: "AI" },
  { path: "/api/ai/autofill", method: "POST", description: "AI-autofill", category: "AI" },
  { path: "/api/enrich/postal", method: "GET", description: "Postnummer → ort", category: "Enrich" },
  { path: "/api/checklist/template", method: "GET", description: "Checklista-generering", category: "Flytt" },
  { path: "/api/skv/int7/start", method: "POST", description: "SKV INT7 automation", category: "SKV" },
  { path: "/api/skv/clone/qr/[jobId]", method: "GET", description: "BankID QR mirroring", category: "SKV" },
  { path: "/api/skv/clone/state/[jobId]", method: "GET", description: "Clone state tracking", category: "SKV" },
  { path: "/api/skv/payload", method: "POST", description: "SKV payload generation", category: "SKV" },
  { path: "/api/cron/reminders", method: "GET", description: "Påminnelser (cron)", category: "System" },
  { path: "/api/admin/stats", method: "GET", description: "Admin-statistik", category: "Admin" },
  { path: "/api/admin/comparisons/config", method: "GET", description: "Comparisons runtime-config", category: "Admin" },
  { path: "/api/admin/openclaw/events", method: "GET/POST", description: "OpenClaw fel/status-events", category: "Admin" },
  { path: "/api/admin/openclaw/automation", method: "GET/POST", description: "Cron + email automation control", category: "Admin" },
  { path: "/api/admin/openclaw/automation/test-candidate", method: "POST", description: "Skapar testkandidat för reminder-flow", category: "Admin" },
];

export default function ApiPage() {
  const [envStatus, setEnvStatus] = useState<EnvStatus[] | null>(null);
  const [endpointHealth, setEndpointHealth] = useState<Record<string, "ok" | "error">>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch("/api/admin/env-audit")
      .then((r) => r.json())
      .then(setEnvStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function runHealthChecks() {
    setChecking(true);
    const checkable = [
      { key: "/api/openclaw/health", url: "/api/openclaw/health" },
      { key: "/api/admin/stats", url: "/api/admin/stats" },
      { key: "/api/admin/env-audit", url: "/api/admin/env-audit" },
      { key: "/api/admin/did/config", url: "/api/admin/did/config" },
      { key: "/api/admin/openclaw/config", url: "/api/admin/openclaw/config" },
      { key: "/api/admin/openclaw/automation", url: "/api/admin/openclaw/automation" },
      { key: "/api/admin/skv/stats", url: "/api/admin/skv/stats" },
      { key: "/api/admin/comparisons/config", url: "/api/admin/comparisons/config" },
      {
        key: "/api/compare/[taskKey]",
        url: "/api/compare/electricity_contract?toPostal=41119&toCity=Goteborg",
      },
    ];
    const results: Record<string, "ok" | "error"> = {};

    await Promise.all(
      checkable.map(async ({ key, url }) => {
        try {
          const r = await fetch(url);
          results[key] = r.ok ? "ok" : "error";
        } catch {
          results[key] = "error";
        }
      })
    );

    setEndpointHealth(results);
    setChecking(false);
  }

  const categories = [...new Set(endpoints.map((e) => e.category))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API</h1>
        <p className="text-muted-foreground">
          API-endpoints och miljövariabler
        </p>
      </div>

      <Button variant="outline" size="sm" onClick={runHealthChecks} disabled={checking}>
        <RefreshCw className={`mr-2 size-4 ${checking ? "animate-spin" : ""}`} />
        Kör health checks
      </Button>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="size-4" />
              Endpoints ({endpoints.length})
            </CardTitle>
            <CardDescription>Alla registrerade API-rutter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {cat}
                  </p>
                  <div className="space-y-1">
                    {endpoints
                      .filter((e) => e.category === cat)
                      .map((ep) => {
                        const status = endpointHealth[ep.path];
                        return (
                          <div
                            key={ep.path}
                            className="flex items-center gap-3 rounded-lg border p-2.5 text-sm"
                          >
                            {status === "ok" ? (
                              <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
                            ) : status === "error" ? (
                              <XCircle className="size-3.5 shrink-0 text-destructive" />
                            ) : (
                              <div className="size-3.5 shrink-0 rounded-full border" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {ep.method}
                                </Badge>
                                <code className="truncate text-xs">{ep.path}</code>
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {ep.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Miljövariabler
            </CardTitle>
            <CardDescription>
              Granskning av nödvändiga env-variabler (ej värden)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : envStatus ? (
              <div className="space-y-4">
                {[...new Set(envStatus.map((e) => e.category))].map((cat) => (
                  <div key={cat}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {cat}
                    </p>
                    <div className="space-y-1">
                      {envStatus
                        .filter((e) => e.category === cat)
                        .map((env) => (
                          <div
                            key={env.key}
                            className="flex items-center justify-between rounded-lg border p-2.5"
                          >
                            <code className="text-xs">{env.key}</code>
                            <Badge
                              variant={env.set ? "default" : "destructive"}
                              className="text-[10px]"
                            >
                              {env.set ? "Set" : "Missing"}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Kunde inte hämta miljövariabelstatus.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
