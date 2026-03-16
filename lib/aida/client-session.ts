const AIDA_SESSION_STORAGE_KEY = "aida_session_id";
const LEGACY_SESSION_STORAGE_KEYS = [
  AIDA_SESSION_STORAGE_KEY,
  "did_bridge_session_id",
  "openclaw_session_id",
] as const;

function readSessionStorage(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(key)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeSessionStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and let callers keep the in-memory id.
  }
}

export function getSharedAidaSessionId(): string {
  if (typeof window === "undefined") return "";

  for (const key of LEGACY_SESSION_STORAGE_KEYS) {
    const existing = readSessionStorage(key);
    if (existing) {
      writeSessionStorage(AIDA_SESSION_STORAGE_KEY, existing);
      return existing;
    }
  }

  const created = crypto.randomUUID();
  writeSessionStorage(AIDA_SESSION_STORAGE_KEY, created);
  return created;
}
