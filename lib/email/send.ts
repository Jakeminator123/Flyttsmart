export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

export type MailProvider = "resend" | "sendgrid";

export async function sendViaResend(args: {
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

export async function sendViaSendgrid(args: {
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

export function resolveEmailProvider(
  requestedOverride?: string
): { provider: MailProvider | null; missing: string[]; requested: string } {
  const requested = (
    requestedOverride ??
    process.env.REMINDER_EMAIL_PROVIDER ??
    ""
  )
    .trim()
    .toLowerCase();
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSendgrid = Boolean(process.env.SENDGRID_API_KEY);

  if (requested === "auto" || !requested) {
    if (hasResend) return { provider: "resend", missing: [], requested: requested || "auto" };
    if (hasSendgrid) return { provider: "sendgrid", missing: [], requested: requested || "auto" };
    return { provider: null, missing: ["RESEND_API_KEY or SENDGRID_API_KEY"], requested: requested || "auto" };
  }

  if (requested === "resend") {
    return { provider: hasResend ? "resend" : null, missing: hasResend ? [] : ["RESEND_API_KEY"], requested };
  }
  if (requested === "sendgrid") {
    return { provider: hasSendgrid ? "sendgrid" : null, missing: hasSendgrid ? [] : ["SENDGRID_API_KEY"], requested };
  }
  if (hasResend) return { provider: "resend", missing: [], requested };
  if (hasSendgrid) return { provider: "sendgrid", missing: [], requested };
  return { provider: null, missing: ["RESEND_API_KEY or SENDGRID_API_KEY"], requested };
}

export function resolveFromEmail(override?: string): string {
  if (override && override.trim()) return override.trim();
  return (process.env.REMINDER_EMAIL_FROM || process.env.EMAIL_FROM || "").trim();
}

export async function sendEmail(args: {
  to: string;
  content: EmailContent;
  fromOverride?: string;
  providerOverride?: string;
}): Promise<{ ok: boolean; provider: string | null; messageId: string | null; error?: string }> {
  const { provider, missing } = resolveEmailProvider(args.providerOverride);
  const from = resolveFromEmail(args.fromOverride);

  if (!provider) {
    return { ok: false, provider: null, messageId: null, error: `Missing credentials: ${missing.join(", ")}` };
  }
  if (!from) {
    return { ok: false, provider, messageId: null, error: "No sender address configured (REMINDER_EMAIL_FROM / EMAIL_FROM)" };
  }

  try {
    const messageId =
      provider === "resend"
        ? await sendViaResend({ apiKey: process.env.RESEND_API_KEY as string, from, to: args.to, content: args.content })
        : await sendViaSendgrid({ apiKey: process.env.SENDGRID_API_KEY as string, from, to: args.to, content: args.content });

    return { ok: true, provider, messageId };
  } catch (error) {
    return { ok: false, provider, messageId: null, error: error instanceof Error ? error.message : "Unknown send error" };
  }
}
