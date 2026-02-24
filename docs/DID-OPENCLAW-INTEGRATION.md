# D-ID + OpenClaw Integration

## Overview

The D-ID avatar "AIda" (agent `v2_agt_THZNQGpC`) uses OpenClaw as its brain
via D-ID's Custom LLM feature. D-ID handles video/audio/avatar rendering,
while OpenClaw handles reasoning, tool calls, and response generation.

```
User (voice/text)
    |
    v
D-ID Avatar (WebRTC, STT, TTS, video)
    |
    v  (server-to-server, compressed POST, SSE streaming)
Vercel endpoint: /api/did/v1/chat/completions
    |
    v  (OpenAI-compatible, Bearer token auth)
OpenClaw Gateway on Render (openclaw-aida.onrender.com)
    |
    v  (internal)
OpenAI API (GPT models)
```

## Authentication chain

Each hop uses a separate credential:

| Hop                   | Auth method              | Credential                    |
|-----------------------|--------------------------|-------------------------------|
| D-ID -> Vercel        | `x-api-key` header       | `DID_BRIDGE_SECRET`           |
| Vercel -> OpenClaw    | `Authorization: Bearer`  | `OPENCLAW_GATEWAY_TOKEN`      |
| OpenClaw -> OpenAI    | `Authorization: Bearer`  | `OPENAI_API_KEY` (on Render)  |

## Key files

| File                                                | Purpose                                      |
|-----------------------------------------------------|----------------------------------------------|
| `app/api/did/v1/chat/completions/route.ts`          | Custom LLM endpoint (main proxy)             |
| `app/api/did/v1/chat/completions/models/route.ts`   | Model list for D-ID Studio                   |
| `app/api/did/chat/route.ts`                         | Bridge: form events + direct chat            |
| `components/did-openclaw-bridge-widget.tsx`          | Frontend: D-ID embed + form tracking         |
| `lib/openclaw/server-config.ts`                     | Token/URL resolution with fallbacks          |
| `lib/openclaw/response.ts`                          | Response parsing (OpenAI + suggestion blocks)|
| `lib/did/session-store.ts`                          | In-memory form context per session           |

## Custom LLM endpoint details

`POST /api/did/v1/chat/completions`

What it does:
1. Validates auth (`x-api-key` must match `DID_BRIDGE_SECRET`)
2. Decompresses request body if needed (D-ID sends gzip/brotli)
3. Normalizes messages from D-ID format
4. Loads form context from session store (keyed by `x-did-distinct-id`)
5. Builds system prompt with field knowledge + form context + enrichment data
6. Proxies to OpenClaw Gateway (`/v1/chat/completions`) with SSE streaming
7. Relays SSE chunks back to D-ID in OpenAI Chat Completions chunk format

Why decompression matters:
D-ID sends POST bodies compressed with brotli. Without explicit decompression
(`brotliDecompressSync`), `req.json()` fails silently. This caused D-ID Studio
to fail validation and disable the model dropdown. The fix imports `node:zlib`
and handles `content-encoding: br|gzip|deflate` before JSON parsing.

`GET /api/did/v1/chat/completions/models`

Returns an OpenAI-compatible model list so D-ID Studio can populate the model
dropdown. Includes CORS headers for `studio.d-id.com`.

## D-ID agent configuration

The agent is configured via the D-ID API (not Studio UI, which has a bug
with Custom LLM model dropdowns).

Current config (set 2026-02-24):
- `llm.provider`: `custom`
- `llm.custom.type`: `basic`
- `llm.custom.url`: `https://flyttanu.vercel.app/api/did/v1/chat/completions`
- `llm.custom.key`: value of `DID_BRIDGE_SECRET`
- `llm.custom.streaming`: `true`
- `llm.custom.max_messages`: `20`
- `presenter.voice.voice_id`: `sv-SE-SofieNeural`
- `presenter.voice.language`: `Swedish (Sweden)`

To update via API (get Bearer token from D-ID Studio network tab):
```bash
curl -X PATCH "https://api.d-id.com/agents/v2_agt_THZNQGpC" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"llm":{"provider":"custom","custom":{"type":"basic",
    "url":"https://flyttanu.vercel.app/api/did/v1/chat/completions",
    "key":"<DID_BRIDGE_SECRET>","streaming":true,"max_messages":20}}}'
```

## Environment variables

### Vercel (required for D-ID integration)

| Variable                         | Purpose                              |
|----------------------------------|--------------------------------------|
| `OPENCLAW_GATEWAY_TOKEN`         | Auth to OpenClaw on Render           |
| `OPENCLAW_GATEWAY_URL`           | OpenClaw base URL                    |
| `OPENCLAW_AGENT_ID`              | Agent ID (`aida-flyttagent`)         |
| `DID_BRIDGE_SECRET`              | Shared secret with D-ID              |
| `NEXT_PUBLIC_DID_CLIENT_KEY`     | D-ID client key (frontend, origin-locked) |
| `NEXT_PUBLIC_DID_AGENT_ID`       | D-ID agent ID (`v2_agt_THZNQGpC`)   |
| `NEXT_PUBLIC_DID_BRIDGE_ENABLED` | Enable D-ID widget (`true`)          |
| `NEXT_PUBLIC_MERGE_OC_DID`       | Hide text chat, avatar is primary (`y`) |

### Render (no D-ID-specific vars needed)

| Variable                  | Purpose                    |
|---------------------------|----------------------------|
| `OPENCLAW_GATEWAY_TOKEN`  | Gateway auth               |
| `OPENCLAW_GATEWAY_PORT`   | Listen port (`10000`)      |
| `OPENAI_API_KEY`          | OpenAI API for LLM calls   |

## Troubleshooting

### Avatar responds but not with OpenClaw knowledge
Check that `llm.provider` is `custom` (not `openai`):
```bash
curl -H "Authorization: Bearer <token>" https://api.d-id.com/agents/v2_agt_THZNQGpC | jq .llm.provider
```

### D-ID Studio model dropdown is empty
This is a known D-ID Studio UI bug. The `/models` endpoint works correctly
(verified via Network tab), but the dropdown stays disabled. Use the API
to configure Custom LLM instead.

### Voice input not working (STT)
Ensure the agent voice is set to Swedish (`sv-SE-SofieNeural`), not English.
D-ID ties STT language to the voice language. English STT cannot parse Swedish.

### Chat works locally but not on Vercel
Check that `OPENCLAW_GATEWAY_TOKEN` is set in Vercel environment variables.
The fallback token `OPENCLAW_AGENT_TOKEN` may not match the Render gateway token.

### D-ID sends compressed bodies and endpoint fails
The endpoint handles `content-encoding: br|gzip|deflate` via `node:zlib`.
If a new compression format appears, check the `parseRequestBody` function.

### LaunchDarkly requests in network tab
These come from D-ID's own feature flag system (not your code). They are
normal and harmless: `app.launchdarkly.com/sdk/goals/...` and
`app.launchdarkly.com/sdk/evalx/...`. Ignore them.
