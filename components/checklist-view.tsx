"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

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

interface ChecklistViewProps {
  items: ChecklistItem[];
  onItemChange?: (index: number, changes: Partial<ChecklistItem>) => void;
  className?: string;
  compact?: boolean;
  readOnly?: boolean;
}

export function ChecklistView({
  items,
  onItemChange,
  className,
  compact,
  readOnly = false,
}: ChecklistViewProps) {
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const normalize = (item: ChecklistItem): ChecklistItem => ({
    ...item,
    section: item.section || "Övrigt",
    sectionKey: item.sectionKey || "other",
    needHelp: item.needHelp === true,
    wantCompare: item.wantCompare === true,
    status: item.status || (item.completed ? "done" : "todo"),
    comparisonHints: Array.isArray(item.comparisonHints) ? item.comparisonHints : [],
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
      })
    );
    onItemChange?.(index, changes);
  };

  const normalizedItems = useMemo(
    () =>
      localItems
        .map(normalize)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [localItems]
  );

  const completedCount = normalizedItems.filter((i) => i.status === "done" || i.completed).length;
  const totalCount = localItems.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const grouped = normalizedItems.reduce<Record<string, ChecklistItem[]>>(
    (acc, item) => {
      const key = item.sectionKey || item.section || "other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {}
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {completedCount} av {totalCount} klara
          </span>
          <span className="text-muted-foreground">{progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Grouped items */}
      {Object.entries(grouped).map(([sectionKey, sectionItems]) => {
        return (
          <div key={sectionKey} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="text-xs">
                {sectionItems[0]?.section || "Övrigt"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {sectionItems.filter((i) => i.status === "done" || i.completed).length}/
                {sectionItems.length}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <div className="grid min-w-[740px] grid-cols-[minmax(260px,1fr)_120px_120px_140px] border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                <div>Moment</div>
                <div className="text-center">Behöver hjälp</div>
                <div className="text-center">Vill jämföra</div>
                <div>Status</div>
              </div>

              <div className="divide-y">
                {sectionItems.map((item) => {
                  const globalIndex = normalizedItems.findIndex(
                    (candidate) =>
                      candidate.taskKey === item.taskKey &&
                      candidate.sortOrder === item.sortOrder
                  );

                return (
                  <div key={`${item.taskKey || item.title}-${item.sortOrder || 0}`} className="grid min-w-[740px] grid-cols-[minmax(260px,1fr)_120px_120px_140px] items-start gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          item.status === "done" ? "line-through text-muted-foreground" : "text-foreground"
                        )}
                      >
                        {item.title}
                      </p>
                      {!compact && item.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      )}
                      {!!item.comparisonHints?.length && item.wantCompare && (
                        <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Jämförelse:</span>{" "}
                          {item.comparisonHints.join(" • ")}
                        </div>
                      )}
                      {item.dueDate && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          <span>{item.dueDate}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-center pt-1">
                      <Checkbox
                        checked={item.needHelp === true}
                        disabled={readOnly}
                        onCheckedChange={(checked) => {
                          if (globalIndex < 0) return;
                          updateItem(globalIndex, { needHelp: checked === true });
                        }}
                      />
                    </div>

                    <div className="flex justify-center pt-1">
                      <Checkbox
                        checked={item.wantCompare === true}
                        disabled={readOnly}
                        onCheckedChange={(checked) => {
                          if (globalIndex < 0) return;
                          updateItem(globalIndex, { wantCompare: checked === true });
                        }}
                      />
                    </div>

                    <div>
                      <select
                        value={item.status || "todo"}
                        disabled={readOnly}
                        onChange={(event) => {
                          if (globalIndex < 0) return;
                          const nextStatus = event.target.value as ChecklistItem["status"];
                          updateItem(globalIndex, { status: nextStatus });
                        }}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="todo">Ej startad</option>
                        <option value="in_progress">Pågår</option>
                        <option value="done">Klar</option>
                      </select>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
