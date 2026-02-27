import { NextRequest, NextResponse } from "next/server";
import { sendEmail, type EmailContent } from "@/lib/email/send";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  firstName: "Fornamn",
  lastName: "Efternamn",
  personalNumber: "Personnummer",
  fromStreet: "Nuvarande gata",
  fromPostal: "Nuvarande postnr",
  fromCity: "Nuvarande ort",
  toStreet: "Ny gata",
  toPostal: "Nytt postnr",
  toCity: "Ny ort",
  apartmentNumber: "Lagenhetsnummer",
  propertyDesignation: "Fastighetsbeteckning",
  propertyOwner: "Fastighetsagare",
  email: "E-post",
  phone: "Telefon",
  moveDate: "Flyttdatum",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildFieldsHtml(fields: Record<string, string>): string {
  const rows = Object.entries(fields)
    .filter(([, value]) => value && value.trim())
    .map(([key, value]) => {
      const label = FIELD_LABELS[key] || key;
      return `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:600">${escapeHtml(label)}</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${escapeHtml(value)}</td></tr>`;
    });

  if (rows.length === 0) return "";
  return `<h3 style="margin:24px 0 8px">Dina ifyllda falt</h3><table style="border-collapse:collapse;width:100%">${rows.join("")}</table>`;
}

function buildFieldsText(fields: Record<string, string>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value && value.trim())
    .map(([key, value]) => `${FIELD_LABELS[key] || key}: ${value}`);
  return lines.length > 0 ? "DINA IFYLLDA FALT\n" + lines.join("\n") : "";
}

function buildChecklistHtml(items: Array<{ title: string; dueDate?: string; status?: string }>): string {
  if (items.length === 0) return "";
  const rows = items.map((item) => {
    const statusBadge = item.status === "done" ? "Klar" : item.dueDate || "Kommande";
    return `<li style="margin:4px 0"><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(statusBadge)}</li>`;
  });
  return `<h3 style="margin:24px 0 8px">Checklistpunkter</h3><ul>${rows.join("")}</ul>`;
}

function buildChecklistText(items: Array<{ title: string; dueDate?: string; status?: string }>): string {
  if (items.length === 0) return "";
  const lines = items.map((item) => {
    const statusBadge = item.status === "done" ? "Klar" : item.dueDate || "Kommande";
    return `- ${item.title} (${statusBadge})`;
  });
  return "CHECKLISTPUNKTER\n" + lines.join("\n");
}

function buildEmailContent(args: {
  subject: string;
  fields: Record<string, string>;
  checklistItems: Array<{ title: string; dueDate?: string; status?: string }>;
  includeFields: boolean;
  includeChecklist: boolean;
}): EmailContent {
  const { subject, fields, checklistItems, includeFields, includeChecklist } = args;
  const firstName = fields.firstName || "du";

  const fieldsHtml = includeFields ? buildFieldsHtml(fields) : "";
  const checklistHtml = includeChecklist ? buildChecklistHtml(checklistItems) : "";
  const fieldsText = includeFields ? buildFieldsText(fields) : "";
  const checklistText = includeChecklist ? buildChecklistText(checklistItems) : "";

  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">` +
    `<p>Hej ${escapeHtml(firstName)},</p>` +
    `<p>Har ar en sammanfattning av din flytt fran Flytt.io.</p>` +
    fieldsHtml +
    checklistHtml +
    `<p style="margin-top:24px">Ga till <a href="https://flyttanu.vercel.app/adressandring">din dashboard</a> for att fortsatta.</p>` +
    `<p>Halsningar,<br/>Aida – Flytt.io</p>` +
    `</div>`;

  const textParts = [
    `Hej ${firstName},`,
    "Har ar en sammanfattning av din flytt fran Flytt.io.",
    fieldsText,
    checklistText,
    "Ga till https://flyttanu.vercel.app/adressandring for att fortsatta.",
    "Halsningar,\nAida – Flytt.io",
  ].filter(Boolean);

  return { subject, text: textParts.join("\n\n"), html };
}

export async function POST(req: NextRequest) {
  const sameOrigin = req.headers.get("origin") === req.nextUrl.origin;
  if (!sameOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
    if (!to || !to.includes("@")) {
      return NextResponse.json({ error: "Valid email address required" }, { status: 400 });
    }

    const subject = typeof body.subject === "string" && body.subject.trim()
      ? body.subject.trim().slice(0, 140)
      : "Sammanfattning av din flytt";
    const fields: Record<string, string> = body.fields && typeof body.fields === "object" ? body.fields : {};
    const checklistItems: Array<{ title: string; dueDate?: string; status?: string }> =
      Array.isArray(body.checklistItems) ? body.checklistItems : [];
    const includeFields = body.includeFields !== false;
    const includeChecklist = body.includeChecklist !== false;

    const content = buildEmailContent({ subject, fields, checklistItems, includeFields, includeChecklist });
    const result = await sendEmail({ to, content });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, provider: result.provider },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("[email/send] Error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
