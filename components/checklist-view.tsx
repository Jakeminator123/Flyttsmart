"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  CalendarDays,
  Briefcase,
  Wrench,
  Baby,
  Sparkles,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface ChecklistItem {
  id?: number;
  title: string;
  description?: string;
  dueDate?: string;
  completed?: boolean;
  category?: string;
  sortOrder?: number;
}

interface ChecklistViewProps {
  items: ChecklistItem[];
  onToggle?: (index: number) => void;
  className?: string;
  compact?: boolean;
}

const categoryConfig: Record<
  string,
  { label: string; icon: typeof Briefcase; color: string }
> = {
  administration: {
    label: "Administration",
    icon: Briefcase,
    color: "text-blue-600 bg-blue-50",
  },
  practical: {
    label: "Praktiskt",
    icon: Wrench,
    color: "text-orange-600 bg-orange-50",
  },
  children: {
    label: "Barn & familj",
    icon: Baby,
    color: "text-pink-600 bg-pink-50",
  },
  cleaning: {
    label: "Städning",
    icon: Sparkles,
    color: "text-green-600 bg-green-50",
  },
  post_move: {
    label: "Efter flytt",
    icon: ArrowRight,
    color: "text-purple-600 bg-purple-50",
  },
  area_tips: {
    label: "Områdestips",
    icon: MapPin,
    color: "text-teal-600 bg-teal-50",
  },
};

export function ChecklistView({
  items,
  onToggle,
  className,
  compact,
}: ChecklistViewProps) {
  const [localItems, setLocalItems] = useState(items);

  const handleToggle = (index: number) => {
    setLocalItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, completed: !item.completed } : item
      )
    );
    onToggle?.(index);
  };

  const completedCount = localItems.filter((i) => i.completed).length;
  const totalCount = localItems.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Group by category
  const grouped = localItems.reduce<Record<string, ChecklistItem[]>>(
    (acc, item) => {
      const cat = item.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
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
      {Object.entries(grouped).map(([category, categoryItems]) => {
        const config = categoryConfig[category] || {
          label: category,
          icon: Circle,
          color: "text-gray-600 bg-gray-50",
        };
        const Icon = config.icon;

        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn("gap-1 text-xs", config.color)}
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {categoryItems.filter((i) => i.completed).length}/
                {categoryItems.length}
              </span>
            </div>

            <div className="space-y-1">
              {categoryItems.map((item, i) => {
                const globalIndex = localItems.indexOf(item);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleToggle(globalIndex)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all hover:bg-accent/50",
                      item.completed
                        ? "border-primary/20 bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          item.completed
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        )}
                      >
                        {item.title}
                      </p>
                      {!compact && item.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    {item.dueDate && (
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        <span>{item.dueDate}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
