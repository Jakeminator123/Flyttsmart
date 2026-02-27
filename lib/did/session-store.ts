const SESSION_HISTORY = new Map<
  string,
  Array<{ role: string; content: string; ts: number }>
>();
const MAX_HISTORY = 20;
const SESSION_TTL_MS = 30 * 60 * 1000;

const SESSION_FORM_CTX = new Map<string, Record<string, string>>();

const UNLOCK_DURATION_MS = 7 * 60 * 1000;
const SESSION_UNLOCK = new Map<string, number>();

export function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, msgs] of SESSION_HISTORY) {
    const newest = msgs.at(-1)?.ts ?? 0;
    if (now - newest > SESSION_TTL_MS) {
      SESSION_HISTORY.delete(id);
      SESSION_FORM_CTX.delete(id);
      SESSION_UNLOCK.delete(id);
    }
  }
}

export function pushMessage(sessionId: string, role: string, content: string) {
  if (!SESSION_HISTORY.has(sessionId)) SESSION_HISTORY.set(sessionId, []);
  const history = SESSION_HISTORY.get(sessionId)!;
  history.push({ role, content, ts: Date.now() });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

export function getHistory(sessionId: string) {
  return (SESSION_HISTORY.get(sessionId) ?? []).map(({ role, content }) => ({
    role,
    content,
  }));
}

/**
 * If server-side history is empty (cold start), seed it from client-provided
 * history so the LLM gets conversation context even after a cold start.
 */
export function hydrateFromClient(
  sessionId: string,
  clientHistory: Array<{ role: string; content: string }>,
) {
  const existing = SESSION_HISTORY.get(sessionId);
  if (existing && existing.length > 0) return;

  const trimmed = clientHistory.slice(-MAX_HISTORY);
  const now = Date.now();
  SESSION_HISTORY.set(
    sessionId,
    trimmed.map((m, i) => ({ role: m.role, content: m.content, ts: now - (trimmed.length - i) })),
  );
}

export function updateFormField(sessionId: string, field: string, value: string) {
  if (!SESSION_FORM_CTX.has(sessionId)) SESSION_FORM_CTX.set(sessionId, {});
  SESSION_FORM_CTX.get(sessionId)![field] = value;
}

export function getFormContext(sessionId: string): Record<string, string> | null {
  const ctx = SESSION_FORM_CTX.get(sessionId);
  return ctx && Object.keys(ctx).length > 0 ? ctx : null;
}

export function unlockSession(sessionId: string) {
  SESSION_UNLOCK.set(sessionId, Date.now());
}

export function isUnlocked(sessionId: string): boolean {
  const ts = SESSION_UNLOCK.get(sessionId);
  if (!ts) return false;
  if (Date.now() - ts > UNLOCK_DURATION_MS) {
    SESSION_UNLOCK.delete(sessionId);
    return false;
  }
  return true;
}

export function getUnlockTimeLeft(sessionId: string): number {
  const ts = SESSION_UNLOCK.get(sessionId);
  if (!ts) return 0;
  const left = UNLOCK_DURATION_MS - (Date.now() - ts);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}
