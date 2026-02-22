import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { checklistItems, moves, reminderLogs, users } from "@/lib/db/schema";
import {
  getOpenClawAgentId,
  getOpenClawChatModel,
  getOpenClawGatewayBaseUrl,
  getOpenClawTokens,
} from "@/lib/openclaw/server-config";
import { extractOpenClawText } from "@/lib/openclaw/response";

export const runtime = "nodejs";

const DEFAULT_LOOKAHEAD_DAYS = 3;
const MAX_LOOKAHEAD_DAYS = 30;
const REMINDER_KIND = "due_soon";

type DueItem = {
  taskKey: string | null;
  title: string;
  section: string | null;
  dueDate: string;
  status: string | null;
  sortOrder: number;
};

type ReminderCandidate = {
  moveId: number;
  userName: string;
  userEmail: string;
  moveDate: string | null;
  dueItems: DueItem[];
};

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

type MailProvider = "resend" | "sendgrid";

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function normalizeToken(req: NextRequest): string {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  return (req.headers.get("x-cron-secret") || "").trim();
}

function isChecklistDone(item: {
  completed?: boolean | null;
  status?: string | null;
}): boolean {
  if (item.completed) return true;
  return item.status === "done";
}

function parseLookaheadDays(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LOOKAHEAD_DAYS;
  }
  return Math.min(Math.floor(parsed), MAX_LOOKAHEAD_DAYS);
}

function parseDryRun(req: NextRequest): boolean {
  const param = req.nextUrl.searchParams.get("dryRun");
  if (param === "true" || param === "1") return true;
  if (param === "false" || param === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDeterministicContent(
  candidate: ReminderCandidate,
  lookaheadDays: number
): EmailContent {
  const firstName = candidate.userName.split(" ")[0] || "du";
  const sortedItems = [...candidate.dueItems].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });

  const subject = `Flyttpaminnelse: ${sortedItems.length} uppgifter inom ${lookaheadDays} dagar`;
  const intro =
    `Hej ${firstName},\n\n` +
    `Har ar dina narmaste flyttmoment som behover hanteras snart.\n` +
    (candidate.moveDate
      ? `Inflyttningsdatum: ${candidate.moveDate}\n\n`
      : "\n");

  const bulletLines = sortedItems.map(
    (item) =>
      `- ${item.dueDate}: ${item.title}${item.section ? ` (${item.section})` : ""}`
  );

  const text =
    `${intro}` +
    `${bulletLines.join("\n")}\n\n` +
    `Ga till din dashboard for att markera status och fa fortsatt hjalp.\n` +
    `Halsningar,\nFlytt.io`;

  const htmlItems = sortedItems
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.dueDate)}</strong> - ${escapeHtml(item.title)}${
          item.section ? ` <em>(${escapeHtml(item.section)})</em>` : ""
        }</li>`
    )
    .join("");

  const html =
    `<p>Hej ${escapeHtml(firstName)},</p>` +
    `<p>Har ar dina narmaste flyttmoment som behover hanteras snart.</p>` +
    (candidate.moveDate
      ? `<p><strong>Inflyttningsdatum:</strong> ${escapeHtml(candidate.moveDate)}</p>`
      : "") +
    `<ul>${htmlItems}</ul>` +
    `<p>Ga till din dashboard for att markera status och fa fortsatt hjalp.</p>` +
    `<p>Halsningar,<br/>Flytt.io</p>`;

  return { subject, text, html };
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function normalizeAidaContent(value: unknown): EmailContent | null {
  if (!value || typeof value !== "object") return null;
  const subject = (value as { subject?: unknown }).subject;
  const text = (value as { text?: unknown }).text;
  const html = (value as { html?: unknown }).html;
  if (
    typeof subject !== "string" ||
    typeof text !== "string" ||
    typeof html !== "string"
  ) {
    return null;
  }
  const s = subject.trim();
  const t = text.trim();
  const h = html.trim();
  if (!s || !t || !h) return null;
  return { subject: s.slice(0, 140), text: t.slice(0, 8000), html: h.slice(0, 15000) };
}

async function generateAidaContent(
  candidate: ReminderCandidate,
  lookaheadDays: number
): Promise<EmailContent | null> {
  const gatewayBaseUrl = getOpenClawGatewayBaseUrl();
  const agentId = getOpenClawAgentId();
  const model = getOpenClawChatModel(agentId);
  const { gatewayToken } = getOpenClawTokens();

  if (!gatewayBaseUrl || !gatewayToken) return null;
  if ((process.env.REMINDER_USE_AIDA ?? "true") !== "true") return null;

  const minimalItems = candidate.dueItems
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((item) => ({
      title: item.title,
      dueDate: item.dueDate,
      section: item.section,
    }));

  const systemPrompt =
    "Du ar Aida, en svensk flyttassistent. " +
    "Du far INTE valja vilka uppgifter som ska paminnas om; scheduler ar redan bestamd. " +
    'Returnera ENDAST giltig JSON med exakt nycklarna: {"subject":"...","text":"...","html":"..."} ' +
    "utan markdown eller extra text.";

  const userPrompt = JSON.stringify(
    {
      instruction:
        "Skriv ett kort, varmt och tydligt paminnelsemail pa svenska utifran redan utvalda uppgifter.",
      recipientName: candidate.userName,
      moveDate: candidate.moveDate,
      lookaheadDays,
      dueItems: minimalItems,
    },
    null,
    2
  );

  try {
    const response = await fetch(`${gatewayBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayToken}`,
        "x-openclaw-agent-id": agentId,
      },
      body: JSON.stringify({
        model,
        stream: false,
        user: `cron-reminder-${candidate.moveId}`,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    const text = extractOpenClawText(data);
    if (!text) return null;

    const jsonText = extractJsonObject(text);
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText);
    return normalizeAidaContent(parsed);
  } catch {
    return null;
  }
}

function resolveProvider(): { provider: MailProvider | null; missing: string[] } {
  const requested = (process.env.REMINDER_EMAIL_PROVIDER || "").trim().toLowerCase();
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSendgrid = Boolean(process.env.SENDGRID_API_KEY);

  if (requested === "resend") {
    return { provider: hasResend ? "resend" : null, missing: hasResend ? [] : ["RESEND_API_KEY"] };
  }
  if (requested === "sendgrid") {
    return {
      provider: hasSendgrid ? "sendgrid" : null,
      missing: hasSendgrid ? [] : ["SENDGRID_API_KEY"],
    };
  }
  if (hasResend) return { provider: "resend", missing: [] };
  if (hasSendgrid) return { provider: "sendgrid", missing: [] };
  return { provider: null, missing: ["RESEND_API_KEY or SENDGRID_API_KEY"] };
}

async function sendViaResend(args: {
  apiKey: string;
  from: string;
  to: string;
  content: EmailContent;
}): Promise<string | null> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.content.subject,
      text: args.content.text,
      html: args.content.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}`);
  }

  const data = (await response.json().catch(() => null)) as { id?: string } | null;
  return data?.id ?? null;
}

async function sendViaSendgrid(args: {
  apiKey: string;
  from: string;
  to: string;
  content: EmailContent;
}): Promise<string | null> {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: args.to }] }],
      from: { email: args.from },
      subject: args.content.subject,
      content: [
        { type: "text/plain", value: args.content.text },
        { type: "text/html", value: args.content.html },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid returned ${response.status}`);
  }

  return response.headers.get("x-message-id");
}

export async function GET(req: NextRequest) {
  try {
    const expectedSecret = (process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || "").trim();
    if (expectedSecret) {
      const incoming = normalizeToken(req);
      if (!incoming || incoming !== expectedSecret) {
        return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    const lookaheadDays = parseLookaheadDays(req.nextUrl.searchParams.get("lookaheadDays"));
    const dryRun = parseDryRun(req);

    const today = new Date();
    const todayIso = toIsoDate(today);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + lookaheadDays);
    const horizonIso = toIsoDate(horizon);

    const db = getDb();
    const moveRows = await db
      .select({
        moveId: moves.id,
        moveDate: moves.moveDate,
        userName: users.name,
        userEmail: users.email,
      })
      .from(moves)
      .innerJoin(users, eq(moves.userId, users.id));

    const candidates: ReminderCandidate[] = [];

    for (const moveRow of moveRows) {
      if (!moveRow.userEmail) continue;

      const rows = await db
        .select({
          taskKey: checklistItems.taskKey,
          title: checklistItems.title,
          section: checklistItems.section,
          dueDate: checklistItems.dueDate,
          completed: checklistItems.completed,
          status: checklistItems.status,
          sortOrder: checklistItems.sortOrder,
        })
        .from(checklistItems)
        .where(eq(checklistItems.moveId, moveRow.moveId));

      const dueItems: DueItem[] = rows
        .filter((item) => !isChecklistDone(item))
        .filter((item) => typeof item.dueDate === "string" && item.dueDate.length === 10)
        .map((item) => ({
          taskKey: item.taskKey,
          title: item.title,
          section: item.section,
          dueDate: item.dueDate as string,
          status: item.status,
          sortOrder: item.sortOrder ?? 0,
        }))
        .filter((item) => item.dueDate >= todayIso && item.dueDate <= horizonIso);

      if (dueItems.length === 0) continue;

      candidates.push({
        moveId: moveRow.moveId,
        userName: moveRow.userName,
        userEmail: moveRow.userEmail,
        moveDate: moveRow.moveDate,
        dueItems,
      });
    }

    const { provider, missing } = resolveProvider();
    const fromEmail = (process.env.REMINDER_EMAIL_FROM || process.env.EMAIL_FROM || "").trim();

    const processed: Array<{
      moveId: number;
      email: string;
      itemCount: number;
      status: "sent" | "planned" | "skipped" | "failed";
      reason?: string;
      provider?: string;
      subject?: string;
      providerMessageId?: string | null;
      usedAida: boolean;
    }> = [];

    for (const candidate of candidates) {
      const existing = await db
        .select({ id: reminderLogs.id })
        .from(reminderLogs)
        .where(
          and(
            eq(reminderLogs.moveId, candidate.moveId),
            eq(reminderLogs.kind, REMINDER_KIND),
            eq(reminderLogs.scheduledFor, todayIso)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        processed.push({
          moveId: candidate.moveId,
          email: candidate.userEmail,
          itemCount: candidate.dueItems.length,
          status: "skipped",
          reason: "already_sent_today",
          usedAida: false,
        });
        continue;
      }

      const deterministicContent = buildDeterministicContent(candidate, lookaheadDays);
      const aidaContent = await generateAidaContent(candidate, lookaheadDays);
      const content = aidaContent ?? deterministicContent;
      const usedAida = Boolean(aidaContent);

      if (dryRun) {
        processed.push({
          moveId: candidate.moveId,
          email: candidate.userEmail,
          itemCount: candidate.dueItems.length,
          status: "planned",
          provider: provider ?? "none",
          subject: content.subject,
          usedAida,
        });
        continue;
      }

      if (!provider) {
        processed.push({
          moveId: candidate.moveId,
          email: candidate.userEmail,
          itemCount: candidate.dueItems.length,
          status: "failed",
          reason: `missing_provider_credentials: ${missing.join(", ")}`,
          usedAida,
        });
        continue;
      }

      if (!fromEmail) {
        processed.push({
          moveId: candidate.moveId,
          email: candidate.userEmail,
          itemCount: candidate.dueItems.length,
          status: "failed",
          reason: "missing REMINDER_EMAIL_FROM or EMAIL_FROM",
          provider,
          usedAida,
        });
        continue;
      }

      try {
        const providerMessageId =
          provider === "resend"
            ? await sendViaResend({
                apiKey: process.env.RESEND_API_KEY as string,
                from: fromEmail,
                to: candidate.userEmail,
                content,
              })
            : await sendViaSendgrid({
                apiKey: process.env.SENDGRID_API_KEY as string,
                from: fromEmail,
                to: candidate.userEmail,
                content,
              });

        await db.insert(reminderLogs).values({
          moveId: candidate.moveId,
          kind: REMINDER_KIND,
          scheduledFor: todayIso,
          emailTo: candidate.userEmail,
          provider,
          providerMessageId,
          subject: content.subject,
        });

        processed.push({
          moveId: candidate.moveId,
          email: candidate.userEmail,
          itemCount: candidate.dueItems.length,
          status: "sent",
          provider,
          subject: content.subject,
          providerMessageId,
          usedAida,
        });
      } catch (error) {
        processed.push({
          moveId: candidate.moveId,
          email: candidate.userEmail,
          itemCount: candidate.dueItems.length,
          status: "failed",
          provider,
          reason: error instanceof Error ? error.message : "unknown_send_error",
          usedAida,
        });
      }
    }

    const counts = {
      totalCandidates: candidates.length,
      sent: processed.filter((row) => row.status === "sent").length,
      planned: processed.filter((row) => row.status === "planned").length,
      skipped: processed.filter((row) => row.status === "skipped").length,
      failed: processed.filter((row) => row.status === "failed").length,
      usedAida: processed.filter((row) => row.usedAida).length,
    };

    return NextResponse.json({
      ok: true,
      dryRun,
      lookaheadDays,
      window: { from: todayIso, to: horizonIso },
      provider: provider ?? null,
      counts,
      processed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
