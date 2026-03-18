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
    chip: "border-border/70 bg-background text-muted-foreground",
    surface: "bg-muted/70 text-muted-foreground",
  },
  in_progress: {
    label: "Pågår",
    icon: Clock,
    color: "text-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",
    surface: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300",
  },
  done: {
    label: "Klar",
    icon: CheckCircle2,
    color: "text-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300",
    surface: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
} as const;

const SECTION_META: Record<
  string,
  { number: string; eyebrow: string; description: string }
> = {
  address_authorities: {
    number: "01",
    eyebrow: "Grundsteg",
    description: "Adress, myndigheter och det som behöver landa tidigt.",
  },
  housing_contracts: {
    number: "02",
    eyebrow: "Boendet",
    description: "Avtal, nycklar och detaljer kopplade till bostaden.",
  },
  utilities_insurance: {
    number: "03",
    eyebrow: "Praktiskt",
    description: "El, försäkring och sådant som påverkar vardagen direkt.",
  },
  bank_finance: {
    number: "04",
    eyebrow: "Ekonomi",
    description: "Bank, betalningar och saker som bör följa med utan glapp.",
  },
  broadband_tech: {
    number: "05",
    eyebrow: "Uppkoppling",
    description: "Bredband och tjänster du kan vilja jämföra innan du väljer.",
  },
  move_logistics: {
    number: "06",
    eyebrow: "Flyttdagen",
    description: "Logistik, tajming och sådant som gör själva dagen smidigare.",
  },
  post_move: {
    number: "07",
    eyebrow: "Efter flytten",
    description: "Det sista finliret när du redan har kommit på plats.",
  },
};

const NEXT_STATUS: Record<string, ChecklistItem["status"]> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

const LEGACY_TEXT_REPLACEMENTS: Array<[string, string]> = [
  ["Folkbokforing/adressandring", "Folkbokföring/adressändring"],
  ["Eftersandning", "Eftersändning"],
  ["myndigheter/tjanster", "myndigheter/tjänster"],
  ["Uppsagning", "Uppsägning"],
  ["forsaljning", "försäljning"],
  ["bostadsratt", "bostadsrätt"],
  ["overlamning", "överlämning"],
  ["Flyttstadning", "Flyttstädning"],
  ["Stadfirma", "Städfirma"],
  ["Forsakring", "Försäkring"],
  ["varme", "värme"],
  ["hemforsakring", "hemförsäkring"],
  ["Hemforsakring", "Hemförsäkring"],
  ["flyttanmalan", "flyttanmälan"],
  ["saga upp", "säga upp"],
  ["Rorligt", "Rörligt"],
  ["Paslag", "Påslag"],
  ["Sjalvrisk", "Självrisk"],
  ["skyddsniva", "skyddsnivå"],
  ["fjarrvarme", "fjärrvärme"],
  ["kopplat", "kopplade"],
  ["pa nya adressen", "på nya adressen"],
  ["Tillgangliga leverantorer", "Tillgängliga leverantörer"],
  ["Stod for", "Stöd för"],
  ["Uppsagning nuvarande avtal / flytt av tjanst", "Uppsägning nuvarande avtal / flytt av tjänst"],
  ["Bestalla", "Beställa"],
  ["tackningstest", "täckningstest"],
  ["slap", "släp"],
  ["Omdomen", "Omdömen"],
  ["Parkeringstillstand", "Parkeringstillstånd"],
  ["Sakerhet", "Säkerhet"],
  ["las", "lås"],
  ["Slutavstamning", "Slutavstämning"],
  ["ratt", "rätt"],
  ["stammer", "stämmer"],
];

function normalizeLegacyText(value?: string) {
  if (!value) return value;

  return LEGACY_TEXT_REPLACEMENTS.reduce(
    (text, [from, to]) => text.replaceAll(from, to),
    value,
  );
}

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

function getSectionMeta(sectionKey: string) {
  return (
    SECTION_META[sectionKey] ?? {
      number: "00",
      eyebrow: "Övrigt",
      description: "Fler steg som hör till din flyttplan.",
    }
  );
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
    const normalized = items
      .map(normalize)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const orderedKeys = Array.from(
      new Set(normalized.map((i) => i.sectionKey || i.section || "other")),
    );

    if (orderedKeys.length === 0) {
      setExpandedSections(new Set());
      return;
    }

    if (readOnly) {
      const firstPending = normalized.find((item) => item.status !== "done");
      const firstKey =
        firstPending?.sectionKey || firstPending?.section || orderedKeys[0];
      setExpandedSections(new Set([firstKey]));
      return;
    }

    setExpandedSections(new Set(orderedKeys));
  }, [items, readOnly]);

  const normalize = (item: ChecklistItem): ChecklistItem => ({
    ...item,
    section: normalizeLegacyText(item.section) || "Övrigt",
    sectionKey: item.sectionKey || "other",
    title: normalizeLegacyText(item.title) || item.title,
    description: normalizeLegacyText(item.description),
    comparisonHints: Array.isArray(item.comparisonHints)
      ? item.comparisonHints
          .map((hint) => normalizeLegacyText(hint))
          .filter((hint): hint is string => Boolean(hint))
      : [],
    needHelp: item.needHelp === true,
    wantCompare: item.wantCompare === true,
    status: item.status || (item.completed ? "done" : "todo"),
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
    [localItems],
  );

  const completedCount = normalizedItems.filter(
    (i) => i.status === "done" || i.completed,
  ).length;
  const totalCount = localItems.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const remainingCount = Math.max(totalCount - completedCount, 0);
  const compareReadyCount = normalizedItems.filter(
    (i) =>
      Boolean(
        i.taskKey &&
          Array.isArray(i.comparisonHints) &&
          i.comparisonHints.length > 0,
      ),
  ).length;
  const helpWantedCount = normalizedItems.filter((i) => i.needHelp).length;

  const grouped = normalizedItems.reduce<Record<string, ChecklistItem[]>>(
    (acc, item) => {
      const key = item.sectionKey || item.section || "other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {},
  );

  const groupedEntries = useMemo(
    () =>
      Object.entries(grouped).sort(([a], [b]) => {
        const left = Number.parseInt(getSectionMeta(a).number, 10);
        const right = Number.parseInt(getSectionMeta(b).number, 10);
        return left - right;
      }),
    [grouped],
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
      <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-linear-to-br from-hero-gradient-from via-card to-background p-6 shadow-[0_24px_80px_-40px_rgba(26,26,46,0.25)]">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.05]" />
        <div className="pointer-events-none absolute -right-12 top-0 h-40 w-40 rounded-full bg-primary/8 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-accent/25 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.5fr_0.9fr] lg:items-center">
          <div>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-background/80 px-4 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-primary"
            >
              Din flyttplan
            </Badge>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              En renare checklista med fokus på det viktiga
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Håll koll på vad som är klart, vad som återstår och vilka delar som
              är värda att jämföra utan att checklistan känns tung eller plottrig.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Klart
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {completedCount}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Kvar
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {remainingCount}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Jämförbara val
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {compareReadyCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-border/60 bg-background/85 p-5 shadow-sm backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Framsteg just nu</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {pct}% av checklistan är avklarad.
                </p>
              </div>
              <div className="relative h-18 w-18 shrink-0">
                <svg className="h-18 w-18 -rotate-90" viewBox="0 0 72 72">
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-muted/50"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={`${pct * 1.88} 188`}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-700"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-primary">
                  {pct}%
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                <div
                  className="h-full rounded-full bg-linear-to-r from-primary to-primary/70 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 bg-background px-3 py-1 text-[11px]"
                >
                  {completedCount}/{totalCount} moment klara
                </Badge>
                {helpWantedCount > 0 && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-violet-200 bg-violet-50 px-3 py-1 text-[11px] text-violet-700 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-300"
                  >
                    {helpWantedCount} markerade för hjälp
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sections ──────────────────────────────────────────────── */}
      {groupedEntries.map(([sectionKey, sectionItems]) => {
        const open = expandedSections.has(sectionKey);
        const secDone = sectionItems.filter(
          (i) => i.status === "done" || i.completed,
        ).length;
        const secTotal = sectionItems.length;
        const label = sectionItems[0]?.section || "Övrigt";
        const allDone = secDone === secTotal;
        const secPct = secTotal > 0 ? Math.round((secDone / secTotal) * 100) : 0;
        const meta = getSectionMeta(sectionKey);

        return (
          <div key={sectionKey}>
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(sectionKey)}
              className={cn(
                "group relative flex w-full items-center gap-4 overflow-hidden rounded-[28px] border border-border/60 px-5 py-5 text-left transition-all duration-200 shadow-sm shadow-primary/5",
                open
                  ? "rounded-b-none border-b-transparent bg-card/95"
                  : "bg-card/80 hover:border-primary/15 hover:bg-card/95",
                allDone &&
                  "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/10",
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/8 font-mono text-sm font-semibold tracking-[0.2em] text-primary shadow-inner">
                {meta.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    {meta.eyebrow}
                  </p>
                  {allDone && (
                    <Badge className="rounded-full bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Klar
                    </Badge>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-1 text-base font-semibold tracking-tight",
                    allDone
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-foreground",
                  )}
                >
                  {label}
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {meta.description}
                </p>
              </div>
              <div className="hidden min-w-36 shrink-0 sm:block">
                <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>{secDone}/{secTotal} klara</span>
                  <span className="tabular-nums">{secPct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      allDone ? "bg-emerald-500" : "bg-primary",
                    )}
                    style={{ width: `${secPct}%` }}
                  />
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  !open && "-rotate-90",
                )}
              />
            </button>

            {/* Items */}
            {open && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200 rounded-b-[28px] border border-t-0 border-border/60 bg-card/95 p-3 shadow-sm shadow-primary/5 sm:p-4">
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
                  const isDone = item.status === "done";

                  return (
                    <div
                      key={`${item.taskKey || item.title}-${item.sortOrder || 0}`}
                      className={cn(
                        "rounded-2xl border px-4 py-4 shadow-sm transition-all sm:px-5",
                        isDone
                          ? "border-emerald-200/70 bg-emerald-50/35 dark:border-emerald-800/40 dark:bg-emerald-950/10"
                          : "border-border/70 bg-background/85 hover:border-primary/15 hover:bg-card",
                      )}
                    >
                      <div className="flex items-start gap-3">
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
                                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all",
                                !readOnly && "cursor-pointer hover:scale-[1.03] active:scale-[0.98]",
                                readOnly && "cursor-default",
                                sc.chip,
                              )}
                              aria-label={sc.label}
                            >
                              <StatusIcon className={cn("h-4 w-4", sc.color)} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {readOnly
                              ? sc.label
                              : `Klicka för att ändra (${sc.label})`}
                          </TooltipContent>
                        </Tooltip>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[10px] font-medium",
                                    sc.chip,
                                  )}
                                >
                                  {sc.label}
                                </Badge>
                                {item.needHelp && readOnly && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-violet-200 px-2.5 py-1 text-[10px] text-violet-600 dark:border-violet-800 dark:text-violet-400"
                                  >
                                    Vill ha hjälp
                                  </Badge>
                                )}
                              </div>
                              <p
                                className={cn(
                                  "mt-3 text-[15px] font-semibold leading-snug tracking-tight",
                                  isDone
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground",
                                )}
                              >
                                {item.title}
                              </p>

                              {!compact && item.description && (
                                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                              {due && item.status !== "done" && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "gap-1 rounded-full border-0 px-2.5 py-1 text-[10px] font-medium",
                                    due.cls,
                                  )}
                                >
                                  <CalendarDays className="h-3 w-3" />
                                  {due.text}
                                </Badge>
                              )}
                              {canCompare && (
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] text-primary"
                                >
                                  Jämförbart val
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Action row */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
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
                                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all",
                                      item.needHelp
                                        ? "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
                                        : "border-border/70 bg-background text-muted-foreground hover:bg-muted",
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
                                className="gap-1 rounded-full border-violet-200 px-2.5 py-1 text-[10px] text-violet-600 dark:border-violet-800 dark:text-violet-400"
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
                                  "h-8 gap-1 rounded-full px-3.5 text-[10px] font-semibold transition-all",
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
                        <div className="mt-4 border-t border-border/60 pt-4">
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
