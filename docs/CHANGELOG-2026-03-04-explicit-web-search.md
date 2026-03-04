# Explicit web search gate for Aida chat

Date: 2026-03-04

## What changed and why

The chat backend now has a deterministic "explicit web search" path.

When a user explicitly asks to search the web (for example "sok pa natet", "googla", "web_search"), the request is handled directly in backend code instead of being left to the OpenClaw gateway prompt/model behavior.

This removes the prior "sometimes yes, sometimes no" behavior where the model could decline despite technical capability.

## Data flow (before vs after)

Before:

```text
User message
  -> /api/did/chat or /api/openclaw/chat
  -> OpenClaw gateway model decision
  -> (sometimes web search, sometimes refusal)
```

After:

```text
User message
  -> /api/did/chat or /api/openclaw/chat
  -> explicit web-search detector
     -> YES: OpenAI Responses API + web_search tool (deterministic path)
     -> NO: existing OpenClaw gateway flow (unchanged)
```

## Env variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `AIDA_WEB_SEARCH_MODEL` | No | `gpt-4.1-mini` (fallback via `COMPARE_MODEL`) | Model used for deterministic explicit web search path |
| `COMPARE_MODEL` | No | Existing project value | Secondary fallback if `AIDA_WEB_SEARCH_MODEL` is not set |
| `OPENAI_API_KEY` | Yes (already required) | n/a | Used by backend OpenAI client for explicit web search call |

## Preserved behavior

- Existing enrichment flow is unchanged.
- Existing comparison prefetch flow is unchanged.
- Existing OpenClaw gateway flow remains default for non-explicit web-search requests.
- Existing personnummer enrichment route remains unchanged.
