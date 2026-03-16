"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bot,
  Bell,
  RefreshCw,
  Rocket,
  PlayCircle,
  Save,
  Heart,
  Mail,
  Clock3,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Server,
  ExternalLink,
  Pencil,
  History,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface HealthData {
  ok: boolean;
  gatewayUrl: string;
  agentId: string;
  hasGatewayToken: boolean;
}

interface OpenClawConfig {
  identity: string;
  gatewayUrl: string;
  agentId: string;
  models: {
    primary: string;
    fallback: string;
  };
  sync?: {
    configured: boolean;
    endpoint: string | null;
  };
  redeploy?: {
    autoOnSave: boolean;
    renderConfigured: boolean;
  };
}

interface OpenClawEvent {
  id: string;
  level: "info" | "warning" | "error";
  source: string;
  message: string;
  details?: string;
  createdAt: string;
}

interface OpenClawAutomationStatus {
  cronAuthConfigured: boolean;
  defaults: {
    providerPreference: string;
    fromEmail: string | null;
    useAida: boolean;
    dryRunDefault: boolean;
    lookaheadDays: number;
  };
  integrations: {
    hasResendApiKey: boolean;
    hasSendgridApiKey: boolean;
  };
  stats: {
    totalReminderLogs: number;
    todayReminderLogs: number;
  };
  recentLogs: Array<{
    id: number;
    moveId: number;
    scheduledFor: string;
    emailTo: string | null;
    provider: string;
    subject: string | null;
    providerMessageId: string | null;
    createdAt: string;
  }>;
}

interface AutomationRunResponse {
  ok: boolean;
  status?: number;
  payload?: {
    ok: boolean;
    dryRun: boolean;
    lookaheadDays: number;
    provider: string | null;
    targetEmail: string | null;
    counts?: {
      totalCandidates: number;
      sent: number;
      planned: number;
      skipped: number;
      failed: number;
      usedAida: number;
    };
    processed?: Array<{
      moveId: number;
      email: string;
      itemCount: number;
      status: "sent" | "planned" | "skipped" | "failed";
      reason?: string;
      provider?: string;
      subject?: string;
    }>;
  };
  error?: string;
}

interface TestCandidateResponse {
  ok: boolean;
  moveId?: number;
  checklistItemsCreated?: number;
  dueSoonCount?: number;
  error?: string;
}

interface OpenClawReadiness {
  ok: boolean;
  summary: {
    missingCritical: number;
    missingWarnings: number;
  };
  context: {
    webSearchEnabled: boolean;
    didBridgeEnabled: boolean;
    reminderUseAida: boolean;
    providerPreference: string;
  };
  checks: Array<{
    key: string;
    label: string;
    ok: boolean;
    severity: "critical" | "warning";
    details: string;
  }>;
}

export default function OpenClawPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [identity, setIdentity] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [redeploying, setRedeploying] = useState(false);
  const [redeployMessage, setRedeployMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<OpenClawEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [automationStatus, setAutomationStatus] =
    useState<OpenClawAutomationStatus | null>(null);
  const [automationLoading, setAutomationLoading] = useState(true);
  const [automationTargetEmail, setAutomationTargetEmail] = useState("");
  const [automationLookaheadDays, setAutomationLookaheadDays] = useState(3);
  const [automationDryRun, setAutomationDryRun] = useState(true);
  const [automationUseAida, setAutomationUseAida] = useState(true);
  const [automationProvider, setAutomationProvider] = useState("auto");
  const [automationFromEmail, setAutomationFromEmail] = useState("");
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationRunMessage, setAutomationRunMessage] = useState<string | null>(
    null
  );
  const [automationRunResult, setAutomationRunResult] =
    useState<AutomationRunResponse | null>(null);
  const [creatingTestCandidate, setCreatingTestCandidate] = useState(false);
  const [testCandidateMessage, setTestCandidateMessage] = useState<string | null>(
    null
  );
  const [readiness, setReadiness] = useState<OpenClawReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);

  const [renderEnv, setRenderEnv] = useState<Array<{ key: string; value: string; masked: boolean }>>([]);
  const [renderEnvLoading, setRenderEnvLoading] = useState(true);
  const [renderEnvError, setRenderEnvError] = useState<string | null>(null);
  const [renderDeploys, setRenderDeploys] = useState<Array<{
    id: string; status: string; trigger: string; createdAt: string;
    finishedAt: string | null; commitMessage: string | null; commitId: string | null;
  }>>([]);
  const [renderDeploysLoading, setRenderDeploysLoading] = useState(true);
  const [editingEnvKey, setEditingEnvKey] = useState<string | null>(null);
  const [editingEnvValue, setEditingEnvValue] = useState("");
  const [savingEnv, setSavingEnv] = useState(false);
  const [envSaveMsg, setEnvSaveMsg] = useState<string | null>(null);

  const fetchHealth = useCallback(() => {
    setHealthLoading(true);
    fetch("/api/openclaw/health?debug=1")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch health data");
        return r.json();
      })
      .then((data) => {
        setHealth({
          ok: Boolean(data.ok),
          gatewayUrl: data.config?.gatewayUrl ?? "–",
          agentId: data.config?.agentId ?? "–",
          hasGatewayToken: data.config?.hasGatewayToken ?? false,
        });
      })
      .catch(() => setHealth({ ok: false, gatewayUrl: "–", agentId: "–", hasGatewayToken: false }))
      .finally(() => setHealthLoading(false));
  }, []);

  const fetchConfig = useCallback(() => {
    setConfigLoading(true);
    fetch("/api/admin/openclaw/config")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch config");
        return r.json();
      })
      .then((data) => {
        setConfig(data);
        setIdentity(data.identity ?? "");
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  const fetchEvents = useCallback(() => {
    setEventsLoading(true);
    fetch("/api/admin/openclaw/events?limit=20")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch OpenClaw events");
        return r.json();
      })
      .then((data) => setEvents(Array.isArray(data.events) ? data.events : []))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, []);

  const fetchAutomationStatus = useCallback(() => {
    setAutomationLoading(true);
    fetch("/api/admin/openclaw/automation")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch automation status");
        return r.json();
      })
      .then((data) => {
        setAutomationStatus(data);
        setAutomationLookaheadDays(data.defaults?.lookaheadDays ?? 3);
        setAutomationDryRun(Boolean(data.defaults?.dryRunDefault));
        setAutomationUseAida(Boolean(data.defaults?.useAida));
        setAutomationProvider(data.defaults?.providerPreference || "auto");
      })
      .catch(() => {
        setAutomationStatus(null);
      })
      .finally(() => setAutomationLoading(false));
  }, []);

  const fetchReadiness = useCallback(() => {
    setReadinessLoading(true);
    fetch("/api/admin/openclaw/readiness")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch readiness");
        return r.json();
      })
      .then((data) => setReadiness(data))
      .catch(() => setReadiness(null))
      .finally(() => setReadinessLoading(false));
  }, []);

  const fetchRenderEnv = useCallback(() => {
    setRenderEnvLoading(true);
    setRenderEnvError(null);
    fetch("/api/admin/render/env")
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 501 ? "Render API-nyckel saknas" : `Render API ${r.status}`);
        return r.json();
      })
      .then((data) => setRenderEnv(data.vars ?? []))
      .catch((e) => { setRenderEnvError(e.message); setRenderEnv([]); })
      .finally(() => setRenderEnvLoading(false));
  }, []);

  const fetchRenderDeploys = useCallback(() => {
    setRenderDeploysLoading(true);
    fetch("/api/admin/render/deploys")
      .then((r) => { if (!r.ok) throw new Error(""); return r.json(); })
      .then((data) => setRenderDeploys(data.deploys ?? []))
      .catch(() => setRenderDeploys([]))
      .finally(() => setRenderDeploysLoading(false));
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchConfig();
    fetchEvents();
    fetchAutomationStatus();
    fetchReadiness();
    fetchRenderEnv();
    fetchRenderDeploys();
  }, [fetchHealth, fetchConfig, fetchEvents, fetchAutomationStatus, fetchReadiness, fetchRenderEnv, fetchRenderDeploys]);

  async function handleSaveEnvVar(key: string, value: string) {
    setSavingEnv(true);
    setEnvSaveMsg(null);
    try {
      const res = await fetch("/api/admin/render/env", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ key, value }] }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnvSaveMsg(`${key} uppdaterad. Redeploy krävs.`);
        setEditingEnvKey(null);
        fetchRenderEnv();
      } else {
        setEnvSaveMsg(data.error ?? "Kunde inte spara.");
      }
    } catch {
      setEnvSaveMsg("Nätverksfel.");
    } finally {
      setSavingEnv(false);
    }
  }

  async function handleSaveIdentity() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/admin/openclaw/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const statusBits: string[] = [];
        if (data.write?.ok) {
          statusBits.push("lokal fil sparad");
        }
        if (data.sync?.attempted) {
          statusBits.push(data.sync?.ok ? "synk OK" : "synk fel");
        }
        if (data.redeploy?.attempted) {
          statusBits.push(data.redeploy?.ok ? "redeploy startad" : "redeploy fel");
        }
        setSaveMessage(
          statusBits.length > 0
            ? `Sparat (${statusBits.join(", ")}).`
            : "Sparat."
        );
        fetchConfig();
        fetchReadiness();
      } else {
        const fallbackError =
          data?.error ||
          data?.sync?.reason ||
          data?.redeploy?.reason ||
          "Kunde inte spara.";
        setSaveMessage(fallbackError);
      }
    } catch {
      setSaveMessage("Nätverksfel.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRedeploy() {
    setRedeploying(true);
    setRedeployMessage(null);
    try {
      const res = await fetch("/api/admin/openclaw/redeploy", { method: "POST" });
      const data = await res.json();
      setRedeployMessage(
        res.ok
          ? `Redeploy startad${data.deployId ? ` (id: ${data.deployId})` : ""}.`
          : data.error ?? data.details ?? "Redeploy misslyckades."
      );
    } catch {
      setRedeployMessage("Nätverksfel.");
    } finally {
      setRedeploying(false);
      fetchReadiness();
    }
  }

  async function handleRunAutomation() {
    setAutomationRunning(true);
    setAutomationRunMessage(null);
    setAutomationRunResult(null);

    try {
      const res = await fetch("/api/admin/openclaw/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail: automationTargetEmail.trim() || undefined,
          lookaheadDays: automationLookaheadDays,
          dryRun: automationDryRun,
          useAida: automationUseAida,
          provider: automationProvider,
          fromEmail: automationFromEmail.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as AutomationRunResponse;
      setAutomationRunResult(data);

      if (res.ok && data.payload?.ok) {
        const counts = data.payload.counts;
        setAutomationRunMessage(
          counts
            ? `Körning klar: sent=${counts.sent}, planned=${counts.planned}, skipped=${counts.skipped}, failed=${counts.failed}.`
            : "Körning klar."
        );
      } else {
        setAutomationRunMessage(data.error ?? "Automation-körning misslyckades.");
      }
    } catch {
      setAutomationRunMessage("Nätverksfel vid automation-körning.");
    } finally {
      setAutomationRunning(false);
      fetchAutomationStatus();
    }
  }

  async function handleCreateTestCandidate() {
    const email = automationTargetEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setTestCandidateMessage(
        "Ange en giltig e-post i \"Mål-e-post\" först, t.ex. jakobkorea1@gmail.com."
      );
      return;
    }

    setCreatingTestCandidate(true);
    setTestCandidateMessage(null);

    try {
      const res = await fetch("/api/admin/openclaw/automation/test-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as TestCandidateResponse;
      if (res.ok && data.ok) {
        setTestCandidateMessage(
          `Testkandidat skapad (moveId=${data.moveId}, checklista=${data.checklistItemsCreated}, dueSoon=${data.dueSoonCount}).`
        );
      } else {
        setTestCandidateMessage(data.error ?? "Kunde inte skapa testkandidat.");
      }
    } catch {
      setTestCandidateMessage("Nätverksfel vid skapande av testkandidat.");
    } finally {
      setCreatingTestCandidate(false);
      fetchAutomationStatus();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OpenClaw</h1>
        <p className="text-muted-foreground">
          Hantera aida-flyttagent – identitet, konfiguration och deploy
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gateway</CardTitle>
            {healthLoading ? (
              <Skeleton className="size-5 rounded-full" />
            ) : health?.ok ? (
              <CheckCircle2 className="size-4 text-green-500" />
            ) : (
              <AlertTriangle className="size-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <p className="truncate text-xs text-muted-foreground">
              {health?.gatewayUrl ?? "–"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Agent ID</CardTitle>
            <Bot className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">
              {health?.agentId ?? "–"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Token</CardTitle>
            <Heart className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={health?.hasGatewayToken ? "default" : "destructive"}>
              {health?.hasGatewayToken ? "Konfigurerad" : "Saknas"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Modell</CardTitle>
            <Bot className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="truncate text-xs font-mono">
              {config?.models.primary ?? "–"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={fetchHealth}>
          <RefreshCw className="mr-2 size-4" />
          Health check
        </Button>
        <Button variant="outline" size="sm" onClick={fetchEvents}>
          <Bell className="mr-2 size-4" />
          Hämta events
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleRedeploy}
          disabled={redeploying}
        >
          {redeploying ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 size-4" />
          )}
          Redeploy agent
        </Button>
        {redeployMessage && (
          <span className="self-center text-sm text-muted-foreground">
            {redeployMessage}
          </span>
        )}
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Agent Identity (IDENTITY.md)</CardTitle>
          <CardDescription>
            Systemprompt som styr hur Aida beter sig. Sparas till{" "}
            <code className="text-xs">claw/config/agents/aida-flyttagent/agent/IDENTITY.md</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <textarea
              className="min-h-[320px] w-full rounded-lg border bg-muted/50 p-4 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            />
          )}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveIdentity} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Spara IDENTITY.md
            </Button>
            {saveMessage && (
              <span className="text-sm text-muted-foreground">{saveMessage}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrationer</CardTitle>
          <CardDescription>
            Synk till extern OpenClaw-server och redeploy-konfiguration
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <ConfigRow
            label="Extern sync"
            value={config?.sync?.configured ? "Konfigurerad" : "Ej konfigurerad"}
          />
          <ConfigRow
            label="Sync-endpoint"
            value={config?.sync?.endpoint ?? "–"}
          />
          <ConfigRow
            label="Auto redeploy vid Save"
            value={config?.redeploy?.autoOnSave ? "Ja" : "Nej"}
          />
          <ConfigRow
            label="Render deploy credentials"
            value={config?.redeploy?.renderConfigured ? "Konfigurerad" : "Saknas"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness efter redeploy</CardTitle>
          <CardDescription>
            Snabb driftkontroll for Aidas capabilities (API, web search, e-post, D-ID)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {readinessLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : readiness ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={readiness.ok ? "default" : "destructive"}>
                  {readiness.ok ? "Ready" : "Action required"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Critical missing: {readiness.summary.missingCritical} · Warning missing:{" "}
                  {readiness.summary.missingWarnings}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {readiness.checks.map((check) => (
                  <div
                    key={check.key}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{check.label}</p>
                      <Badge
                        variant={
                          check.ok
                            ? "default"
                            : check.severity === "critical"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {check.ok ? "ok" : check.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {check.details}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Kunde inte hamta readiness-status.
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReadiness}
              disabled={readinessLoading}
            >
              <RefreshCw className="mr-2 size-4" />
              Uppdatera readiness
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="size-4" />
            Automation (Cron + E-post)
          </CardTitle>
          <CardDescription>
            Översikt och manuell körning av påminnelse-jobb via OpenClaw
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {automationLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <ConfigRow
                  label="Cron secret"
                  value={
                    automationStatus?.cronAuthConfigured
                      ? "Konfigurerad"
                      : "Saknas"
                  }
                />
                <ConfigRow
                  label="Provider (default)"
                  value={automationStatus?.defaults.providerPreference || "auto"}
                />
                <ConfigRow
                  label="From-email (default)"
                  value={automationStatus?.defaults.fromEmail || "Ej satt"}
                />
                <ConfigRow
                  label="REMINDER_USE_AIDA"
                  value={automationStatus?.defaults.useAida ? "true" : "false"}
                />
                <ConfigRow
                  label="Resend API key"
                  value={
                    automationStatus?.integrations.hasResendApiKey
                      ? "Konfigurerad"
                      : "Saknas"
                  }
                />
                <ConfigRow
                  label="SendGrid API key"
                  value={
                    automationStatus?.integrations.hasSendgridApiKey
                      ? "Konfigurerad"
                      : "Saknas"
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Utskick idag
                  </p>
                  <p className="text-lg font-semibold">
                    {automationStatus?.stats.todayReminderLogs ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Totalt reminder_logs
                  </p>
                  <p className="text-lg font-semibold">
                    {automationStatus?.stats.totalReminderLogs ?? 0}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Mål-e-post (valfritt)
                  </label>
                  <input
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    placeholder="anna@example.com"
                    value={automationTargetEmail}
                    onChange={(e) => setAutomationTargetEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Lookahead dagar
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={automationLookaheadDays}
                    onChange={(e) =>
                      setAutomationLookaheadDays(Number(e.target.value || 3))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Provider override
                  </label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={automationProvider}
                    onChange={(e) => setAutomationProvider(e.target.value)}
                  >
                    <option value="auto">auto</option>
                    <option value="resend">resend</option>
                    <option value="sendgrid">sendgrid</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    From-email override (valfritt)
                  </label>
                  <input
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    placeholder="no-reply@din-domän.se"
                    value={automationFromEmail}
                    onChange={(e) => setAutomationFromEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>
                  <strong>targetEmail</strong>: Kör bara för en specifik användare
                  (bra för test).
                </p>
                <p>
                  <strong>lookaheadDays</strong>: Hur långt fram systemet letar
                  efter förfallna checklistpunkter.
                </p>
                <p>
                  <strong>dryRun</strong>: Simulerar körning utan att skicka
                  e-post.
                </p>
                <p>
                  <strong>provider</strong>: Tvinga kanal (`resend`/`sendgrid`)
                  eller `auto` (backend väljer).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={automationDryRun}
                    onChange={(e) => setAutomationDryRun(e.target.checked)}
                  />
                  Dry run
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={automationUseAida}
                    onChange={(e) => setAutomationUseAida(e.target.checked)}
                  />
                  Använd AIda för mailtext
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleRunAutomation}
                  disabled={automationRunning || creatingTestCandidate}
                >
                  {automationRunning ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 size-4" />
                  )}
                  Kör automation nu
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCreateTestCandidate}
                  disabled={creatingTestCandidate || automationRunning}
                >
                  {creatingTestCandidate ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 size-4" />
                  )}
                  Skapa testkandidat
                </Button>
                <Button
                  variant="outline"
                  onClick={fetchAutomationStatus}
                  disabled={automationLoading}
                >
                  <RefreshCw className="mr-2 size-4" />
                  Uppdatera status
                </Button>
                {automationRunMessage && (
                  <span className="text-sm text-muted-foreground">
                    {automationRunMessage}
                  </span>
                )}
                {testCandidateMessage && (
                  <span className="text-sm text-muted-foreground">
                    {testCandidateMessage}
                  </span>
                )}
              </div>

              {automationRunResult?.payload?.processed &&
                automationRunResult.payload.processed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Senaste körning (urval)
                    </p>
                    {automationRunResult.payload.processed
                      .slice(0, 8)
                      .map((row, idx) => (
                        <div
                          key={`${row.moveId}-${idx}`}
                          className="flex items-center justify-between rounded-lg border p-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono">{row.email}</p>
                            <p className="text-muted-foreground">
                              moveId={row.moveId}, items={row.itemCount}
                            </p>
                          </div>
                          <Badge
                            variant={
                              row.status === "failed"
                                ? "destructive"
                                : row.status === "sent"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {row.status}
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}

              <Separator />

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Senaste utskicksloggar
                </p>
                {automationStatus?.recentLogs?.length ? (
                  automationStatus.recentLogs.slice(0, 10).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-mono">
                          {log.emailTo || "okänd e-post"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {log.scheduledFor} · {log.provider} · {log.subject || "utan ämne"}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("sv-SE")}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Inga reminder-logs ännu.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-4" />
            Render – Miljövariabler
          </CardTitle>
          <CardDescription>
            Env vars på <code className="text-xs">openclaw-aida</code> (Render).
            Ändringar kräver redeploy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderEnvLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : renderEnvError ? (
            <p className="text-sm text-destructive">{renderEnvError}</p>
          ) : (
            <div className="space-y-2">
              {renderEnv.map((env) => (
                <div key={env.key} className="rounded-lg border p-3">
                  {editingEnvKey === env.key ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">{env.key}</p>
                      <input
                        className="h-9 w-full rounded-md border bg-background px-3 font-mono text-sm"
                        value={editingEnvValue}
                        onChange={(e) => setEditingEnvValue(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEnvVar(env.key, editingEnvValue)}
                          disabled={savingEnv}
                        >
                          {savingEnv ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Save className="mr-1 size-3" />}
                          Spara
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingEnvKey(null)}>
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{env.key}</p>
                        <p className="truncate font-mono text-sm">
                          {env.value || "–"}
                          {env.masked && <Badge variant="secondary" className="ml-2 text-[9px]">masked</Badge>}
                        </p>
                      </div>
                      {!env.masked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingEnvKey(env.key); setEditingEnvValue(env.value); setEnvSaveMsg(null); }}
                        >
                          <Pencil className="size-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {envSaveMsg && (
            <p className="text-sm text-muted-foreground">{envSaveMsg}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRenderEnv} disabled={renderEnvLoading}>
              <RefreshCw className="mr-2 size-4" />
              Uppdatera
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://openclaw-aida.onrender.com/chat?session=agent%3Aaida-flyttagent%3Amain", "_blank")}
            >
              <ExternalLink className="mr-2 size-4" />
              OpenClaw Control UI
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4" />
            Render – Deploy-historik
          </CardTitle>
          <CardDescription>Senaste 10 deploys för openclaw-aida</CardDescription>
        </CardHeader>
        <CardContent>
          {renderDeploysLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : renderDeploys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga deploys hittade.</p>
          ) : (
            <div className="space-y-2">
              {renderDeploys.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={d.status === "live" ? "default" : d.status === "build_failed" || d.status === "update_failed" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {d.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{d.trigger}</span>
                      {d.commitId && (
                        <code className="text-[10px] text-muted-foreground">{d.commitId}</code>
                      )}
                    </div>
                    {d.commitMessage && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.commitMessage}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString("sv-SE")}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={fetchRenderDeploys} disabled={renderDeploysLoading}>
              <RefreshCw className="mr-2 size-4" />
              Uppdatera
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OpenClaw events</CardTitle>
          <CardDescription>
            Senaste fel och statusmeddelanden från OpenClaw-kedjan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga events ännu.
            </p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          event.level === "error"
                            ? "destructive"
                            : event.level === "warning"
                              ? "secondary"
                              : "default"
                        }
                        className="text-[10px]"
                      >
                        {event.level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {event.source}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString("sv-SE")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{event.message}</p>
                  {event.details && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-sm">{value || "–"}</p>
    </div>
  );
}
