"use client";

import {
  FileText,
  CheckCircle2,
  Clock,
  Send,
  PartyPopper,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MoveStatus = "draft" | "submitted" | "confirmed" | "completed";

interface MoveTimelineProps {
  status: MoveStatus;
  className?: string;
}

const stages: {
  key: MoveStatus;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    key: "draft",
    label: "Utkast",
    description: "Flytten är påbörjad men ej inskickad",
    icon: FileText,
  },
  {
    key: "submitted",
    label: "Inskickad",
    description: "Dina uppgifter har sparats hos Flytt.io",
    icon: Send,
  },
  {
    key: "confirmed",
    label: "Bekräftad",
    description: "Flyttanmälan behandlas av Skatteverket",
    icon: CheckCircle2,
  },
  {
    key: "completed",
    label: "Klar",
    description: "Flytten är genomförd och registrerad",
    icon: PartyPopper,
  },
];

export function MoveTimeline({ status, className }: MoveTimelineProps) {
  const currentIndex = stages.findIndex((s) => s.key === status);

  return (
    <div className={cn("space-y-0", className)}>
      {stages.map((stage, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isPending = i > currentIndex;
        const _Icon = stage.icon;

        return (
          <div key={stage.key} className="flex gap-3">
            {/* Icon column */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20"
                      : "border-border bg-card text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isCurrent ? (
                  <Clock className="h-5 w-5 animate-pulse" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>
              {i < stages.length - 1 && (
                <div
                  className={cn(
                    "my-1 h-8 w-0.5",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn("pb-6 pt-1.5", isPending && "opacity-50")}>
              <p
                className={cn(
                  "text-sm font-semibold",
                  isCurrent ? "text-primary" : "text-foreground"
                )}
              >
                {stage.label}
                {isCurrent && (
                  <span className="ml-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Aktuellt
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stage.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
