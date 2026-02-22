import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { buildNormalizedSkvPayload, type SkvSourceData } from "@/lib/skv/payload";

export const runtime = "nodejs";

const INLOGG_DIR = path.join(process.cwd(), "inlogg");
const RUNTIME_DIR = path.join(INLOGG_DIR, "runtime");
const PAYLOAD_FILE = path.join(RUNTIME_DIR, "skv_payload_latest.json");
const PROCESS_FILE = path.join(RUNTIME_DIR, "skv_int7_process.json");
const PY_SCRIPT = path.join(INLOGG_DIR, "skv_int7.py");

function isTruthy(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return ["1", "y", "yes", "true"].includes(normalized);
}

function resolvePythonCommand() {
  const configured = process.env.SKV_PYTHON_BIN?.trim();
  if (configured) return { command: configured, extraArgs: [] as string[] };

  if (process.platform === "win32") {
    return { command: "py", extraArgs: ["-3"] };
  }

  return { command: "python3", extraArgs: [] as string[] };
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
          script: "skv_int7.py",
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

    await fs.writeFile(
      PROCESS_FILE,
      `${JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf-8"
    );
    child.unref();

    return NextResponse.json({
      ok: true,
      started: true,
      payload,
      script: "skv_int7.py",
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
