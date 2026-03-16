# D-ID + OpenClaw Integration

## Overview

The D-ID avatar "AIda" uses OpenClaw as its brain. The widget uses the
D-ID Client SDK with Web Speech API for Swedish voice input, and
`agentManager.speak()` to make the avatar respond.

```
User speaks Swedish
    |
    v
Web Speech API (sv-SE) -> transcribed text
    |
    v
React Widget -> POST /api/did/chat {message, sessionId, formContext}
    |
    v
Vercel endpoint -> POST /v1/chat/completions (OpenClaw on Render)
    |
    v
OpenClaw generates response with move expertise
    |
    v
Widget receives reply -> agentManager.speak(reply)
    |
    v
D-ID Avatar speaks + animates (TTS: sv-SE-SofieNeural)
```

## Architecture (current, 2026-02-27)

The widget uses the "client-side relay" pattern:
- **STT**: Web Speech API (`sv-SE`) in the browser
- **Brain**: OpenClaw Gateway on Render (via `/api/did/chat`)
- **Avatar**: D-ID Client SDK (`@d-id/client-sdk`) with `speak()` mode
- **TTS**: Microsoft `sv-SE-SofieNeural` (configured on D-ID agent)
- **Stream**: `streamWarmup: true` + `compatibilityMode: "auto"` for immediate idle video
- **Idle**: `onVideoStateChange("STOP")` switches to `idle_video` (no black screen)

D-ID agent config is `provider: "openai"` with `gpt-4.1-nano` but
the LLM pipeline is never used (we bypass it with `speak()`).
The built-in LLM is only there as a fallback.

### Smart message routing (2026-02-27)

Both `/api/did/chat` and `/api/openclaw/chat` use `lib/aida/classify.ts`
to classify each message and choose the optimal response path:

| Intent | Enrichment | Comparison | Typical latency |
|--------|-----------|-----------|----------------|
| `direct` | Skip | Skip | <0.5s (local pattern match, no model call) |
| `simple` | Skip | Skip | 2-5s (field/step questions, greetings) |
| `comparison` | Parallel | Parallel | 5-15s (gpt-4.1 web_search) |
| `general` | Yes | Skip | 3-8s (form help, move advice) |

For `comparison` intent, enrichment and comparison run in **parallel**
(previously sequential), saving 1-3 seconds on comparison questions.

## Key files

| File | Purpose |
|------|---------|
| `components/did-openclaw-bridge-widget.tsx` | Main widget: SDK init, Web Speech API, form tracking |
| `app/api/did/chat/route.ts` | Backend: form events + chat proxy to OpenClaw |
| `app/api/openclaw/chat/route.ts` | Text chat: same capabilities as DID (SSE streaming) |
| `lib/aida/classify.ts` | Message classifier: direct/simple/comparison/general |
| `lib/aida/enrich.ts` | Enrichment pipeline: PAP, Nominatim, Eniro, SCB |
| `lib/comparison/compare.ts` | Comparison engine: gpt-4.1 + web_search |
| `lib/openclaw/server-config.ts` | Token/URL resolution |
| `lib/openclaw/response.ts` | Response parsing |
| `lib/did/session-store.ts` | In-memory session history + form context |

## Authentication chain

| Hop | Auth method | Credential |
|-----|------------|------------|
| Widget -> Vercel | Same-origin (no auth needed) | - |
| Widget -> D-ID SDK | Client key (origin-locked) | `NEXT_PUBLIC_DID_CLIENT_KEY` |
| Vercel -> OpenClaw | `Authorization: Bearer` | `OPENCLAW_GATEWAY_TOKEN` |
| OpenClaw -> OpenAI | `Authorization: Bearer` | `OPENAI_API_KEY` (on Render) |

## Environment variables

### Vercel

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_GATEWAY_TOKEN` | Auth to OpenClaw on Render |
| `OPENCLAW_GATEWAY_URL` | OpenClaw base URL |
| `OPENCLAW_AGENT_ID` | Agent ID (`aida-flyttagent`) |
| `OPENCLAW_CHAT_MODEL` | Primary model for general/comparison (recommended: `openai/gpt-5.1-codex`) |
| `OPENCLAW_CHAT_MODEL_SIMPLE` | Fast model for simple prompts (recommended: `openai/gpt-4.1-mini`) |
| `DID_BRIDGE_SECRET` | Auth for cross-origin DID bridge requests |
| `NEXT_PUBLIC_DID_CLIENT_KEY` | D-ID client key (frontend, origin-locked) |
| `NEXT_PUBLIC_DID_AGENT_ID` | D-ID agent ID (`v2_agt_THZNQGpC`) |
| `NEXT_PUBLIC_DID_BRIDGE_ENABLED` | Enable the embedded landing assistant (`true`) |

### Render (OpenClaw)

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth |
| `OPENCLAW_GATEWAY_PORT` | Listen port (`10000`) |
| `OPENAI_API_KEY` | OpenAI API for LLM calls |

OpenClaw is configured OpenAI-only in this setup (no JuiceFactory provider path).

## D-ID agent config

Agent `v2_agt_THZNQGpC` is configured via D-ID API (not Studio UI):
- `llm.provider`: `openai` (fallback only, we use `speak()`)
- `llm.model`: `gpt-4.1-nano`
- `presenter.voice`: `sv-SE-SofieNeural` (Swedish)

## Troubleshooting

### Voice input not working
- Check microphone permission in browser address bar
- Web Speech API requires Chrome, Edge, or Safari
- Firefox has limited support; fallback is text input

### Avatar not connecting
- Check that `NEXT_PUBLIC_DID_CLIENT_KEY` and `NEXT_PUBLIC_DID_AGENT_ID` are set
- Check that the domain is in D-ID's allowed_domains for the client key

### Chat returns generic GPT answers instead of OpenClaw
- Verify `OPENCLAW_GATEWAY_TOKEN` is set on Vercel
- Check `/api/openclaw/health` endpoint for config status

### Webhook 401 errors in console
- Same-origin requests skip signature verification
- Cross-origin requests need `NEXT_PUBLIC_OPENCLAW_WEBHOOK_SECRET`

## Removed files (2026-02-24)

These were part of the old Custom LLM approach and are no longer needed:
- `app/api/did/v1/chat/completions/route.ts` (Custom LLM proxy)
- `app/api/did/v1/chat/completions/models/route.ts` (model list for D-ID Studio)
- `app/api/did/v1/models/route.ts` (alternative model list)
- `fix-did-llm.py` (script to restore Custom LLM config)
