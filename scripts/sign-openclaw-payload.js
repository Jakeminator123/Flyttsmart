#!/usr/bin/env node
/**
 * Usage:
 *   echo '{"sessionId":"demo","event":"field_change",...}' | \
 *     OPENCLAW_WEBHOOK_SECRET=dev-secret node scripts/sign-openclaw-payload.js
 *
 * Prints the HMAC-SHA256 signature expected in `x-openclaw-signature`.
 */

import crypto from "crypto";

const secret =
  process.env.OPENCLAW_WEBHOOK_SECRET ||
  process.env.NEXT_PUBLIC_OPENCLAW_WEBHOOK_SECRET ||
  "";

if (!secret) {
  console.error(
    "Missing OPENCLAW_WEBHOOK_SECRET. Pass it via env when running this script."
  );
  process.exit(1);
}

const readStdin = async () => {
  if (!process.stdin.isTTY) {
    /** @type {Buffer[]} */
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString("utf8").trim();
  }
  return process.argv[2] ?? "";
};

const payload = await readStdin();

if (!payload) {
  console.error("No payload provided. Pipe JSON via stdin or pass it as the first arg.");
  process.exit(1);
}

const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
process.stdout.write(signature + "\n");
