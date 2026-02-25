# Flytt.io — Dokumentationsindex

Senast uppdaterad: 2026-02-25

## Dokumentation i `info/`

| Dokument | Innehall |
|---|---|
| [GDPR-HANDLINGSGUIDE-FLYTTIO.md](GDPR-HANDLINGSGUIDE-FLYTTIO.md) | Praktisk GDPR-guide: rattslig grund, samtycke, IP/geo, dataminimering, DPIA |
| [MINDMAP-API-LOGIK-FLYTTBLANKETT.md](MINDMAP-API-LOGIK-FLYTTBLANKETT.md) | Mermaid-mindmap: minsta indata, harledda falt, API-kallor, Skatteverkets 10 falt |
| [API-ROADMAP-FLYTTIO.md](API-ROADMAP-FLYTTIO.md) | Prioriterad API-lista i tre faser (nu/nasta/senare) med nytta, risk, kostnad |
| [FLYTTPLANERARE-KARTLAGGNING.md](FLYTTPLANERARE-KARTLAGGNING.md) | Var flyttplaneraren/jamforelselogiken lever i kodbasen, alla 23 moment |
| [flytta_nu_samlad_kunskap.txt](flytta_nu_samlad_kunskap.txt) | Samlad kunskap: produktide, SKV-formularanalys, API-strategier, juridik |

## Live-policysidor (kod)

| Sida | Fil |
|---|---|
| Integritetspolicy | `app/integritetspolicy/page.tsx` |
| Cookiepolicy | `app/cookiepolicy/page.tsx` |
| Anvandarvillkor | `app/anvandarvillkor/page.tsx` |
| Om Flytt.io | `app/om/page.tsx` |

## Arkitekturdokumentation i `docs/`

| Dokument | Innehall |
|---|---|
| `docs/DID-OPENCLAW-INTEGRATION.md` | D-ID avatar + OpenClaw relay-arkitektur |
| `docs/AUTOFILL-ORCHESTRATOR.md` | Autofill-flodet: PAP, suggestion-block, prioritering |
| `docs/AIda-agent.md` | Aidas persona, formularkontext, systemprompt |
| `docs/OPENCLAW.md` | OpenClaw-integration: webhooks, chat-proxy, access-bypass |
| `docs/CHANGELOG-2026-02-25-api-coverage-and-scb-v2.md` | SCB v2, DID autofill, API-karta, faltmatris |
| `docs/CHANGELOG-2026-02-23-forenkling.md` | Forenklingsrefactor |

## Cursor-regler (`.cursor/rules/`)

| Regel | Scope |
|---|---|
| `did-openclaw-architecture.mdc` | DID + OpenClaw widget, API-routes, libs |
| `openai-docs-mcp.mdc` | MCP-servrar for OpenAI, shadcn, Vercel |
| `document-architecture-changes.mdc` | Nar och hur man dokumenterar arkitekturandringar |

## Nyckelkodfiler for flyttplaneraren

| Fil | Roll |
|---|---|
| `lib/checklist/template.ts` | 23 moment med dayOffset, comparisonHints |
| `app/api/checklist/template/route.ts` | API: moveDate + toCity -> datumklar checklista |
| `components/checklist-view.tsx` | UI: progress, sektioner, jamforelsehints |
| `app/adressandring/page.tsx` (steg 4) | Formularflode: laddar och visar checklista |
| `app/api/move/route.ts` | Persistering till Turso |
| `app/api/cron/reminders/route.ts` | E-postpaminnelser for kommande moment |
| `hooks/use-openclaw-mirror.ts` | Event-spegling: compare_open/close till OpenClaw |
| `lib/aida/enrich.ts` | Proaktiv jamforelse + all API-berikning |
| `lib/aida/direct-suggestion.ts` | Autofill-parser for "fyll i X i Y" |

## Korsreferens: API -> dokument

| API | Status | Dokumentation |
|---|---|---|
| PAP | Aktiv | API-ROADMAP (Fas 1), MINDMAP (harledningskedja) |
| Nominatim | Aktiv | API-ROADMAP (Fas 1), MINDMAP (adressvalidering) |
| Eniro | Aktiv (trial) | API-ROADMAP (Fas 1+2), GDPR-guide (DPA) |
| SCB v2 | Aktiv | API-ROADMAP (Fas 1), MINDMAP (befolkning) |
| Elpris API | Planerad | API-ROADMAP (Fas 2), FLYTTPLANERARE (sektion 3) |
| Trafiklab | Planerad | API-ROADMAP (Fas 2), MINDMAP (framtid) |
| VALID API | Planerad | API-ROADMAP (Fas 3), MINDMAP (fastighetsbeteckning) |
| SPAR | Planerad | API-ROADMAP (Fas 3), GDPR-guide (tillstand + DPA) |
| PersonKontakt | Planerad | API-ROADMAP (Fas 3), GDPR-guide (DPA + andamal) |
