# OpenClaw Integration Guide

This project ships with a full OpenClaw bridge so agents can observe form data, see the same UI that the user sees (even behind Vercel deployment protection), and answer questions inside the embedded chat widget.

The integration has three pillars:

1. **Form mirroring** – every keystroke, step change, QR scan, and submission is mirrored to `POST /api/openclaw/webhook` via `hooks/use-openclaw-mirror.ts`.
2. **Chat proxy** – the floating `OpenClawChatWidget` posts chat turns to `POST /api/openclaw/chat`, bundling the current form state for context.
3. **Deployment access** – `/api/openclaw/access` issues the Vercel deployment-protection bypass cookie or returns the bypass header/token as JSON so OpenClaw can crawl the protected preview.

Below is everything you need to keep the loop closed in production.

---

## 1. Environment variables

Copy `.env.example` to `.env.local` for local development and add the same keys in Vercel → **Project → Settings → Environment Variables** (Preview + Production):

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_OPENCLAW_WEBHOOK_SECRET` | Client | Shared string used to HMAC-sign payloads from the browser |
| `OPENCLAW_WEBHOOK_SECRET` | Server | Same value as above; server verifies the HMAC |
| `OPENCLAW_AGENT_URL` | Server | Base URL to your OpenClaw agent (e.g. `https://assistant.openclaw.ai/sessions/abc123`) |
| `OPENCLAW_AGENT_TOKEN` | Server | Bearer token that authenticates requests against the agent |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Server | Protection‑bypass token from Vercel → Deployment Protection → Automation |
| `NEXT_PUBLIC_SITE_URL` (optional) | Client | Used in a few UI helpers for canonical links |

> 🔐 **Never** expose `OPENCLAW_AGENT_TOKEN` or `VERCEL_AUTOMATION_BYPASS_SECRET` to the client. They only live on the server or via OpenClaw itself.

Redeploy after setting/changing these; Vercel system environment variables are baked when the build runs.

---

## 2. Data flow recap

```
Browser (useOpenClawMirror)
  └── POST /api/openclaw/webhook
        ├─ Validates HMAC signature
        ├─ Adds siteAccess helper (bypass header + access endpoint + cookie URL)
        └─ Forwards payload to OPENCLAW_AGENT_URL (Bearer OPENCLAW_AGENT_TOKEN)

Browser (chat widget)
  └── POST /api/openclaw/chat
        ├─ Sends sessionId + chat messages + current form snapshot
        ├─ Streams SSE replies when the agent streams
        └─ Provides identical siteAccess helper as above

OpenClaw agent (server-side tools)
  └── GET /api/openclaw/access?token=<OPENCLAW_AGENT_TOKEN>&redirect=/adressandring
        ├─ Sets the Vercel bypass cookie (using Automation secret)
        └─ Redirects to desired page so the agent can browse freely
```

The `siteAccess` object that the webhook + chat proxies forward looks like this:

```json
{
  "baseUrl": "https://flyttanu.vercel.app",
  "bypassHeader": "x-vercel-protection-bypass",
  "bypassToken": "<VERCEL_AUTOMATION_BYPASS_SECRET>",
  "accessEndpoint": "https://flyttanu.vercel.app/api/openclaw/access",
  "defaultRedirectPath": "/adressandring",
  "bypassCookieUrl": "https://flyttanu.vercel.app/api/openclaw/access?token=<OPENCLAW_AGENT_TOKEN>&redirect=%2Fadressandring"
}
```

An OpenClaw tool can either set the header on every request or call the `bypassCookieUrl` once to drop in the cookie.

---

## 3. Testing locally

1. Install deps once: `npm install`
2. Copy `.env.example` → `.env.local` and fill dev secrets.
3. Run `npm run dev` and visit `http://localhost:3000/adressandring`
4. To simulate mirroring, send a signed payload:

```bash
curl -X POST http://localhost:3000/api/openclaw/webhook \
  -H 'Content-Type: application/json' \
  -H 'x-openclaw-signature: '$(node scripts/sign-openclaw-payload.js) \
  -d '{"sessionId":"demo","event":"field_change","formType":"adressandring","fields":{"firstName":"Test"}}'
```

(Replace the signature helper with whatever script you prefer — the server skips verification when `OPENCLAW_WEBHOOK_SECRET` is empty.)

5. To verify deployment access, hit:

```bash
curl -i 'http://localhost:3000/api/openclaw/access' \
  -H 'Content-Type: application/json' \
  -d '{"token": "<OPENCLAW_AGENT_TOKEN>"}'
```

You should receive the JSON block with header/cookie instructions.

---

## 4. Operational checklist

- [ ] Set all environment variables (see table above)
- [ ] Generate a Vercel **Protection Bypass for Automation** token and store it as `VERCEL_AUTOMATION_BYPASS_SECRET`
- [ ] Redeploy the app so the new env vars take effect
- [ ] In OpenClaw, update the agent’s tools to:
  - add header `x-vercel-protection-bypass: <bypassToken>` on fetches, **or**
  - call `siteAccess.bypassCookieUrl` once and then browse normally
- [ ] Confirm `/api/openclaw/webhook` logs mirror events in the OpenClaw session
- [ ] Ask a question in the embedded chat to verify `/api/openclaw/chat` proxies correctly

With those pieces in place, the assistant inside OpenClaw has full real-time context of the user’s progress through adressändring and can safely browse even protected preview deployments.
