"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Truck,
  CheckCircle2,
  QrCode,
  Bell,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  counts: {
    users: number;
    moves: number;
    checklistItems: number;
    completedChecklistItems: number;
    qrTokens: number;
    reminders: number;
  };
  statusDistribution: { status: string; count: number }[];
  recentMoves: {
    id: number;
    fromCity: string | null;
    toCity: string | null;
    moveDate: string | null;
    status: string;
    createdAt: string;
  }[];
}

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  submitted: "Inskickad",
  confirmed: "Bekräftad",
  completed: "Klar",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Allmänt</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Allmänt</h1>
        <p className="text-muted-foreground">
          Översikt över Flytt.io-plattformen
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Users className="size-4" />}
          title="Användare"
          value={stats?.counts.users}
          loading={loading}
        />
        <StatCard
          icon={<Truck className="size-4" />}
          title="Flyttar"
          value={stats?.counts.moves}
          loading={loading}
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          title="Checklistepunkter"
          value={stats?.counts.checklistItems}
          subtitle={
            stats
              ? `${stats.counts.completedChecklistItems} avklarade`
              : undefined
          }
          loading={loading}
        />
        <StatCard
          icon={<QrCode className="size-4" />}
          title="QR-tokens"
          value={stats?.counts.qrTokens}
          loading={loading}
        />
        <StatCard
          icon={<Bell className="size-4" />}
          title="Påminnelser"
          value={stats?.counts.reminders}
          loading={loading}
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          title="Konvertering"
          value={
            stats && stats.counts.moves > 0
              ? Math.round(
                  ((stats.statusDistribution.find((s) => s.status === "completed")
                    ?.count ?? 0) /
                    stats.counts.moves) *
                    100
                )
              : 0
          }
          suffix="%"
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Flyttstatus
            </CardTitle>
            <CardDescription>
              Fördelning av alla flyttar per status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : stats && stats.statusDistribution.length > 0 ? (
              <div className="space-y-3">
                {stats.statusDistribution.map((s) => {
                  const pct =
                    stats.counts.moves > 0
                      ? Math.round((s.count / stats.counts.moves) * 100)
                      : 0;
                  return (
                    <div key={s.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {statusLabels[s.status] ?? s.status}
                        </span>
                        <span className="text-muted-foreground">
                          {s.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Inga flyttar ännu.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Senaste flyttar</CardTitle>
            <CardDescription>De 10 senaste registrerade flyttarna</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : stats && stats.recentMoves.length > 0 ? (
              <div className="space-y-2">
                {stats.recentMoves.map((move) => (
                  <div
                    key={move.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {move.fromCity ?? "–"} → {move.toCity ?? "–"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {move.moveDate
                          ? new Date(move.moveDate).toLocaleDateString("sv-SE")
                          : "Inget datum"}{" "}
                        · Skapad{" "}
                        {new Date(move.createdAt).toLocaleDateString("sv-SE")}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={statusColors[move.status] ?? ""}
                    >
                      {statusLabels[move.status] ?? move.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Inga flyttar ännu.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  suffix = "",
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  value?: number;
  subtitle?: string;
  suffix?: string;
  loading: boolean;
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
        ) : (
          <>
            <div className="text-2xl font-bold">
              {value?.toLocaleString("sv-SE")}
              {suffix}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
