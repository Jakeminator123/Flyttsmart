import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { buildNormalizedSkvPayload, type SkvSourceData } from "@/lib/skv/payload";

export const runtime = "nodejs";

const INLOGG_DIR = path.join(process.cwd(), "inlogg");
const RUNTIME_DIR = path.join(INLOGG_DIR, "runtime");
const CONFIG_FILE = path.join(INLOGG_DIR, "config.txt");
const PAYLOAD_FILE = path.join(RUNTIME_DIR, "skv_payload_latest.json");
const PROCESS_FILE = path.join(RUNTIME_DIR, "skv_int7_process.json");
const JOB_FILE = path.join(RUNTIME_DIR, "skv_int7_job.json");
const PY_SCRIPT = path.join(INLOGG_DIR, "int7", "runner.py");

function isTruthy(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return ["1", "y", "yes", "true"].includes(normalized);
}

async function isCloneQrToSiteEnabled(): Promise<boolean> {
  if (isTruthy(process.env.CLONE_QR_FROMPLAYWRIGHT_TO_SITE)) return true;
  if (isTruthy(process.env.SKV_CLONE_QR_FROMPLAYWRIGHT_TO_SITE)) return true;
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key?.trim().toUpperCase() === "CLONE_QR_FROMPLAYWRIGHT_TO_SITE") {
        return isTruthy(rest.join("=").trim());
      }
    }
  } catch {
    // config.txt missing or unreadable
  }
  return false;
}

function resolvePythonCommand() {
  const configured = process.env.SKV_PYTHON_BIN?.trim();
  if (configured) return { command: configured, extraArgs: [] as string[] };

  if (process.platform === "win32") {
    return { command: "py", extraArgs: ["-3"] };
  }

  return { command: "python3", extraArgs: [] as string[] };
}

const SKV_SERVICE_URL = (process.env.SKV_SERVICE_URL ?? "http://127.0.0.1:8767").replace(/\/$/, "");

async function readJobFileWithRetry(
  spawnedAfter: number,
  maxAttempts = 25,
  delayMs = 400,
): Promise<{ jobId?: string; flaskPort?: number; cloneQrViewUrl?: string; cloneQrStateUrl?: string } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const stat = await fs.stat(JOB_FILE);
      if (stat.mtimeMs < spawnedAfter) {
        // Stale file from previous run – wait for runner to overwrite
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
    const code = (error as NodeJS.ErrnoException)?.code;
    // EPERM means the process exists but signal is not permitted.
    return code === "EPERM";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { formData?: SkvSourceData } & SkvSourceData;
    const source = body?.formData ?? body ?? {};
    const payload = buildNormalizedSkvPayload(source);

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
      // No process file yet or invalid stale data; continue with new spawn.
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
      env: {
        ...process.env,
        SKV_PAYLOAD_FILE: PAYLOAD_FILE,
      },
    });

    const spawnedAt = Date.now();
    await fs.writeFile(
      PROCESS_FILE,
      `${JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf-8"
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
  } catch (error) {
    console.error("[SKV int7] failed to start:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to start SKV int7 automation",
      },
      { status: 500 }
    );
  }
}
