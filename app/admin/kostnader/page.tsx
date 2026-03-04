"use client";

import { useEffect, useState } from "react";
import {
  Coins,
  Activity,
  Zap,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import * as Recharts from "recharts";

type PeriodKey = "24h" | "7d" | "30d";

interface UsageData {
  period: PeriodKey;
  since: string;
  summary: {
    requests: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number | null;
    successRate: number;
  };
  byProvider: {
    provider: string;
    requests: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number | null;
    successRate: number;
  }[];
  byFlow: {
    flow: string;
    requests: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number | null;
    successRate: number;
  }[];
  dailyTrend: {
    day: string;
    provider: string;
    requests: number;
    totalTokens: number;
    totalCostUsd: number;
  }[];
}

const PERIOD_LABELS: Record<PeriodKey, string> = {
  "24h": "24 timmar",
  "7d": "7 dagar",
  "30d": "30 dagar",
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function pivotDailyTrend(
  dailyTrend: UsageData["dailyTrend"],
): { day: string; [key: string]: unknown }[] {
  const byDay = new Map<string, { day: string; [key: string]: unknown }>();
  for (const row of dailyTrend) {
    let entry = byDay.get(row.day);
    if (!entry) {
      entry = { day: row.day };
      byDay.set(row.day, entry);
    }
    entry[row.provider] = row.totalCostUsd;
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.day.localeCompare(b.day),
  );
}

export default function KostnaderPage() {
  const [period, setPeriod] = useState<PeriodKey>("24h");
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/usage?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error("Kunde inte ladda anvandningsdata");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Kostnader</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chartData = data ? pivotDailyTrend(data.dailyTrend) : [];
  const providers = data
    ? [...new Set(data.dailyTrend.map((r) => r.provider))].sort()
    : [];

  const chartConfig: Record<string, { label?: string; color?: string }> = {
    day: { label: "Dag" },
  };
  providers.forEach((p, i) => {
    chartConfig[p] = { label: p, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kostnader</h1>
          <p className="text-muted-foreground">
            Anvandning och kostnader per provider och flow
          </p>
        </div>
        <div className="flex gap-2">
          {(["24h", "7d", "30d"] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Zap className="size-4" />}
          title="Totalt tokens"
          value={data?.summary.totalTokens}
          loading={loading}
          formatter={(v) => v.toLocaleString("sv-SE")}
        />
        <StatCard
          icon={<DollarSign className="size-4" />}
          title="Total kostnad (USD)"
          value={data?.summary.totalCostUsd}
          loading={loading}
          formatter={(v) => v.toFixed(4)}
        />
        <StatCard
          icon={<Activity className="size-4" />}
          title="Request"
          value={data?.summary.requests}
          loading={loading}
          formatter={(v) => v.toLocaleString("sv-SE")}
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          title="Snitt latens (ms)"
          value={data?.summary.avgLatencyMs}
          loading={loading}
          formatter={(v) => String(v)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="size-4" />
              Per provider
            </CardTitle>
            <CardDescription>Kostnad och anvandning per leverantor</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : data && data.byProvider.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Request</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">USD</TableHead>
                    <TableHead className="text-right">Latens</TableHead>
                    <TableHead className="text-right">OK %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byProvider.map((row) => (
                    <TableRow key={row.provider}>
                      <TableCell>
                        <Badge variant="secondary">{row.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.requests.toLocaleString("sv-SE")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.totalTokens.toLocaleString("sv-SE")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.totalCostUsd.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.avgLatencyMs != null ? `${row.avgLatencyMs} ms` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.successRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ingen data for vald period.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Per flow
            </CardTitle>
            <CardDescription>Kostnad och anvandning per flow</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : data && data.byFlow.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flow</TableHead>
                    <TableHead className="text-right">Request</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">USD</TableHead>
                    <TableHead className="text-right">Latens</TableHead>
                    <TableHead className="text-right">OK %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byFlow.map((row) => (
                    <TableRow key={row.flow}>
                      <TableCell>
                        <Badge variant="outline">{row.flow}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.requests.toLocaleString("sv-SE")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.totalTokens.toLocaleString("sv-SE")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.totalCostUsd.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.avgLatencyMs != null ? `${row.avgLatencyMs} ms` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.successRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ingen data for vald period.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daglig kostnadstrend (USD)</CardTitle>
          <CardDescription>
            Stackad kostnad per provider over tid
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length > 0 && providers.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <Recharts.AreaChart data={chartData} margin={{ left: 0 }}>
                <Recharts.CartesianGrid strokeDasharray="3 3" />
                <Recharts.XAxis
                  dataKey="day"
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString("sv-SE", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <Recharts.YAxis
                  tickFormatter={(v) => `$${v.toFixed(4)}`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        value != null
                          ? `$${Number(value).toFixed(4)}`
                          : "-"
                      }
                    />
                  }
                />
                {providers.map((provider, i) => (
                  <Recharts.Area
                    key={provider}
                    dataKey={provider}
                    stackId="cost"
                    type="monotone"
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Recharts.AreaChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8">
              Ingen trenddata for vald period.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  loading,
  formatter,
}: {
  icon: React.ReactNode;
  title: string;
  value?: number | null;
  loading: boolean;
  formatter: (v: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : value != null ? (
          <div className="text-2xl font-bold">{formatter(value)}</div>
        ) : (
          <div className="text-2xl font-bold text-muted-foreground">-</div>
        )}
      </CardContent>
    </Card>
  );
}
