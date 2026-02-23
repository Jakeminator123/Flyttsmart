"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";

interface BankIdQrMirrorProps {
  cloneQrStateUrl: string;
  cloneQrImageUrl: string;
  onDismiss?: () => void;
}

interface CloneState {
  enabled?: boolean;
  jobState?: string;
  aidPresent?: boolean;
  qrReady?: boolean;
  qrImageReady?: boolean;
  apiReady?: boolean;
  error?: string;
}

const TERMINAL_STATES = new Set(["error", "timeout", "cancelled"]);

export function BankIdQrMirror({
  cloneQrStateUrl,
  cloneQrImageUrl,
  onDismiss,
}: BankIdQrMirrorProps) {
  const [state, setState] = useState<CloneState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isTerminal = state?.jobState ? TERMINAL_STATES.has(state.jobState) : false;

  const poll = useCallback(async () => {
    if (!cloneQrStateUrl) return;
    try {
      const res = await fetch(cloneQrStateUrl, { cache: "no-store" });
      const data = await res.json();
      setFetchError(null);
      setState(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Anslutning misslyckades");
    }
  }, [cloneQrStateUrl]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (!state?.qrImageReady) return;
    const id = setInterval(() => setRefreshTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [state?.qrImageReady]);

  const done = state?.apiReady || state?.jobState === "matched";
  if (dismissed) return null;

  if (done) {
    return (
      <div className="relative rounded-xl border border-green-300 bg-green-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          Inloggning klar
        </div>
        <p className="mt-1 text-xs text-green-700">
          BankID-verifieringen lyckades. Formuläret fylls i automatiskt.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">BankID – skanna för inloggning</span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              onDismiss();
            }}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Stäng"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Skanna QR-koden nedan med Mobilt BankID för att logga in på Skatteverket.
        Detta är <strong>inte</strong> samma QR som Data-QR för mobilhandoff.
      </p>

      {isTerminal && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 py-3 px-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {state?.jobState === "timeout"
                ? "Tidsgränsen nåddes"
                : state?.jobState === "cancelled"
                  ? "Avbruten"
                  : "Något gick fel"}
            </p>
            <p className="mt-0.5 text-xs text-red-700">
              {state?.error || "Starta om SKV-int7 och försök igen."}
            </p>
          </div>
        </div>
      )}
      {fetchError && !isTerminal && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 py-4 px-3 text-sm text-amber-800">
          Kunde inte ansluta till BankID-tjänsten. Kontrollera att du klickat &quot;Starta SKV-int7&quot; och att Python/Playwright körs.
        </div>
      )}
      {!state?.qrImageReady && !fetchError && !isTerminal && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state?.aidPresent
            ? "Capturerar QR från Playwright..."
            : "Väntar på BankID-session..."}
        </div>
      )}

      {state?.qrImageReady && !isTerminal && (
        <div className="flex justify-center rounded-lg border border-border/50 bg-white p-4">
          <img
            src={`${cloneQrImageUrl}${cloneQrImageUrl.includes("?") ? "&" : "?"}t=${refreshTick}`}
            alt="BankID QR-kod – skanna med Mobilt BankID"
            className="max-h-[360px] w-auto rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
