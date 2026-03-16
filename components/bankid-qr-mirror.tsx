"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";

interface BankIdQrMirrorProps {
  cloneQrStateUrl: string;
  cloneQrImageUrl: string;
  statusUrl?: string;
  onDismiss?: () => void;
}

interface CloneState {
  enabled?: boolean;
  jobState?: string;
  jobExists?: boolean;
  aidPresent?: boolean;
  qrReady?: boolean;
  qrImageReady?: boolean;
  qrImageUpdatedAt?: number;
  qrCaptureMode?: string;
  qrFrameCount?: number;
  qrCaptureIntervalSeconds?: number;
  qrHistorySeconds?: number;
  qrArchiveEnabled?: boolean;
  apiReady?: boolean;
  error?: string;
}

interface Int7Status {
  state?: string;
  message?: string;
}

const TERMINAL_STATES = new Set(["error", "timeout", "cancelled"]);
const POLL_INTERVAL_MS = 2000;
const MAX_POLLING_MS = 12 * 60 * 1000;

export function BankIdQrMirror({
  cloneQrStateUrl,
  cloneQrImageUrl,
  statusUrl,
  onDismiss,
}: BankIdQrMirrorProps) {
  const [state, setState] = useState<CloneState | null>(null);
  const [int7Status, setInt7Status] = useState<Int7Status | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pollingExpired, setPollingExpired] = useState(false);

  const effectiveJobState = int7Status?.state ?? state?.jobState;
  const isTerminal = effectiveJobState ? TERMINAL_STATES.has(effectiveJobState) : false;
  const done = state?.apiReady || effectiveJobState === "matched";
  const latestQrTime = useMemo(() => {
    if (!state?.qrImageUpdatedAt) return null;
    return new Date(state.qrImageUpdatedAt * 1000).toLocaleTimeString("sv-SE");
  }, [state?.qrImageUpdatedAt]);

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

    if (!statusUrl) return;
    try {
      const statusRes = await fetch(statusUrl, { cache: "no-store" });
      if (!statusRes.ok) return;
      const statusData = await statusRes.json();
      setInt7Status({
        state: typeof statusData?.state === "string" ? statusData.state : undefined,
        message: typeof statusData?.message === "string" ? statusData.message : undefined,
      });
    } catch {
      // Optional status channel; ignore polling errors here.
    }
  }, [cloneQrStateUrl, statusUrl]);

  useEffect(() => {
    if (!cloneQrStateUrl || dismissed || done || isTerminal || pollingExpired) {
      return;
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cloneQrStateUrl, dismissed, done, isTerminal, poll, pollingExpired]);

  useEffect(() => {
    if (!state?.qrImageReady || dismissed || done || isTerminal || pollingExpired) return;
    const id = setInterval(() => setRefreshTick((t) => t + 1), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [dismissed, done, isTerminal, pollingExpired, state?.qrImageReady]);

  useEffect(() => {
    if (dismissed || done || isTerminal || pollingExpired) return;
    const id = setTimeout(() => {
      setPollingExpired(true);
      setFetchError(
        "Övervakningen stoppades efter en längre stund för att undvika att sidan fortsätter polla i onödan. Starta om SKV-int7 om du vill försöka igen.",
      );
    }, MAX_POLLING_MS);
    return () => clearTimeout(id);
  }, [dismissed, done, isTerminal, pollingExpired]);

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
        Skanna QR-koden nedan med Mobilt BankID för att fortsätta i
        Skatteverkets inloggning på desktop.
      </p>

      {isTerminal && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 py-3 px-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {effectiveJobState === "timeout"
                ? "Tidsgränsen nåddes"
                : effectiveJobState === "cancelled"
                  ? "Avbruten"
                  : "Något gick fel"}
            </p>
            <p className="mt-0.5 text-xs text-red-700">
              {int7Status?.message ||
                state?.error ||
                "Starta om SKV-int7 och försök igen."}
            </p>
          </div>
        </div>
      )}
      {fetchError && !isTerminal && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 py-4 px-3 text-sm text-amber-800">
          {fetchError.includes("Övervakningen stoppades")
            ? fetchError
            : "Kunde inte ansluta till BankID-tjänsten. Kontrollera att du klickat \"Starta SKV-int7\" och att Python/Playwright körs."}
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

      {int7Status?.message && !isTerminal && (
        <p className="mt-2 text-xs text-muted-foreground">{int7Status.message}</p>
      )}

      {state?.qrImageReady && !isTerminal && (
        <div className="space-y-3">
          <div className="flex justify-center rounded-lg border border-border/50 bg-white p-4">
            <Image
              src={`${cloneQrImageUrl}${cloneQrImageUrl.includes("?") ? "&" : "?"}t=${refreshTick}`}
              alt="BankID QR-kod – skanna med Mobilt BankID"
              width={320}
              height={320}
              unoptimized
              className="max-h-[360px] w-auto rounded-lg"
            />
          </div>
          <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
            <p>
              QR-koden uppdateras live ungefär var{" "}
              {state.qrCaptureIntervalSeconds ?? 2} sekund.
              {state.qrArchiveEnabled
                ? ` Ett försiktigt historikfönster sparas på serversidan i upp till ${Math.round(
                    (state.qrHistorySeconds ?? 120) / 60,
                  )} minuter.`
                : ""}
            </p>
            {(state.qrFrameCount || latestQrTime) && (
              <p className="mt-1">
                Sparade ramar: {state.qrFrameCount ?? 0}
                {latestQrTime ? ` · senast uppdaterad ${latestQrTime}` : ""}
                {state.qrCaptureMode ? ` · läge: ${state.qrCaptureMode}` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
