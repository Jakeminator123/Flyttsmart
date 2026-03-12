"use client";

import { Cookie } from "lucide-react";
import { cn } from "@/lib/utils";
import { COOKIE_SETTINGS_OPEN_EVENT } from "@/lib/cookie-consent";

interface ManageCookiesButtonProps {
  className?: string;
}

export function ManageCookiesButton({
  className,
}: ManageCookiesButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_OPEN_EVENT));
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
    >
      <Cookie className="h-3.5 w-3.5" />
      Cookieinställningar
    </button>
  );
}
