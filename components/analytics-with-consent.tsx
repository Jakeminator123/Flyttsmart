"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  COOKIE_CONSENT_EVENT,
  readCookieConsent,
} from "@/lib/cookie-consent";

export function AnalyticsWithConsent() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => {
      const consent = readCookieConsent();
      setEnabled(consent?.analytics === true);
    };

    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!enabled) return null;

  return <Analytics />;
}
