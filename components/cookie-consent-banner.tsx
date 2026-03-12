"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ChevronDown, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  COOKIE_SETTINGS_OPEN_EVENT,
  createDefaultCookieConsent,
  readCookieConsent,
  writeCookieConsent,
} from "@/lib/cookie-consent";

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = readCookieConsent();

    if (existing) {
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
      setOpen(false);
    } else {
      setOpen(true);
    }

    setMounted(true);

    const onOpenSettings = () => {
      const consent = readCookieConsent();
      if (consent) {
        setAnalytics(consent.analytics);
        setMarketing(consent.marketing);
      }
      setShowSettings(true);
      setOpen(true);
    };

    window.addEventListener(COOKIE_SETTINGS_OPEN_EVENT, onOpenSettings);

    return () => {
      window.removeEventListener(COOKIE_SETTINGS_OPEN_EVENT, onOpenSettings);
    };
  }, []);

  if (!mounted || !open) return null;

  const saveConsent = (nextAnalytics: boolean, nextMarketing: boolean) => {
    writeCookieConsent(
      createDefaultCookieConsent({
        analytics: nextAnalytics,
        marketing: nextMarketing,
      }),
    );
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setOpen(false);
    setShowSettings(false);
  };

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-70 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-xl">
      <div className="pointer-events-auto rounded-[28px] border border-border/80 bg-card/96 p-4 shadow-2xl shadow-primary/12 backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Cookies och integritet
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/6 px-2 py-0.5 text-[11px] font-medium text-primary">
                <ShieldCheck className="h-3 w-3" />
                Du styr själv
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Vi använder nödvändiga cookies för att sajten, formulär och
              guidefunktioner ska fungera. Analys och framtida erbjudandefunktioner
              aktiveras bara om du säger ja.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Link href="/cookiepolicy" className="underline underline-offset-4 hover:text-foreground">
            Läs cookiepolicy
          </Link>
          <button
            type="button"
            onClick={() => setShowSettings((value) => !value)}
            className="inline-flex items-center gap-1 text-primary"
          >
            {showSettings ? "Dölj val" : "Anpassa val"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                showSettings ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {showSettings && (
          <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
            <div className="flex items-start gap-3 rounded-xl bg-background/80 p-3">
              <Checkbox checked disabled id="cookie-necessary" />
              <div className="space-y-1">
                <Label htmlFor="cookie-necessary">Nödvändiga cookies</Label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Behövs för säkerhet, navigation, formulär och grundläggande funktion.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-background/80 p-3">
              <Checkbox
                id="cookie-analytics"
                checked={analytics}
                onCheckedChange={(value) => setAnalytics(value === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="cookie-analytics">Analys</Label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Hjälper oss förstå vilka sidor som fungerar bra och förbättra upplevelsen.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-background/80 p-3">
              <Checkbox
                id="cookie-marketing"
                checked={marketing}
                onCheckedChange={(value) => setMarketing(value === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="cookie-marketing">Erbjudanden och marknadsföring</Label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Används bara om vi behöver mäta eller personalisera erbjudanden kopplade till flytt.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => saveConsent(false, false)}
          >
            Endast nödvändiga
          </Button>
          {showSettings && (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => saveConsent(analytics, marketing)}
            >
              Spara val
            </Button>
          )}
          <Button
            type="button"
            className="rounded-full"
            onClick={() => saveConsent(true, true)}
          >
            Godkänn alla
          </Button>
        </div>
      </div>
    </div>
  );
}
