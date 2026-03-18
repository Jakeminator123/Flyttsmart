export const COOKIE_CONSENT_STORAGE_KEY = "flytt-cookie-consent";
export const COOKIE_CONSENT_EVENT = "flytt-cookie-consent-changed";
export const COOKIE_SETTINGS_OPEN_EVENT = "flytt-open-cookie-settings";

export interface CookieConsentState {
  version: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

export function createDefaultCookieConsent(
  overrides?: Partial<Omit<CookieConsentState, "version" | "updatedAt" | "necessary">>,
): CookieConsentState {
  return {
    version: 1,
    necessary: true,
    analytics: overrides?.analytics ?? false,
    marketing: overrides?.marketing ?? false,
    updatedAt: new Date().toISOString(),
  };
}

export function parseCookieConsent(rawValue?: string | null) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<CookieConsentState>;
    return {
      version: 1,
      necessary: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    } satisfies CookieConsentState;
  } catch {
    return null;
  }
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") return null;

  const encodedPrefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(encodedPrefix));

  if (!match) return null;

  return decodeURIComponent(match.slice(encodedPrefix.length));
}

export function readCookieConsent() {
  if (typeof window === "undefined") return null;

  const fromStorage = parseCookieConsent(
    window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY),
  );

  if (fromStorage) return fromStorage;

  return parseCookieConsent(getCookieValue(COOKIE_CONSENT_STORAGE_KEY));
}

export function writeCookieConsent(state: CookieConsentState) {
  if (typeof window === "undefined") return;

  const normalized = createDefaultCookieConsent({
    analytics: state.analytics,
    marketing: state.marketing,
  });

  const serialized = JSON.stringify(normalized);
  const maxAgeSeconds = 60 * 60 * 24 * 180;

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, serialized);
  document.cookie =
    `${encodeURIComponent(COOKIE_CONSENT_STORAGE_KEY)}=${encodeURIComponent(serialized)}; ` +
    `path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;

  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT));
}
