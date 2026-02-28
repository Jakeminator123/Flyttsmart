"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export interface ChecklistItem {
  id?: number;
  taskKey?: string;
  sectionKey?: string;
  section?: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed?: boolean;
  needHelp?: boolean;
  wantCompare?: boolean;
  status?: "todo" | "in_progress" | "done";
  comparisonHints?: string[];
  category?: string;
  sortOrder?: number;
}

interface CompareProvider {
  name: string;
  price: string;
  pros: string[];
  cons: string[];
  url?: string;
}

interface CompareResult {
  taskKey: string;
  category: string;
  summary: string;
  providers: CompareProvider[];
  tip: string;
  sources: string[];
  cached: boolean;
  mode: "web_search" | "stub" | "api";
  elArea?: string;
}

interface ChecklistViewProps {
  items: ChecklistItem[];
  onItemChange?: (index: number, changes: Partial<ChecklistItem>) => void;
  className?: string;
  compact?: boolean;
  readOnly?: boolean;
  moveContext?: {
    toPostal?: string;
    toCity?: string;
    moveDate?: string;
    toStreet?: string;
  };
}

const STATUS_CONFIG = {
  todo: {
    label: "Ej startad",
    icon: Circle,
    color: "text-muted-foreground",
    border: "border-l-muted-foreground/30",
  },
  in_progress: {
    label: "Pågår",
    icon: Clock,
    color: "text-amber-500",
    border: "border-l-amber-400",
  },
  done: {
    label: "Klar",
    icon: CheckCircle2,
    color: "text-emerald-500",
    border: "border-l-emerald-400",
  },
} as const;

const SECTION_EMOJI: Record<string, string> = {
  address_authorities: "📮",
  housing_contracts: "🏠",
  utilities_insurance: "⚡",
  bank_finance: "🏦",
  broadband_tech: "📡",
  move_logistics: "🚚",
  post_move: "🎉",
};

const NEXT_STATUS: Record<string, ChecklistItem["status"]> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

function dueDateInfo(dueDate?: string) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0)
    return {
      text: `${Math.abs(diff)}d sen`,
      cls: "text-destructive bg-destructive/10",
    };
  if (diff === 0)
    return { text: "Idag", cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" };
  if (diff <= 7)
    return {
      text: `${diff}d kvar`,
      cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
    };
  return { text: dueDate, cls: "text-muted-foreground bg-muted/50" };
}

function ComparisonSkeleton() {
  return (
    <div className="space-y-4 p-1">
      <Skeleton className="h-5 w-3/4" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-8 w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  rank,
}: {
  provider: CompareProvider;
  rank: number;
}) {
  const best = rank === 0;
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-4 transition-all duration-200 hover:shadow-md",
        best
          ? "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "border-border bg-card hover:border-primary/20",
      )}
    >
      {best && (
        <Badge className="absolute -top-2.5 left-3 gap-1 bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
          <Sparkles className="h-3 w-3" />
          Rekommenderad
        </Badge>
      )}

      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">
          {provider.name}
        </h4>
        <p className="mt-1 text-lg font-bold text-primary">{provider.price}</p>
      </div>

      {provider.pros.length > 0 && (
        <div className="mb-2 space-y-1">
          {provider.pros.slice(0, 3).map((pro, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <ThumbsUp className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              <span className="text-muted-foreground">{pro}</span>
            </div>
          ))}
        </div>
      )}

      {provider.cons.length > 0 && (
        <div className="mb-3 space-y-1">
          {provider.cons.slice(0, 2).map((con, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <ThumbsDown className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
              <span className="text-muted-foreground">{con}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-2">
        {provider.url ? (
          <Button
            asChild
            variant={best ? "default" : "outline"}
            size="sm"
            className="w-full gap-1.5 text-xs"
          >
            <a href={provider.url} target="_blank" rel="noopener noreferrer">
              {best ? "Välj denna" : "Läs mer"}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        ) : (
          <Button
            variant={best ? "default" : "outline"}
            size="sm"
            className="w-full text-xs"
            disabled
          >
            {best ? "Bästa valet" : "Info saknas"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ComparisonPanel({
  result,
  loading,
  error,
  onRetry,
}: {
  result?: CompareResult;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  if (loading) return <ComparisonSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" />
            Försök igen
          </Button>
        )}
      </div>
    );
  }

  if (!result) return null;

  const isStub = result.mode === "stub" && result.providers.length === 0;

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 rounded-xl border border-primary/20 bg-linear-to-br from-primary/3 via-background to-primary/3 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{result.summary}</p>
          {result.elArea && (
            <Badge variant="outline" className="mt-1.5 text-[10px]">
              Elområde: {result.elArea}
            </Badge>
          )}
        </div>
      </div>

      {result.providers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.providers.map((p, i) => (
            <ProviderCard key={`${p.name}-${i}`} provider={p} rank={i} />
          ))}
        </div>
      )}

      {isStub && (
        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-medium text-foreground">
            Detaljerad jämförelse är inte tillgänglig ännu. Här är vad du bör
            tänka på:
          </p>
          <p className="text-xs text-muted-foreground">{result.tip}</p>
        </div>
      )}

      {result.tip && result.providers.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-muted-foreground">{result.tip}</p>
        </div>
      )}

      {result.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          <span className="font-medium">Källor:</span>
          {result.sources.map((src, i) => {
            let host = src;
            try {
              host = new URL(src).hostname.replace("www.", "");
            } catch {
              /* keep raw */
            }
            return (
              <a
                key={i}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-primary transition-colors truncate max-w-[180px]"
              >
                {host}
              </a>
            );
          })}
        </div>
      )}

      {result.cached && (
        <p className="text-[10px] text-muted-foreground/50 italic">
          Cachad data
        </p>
      )}
    </div>
  );
}

export function ChecklistView({
  items,
  onItemChange,
  className,
  compact,
  readOnly = false,
  moveContext,
}: ChecklistViewProps) {
  const [localItems, setLocalItems] = useState(items);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [expandedCompare, setExpandedCompare] = useState<Set<string>>(
    new Set(),
  );
  const [compareData, setCompareData] = useState<
    Record<string, CompareResult>
  >({});
  const [compareLoading, setCompareLoading] = useState<Set<string>>(
    new Set(),
  );
  const [compareErrors, setCompareErrors] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  useEffect(() => {
    const keys = new Set(
      items.map((i) => i.sectionKey || i.section || "other"),
    );
    setExpandedSections(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalize = (item: ChecklistItem): ChecklistItem => ({
    ...item,
    section: item.section || "Övrigt",
    sectionKey: item.sectionKey || "other",
    needHelp: item.needHelp === true,
    wantCompare: item.wantCompare === true,
    status: item.status || (item.completed ? "done" : "todo"),
    comparisonHints: Array.isArray(item.comparisonHints)
      ? item.comparisonHints
      : [],
  });

  const updateItem = (index: number, changes: Partial<ChecklistItem>) => {
    setLocalItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return normalize(item);
        const next = normalize({ ...item, ...changes });
        if (changes.status) {
          next.completed = changes.status === "done";
        }
        return next;
      }),
    );
    onItemChange?.(index, changes);
  };

  const normalizedItems = useMemo(
    () =>
      localItems
        .map(normalize)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localItems],
  );

  const completedCount = normalizedItems.filter(
    (i) => i.status === "done" || i.completed,
  ).length;
  const totalCount = localItems.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const grouped = normalizedItems.reduce<Record<string, ChecklistItem[]>>(
    (acc, item) => {
      const key = item.sectionKey || item.section || "other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {},
  );

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function fetchComparison(taskKey: string) {
    setCompareLoading((prev) => new Set([...prev, taskKey]));
    setCompareErrors((prev) => {
      const { [taskKey]: _, ...rest } = prev;
      return rest;
    });

    try {
      const params = new URLSearchParams();
      if (moveContext?.toPostal) params.set("toPostal", moveContext.toPostal);
      if (moveContext?.toCity) params.set("toCity", moveContext.toCity);
      if (moveContext?.moveDate) params.set("moveDate", moveContext.moveDate);
      if (moveContext?.toStreet) params.set("toStreet", moveContext.toStreet);

      const res = await fetch(`/api/compare/${taskKey}?${params.toString()}`);
      if (!res.ok) throw new Error("Kunde inte hämta jämförelsedata");
      const result: CompareResult = await res.json();
      setCompareData((prev) => ({ ...prev, [taskKey]: result }));
    } catch (err) {
      setCompareErrors((prev) => ({
        ...prev,
        [taskKey]:
          err instanceof Error ? err.message : "Ett fel uppstod vid hämtning",
      }));
    } finally {
      setCompareLoading((prev) => {
        const next = new Set(prev);
        next.delete(taskKey);
        return next;
      });
    }
  }

  function toggleCompare(taskKey: string) {
    const wasExpanded = expandedCompare.has(taskKey);
    setExpandedCompare((prev) => {
      const next = new Set(prev);
      if (wasExpanded) next.delete(taskKey);
      else next.add(taskKey);
      return next;
    });
    if (!wasExpanded && !compareData[taskKey]) {
      fetchComparison(taskKey);
    }
  }

  return (
    <div className={cn("space-y-5", className)}>
      {/* ── Progress ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-r from-primary/5 via-background to-primary/5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {completedCount}
              <span className="text-base font-normal text-muted-foreground">
                /{totalCount}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">moment klara</p>
          </div>
          <div className="relative h-16 w-16">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-muted/40"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${pct * 1.76} 176`}
                strokeLinecap="round"
                className="text-primary transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary tabular-nums">
              {pct}%
            </span>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-linear-to-r from-primary to-primary/70 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Sections ──────────────────────────────────────────────── */}
      {Object.entries(grouped).map(([sectionKey, sectionItems]) => {
        const open = expandedSections.has(sectionKey);
        const secDone = sectionItems.filter(
          (i) => i.status === "done" || i.completed,
        ).length;
        const secTotal = sectionItems.length;
        const label = sectionItems[0]?.section || "Övrigt";
        const emoji = SECTION_EMOJI[sectionKey] || "📋";
        const allDone = secDone === secTotal;

        return (
          <div key={sectionKey}>
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(sectionKey)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200",
                open
                  ? "rounded-b-none border-b-transparent bg-card shadow-sm"
                  : "bg-card/60 hover:bg-card hover:shadow-sm",
                allDone &&
                  "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/10",
              )}
            >
              <span className="text-lg leading-none">{emoji}</span>
              <span
                className={cn(
                  "flex-1 text-sm font-semibold",
                  allDone
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-foreground",
                )}
              >
                {label}
              </span>
              <Badge
                variant={allDone ? "default" : "secondary"}
                className={cn(
                  "text-[10px] tabular-nums",
                  allDone && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                )}
              >
                {secDone}/{secTotal}
              </Badge>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  !open && "-rotate-90",
                )}
              />
            </button>

            {/* Items */}
            {open && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200 divide-y rounded-b-xl border border-t-0 bg-card">
                {sectionItems.map((item) => {
                  const gi = normalizedItems.findIndex(
                    (c) =>
                      c.taskKey === item.taskKey &&
                      c.sortOrder === item.sortOrder,
                  );
                  const sc = STATUS_CONFIG[item.status || "todo"];
                  const StatusIcon = sc.icon;
                  const canCompare = !!(item.comparisonHints?.length && item.taskKey);
                  const isCompOpen = item.taskKey
                    ? expandedCompare.has(item.taskKey)
                    : false;
                  const due = dueDateInfo(item.dueDate);

                  return (
                    <div
                      key={`${item.taskKey || item.title}-${item.sortOrder || 0}`}
                      className={cn("border-l-[3px] transition-colors", sc.border)}
                    >
                      <div className="flex items-start gap-3 px-4 py-3.5">
                        {/* Status icon (click to cycle) */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => {
                                if (gi < 0 || readOnly) return;
                                updateItem(gi, {
                                  status: NEXT_STATUS[item.status || "todo"],
                                });
                              }}
                              className={cn(
                                "mt-0.5 shrink-0 rounded-full p-0.5 transition-all",
                                !readOnly && "hover:scale-110 active:scale-95 cursor-pointer",
                                sc.color,
                              )}
                              aria-label={sc.label}
                            >
                              <StatusIcon className="h-5 w-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {readOnly
                              ? sc.label
                              : `Klicka för att ändra (${sc.label})`}
                          </TooltipContent>
                        </Tooltip>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium leading-snug",
                              item.status === "done"
                                ? "line-through text-muted-foreground"
                                : "text-foreground",
                            )}
                          >
                            {item.title}
                          </p>

                          {!compact && item.description && (
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                              {item.description}
                            </p>
                          )}

                          {/* Action row */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {due && item.status !== "done" && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1 border-0 text-[10px] font-normal",
                                  due.cls,
                                )}
                              >
                                <CalendarDays className="h-3 w-3" />
                                {due.text}
                              </Badge>
                            )}

                            {/* Hjälp toggle */}
                            {!readOnly ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (gi < 0) return;
                                      updateItem(gi, {
                                        needHelp: !item.needHelp,
                                      });
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all",
                                      item.needHelp
                                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted",
                                    )}
                                  >
                                    <HelpCircle className="h-3 w-3" />
                                    Hjälp
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {item.needHelp
                                    ? "Du vill ha hjälp med detta"
                                    : "Markera om du vill ha hjälp"}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              item.needHelp && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-violet-200 text-[10px] text-violet-600 dark:border-violet-800 dark:text-violet-400"
                                >
                                  <HelpCircle className="h-3 w-3" />
                                  Vill ha hjälp
                                </Badge>
                              )
                            )}

                            {/* Jämför button */}
                            {canCompare && (
                              <Button
                                variant={isCompOpen ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-6 gap-1 rounded-full px-2.5 text-[10px] font-semibold transition-all",
                                  !isCompOpen &&
                                    "hover:border-primary hover:text-primary",
                                )}
                                onClick={() => {
                                  if (!item.taskKey) return;
                                  toggleCompare(item.taskKey);
                                  if (!readOnly && gi >= 0 && !item.wantCompare) {
                                    updateItem(gi, { wantCompare: true });
                                  }
                                }}
                              >
                                {compareLoading.has(item.taskKey!) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ArrowLeftRight className="h-3 w-3" />
                                )}
                                Jämför
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Comparison panel (expandable) */}
                      {isCompOpen && item.taskKey && (
                        <div className="px-4 pb-4">
                          <ComparisonPanel
                            result={compareData[item.taskKey]}
                            loading={compareLoading.has(item.taskKey)}
                            error={compareErrors[item.taskKey]}
                            onRetry={() => fetchComparison(item.taskKey!)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
