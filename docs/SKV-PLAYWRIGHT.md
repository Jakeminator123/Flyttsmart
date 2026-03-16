# SKV Playwright Service -- BankID-automation via Render

This project includes a headless Playwright service that automates the Skatteverket BankID login flow and mirrors the QR code back to the user's browser in real-time. The service runs as a Docker web service on Render, completely separate from the Vercel-hosted Next.js app.

The integration has three pillars:

1. **Remote job execution** -- Vercel's `/api/skv/int7/start` delegates to the Render service via `POST /api/run`, passing form payload and click configuration.
2. **QR mirroring** -- The Playwright browser screenshots the BankID QR every 2 seconds. The Next.js `BankIdQrMirror` component polls the proxy routes and displays the image inline.
3. **Proxy layer** -- `/api/skv/clone/state/[jobId]` and `/api/skv/clone/qr/[jobId]` on Vercel proxy to Flask on Render, authenticated via Bearer token.

---

## 1. Architecture

```
User browser
  --> Vercel (Next.js)
        --> POST /api/skv/int7/start
              --> POST https://skv-playwright.onrender.com/api/run
                    (starts headless Chromium, navigates to Skatteverket,
                     clicks through cookie/login/BankID, captures QR)

  --> GET /api/skv/clone/state/{jobId}
        --> proxied to Render /api/clone/state/{jobId}
              (returns JSON: aidPresent, qrImageReady, jobState, etc.)

  --> GET /api/skv/clone/qr/{jobId}
        --> proxied to Render /api/clone/qr/{jobId}
              (returns PNG screenshot of BankID QR code)
```

In local development the flow is identical except Next.js spawns a local Python process instead of calling Render. The switch is automatic: when `SKV_SERVICE_URL` is set and points to a remote host, production mode is used.

---

## 2. Environment variables

### Render (Docker service)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | (set by Render) | HTTP port for gunicorn |
| `SKV_HEADLESS` | `y` | Must be `y` on Render (no display) |
| `SKV_HOST` | `0.0.0.0` | Bind address |
| `SKV_DATA_DIR` | `/var/data` | Persistent storage root for results, payloads, snapshots, and archived job state |
| `CLONE_QR_FROMPLAYWRIGHT_TO_SITE` | `y` | Enable QR mirroring to the site |
| `SKV_API_KEY` | (secret) | Bearer token for `/api/*` endpoints |
| `SKV_QR_CAPTURE_INTERVAL_SECONDS` | `2` | How often the live QR capture updates while waiting for BankID |
| `SKV_QR_HISTORY_SECONDS` | `120` | Rolling window for archived QR frames on disk |
| `SKV_QR_HISTORY_MAX_FRAMES` | `60` | Safety cap for archived QR images |
| `SKV_QR_ARCHIVE_ENABLED` | `y` | Persist a gentle rolling QR archive to disk |
| `SKV_QR_ARCHIVE_MAX_BYTES` | `750000` | Skip archiving oversized fallback captures |

### Vercel (Next.js)

| Variable | Purpose |
| --- | --- |
| `SKV_SERVICE_URL` | Full Render URL, e.g. `https://skv-playwright.onrender.com` |
| `SKV_SERVICE_API_KEY` | Same value as `SKV_API_KEY` on Render |
| `CLONE_QR_FROMPLAYWRIGHT_TO_SITE` | `y` to enable BankIdQrMirror in the UI |

### Local development

Leave `SKV_SERVICE_URL` unset (or commented out in `.env.local`). Next.js will spawn `inlogg/int7/runner.py` directly and the Playwright window opens on your screen.

---

## 3. Render setup

| Setting | Value |
| --- | --- |
| **Name** | `skv-playwright` |
| **Runtime** | Docker |
| **Root Directory** | `inlogg` |
| **Dockerfile Path** | `./Dockerfile` |
| **Instance Type** | Standard (2 GB RAM minimum for Chromium) |
| **Health Check Path** | `/api/health` |
| **Disk** | Mount a persistent disk at `/var/data` |

The `render.yaml` in the project root defines this as a Blueprint. Alternatively, create the service manually in the Render dashboard using the values above.

---

## 4. Key files

| File | Role |
| --- | --- |
| `inlogg/skv6.py` | Flask app + Playwright automation engine |
| `inlogg/skv_core.py` | Shared helpers (form signals, config, page detection) |
| `inlogg/formulär/flytt_form_filler.py` | Auto-fills the Skatteverket move form |
| `inlogg/int7/runner.py` | Local-mode launcher (spawns Flask + Playwright in one process) |
| `inlogg/Dockerfile` | Production Docker image (gunicorn + headless Chromium) |
| `inlogg/config.txt` | Feature flags (QR clone, browser trace, scroll behavior) |
| `render.yaml` | Render Blueprint definition |
| `lib/skv/config.ts` | Centralized config helpers for Next.js routes |
| `app/api/skv/int7/start/route.ts` | Dual-mode start (local spawn vs remote HTTP) |
| `app/api/skv/clone/proxy-helpers.ts` | Shared upstream URL + auth header logic |
| `app/api/skv/clone/state/[jobId]/route.ts` | Proxy: job state polling |
| `app/api/skv/clone/qr/[jobId]/route.ts` | Proxy: QR image |
| `components/bankid-qr-mirror.tsx` | React component that polls and displays the QR |

---

## 5. Job lifecycle

1. `POST /api/run` starts a Playwright job in a daemon thread. Each job gets a unique 12-char hex ID.
2. The job navigates to Skatteverket, clicks through cookie/login/BankID sequences, and enters the QR wait loop.
3. While waiting for the user to scan the QR, the engine screenshots the auth page every 2 seconds and stores the image in memory keyed by `job_id`.
4. The frontend polls `/api/clone/state/{jobId}` every 2 seconds. When `qrImageReady` becomes `true`, `BankIdQrMirror` renders the QR from `/api/clone/qr/{jobId}`.
5. After the user scans and authenticates, the engine detects the form page, runs `flytt_form_filler`, and sets `jobState: "matched"`.
6. The component shows a green "Inloggning klar" message and stops polling.

### Persistent artifacts

When `SKV_DATA_DIR` points at a persistent disk, the service keeps:

- `results/{jobId}.png` -- final screenshot
- `runtime/payload_{jobId}.json` -- exact payload used for autofill
- `snapshots/{jobId}.html` -- saved HTML snapshot of the form page
- `jobs/{jobId}.json` -- archived final job state used by `/api/status/{jobId}` even after in-memory cleanup
- `qr_frames/{jobId}/` -- a rolling QR archive (defaults to 1 frame every 2 seconds, max 2 minutes / 60 frames)

### Limits and cleanup

- **Max 3 concurrent jobs** (`MAX_CONCURRENT_JOBS`). Returns 429 if all slots are full.
- **Max 10 min runtime** (`MAX_JOB_RUNTIME_SECONDS = 600`). The Playwright loop exits after this.
- **Browser is closed explicitly** after every terminal state (matched, timeout, error, cancelled).
- **Memory cleanup** runs 5 minutes after job completion: removes live job data, cancel flags, and QR captures from memory.
- **Per-job payload files** (`runtime/payload_{jobId}.json`) ensure parallel jobs don't overwrite each other's form data and now remain on disk for later retrieval.
- **QR frame archive** is intentionally gentle: it keeps a rolling cap, defaults to QR-sized element captures, and avoids writing oversized fallback screenshots unless they are small enough.
- **Client polling** stops automatically when the job is done, terminal, dismissed, or has been open for too long, so the UI does not keep polling forever.

### Error handling

- `jobState: "error"` -- Playwright crashed or an exception occurred. BankIdQrMirror shows a red error banner.
- `jobState: "timeout"` -- 10-minute limit reached without finding the form.
- `jobState: "cancelled"` -- User or system cancelled via `POST /api/cancel/{jobId}`.
- `fetchError` in the component -- Render is unreachable. Shows amber warning.

---

## 6. API authentication

When `SKV_API_KEY` is set on Render, Flask's `@app.before_request` hook requires `Authorization: Bearer <key>` on all `/api/*` endpoints. The `/api/health` endpoint is exempt so Render's health check works without credentials.

The Next.js proxy routes read `SKV_SERVICE_API_KEY` from Vercel's env and attach the header automatically via `buildUpstreamHeaders()` in `proxy-helpers.ts`.

If `SKV_API_KEY` is empty on Render, authentication is skipped entirely (useful for local dev).

---

## 7. Testing

### Verify Render is alive

```bash
curl https://skv-playwright.onrender.com/api/health
# {"data_dir":"/var/data","headless":true,"ok":true,"service":"skv-playwright"}
```

### Start a job manually

```bash
curl -X POST https://skv-playwright.onrender.com/api/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SKV_API_KEY>" \
  -d '{"url":"https://www7.skatteverket.se/portal/flyttanmalan/","timeout_seconds":300}'
# {"job_id":"abc123def456","state":"queued",...}
```

### Poll state

```bash
curl https://skv-playwright.onrender.com/api/clone/state/abc123def456 \
  -H "Authorization: Bearer <SKV_API_KEY>"
```

### Fetch saved artifacts

```bash
curl https://skv-playwright.onrender.com/api/status/abc123def456 \
  -H "Authorization: Bearer <SKV_API_KEY>"

curl https://skv-playwright.onrender.com/api/payload/abc123def456 \
  -H "Authorization: Bearer <SKV_API_KEY>"

curl https://skv-playwright.onrender.com/api/html/abc123def456 \
  -H "Authorization: Bearer <SKV_API_KEY>"
```

### End-to-end from the site

1. Go to the dashboard or adressandring page.
2. Navigate to the "Skatteverket" tab.
3. Click "Starta SKV-int7 (BankID)".
4. The BankID QR should appear inline within 15-30 seconds.
5. Scan with Mobile BankID on your phone.
6. The component shows "Inloggning klar" and the form is auto-filled.

---

## 8. Operational checklist

- [ ] Set `SKV_API_KEY` on Render (use `python -c "import secrets; print(secrets.token_hex(24))"`)
- [ ] Mount a persistent Render disk at `/var/data`
- [ ] Set `SKV_DATA_DIR=/var/data` on Render
- [ ] Set `SKV_SERVICE_URL` and `SKV_SERVICE_API_KEY` on Vercel
- [ ] Set `CLONE_QR_FROMPLAYWRIGHT_TO_SITE=y` on both Render and Vercel
- [ ] Verify Render instance is Standard plan (2 GB RAM) -- Starter (512 MB) is too small for Chromium
- [ ] Confirm `/api/health` returns `{"ok": true}` on Render
- [ ] Redeploy Vercel after adding env vars
- [ ] Test the full flow: click button -> QR appears -> scan -> form filled
