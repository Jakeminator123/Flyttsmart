import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { buildNormalizedSkvPayload, type SkvSourceData } from "@/lib/skv/payload";
import {
  isTruthy,
  isCloneQrToSiteEnabled,
  getSkvServiceUrl,
  getSkvServiceApiKey,
  isRemoteSkvService,
} from "@/lib/skv/config";

export const runtime = "nodejs";

const INLOGG_DIR = path.join(process.cwd(), "inlogg");
const RUNTIME_DIR = path.join(INLOGG_DIR, "runtime");
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

// ---------------------------------------------------------------------------
// Production mode: delegate to remote Flask service (Render/Docker)
// ---------------------------------------------------------------------------
async function startRemote(
  payload: unknown,
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
  if (cloneQrEnabled && jobId) {
    cloneData = {
      cloneQrEnabled: true,
      jobId,
      cloneQrStateUrl: `/api/skv/clone/state/${jobId}`,
      cloneQrImageUrl: `/api/skv/clone/qr/${jobId}`,
    };
  }

  return NextResponse.json({
    ok: true,
    started: true,
    remote: true,
    payload,
    ...cloneData,
  });
}

// ---------------------------------------------------------------------------
// Local mode: spawn Python child process
// ---------------------------------------------------------------------------
async function startLocal(
  payload: unknown,
): Promise<NextResponse> {
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  await fs.writeFile(PAYLOAD_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  try {
    const existingRaw = await fs.readFile(PROCESS_FILE, "utf-8");
    const existing = JSON.parse(existingRaw) as { pid?: number; startedAt?: string };
    if (existing?.pid && isProcessAlive(existing.pid)) {
      return NextResponse.json({
        ok: true,
        started: false,
        alreadyRunning: true,
        pid: existing.pid,
        startedAt: existing.startedAt ?? null,
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
  let cloneData: Record<string, unknown> = {};

  if (cloneQrEnabled) {
    const jobInfo = await readJobFileWithRetry(spawnedAt);
    if (jobInfo?.jobId) {
      const port = jobInfo.flaskPort ?? 8767;
      const portQ = port !== 8767 ? `?port=${port}` : "";
      cloneData = {
        cloneQrEnabled: true,
        jobId: jobInfo.jobId,
        cloneQrStateUrl: `/api/skv/clone/state/${jobInfo.jobId}${portQ}`,
        cloneQrImageUrl: `/api/skv/clone/qr/${jobInfo.jobId}${portQ}`,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    started: true,
    payload,
    script: "int7/runner.py",
    ...cloneData,
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { formData?: SkvSourceData } & SkvSourceData;
    const source = body?.formData ?? body ?? {};
    const payload = buildNormalizedSkvPayload(source);

    if (isRemoteSkvService()) {
      return await startRemote(payload);
    }
    return await startLocal(payload);
  } catch (error) {
    console.error("[SKV int7] failed to start:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to start SKV int7 automation" },
      { status: 500 },
    );
  }
}
