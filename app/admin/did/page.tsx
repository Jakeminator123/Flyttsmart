"use client";

import { useEffect, useState } from "react";
import {
  Mic,
  Volume2,
  Globe,
  Settings2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface DidConfig {
  bridgeEnabled: boolean;
  clientKeySet: boolean;
  agentId: string;
  mergeOcDid: boolean;
  testTal: boolean;
}

export default function DidPage() {
  const [config, setConfig] = useState<DidConfig | null>(null);
  const [loading, setLoading] = useState(true);

  function fetchConfig() {
    setLoading(true);
    fetch("/api/admin/did/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">D-ID</h1>
        <p className="text-muted-foreground">
          Konfiguration och status för D-ID-avataren AIda
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          icon={<Mic className="size-4" />}
          title="Bridge Widget"
          enabled={config?.bridgeEnabled}
          loading={loading}
        />
        <StatusCard
          icon={<Settings2 className="size-4" />}
          title="Client Key"
          enabled={config?.clientKeySet}
          loading={loading}
        />
        <StatusCard
          icon={<Volume2 className="size-4" />}
          title="TEST_TAL"
          enabled={config?.testTal}
          loading={loading}
        />
        <StatusCard
          icon={<Globe className="size-4" />}
          title="Merge OC+DID"
          enabled={config?.mergeOcDid}
          loading={loading}
        />
      </div>

      <Button variant="outline" size="sm" onClick={fetchConfig}>
        <RefreshCw className="mr-2 size-4" />
        Uppdatera
      </Button>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Arkitektur</CardTitle>
            <CardDescription>
              Dataflöde för D-ID + OpenClaw-integrationen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 font-mono text-xs leading-relaxed">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-muted-foreground">Röstflöde:</p>
                <p>Användarens röst</p>
                <p className="text-primary">→ Web Speech API (sv-SE)</p>
                <p className="text-primary">→ POST /api/did/chat</p>
                <p className="text-primary">→ OpenClaw Gateway</p>
                <p className="text-primary">→ agentManager.speak()</p>
                <p>→ D-ID avatar talar</p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-muted-foreground">TTS-röst:</p>
                <p>Microsoft sv-SE-SofieNeural</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Konfiguration</CardTitle>
            <CardDescription>Aktuella D-ID-inställningar</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <ConfigRow
                  label="Agent ID"
                  value={config?.agentId || "–"}
                />
                <ConfigRow
                  label="NEXT_PUBLIC_DID_BRIDGE_ENABLED"
                  value={config?.bridgeEnabled ? "true" : "false"}
                />
                <ConfigRow
                  label="NEXT_PUBLIC_DID_CLIENT_KEY"
                  value={config?.clientKeySet ? "✓ Set" : "✗ Missing"}
                />
                <ConfigRow
                  label="TEST_TAL"
                  value={config?.testTal ? "y" : "n"}
                />
                <ConfigRow
                  label="NEXT_PUBLIC_MERGE_OC_DID"
                  value={config?.mergeOcDid ? "y" : "n"}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Felsökning</CardTitle>
          <CardDescription>Vanliga problem och lösningar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <TroubleshootItem
              title="Avataren svarar inte"
              steps={[
                "Kontrollera att NEXT_PUBLIC_DID_BRIDGE_ENABLED=true",
                "Verifiera NEXT_PUBLIC_DID_CLIENT_KEY i Vercel",
                "Kontrollera OpenClaw gateway-health",
              ]}
            />
            <TroubleshootItem
              title="Röstigenkänning fungerar inte"
              steps={[
                "Web Speech API kräver HTTPS i produktion",
                "Kontrollera att webbläsaren stödjer sv-SE",
                "Chrome har bäst stöd för Web Speech API",
              ]}
            />
            <TroubleshootItem
              title="Avataren talar fel språk"
              steps={[
                "TTS-rösten sätts i D-ID agent config: sv-SE-SofieNeural",
                "Kontrollera att presenter.voice är korrekt i D-ID Studio",
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  enabled,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  enabled?: boolean;
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
          <Skeleton className="h-6 w-20" />
        ) : (
          <div className="flex items-center gap-2">
            {enabled ? (
              <CheckCircle2 className="size-4 text-green-500" />
            ) : (
              <XCircle className="size-4 text-muted-foreground" />
            )}
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? "Aktiv" : "Inaktiv"}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function TroubleshootItem({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="font-medium">{title}</p>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 text-xs text-primary">→</span>
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}
