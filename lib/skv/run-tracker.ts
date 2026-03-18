import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { skvRuns, type NewSkvRun } from "@/lib/db/schema";

export interface UpsertSkvRunInput {
  jobId: string;
  moveId?: number | null;
  sourceData?: unknown;
  normalizedPayload?: unknown;
  status?: string | null;
  message?: string | null;
  remote?: boolean;
  cloneQrEnabled?: boolean;
  cloneQrStateUrl?: string | null;
  cloneQrImageUrl?: string | null;
  screenshotPath?: string | null;
  details?: unknown;
  startedAt?: string | number | null;
  endedAt?: string | number | null;
}

function stringifyJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function resolveMoveId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function toIso(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return new Date(value * 1000).toISOString();
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(trimmed)) {
    return new Date(numeric * 1000).toISOString();
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeStatus(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "queued";
  const allowed = new Set(["queued", "running", "matched", "timeout", "error", "cancelled"]);
  return allowed.has(raw) ? raw : "unknown";
}

export async function upsertSkvRun(input: UpsertSkvRunInput): Promise<void> {
  const jobId = (input.jobId ?? "").trim();
  if (!jobId) return;

  const now = new Date().toISOString();
  const sourceDataJson = stringifyJson(input.sourceData);
  const normalizedPayloadJson = stringifyJson(input.normalizedPayload);
  const detailsJson = stringifyJson(input.details);
  const startedAtIso = toIso(input.startedAt);
  const endedAtIso = toIso(input.endedAt);

  const db = getDb();

  const insertValues: NewSkvRun = {
    jobId,
    moveId: input.moveId ?? null,
    status: normalizeStatus(input.status),
    message: input.message ?? null,
    remote: input.remote === true,
    cloneQrEnabled: input.cloneQrEnabled === true,
    cloneQrStateUrl: input.cloneQrStateUrl ?? null,
    cloneQrImageUrl: input.cloneQrImageUrl ?? null,
    screenshotPath: input.screenshotPath ?? null,
    startedAt: startedAtIso,
    endedAt: endedAtIso,
    createdAt: now,
    updatedAt: now,
  };
  if (sourceDataJson !== null) insertValues.sourceData = sourceDataJson;
  if (normalizedPayloadJson !== null) insertValues.normalizedPayload = normalizedPayloadJson;
  if (detailsJson !== null) insertValues.details = detailsJson;

  const updateSet: Partial<NewSkvRun> = {
    updatedAt: now,
  };
  if (input.status !== undefined) updateSet.status = normalizeStatus(input.status);
  if (input.message !== undefined) updateSet.message = input.message;
  if (input.moveId !== undefined) updateSet.moveId = input.moveId;
  if (input.remote !== undefined) updateSet.remote = input.remote === true;
  if (input.cloneQrEnabled !== undefined) {
    updateSet.cloneQrEnabled = input.cloneQrEnabled === true;
  }
  if (input.cloneQrStateUrl !== undefined) updateSet.cloneQrStateUrl = input.cloneQrStateUrl;
  if (input.cloneQrImageUrl !== undefined) updateSet.cloneQrImageUrl = input.cloneQrImageUrl;
  if (input.screenshotPath !== undefined) updateSet.screenshotPath = input.screenshotPath;
  if (startedAtIso !== null) updateSet.startedAt = startedAtIso;
  if (endedAtIso !== null) updateSet.endedAt = endedAtIso;
  if (sourceDataJson !== null) updateSet.sourceData = sourceDataJson;
  if (normalizedPayloadJson !== null) updateSet.normalizedPayload = normalizedPayloadJson;
  if (detailsJson !== null) updateSet.details = detailsJson;

  await db
    .insert(skvRuns)
    .values(insertValues)
    .onConflictDoUpdate({
      target: skvRuns.jobId,
      set: updateSet,
    });
}

export async function getSkvRunByJobId(jobId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(skvRuns)
    .where(eq(skvRuns.jobId, jobId))
    .limit(1);
  return row ?? null;
}
