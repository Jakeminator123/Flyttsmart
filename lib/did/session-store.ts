const SESSION_HISTORY = new Map<
  string,
  Array<{ role: string; content: string; ts: number }>
>();
const MAX_HISTORY = 20;
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 500;
const MAX_CONTENT_CHARS = 4000;
const MAX_FIELD_NAME_CHARS = 64;
const MAX_FIELD_VALUE_CHARS = 300;
const MAX_FORM_FIELDS = 80;

const SESSION_FORM_CTX = new Map<string, Record<string, string>>();

function sanitizeString(value: string, maxChars: number): string {
  return value.trim().slice(0, maxChars);
}

function normalizeRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "assistant" || normalized === "system") return normalized;
  return "user";
}

function isValidFieldName(field: string): boolean {
  if (!field || field.length > MAX_FIELD_NAME_CHARS) return false;
  return /^[a-zA-Z0-9_.:-]+$/.test(field);
}

function enforceSessionLimit() {
  if (SESSION_HISTORY.size <= MAX_SESSIONS) return;
  const oldest = [...SESSION_HISTORY.entries()]
    .sort((a, b) => {
      const aTs = a[1].at(-1)?.ts ?? 0;
      const bTs = b[1].at(-1)?.ts ?? 0;
      return aTs - bTs;
    })
    .slice(0, Math.max(1, SESSION_HISTORY.size - MAX_SESSIONS));

  for (const [id] of oldest) {
    SESSION_HISTORY.delete(id);
    SESSION_FORM_CTX.delete(id);
  }
}

export function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, msgs] of SESSION_HISTORY) {
    const newest = msgs.at(-1)?.ts ?? 0;
    if (now - newest > SESSION_TTL_MS) {
      SESSION_HISTORY.delete(id);
      SESSION_FORM_CTX.delete(id);
    }
  }
}

export function pushMessage(sessionId: string, role: string, content: string) {
  const safeSessionId = sanitizeString(sessionId, 120);
  const safeContent = sanitizeString(content, MAX_CONTENT_CHARS);
  if (!safeSessionId || !safeContent) return;

  enforceSessionLimit();

  if (!SESSION_HISTORY.has(safeSessionId)) SESSION_HISTORY.set(safeSessionId, []);
  const history = SESSION_HISTORY.get(safeSessionId)!;
  history.push({
    role: normalizeRole(role),
    content: safeContent,
    ts: Date.now(),
  });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

export function getHistory(sessionId: string) {
  const safeSessionId = sanitizeString(sessionId, 120);
  if (!safeSessionId) return [];
  return (SESSION_HISTORY.get(safeSessionId) ?? []).map(({ role, content }) => ({
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
  const safeSessionId = sanitizeString(sessionId, 120);
  if (!safeSessionId) return;

  const existing = SESSION_HISTORY.get(safeSessionId);
  if (existing && existing.length > 0) return;

  const trimmed = clientHistory
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: normalizeRole(m.role),
      content: sanitizeString(m.content, MAX_CONTENT_CHARS),
    }))
    .filter((m) => m.content.length > 0);
  const now = Date.now();
  SESSION_HISTORY.set(
    safeSessionId,
    trimmed.map((m, i) => ({ role: m.role, content: m.content, ts: now - (trimmed.length - i) })),
  );
}

export function updateFormField(sessionId: string, field: string, value: string) {
  const safeSessionId = sanitizeString(sessionId, 120);
  const safeField = sanitizeString(field, MAX_FIELD_NAME_CHARS);
  const safeValue = sanitizeString(value, MAX_FIELD_VALUE_CHARS);
  if (!safeSessionId || !safeField || !safeValue || !isValidFieldName(safeField)) return;

  if (!SESSION_FORM_CTX.has(safeSessionId)) SESSION_FORM_CTX.set(safeSessionId, {});
  const ctx = SESSION_FORM_CTX.get(safeSessionId)!;

  if (!(safeField in ctx) && Object.keys(ctx).length >= MAX_FORM_FIELDS) return;
  ctx[safeField] = safeValue;
}

export function getFormContext(sessionId: string): Record<string, string> | null {
  const safeSessionId = sanitizeString(sessionId, 120);
  if (!safeSessionId) return null;
  const ctx = SESSION_FORM_CTX.get(safeSessionId);
  return ctx && Object.keys(ctx).length > 0 ? { ...ctx } : null;
}

