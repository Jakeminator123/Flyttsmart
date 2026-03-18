"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GitCompareArrows,
  Zap,
  Wifi,
  Shield,
  Truck,
  Sparkles,
  Archive,
  Radio,
  Mail,
  HelpCircle,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface CompareResult {
  taskKey: string;
  mode: string;
  snippet?: string;
  error?: string;
}

interface ComparisonTaskConfig {
  taskKey: string;
  category: string;
  defaultMode: "web_search" | "stub" | "api";
  resolvedMode: "web_search" | "stub" | "api";
  stubHints: string[];
}

interface ComparisonAdminConfig {
  webSearchEnabled: boolean;
  compareModel: string;
  cacheTtlMs: number;
  tasks: ComparisonTaskConfig[];
  liveTaskKeys: string[];
  apiTaskKeys: string[];
  stubTaskKeys: string[];
}

const TASK_LABELS: Record<string, string> = {
  electricity_contract: "Elavtal",
  broadband_order_install: "Bredband",
  home_insurance: "Hemförsäkring",
  movers_or_trailer: "Flyttfirma",
  cleaning_service: "Flyttstädning",
  storage_gap: "Magasinering",
  broadband_tech_check: "Teknikcheck bredband",
  mail_forwarding: "Eftersändning",
};

const TASK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  electricity_contract: Zap,
  broadband_order_install: Wifi,
  home_insurance: Shield,
  movers_or_trailer: Truck,
  cleaning_service: Sparkles,
  storage_gap: Archive,
  broadband_tech_check: Radio,
  mail_forwarding: Mail,
};

export default function ComparisonsPage() {
  const [config, setConfig] = useState<ComparisonAdminConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, CompareResult>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/comparisons/config")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load comparisons config");
        return r.json();
      })
      .then(setConfig)
      .catch((e) => setConfigError(e.message));
  }, []);

  const liveTasks = useMemo(
    () => config?.tasks.filter((t) => t.resolvedMode === "web_search") ?? [],
    [config]
  );
  const stubTasks = useMemo(
    () => config?.tasks.filter((t) => t.resolvedMode === "stub") ?? [],
    [config]
  );
  const apiTasks = useMemo(
    () => config?.tasks.filter((t) => t.resolvedMode === "api") ?? [],
    [config]
  );

  async function runTest(taskKey: string) {
    setTestingKey(taskKey);
    try {
      const res = await fetch(
        `/api/compare/${taskKey}?toPostal=41119&toCity=Göteborg&moveDate=2026-04-01`
      );
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [taskKey]: {
          taskKey,
          mode: data.mode ?? "unknown",
          snippet: data.result
            ? typeof data.result === "string"
              ? data.result.slice(0, 220)
              : JSON.stringify(data.result).slice(0, 220)
            : data.summary
              ? String(data.summary).slice(0, 220)
              : undefined,
          error: data.error,
        },
      }));
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [taskKey]: { taskKey, mode: "error", error: String(e) },
      }));
    } finally {
      setTestingKey(null);
    }
  }

  if (configError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Jämförelser</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            {configError}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jämförelser</h1>
        <p className="text-muted-foreground">
          Runtime-konfiguration för jämförelseverktyget
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCard title="Live (web search)" value={liveTasks.length} />
        <InfoCard title="Stub" value={stubTasks.length} />
        <InfoCard title="API mode" value={apiTasks.length} />
        <InfoCard
          title="Cache TTL"
          value={config ? Math.round(config.cacheTtlMs / (60 * 60 * 1000)) : "–"}
          suffix="h"
        />
        <InfoCard
          title="Web search"
          value={config?.webSearchEnabled ? "På" : "Av"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Systemstatus</CardTitle>
          <CardDescription>Aktuell runtime från backend</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">COMPARE_MODEL</p>
            <p className="font-mono text-sm">{config?.compareModel ?? "–"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Totalt antal tasks</p>
            <p className="text-sm font-semibold">{config?.tasks.length ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <TaskSection
        title="Live-jämförelser (Web Search)"
        description="Dessa körs mot OpenAI Responses API med web search."
        tasks={liveTasks}
        testResults={testResults}
        testingKey={testingKey}
        onTest={runTest}
      />

      <TaskSection
        title="Stubbade jämförelser"
        description="Dessa returnerar fallback-hints tills live eller API-mode aktiveras."
        tasks={stubTasks}
        testResults={testResults}
        testingKey={testingKey}
        onTest={runTest}
      />

      {apiTasks.length > 0 && (
        <TaskSection
          title="API-jämförelser"
          description="Dessa använder extern API-integration (när konfigurerad)."
          tasks={apiTasks}
          testResults={testResults}
          testingKey={testingKey}
          onTest={runTest}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Elområdesmappning</CardTitle>
          <CardDescription>
            Samma regler som används i backend (`postalToElArea`)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { area: "SE1", region: "Norra Sverige (Luleå)", range: "Postnr 87–98" },
              { area: "SE2", region: "Mellersta Sverige (Sundsvall)", range: "Postnr 80–86" },
              { area: "SE3", region: "Södra-mellersta (Stockholm)", range: "Övriga postnummer" },
              { area: "SE4", region: "Sydligaste Sverige (Malmö)", range: "Postnr 20–29" },
            ].map((el) => (
              <div key={el.area} className="rounded-lg border p-3">
                <p className="text-lg font-bold text-primary">{el.area}</p>
                <p className="text-sm">{el.region}</p>
                <p className="text-xs text-muted-foreground">{el.range}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaskSection({
  title,
  description,
  tasks,
  testResults,
  testingKey,
  onTest,
}: {
  title: string;
  description: string;
  tasks: ComparisonTaskConfig[];
  testResults: Record<string, CompareResult>;
  testingKey: string | null;
  onTest: (taskKey: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompareArrows className="size-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga tasks i denna grupp.</p>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.taskKey}
                task={task}
                result={testResults[task.taskKey]}
                testing={testingKey === task.taskKey}
                onTest={() => onTest(task.taskKey)}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task,
  result,
  testing,
  onTest,
}: {
  task: ComparisonTaskConfig;
  result?: CompareResult;
  testing: boolean;
  onTest: () => void;
}) {
  const Icon = TASK_ICONS[task.taskKey] ?? HelpCircle;
  const label = TASK_LABELS[task.taskKey] ?? task.taskKey;
  const modeLabel =
    task.resolvedMode === "web_search"
      ? "Live"
      : task.resolvedMode === "api"
        ? "API"
        : "Stub";

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div className="text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{label}</p>
              <Badge
                variant={task.resolvedMode === "web_search" ? "default" : task.resolvedMode === "api" ? "outline" : "secondary"}
                className={`text-[10px]${task.resolvedMode === "api" ? " border-emerald-500 text-emerald-700 dark:text-emerald-400" : ""}`}
              >
                {modeLabel}
              </Badge>
            </div>
            <code className="text-xs text-muted-foreground">{task.taskKey}</code>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
          {testing ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : (
            <Play className="mr-1 size-3" />
          )}
          Test
        </Button>
      </div>
      {result && (
        <div className="mt-2 rounded-md bg-muted p-2">
          <div className="flex items-center gap-2">
            {result.error ? (
              <AlertTriangle className="size-3 text-destructive" />
            ) : (
              <CheckCircle2 className="size-3 text-green-500" />
            )}
            <span className="text-xs font-medium">Mode: {result.mode}</span>
          </div>
          {result.snippet && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
              {result.snippet}…
            </p>
          )}
          {result.error && (
            <p className="mt-1 text-xs text-destructive">{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({
  title,
  value,
  suffix,
}: {
  title: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">
          {value}
          {suffix ?? ""}
        </p>
      </CardContent>
    </Card>
  );
}
