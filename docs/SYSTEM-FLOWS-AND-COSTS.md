# Flytt.io / Aida — Systemflöden, API:er och kostnader

Datum: 2026-03-04

---

## 1. Översikt: Vad triggar vad?

```
Användare skriver i chatten
  │
  ├─ Hälsning ("hej") ──────────────────────────► Lokalt svar (gratis, ingen API)
  ├─ Sajt-fråga ("vad kan jag göra här") ───────► Lokalt svar (gratis)
  ├─ Explicit websök ("sök på nätet X") ────────► Brave Search → OpenAI summering
  ├─ Autofill ("fyll i Jakob i förnamn") ───────► Lokalt regex-match (gratis)
  │
  ├─ Simple intent ("vad är fastighetsbeteckning")
  │     └─ Ingen enrichment → OpenClaw gateway (billig modell)
  │
  ├─ Comparison intent ("jämför elavtal")
  │     ├─ Enrichment (PAP, Nominatim, Eniro, SCB, personnummer)
  │     ├─ Jämförelse-prefetch (API eller OpenAI web_search)
  │     └─ OpenClaw gateway (kraftfull modell)
  │
  └─ General intent (allt annat)
        ├─ Enrichment (PAP, Nominatim, Eniro, SCB, personnummer)
        └─ OpenClaw gateway (kraftfull modell)
```

---

## 2. Alla flöden i detalj

### 2.1 Lokala interceptors (Vercel — gratis, ingen extern API)

| Interceptor | Trigger | Provider-tag | Kostnad |
|---|---|---|---|
| Hälsning | "hej", "tjena", "hallå" etc. | `did-local-greeting` | **0 kr** |
| Sajt-fråga | "vad kan jag göra här" etc. | `did-local-capabilities` | **0 kr** |
| Autofill | "fyll i X i Y" / "mitt förnamn är X" | `did-local-autofill` | **0 kr** |

Dessa körs **innan** något skickas till OpenClaw eller OpenAI. Svarstid: <100ms.

---

### 2.2 Explicit webbsökning (Brave-first)

| Steg | API | Vem betalar | Kostnad per anrop |
|---|---|---|---|
| 1. Trigger-detektion | Lokal regex | — | **0 kr** |
| 2. Brave Search | `api.search.brave.com` | Vercel → Brave | **Gratis** (2000 sökn/mån i free tier, sedan ~$0.003/sök) |
| 3. Sammanfatta resultat | OpenAI `gpt-4.1-mini` chat completion | Vercel → OpenAI | **~$0.001-0.003** (~500 input + 200 output tokens) |
| Fallback (om Brave saknas) | OpenAI Responses + `web_search` tool | Vercel → OpenAI | **~$0.01-0.03** (dyrare, input+output+tool-tokens) |

**Trigger**: Användaren skriver "sök på nätet", "googla", "web searcha" etc.
**Env som krävs (Vercel)**: `BRAVE_API_KEY`, `OPENAI_API_KEY`
**Provider-tag**: `did-local-web-search` / `openclaw-local-web-search`
**Svarstid**: ~7-10s

---

### 2.3 Enrichment-pipeline (körs automatiskt vid "general" och "comparison" intent)

Enrichment sker **server-side på Vercel** i `lib/aida/enrich.ts`. Resultatet stoppas in i systemprompten som skickas till OpenClaw. Dessa API:er anropas INTE av OpenClaw/Render.

| Datakälla | API-endpoint | Trigger | Env-variabel | Kostnad |
|---|---|---|---|---|
| **PAP** (postnr→ort) | `api.papapi.se/lite/` | `fromPostal` eller `toPostal` finns | `PAP_API_KEY` | **Gratis** (gratisplan) |
| **Nominatim** (adressvalidering) | `nominatim.openstreetmap.org/search` | `toStreet` eller `fromStreet` finns | `NOMINATIM_ENABLED` (default: on) | **Gratis** (öppen data, max 1 req/s) |
| **Eniro** (företagssök) | `api.eniro.com/cs/search/basic` | `toCity` finns (alltid 3 sök: matbutik, vårdcentral, apotek) | `ENIRO_API_KEY` | **Gratis** (trial, bara företag) |
| **SCB** (befolkningsdata) | `statistikdatabasen.scb.se/api/v2/` | `toCity` finns + `SCB_ENABLED=y` | `SCB_ENABLED` | **Gratis** (öppen data) |
| **Personnummer-scraper** | `RATSIT_SCRAPER_URL/lookup` via `/api/enrich/person` | Personnummer i meddelande eller formulär, namn/adress saknas | `RATSIT_SCRAPER_URL`, `ENRICH_API_SECRET` | **Gratis** (egen Render-tjänst) |
| **Personnummer-parsing** | Lokal (ingen API) | Personnummer finns | — | **0 kr** |

**Viktigt**: Enrichment körs vid **varje** chattmeddelande som klassas som "general" eller "comparison". Vid "simple" intent (hälsning, fältfråga) hoppas enrichment över.

**Total kostnad per enrichment-runda**: **0 kr** (alla API:er är gratis/öppen data/egen tjänst).

---

### 2.4 Jämförelse-prefetch (körs vid "comparison" intent)

Hanteras i `lib/comparison/compare.ts`. Varje jämförelseuppgift kan köras i tre lägen: `api` (gratis dedikerat API), `web_search` (OpenAI web search), eller `stub` (inga live-data).

| Jämförelse | Läge | Externt API | Kostnad per anrop |
|---|---|---|---|
| **Elavtal** (`electricity_contract`) | `api` | elprisetjustnu.se (spotpriser) | **Gratis** |
| **Bredband** (`broadband_order_install`) | `api` | PTS data (lokal JSON) + PAP | **Gratis** |
| **Flyttfirma** (`movers_or_trailer`) | `api` | Eniro företagssök | **Gratis** (trial) |
| **Flyttstädning** (`cleaning_service`) | `api` | Eniro företagssök | **Gratis** (trial) |
| **Hemförsäkring** (`home_insurance`) | `web_search` | OpenAI Responses + `web_search` tool | **~$0.01-0.03** |
| Magasinering (`storage_gap`) | `stub` | — | **0 kr** |
| Bredbandsteknik (`broadband_tech_check`) | `stub` | — | **0 kr** |
| Eftersändning (`mail_forwarding`) | `stub` | — | **0 kr** |

**Krav**: `WEB_SEARCH_COMPARE=y` i env för att web_search-uppgifter ska köras (annars faller de tillbaka till stub).
**Modell**: `COMPARE_MODEL` (default: `gpt-4.1-mini`)
**Env som krävs (Vercel)**: `OPENAI_API_KEY`, `WEB_SEARCH_COMPARE`, `COMPARE_TASKS_ENABLED`, `PAP_API_KEY`, `ENIRO_API_KEY`

---

### 2.5 OpenClaw Gateway (Render)

Alla meddelanden som inte fångas av lokala interceptors skickas till OpenClaw gateway på Render.

| Aspekt | Detalj |
|---|---|
| **URL** | `https://openclaw-aida.onrender.com/v1/chat/completions` |
| **Auth** | `Authorization: Bearer OPENCLAW_GATEWAY_TOKEN` |
| **Modell (simple)** | `openai/gpt-4.1-mini` (~$0.001-0.005/anrop) |
| **Modell (general/comparison)** | `openai/gpt-5.1-codex` (~$0.01-0.05/anrop) |
| **Fallback-modell** | `openai/gpt-5.3-codex` |
| **Timeout** | `OPENCLAW_CHAT_TIMEOUT_MS` (90 000ms = 90s) |
| **Kostnad** | OpenAI-tokens via `OPENAI_API_KEY` på Render |

OpenClaw gateway vidarebefordrar till OpenAI med din nyckel. Det är den **enda** token-tunga kostnaden — systemprompten med all enrichment-data kan vara 2000-5000 tokens, plus användarhistorik och svar.

**Uppskattning per meddelande**:
- Simple: ~1000 tokens totalt → **~$0.001**
- General (med enrichment): ~4000-6000 tokens totalt → **~$0.01-0.03**
- Comparison (med enrichment + jämförelsedata): ~6000-10000 tokens → **~$0.02-0.05**

---

### 2.6 Keepalive-cron

| Aspekt | Detalj |
|---|---|
| **Route** | `/api/cron/keepalive` |
| **Schema** | `*/14 * * * *` (var 14:e minut) |
| **Pingar** | openclaw-aida `/health`, rats_meri_docker_scraper `/health`, skv-playwright `/api/health` |
| **Vercel-kostnad** | ~103 serverless invocations/dag, ~3100/mån → **försumbar** |
| **Render-kostnad** | Håller 3 tjänster vakna → förbrukar fria timmar snabbare (se nedan) |

---

## 3. Kostnadsöversikt per plattform

### Vercel (frontend + API-routes)

| Post | Volym/mån (uppskattning) | Kostnad |
|---|---|---|
| Serverless invocations | ~10 000 (chat + cron + enrichment) | **Ingår i plan** (1M/mån på Pro) |
| Bandwidth | ~5 GB | **Ingår** |
| Cron jobs | 2 st (reminders + keepalive) | **Ingår** |
| **Total Vercel** | | **$0** (extra utöver plan) |

### OpenAI (via Vercel — direkt)

| Post | Per anrop | Volym/mån | Kostnad/mån |
|---|---|---|---|
| Brave-sammanfattning (gpt-4.1-mini) | ~$0.002 | ~200 | **~$0.40** |
| Jämförelse web_search (home_insurance) | ~$0.02 | ~50 | **~$1.00** |
| **Total OpenAI direkt** | | | **~$1.40** |

### OpenAI (via Render/OpenClaw)

| Post | Per anrop | Volym/mån | Kostnad/mån |
|---|---|---|---|
| Simple-meddelanden (gpt-4.1-mini) | ~$0.001 | ~500 | **~$0.50** |
| General/comparison (gpt-5.1-codex) | ~$0.03 | ~300 | **~$9.00** |
| **Total OpenClaw→OpenAI** | | | **~$9.50** |

### Render

| Tjänst | Plan | Kostnad/mån |
|---|---|---|
| openclaw-aida | Starter/Standard | **$7-25** |
| rats_meri_docker_scraper | Free/Starter | **$0-7** |
| skv-playwright | Standard | **$7-25** |
| **Total Render** | | **~$14-57** |

### Externa API:er (gratis)

| API | Kostnad |
|---|---|
| PAP (postnummer) | Gratis |
| Nominatim/OSM | Gratis (öppen data) |
| Eniro (trial) | Gratis (företagssök) |
| SCB | Gratis (öppen data) |
| Brave Search | Gratis (2000/mån), sedan ~$3/1000 sök |
| elprisetjustnu.se | Gratis |

---

## 4. Env-matris: Vad behövs var?

### Vercel (alla 3 miljöer: dev/preview/prod)

| Variabel | Används av | Status |
|---|---|---|
| `OPENAI_API_KEY` | Brave-sammanfattning, jämförelser, validering | OK alla 3 |
| `BRAVE_API_KEY` | Explicit webbsökning | OK alla 3 |
| `PAP_API_KEY` | Postnummer→ort enrichment | OK alla 3 |
| `ENIRO_API_KEY` | Företagssök enrichment | OK alla 3 |
| `ENRICH_API_SECRET` | Server→server auth personnummer-proxy | OK alla 3 |
| `RATSIT_SCRAPER_URL` | Personnummer-scraper URL | OK alla 3 |
| `OPENCLAW_GATEWAY_URL` | OpenClaw gateway | OK alla 3 |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway bearer token | OK alla 3 |
| `OPENCLAW_AGENT_ID` | Agent-id | OK alla 3 |
| `OPENCLAW_CHAT_TIMEOUT_MS` | Gateway timeout (90s) | OK alla 3 |
| `OPENCLAW_CHAT_MODEL` | Modell för general/comparison | OK alla 3 |
| `OPENCLAW_CHAT_MODEL_SIMPLE` | Modell för simple intent | OK alla 3 |
| `WEB_SEARCH_COMPARE` | Master-switch för jämförelse-websök | OK alla 3 |
| `COMPARE_TASKS_ENABLED` | Vilka jämförelser som är aktiva | OK alla 3 |
| `SCB_ENABLED` | SCB befolkningsdata | OK alla 3 |
| `DID_BRIDGE_SECRET` | D-ID avatar auth | OK alla 3 |
| `SKV_SERVICE_URL` | SKV Playwright keepalive | OK alla 3 |
| `NOMINATIM_ENABLED` | Nominatim on/off (default: true) | Ej satt = default on |

### Render: openclaw-aida (9 variabler)

| Variabel | Värde | Används av |
|---|---|---|
| `OPENAI_API_KEY` | `sk-proj-...` | OpenClaw→OpenAI LLM-anrop |
| `OPENCLAW_GATEWAY_TOKEN` | `a2911c42...` | Auth från Vercel |
| `OPENCLAW_GATEWAY_PORT` | `10000` | Render kräver 10000 |
| `OPENCLAW_GATEWAY_BIND` | `lan` | Lyssna på alla interfaces |
| `OPENCLAW_MODEL_PRIMARY` | `openai/gpt-5.1-codex` | Huvudmodell |
| `OPENCLAW_MODEL_FALLBACK` | `openai/gpt-5.3-codex` | Reservmodell |
| `OPENCLAW_CONTROLUI_DISABLE_DEVICE_AUTH` | `true` | Inget pairing-krav |
| `OPENCLAW_ALLOW_INSECURE_CONTROLUI` | `true` | Krävs för ovan |
| `BRAVE_API_KEY` | `BSAsUY-...` | OpenClaw `web_search` tool |

### Render: rats_meri_docker_scraper (1 variabel)

| Variabel | Värde |
|---|---|
| `PORT` | `10000` |

### Render: skv-playwright (6 variabler)

| Variabel | Värde |
|---|---|
| `PORT` | `10000` |
| `SKV_HEADLESS` | `y` |
| `SKV_HOST` | `0.0.0.0` |
| `SKV_API_KEY` | `1f88ca45...` |
| `SKV_SERVICE_URL` | `https://skv-playwright.onrender.com/` |
| `CLONE_QR_FROMPLAYWRIGHT_TO_SITE` | `y` |

---

## 5. Flödes-sammanfattning per meddelandetyp

| Vad användaren gör | Klassificering | Enrichment? | Extern API-kostnad | Typisk svarstid |
|---|---|---|---|---|
| "Hej" | greeting | Nej | 0 kr | <1s |
| "Vad är fastighetsbeteckning?" | simple | Nej | ~$0.001 (gateway) | 3-5s |
| "Fyll i Jakob i förnamn" | autofill | Nej | 0 kr | <1s |
| "Sök på nätet om X" | explicit-web-search | Nej | ~$0.002 (Brave+summering) | 7-10s |
| "Kolla personnummer 19860528-0299" | general | Ja (PAP, Nominatim, Ratsit) | ~$0.03 (gateway) | 30-45s |
| "Jämför elavtal" | comparison | Ja (allt) + jämförelse-prefetch | ~$0.03-0.05 (gateway+ev. websök) | 40-70s |
| "Vilka butiker finns nära nya adressen?" | general | Ja (Eniro, PAP) | ~$0.03 (gateway) | 30-60s |
