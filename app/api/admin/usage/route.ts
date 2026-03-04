import { NextRequest, NextResponse } from "next/server";
import { runSql } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type PeriodKey = "24h" | "7d" | "30d";

const PERIOD_MS: Record<PeriodKey, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function parsePeriod(input: string | null): PeriodKey {
  if (input === "7d" || input === "30d") return input;
  return "24h";
}

function getSince(period: PeriodKey): string {
  const ms = PERIOD_MS[period];
  return new Date(Date.now() - ms).toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = parsePeriod(searchParams.get("period"));
    const since = getSince(period);

    const summaryQuery = sql`
      SELECT
        COUNT(*) AS requests,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COALESCE(SUM(CAST(NULLIF(TRIM(estimated_cost_usd), '') AS REAL)), 0) AS total_cost_usd,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE NULL END) AS avg_latency_ms,
        SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_count
      FROM usage_events
      WHERE created_at >= ${since}
    `;

    const byProviderQuery = sql`
      SELECT
        provider,
        COUNT(*) AS requests,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COALESCE(SUM(CAST(NULLIF(TRIM(estimated_cost_usd), '') AS REAL)), 0) AS total_cost_usd,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE NULL END) AS avg_latency_ms,
        SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_count,
        COUNT(*) AS total
      FROM usage_events
      WHERE created_at >= ${since}
      GROUP BY provider
      ORDER BY total_cost_usd DESC
    `;

    const byFlowQuery = sql`
      SELECT
        flow,
        COUNT(*) AS requests,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COALESCE(SUM(CAST(NULLIF(TRIM(estimated_cost_usd), '') AS REAL)), 0) AS total_cost_usd,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE NULL END) AS avg_latency_ms,
        SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_count,
        COUNT(*) AS total
      FROM usage_events
      WHERE created_at >= ${since}
      GROUP BY flow
      ORDER BY total_cost_usd DESC
    `;

    const dailyTrendQuery = sql`
      SELECT
        date(created_at) AS day,
        provider,
        COUNT(*) AS requests,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COALESCE(SUM(CAST(NULLIF(TRIM(estimated_cost_usd), '') AS REAL)), 0) AS total_cost_usd
      FROM usage_events
      WHERE created_at >= ${since}
      GROUP BY date(created_at), provider
      ORDER BY day ASC, provider ASC
    `;

    function toRows<T>(result: unknown): T[] {
      if (Array.isArray(result)) return result as T[];
      if (
        result &&
        typeof result === "object" &&
        "rows" in result &&
        Array.isArray((result as { rows: unknown }).rows)
      ) {
        return (result as { rows: T[] }).rows;
      }
      return [];
    }

    type SummaryRow = {
      requests: number;
      total_tokens: number;
      total_cost_usd: number;
      avg_latency_ms: number | null;
      ok_count: number;
    };

        const [summaryRow] = toRows<SummaryRow>(await runSql(summaryQuery));

    const byProviderRows = toRows<{
      provider: string;
      requests: number;
      total_tokens: number;
      total_cost_usd: number;
      avg_latency_ms: number | null;
      ok_count: number;
      total: number;
    }>(await runSql(byProviderQuery));

    const byFlowRows = toRows<{
      flow: string;
      requests: number;
      total_tokens: number;
      total_cost_usd: number;
      avg_latency_ms: number | null;
      ok_count: number;
      total: number;
    }>(await runSql(byFlowQuery));

    const dailyTrendRows = toRows<{
      day: string;
      provider: string;
      requests: number;
      total_tokens: number;
      total_cost_usd: number;
    }>(await runSql(dailyTrendQuery));

    const total = summaryRow?.requests ?? 0;
    const okCount = summaryRow?.ok_count ?? 0;
    const successRate = total > 0 ? (okCount / total) * 100 : 0;

    const summary = {
      requests: Number(summaryRow?.requests ?? 0),
      totalTokens: Number(summaryRow?.total_tokens ?? 0),
      totalCostUsd: Number(summaryRow?.total_cost_usd ?? 0),
      avgLatencyMs:
        summaryRow?.avg_latency_ms != null
          ? Math.round(Number(summaryRow.avg_latency_ms))
          : null,
      successRate: Math.round(successRate * 100) / 100,
    };

    const byProvider = byProviderRows.map((r) => {
      const rr = r as Record<string, unknown>;
      return {
        provider: String(rr.provider),
        requests: Number(rr.requests),
        totalTokens: Number(rr.total_tokens),
        totalCostUsd: Number(rr.total_cost_usd),
        avgLatencyMs:
          rr.avg_latency_ms != null
            ? Math.round(Number(rr.avg_latency_ms))
            : null,
        successRate:
          Number(rr.total) > 0
            ? Math.round((Number(rr.ok_count) / Number(rr.total)) * 10000) /
              100
            : 0,
      };
    });

    const byFlow = byFlowRows.map((r) => {
      const rr = r as Record<string, unknown>;
      return {
        flow: String(rr.flow),
        requests: Number(rr.requests),
        totalTokens: Number(rr.total_tokens),
        totalCostUsd: Number(rr.total_cost_usd),
        avgLatencyMs:
          rr.avg_latency_ms != null
            ? Math.round(Number(rr.avg_latency_ms))
            : null,
        successRate:
          Number(rr.total) > 0
            ? Math.round((Number(rr.ok_count) / Number(rr.total)) * 10000) /
              100
            : 0,
      };
    });

    const dailyTrend = dailyTrendRows.map((r) => {
      const rr = r as Record<string, unknown>;
      return {
        day: String(rr.day),
        provider: String(rr.provider),
        requests: Number(rr.requests),
        totalTokens: Number(rr.total_tokens),
        totalCostUsd: Number(rr.total_cost_usd),
      };
    });

    return NextResponse.json({
      period,
      since,
      summary,
      byProvider,
      byFlow,
      dailyTrend,
    });
  } catch (error) {
    console.error("[admin/usage] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage" },
      { status: 500 },
    );
  }
}
