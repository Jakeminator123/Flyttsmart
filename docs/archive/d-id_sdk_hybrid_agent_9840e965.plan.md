---
name: D-ID SDK hybrid agent
overview: Byt D-ID embed-scriptet till Client SDK med Web Speech API for STT (stodjer svenska), behall OpenClaw som hjarna, och anvand agentManager.speak() for att animera avataren. Detta kringgaar D-IDs trasiga STT helt.
todos:
  - id: install-sdk
    content: Installera @d-id/client-sdk
    status: completed
  - id: rewrite-widget
    content: Skriv om did-openclaw-bridge-widget.tsx med Client SDK + Web Speech API + speak()
    status: completed
  - id: update-chat-endpoint
    content: Uppdatera /api/did/chat for att returnera JSON-svar (inte bara SSE)
    status: completed
  - id: update-did-agent
    content: Byt D-ID agent till provider:openai eller ta bort LLM (speak-mode)
    status: completed
  - id: test-voice
    content: Testa rost-chat pa svenska lokalt och pa Vercel
    status: completed
isProject: false
---

# Hybrid D-ID + OpenClaw Agent med fungerade roest

## Problem

D-IDs inbyggda STT transkriberar inte svenska korrekt med Custom LLM. Text-chat fungerar men roest goer det inte. Vi behover baade fungerande roest OCH OpenClaw-kunskap.

## Loesning: Client SDK + Web Speech API + speak()

Byt fran D-IDs embed-script (`agent.d-id.com/v2/index.js`) till deras Client SDK (`@d-id/client-sdk`). Hantera STT sjaelva med webblaesarens inbyggda Web Speech API (som stodjer `sv-SE`), och anvand `agentManager.speak()` for att mata avataren med OpenClaw-svar.

```mermaid
sequenceDiagram
    participant User
    participant Browser as "Web Speech API (sv-SE)"
    participant Widget as "React Widget"
    participant Vercel as "/api/did/chat"
    participant OpenClaw as "OpenClaw (Render)"
    participant DID as "D-ID Avatar (SDK)"

    User->>Browser: Talar svenska
    Browser->>Widget: onresult: transkriberad text
    Widget->>Vercel: POST {message, sessionId, formContext}
    Vercel->>OpenClaw: POST /v1/chat/completions
    OpenClaw-->>Vercel: Svar (SSE)
    Vercel-->>Widget: Svar-text
    Widget->>DID: agentManager.speak(svarText)
    DID-->>User: Avatar talar + animerar
```



## Foerdelar vs nuvarande loesning

- **STT**: Web Speech API stodjer `sv-SE` nativt - kringgaar D-IDs trasiga STT
- **Hjaerna**: OpenClaw behaalls som LLM (flyttkunskap, formulaerkontext, verktygsanrop)
- **Avatar**: D-ID renderar video + TTS som vanligt via speak()
- **Text-chat**: Behaalls parallellt (skriver i widget -> samma endpoint -> OpenClaw)
- **D-ID-agent**: Kan seattas tillbaka till `provider: "openai"` (eller helt utan LLM) since vi aldrig anvander D-IDs LLM-pipeline laengre

## Nyckelfiler att aendra

### 1. Installera D-ID Client SDK

```bash
npm install @d-id/client-sdk
```

### 2. Ersaett embed-widget med SDK-widget

Skriv om [components/did-openclaw-bridge-widget.tsx](components/did-openclaw-bridge-widget.tsx):

- Ta bort `<Script src="https://agent.d-id.com/v2/index.js" .../>` embed-scriptet
- Importera `@d-id/client-sdk`
- Skapa `agentManager` med `createAgentManager()`
- Rendera ett `<video>` element for avataren
- Laegg till Web Speech API (`SpeechRecognition`) for svenska STT
- Nar STT ger text: skicka till `/api/did/chat` -> faa svar -> `agentManager.speak(svar)`
- Behall befintlig form-blur-tracking och form_sync-logik

### 3. Uppdatera `/api/did/chat` endpoint

[app/api/did/chat/route.ts](app/api/did/chat/route.ts) behoever:

- Fortsaetta hantera `field_blur` och `form_sync` (redan klart)
- For chat-meddelanden: skicka till OpenClaw, returnera svar som JSON (inte SSE, since widgeten laeser det direkt)
- Ingen foraendring i OpenClaw-logiken

### 4. D-ID agent config

Byt tillbaka agenten till `provider: "openai"` (eller ta bort LLM helt) since vi anvander `speak()` mode istallet for Custom LLM. D-ID behoever bara hantera TTS + avatar.

### 5. CSP-headers

[next.config.mjs](next.config.mjs) har redan raett CSP for D-ID domaner. Inga aendringar behoevs.

## Risker och begaensningar

- **Web Speech API**: Stods i Chrome, Edge, Safari. Firefox har begransat stod. Fallback: text-input.
- **speak() vs chat()**: `speak()` gor att avataren saeger texten men konversationshistoriken haanteras inte av D-ID. Vi haanterar historik sjaelva i session-store (redan implementerat).
- **Latens**: En extra round-trip (browser -> Vercel -> OpenClaw -> Vercel -> browser -> D-ID speak). Bor vara acceptabelt med SSE streaming.

