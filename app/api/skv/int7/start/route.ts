import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { buildNormalizedSkvPayload, type SkvSourceData } from "@/lib/skv/payload";
import { resolveMoveId, upsertSkvRun } from "@/lib/skv/run-tracker";
import {
  isTruthy,
  isCloneQrToSiteEnabled,
  getSkvServiceUrl,
  getSkvServiceApiKey,
  isRemoteSkvService,
} from "@/lib/skv/config";

export const runtime = "nodejs";

const INLOGG_DIR = path.join(process.cwd(), "inlogg");
const SKV_DATA_DIR = (process.env.SKV_DATA_DIR ?? "").trim();
const RUNTIME_ROOT = SKV_DATA_DIR || INLOGG_DIR;
const RUNTIME_DIR = path.join(RUNTIME_ROOT, "runtime");
const PAYLOAD_FILE = path.join(RUNTIME_DIR, "skv_payload_latest.json");
const PROCESS_FILE = path.join(RUNTIME_DIR, "skv_int7_process.json");
const JOB_FILE = path.join(RUNTIME_DIR, "skv_int7_job.json");
const PY_SCRIPT = path.join(INLOGG_DIR, "int7", "runner.py");

const DEFAULT_SKV_URL = "https://www7.skatteverket.se/portal/flyttanmalan/";
const DEFAULT_TIMEOUT = 300;

// Click selectors matching int7/runner.py defaults
const CLICK_CONFIG = {
  click_after_seconds_0: 1.5,
  click_selectors_0: [
    "#deny-all",
    'skv-button-8-6-2#deny-all',
    'button:has-text("Tillåt endast nödvändiga")',
    "#accept-all",
  ],
  click_after_seconds: 3.0,
  click_selectors: [
    'a[aria-label*="Inloggning"]',
    "button#login-info-button",
    "slot.fin-skv-button-label",
    "span.fin-skv-button-spinner",
  ],
  click_after_seconds_2: 3.0,
  click_selectors_2: ["button#bankid-standard", "#bankid-standard"],
  click_after_seconds_3: 3.0,
  click_selectors_3: ["path[fill='#FFFFFF']", "path[fill='#000000']", "svg path"],
};

function resolvePythonCommand() {
  const configured = process.env.SKV_PYTHON_BIN?.trim();
  if (configured) return { command: configured, extraArgs: [] as string[] };
  if (process.platform === "win32") return { command: "py", extraArgs: ["-3"] };
  return { command: "python3", extraArgs: [] as string[] };
}

async function readCurrentJobFile(): Promise<{ jobId?: string; flaskPort?: number; cloneQrStateUrl?: string } | null> {
  try {
    const raw = await fs.readFile(JOB_FILE, "utf-8");
    const data = JSON.parse(raw);
    return data;
  } catch {
    return null;
  }
}

async function readJobFileWithRetry(
  spawnedAfter: number,
  maxAttempts = 25,
  delayMs = 400,
): Promise<{ jobId?: string; flaskPort?: number; cloneQrStateUrl?: string } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const stat = await fs.stat(JOB_FILE);
      if (stat.mtimeMs < spawnedAfter) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      const raw = await fs.readFile(JOB_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (data?.jobId) return data;
    } catch {
      // File not written yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

function buildAuthHeaders(): Record<string, string> {
  const key = getSkvServiceApiKey();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

interface StartTrackingContext {
  moveId: number | null;
  sourceData: SkvSourceData;
}

function buildArtifactUrls(jobId: string, portQ = "") {
  return {
    statusUrl: `/api/skv/int7/status/${jobId}${portQ}`,
    payloadUrl: `/api/skv/int7/payload/${jobId}${portQ}`,
    htmlUrl: `/api/skv/int7/html/${jobId}${portQ}`,
    screenshotUrl: `/api/skv/int7/screenshot/${jobId}${portQ}`,
    logUrl: `/api/skv/int7/log/${jobId}${portQ}`,
    qrFramesUrl: `/api/skv/int7/qr-frames/${jobId}${portQ}`,
  };
}

// ---------------------------------------------------------------------------
// Production mode: delegate to remote Flask service (Render/Docker)
// ---------------------------------------------------------------------------
async function startRemote(
  payload: unknown,
  tracking: StartTrackingContext,
): Promise<NextResponse> {
  const baseUrl = getSkvServiceUrl();

  const res = await fetch(`${baseUrl}/api/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      url: DEFAULT_SKV_URL,
      timeout_seconds: DEFAULT_TIMEOUT,
      ...CLICK_CONFIG,
      payload,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: data?.error ?? "Remote SKV service returned an error" },
      { status: res.status },
    );
  }

  const jobId = data.job_id as string;
  const cloneQrEnabled = await isCloneQrToSiteEnabled();
  let cloneData: Record<string, unknown> = {};
  const artifactUrls = jobId ? buildArtifactUrls(jobId) : null;
  if (cloneQrEnabled && jobId) {
    cloneData = {
      cloneQrEnabled: true,
      jobId,
      cloneQrStateUrl: `/api/skv/clone/state/${jobId}`,
      cloneQrImageUrl: `/api/skv/clone/qr/${jobId}`,
    };
  }
  if (jobId) {
    await upsertSkvRun({
      jobId,
      moveId: tracking.moveId,
      sourceData: tracking.sourceData,
      normalizedPayload: payload,
      status: typeof data.state === "string" ? data.state : "running",
      message:
        typeof data.message === "string"
          ? data.message
          : "SKV remote-job startad via /api/skv/int7/start",
      remote: true,
      cloneQrEnabled,
      cloneQrStateUrl:
        typeof cloneData.cloneQrStateUrl === "string"
          ? cloneData.cloneQrStateUrl
          : null,
      cloneQrImageUrl:
        typeof cloneData.cloneQrImageUrl === "string"
          ? cloneData.cloneQrImageUrl
          : null,
      startedAt: typeof data.started_at === "number" ? data.started_at : null,
      details: data.details ?? null,
      screenshotPath:
        typeof data.screenshot_path === "string" ? data.screenshot_path : null,
    });
  }

  return NextResponse.json({
    ok: true,
    started: true,
    remote: true,
    payload,
    jobId,
    ...(artifactUrls ?? {}),
    ...cloneData,
  });
}

// ---------------------------------------------------------------------------
// Local mode: spawn Python child process
// ---------------------------------------------------------------------------
async function startLocal(
  payload: unknown,
  tracking: StartTrackingContext,
): Promise<NextResponse> {
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  await fs.writeFile(PAYLOAD_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  try {
    const existingRaw = await fs.readFile(PROCESS_FILE, "utf-8");
    const existing = JSON.parse(existingRaw) as { pid?: number; startedAt?: string };
    if (existing?.pid && isProcessAlive(existing.pid)) {
      const currentJob = await readCurrentJobFile();
      const jobId = typeof currentJob?.jobId === "string" ? currentJob.jobId : null;
      const port = currentJob?.flaskPort ?? 8767;
      const portQ = port !== 8767 ? `?port=${port}` : "";
      const artifactUrls = jobId ? buildArtifactUrls(jobId, portQ) : null;
      return NextResponse.json({
        ok: true,
        started: false,
        alreadyRunning: true,
        pid: existing.pid,
        startedAt: existing.startedAt ?? null,
        jobId,
        ...(artifactUrls ?? {}),
        payload,
        script: "int7/runner.py",
      });
    }
  } catch {
    // No process file yet
  }

  const { command, extraArgs } = resolvePythonCommand();
  const args = [...extraArgs, PY_SCRIPT, "--payload-file", PAYLOAD_FILE];
  if (isTruthy(process.env.SKV_INT7_ALLOW_MOCKUP_DATA)) {
    args.push("--allow-mockup-data");
  }

  const child = spawn(command, args, {
    cwd: INLOGG_DIR,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, SKV_PAYLOAD_FILE: PAYLOAD_FILE },
  });

  const spawnedAt = Date.now();
  await fs.writeFile(
    PROCESS_FILE,
    `${JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf-8",
  );
  child.unref();

  const cloneQrEnabled = await isCloneQrToSiteEnabled();
  const jobInfo = await readJobFileWithRetry(spawnedAt, 12, 300);
  let cloneData: Record<string, unknown> = {};
  let jobData: Record<string, unknown> = {};

  if (jobInfo?.jobId) {
    const port = jobInfo.flaskPort ?? 8767;
    const portQ = port !== 8767 ? `?port=${port}` : "";
    jobData = { jobId: jobInfo.jobId, ...buildArtifactUrls(jobInfo.jobId, portQ) };
  }

  if (cloneQrEnabled && jobInfo?.jobId) {
    const port = jobInfo.flaskPort ?? 8767;
    const portQ = port !== 8767 ? `?port=${port}` : "";
    cloneData = {
      cloneQrEnabled: true,
      jobId: jobInfo.jobId,
      cloneQrStateUrl: `/api/skv/clone/state/${jobInfo.jobId}${portQ}`,
      cloneQrImageUrl: `/api/skv/clone/qr/${jobInfo.jobId}${portQ}`,
    };
  }

  if (jobInfo?.jobId) {
    await upsertSkvRun({
      jobId: jobInfo.jobId,
      moveId: tracking.moveId,
      sourceData: tracking.sourceData,
      normalizedPayload: payload,
      status: "running",
      message: "SKV local-job startad via /api/skv/int7/start",
      remote: false,
      cloneQrEnabled,
      cloneQrStateUrl:
        typeof cloneData.cloneQrStateUrl === "string"
          ? cloneData.cloneQrStateUrl
          : null,
      cloneQrImageUrl:
        typeof cloneData.cloneQrImageUrl === "string"
          ? cloneData.cloneQrImageUrl
          : null,
    });
  }

  return NextResponse.json({
    ok: true,
    started: true,
    payload,
    script: "int7/runner.py",
    ...jobData,
    ...cloneData,
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      moveId?: unknown;
      formData?: SkvSourceData & { moveId?: unknown };
    } & SkvSourceData;
    const source = body?.formData ?? body ?? {};
    const payload = buildNormalizedSkvPayload(source);
    const moveId = resolveMoveId(body?.moveId ?? body?.formData?.moveId);
    const tracking: StartTrackingContext = {
      moveId,
      sourceData: source,
    };

    if (isRemoteSkvService()) {
      return await startRemote(payload, tracking);
    }
    return await startLocal(payload, tracking);
  } catch (error) {
    console.error("[SKV int7] failed to start:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to start SKV int7 automation" },
      { status: 500 },
    );
  }
}
