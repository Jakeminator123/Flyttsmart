# Forenkling av flyttanmalan -- 2026-02-23

## Sammanfattning

Stor forenkling av flyttanmalan-flodet. Tog bort data-QR-sparet (appens egna QR-handoff),
centraliserade autofyll-logik i en orchestrator-hook, och rensade overlappande submit/bekraftelse-logik.
SKV-int7/BankID-QR fran Docker/Playwright oforandrat.

---

## Borttaget

### Data-QR-flodet (helt borttaget)

Appens eget QR-system som genererade en HMAC-signerad QR-kod med formulardata
for desktop->mobil-handoff. Anledning: overflodigt, skapade forvirring med BankID-QR.

**Raderade filer:**
- `app/api/qr/generate/route.ts` -- QR-generation med qrcode-lib
- `app/api/qr/decode/route.ts` -- HMAC-verifiering och avkodning
- `lib/qr/encode.ts` -- HMAC-signering och URL-byggare
- `lib/qr/decode.ts` -- URL-parser
- `components/qr-scanner.tsx` -- Kamera-baserad QR-scanner (BarcodeDetector API)
- `components/qr-display.tsx` -- QR-visningskomponent med download/copy

**Rensat fran sidor:**
- `app/adressandring/page.tsx` -- QrScanner, generateMobileQr, mobileQrImage/Url, sessionStorage-prefill, data-QR i steg 5 och success-vy
- `app/dashboard/page.tsx` -- QR-flik borttagen (4->3 flikar), handleGenerateQr
- `app/start/page.tsx` -- Ersatt med enkel "lanken ar inte langre aktiv"-redirect
- `app/demo/page.tsx` -- QR-generering ersatt med sessionStorage-prefill

### AI-checklista (ersatt av mall)

- `app/api/ai/checklist/route.ts` -- Raderad (anvande GPT-4o, ~$0.02/anrop)
- `CHECKLIST_SYSTEM` prompt i `lib/ai/prompts.ts` -- Raderad
- Ersatt av `app/api/checklist/template/route.ts` + `lib/checklist/template.ts` (deterministisk, gratis)

### Oanvand logik

- `bankIdQrOnlyVisible` state -- Anvandes bara for data-QR vs BankID-forgrening
- `cloneQrToSiteEnabled` state i adressandring -- Sattes men listes aldrig
- `qrPrefilled` state -- Badge-visning for QR-ifyllt
- `isMobile` state -- Anvandes for QR-scanner vs desktop-kort
- OpenClaw-eventtyper `qr_scan`, `checklist_generated`, `tab_change` -- Oanvanda

---

## Tillagt

### Autofill Orchestrator

Ny central hook som samlar all autofyll-logik:

- `lib/autofill/config.ts` -- Konfiguration med per-kalla env-toggles
- `hooks/use-autofill.tsx` -- Hook med queueSuggestion/accept/dismiss/render

Se `docs/AUTOFILL-ORCHESTRATOR.md` for fullstandig dokumentation.

### Debug-logging

`NEXT_PUBLIC_AUTOFILL_DEBUG=true` loggar varje suggestion-handling i browser console
med kalla, falt, varde och utfall.

### Aida utokade verktyg

System-prompten for OpenClaw-chatten (`/api/openclaw/chat`) utokad med:
- Jamforelsekunskap (el, bredband, hemforsakring, flyttfirmor)
- Lokala tips baserat pa toCity
- Proaktivt beteende (erbjuder hjalp nar den ser tomma falt)

### Battre felhantering vid submit

- `submitError` state med synligt felmeddelande i steg 5
- `mirrorSubmit` anropas nu EFTER lyckad persist (inte fore)
- `moveDate`-validering konsoliderad till `generateChecklist()` (en plats)

### Hydration-fix

`typeof window !== "undefined"` ersatt med `isDevMode` state + `useEffect`
for att undvika SSR/klient-mismatch.

---

## Oforandrat (bevarade system)

### SKV-int7 / BankID-QR (Docker/Playwright)

Hela kedjan oforandrad:
- `app/api/skv/int7/start/route.ts` -- Startar lokal Python eller remote Render-tjanst
- `app/api/skv/clone/state/[jobId]/route.ts` -- Proxy for job-status
- `app/api/skv/clone/qr/[jobId]/route.ts` -- Proxy for QR-bild
- `components/bankid-qr-mirror.tsx` -- Pollar och visar BankID-QR
- `lib/skv/config.ts` + `lib/skv/payload.ts` -- Config och payload-normalisering

SKV-int7 atkomlig via dashboard > Skatteverket-flik.

### OpenClaw-integration

Webhook-mirroring och chat-proxy oforandrade:
- `hooks/use-openclaw-mirror.ts`
- `app/api/openclaw/webhook/route.ts`
- `app/api/openclaw/chat/route.ts` (system-prompt utokad, se ovan)
- `components/openclaw-chat-widget.tsx`

### Checklist-mall

- `app/api/checklist/template/route.ts`
- `lib/checklist/template.ts` -- 23 uppgifter i 7 sektioner, datumbaserade deadlines
