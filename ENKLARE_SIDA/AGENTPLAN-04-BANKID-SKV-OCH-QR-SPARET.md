# Agentplan 04 - BankID, SKV och QR-sparet

> Den har planen ager verifierings- och myndighetssparet i nya `flytt.io`: BankID, Skatteverket, QR-mirroring, payload-hantering och tillhorande driftspunkter.

---

## Syfte

Sakra en tydlig och robust strategi for:

- nar och hur `BankID` kommer in
- hur `Skatteverket`-flodet startas
- hur QR pa desktop fungerar i test- och overgangslosningar
- vilken fallback som galler om full autoifyllning inte gar

---

## Malbild

Nar denna plan ar klar ska produktteamet ha en tydlig specifikation och implementerbar riktning for myndighetssparet, utan att blanda ihop det med copy, startsida eller AI-lager.

---

## Agentens ansvar

Agenten far:

- forbattra eller strukturera SKV-start, status och payload-floden
- definiera QR-strategin for desktop
- arbeta med tekniken kring klonad QR och framtida officiell losning
- strukturera admin- och driftpunkter som hor till detta spar
- sakersalla att fallbackvagar ar tydliga

Agenten far inte:

- skriva om startsidans marknadsytor
- skriva om hela adressflodets UX
- skriva om OpenClaw- eller DID-arkitektur
- ta over dashboardens hela efterflodeslogik

---

## Primart filagarskap

- `app/api/skv/int7/start/route.ts`
- `app/api/skv/int7/status/[jobId]/route.ts`
- `app/api/skv/int7/payload/[jobId]/route.ts`
- `app/api/skv/clone/qr/[jobId]/route.ts`
- `app/api/skv/clone/state/[jobId]/route.ts`
- `app/api/skv/clone/proxy-helpers.ts`
- `app/api/skv/payload/route.ts`
- `app/api/skv/config/route.ts`
- `app/admin/skv/page.tsx`
- `app/api/admin/skv/runs/route.ts`
- `app/api/admin/skv/stats/route.ts`
- `components/bankid-qr-mirror.tsx`
- `components/skatteverket-guide.tsx`
- `lib/skv/payload.ts`
- `lib/skv/config.ts`
- `lib/skv/run-tracker.ts`
- `schemas/skv/skv-source-data.schema.json`
- `inlogg/skv6.py`
- `inlogg/skv_core.py`
- `inlogg/int7/runner.py`
- `inlogg/formulär/flytt_form_filler.py`
- `inlogg/config.txt`
- `inlogg/Dockerfile`
- `inlogg/docker-compose.yml`

---

## Filer som far lasas men inte agas

- `app/adressandring/page.tsx`
- `app/dashboard/page.tsx`
- `app/api/move/route.ts`
- `components/bookmarklet-button.tsx`
- `components/checklist-view.tsx`

---

## Do not touch

- `app/page.tsx`
- `components/hero-section.tsx`
- `app/api/openclaw/**`
- `app/api/did/**`
- `components/did-openclaw-bridge-widget.tsx`
- `components/openclaw-chat-widget.tsx`
- `lib/comparison/**`

---

## Viktiga gransdragningar

- Denna plan ager verifiering och myndighetsintegration, inte den overgripande produktresan.
- Om delar av dashboarden maste justeras for att visa QR eller status far det goras snalt och endast runt integrationsytan.
- Om `app/adressandring/page.tsx` maste peka om till en ny overlamning ska det goras i samrad med Plan 03, inte som egen UX-ombyggnad.

---

## Beroenden

Harda beroenden:

- `AGENTPLAN-03-ADRESSANDRINGSFLODE-OCH-STEGSEKVENS.md`

Mjuka beroenden:

- `AGENTPLAN-05-OPENCLAW-OCH-DID-AGENTEN.md` om AI-guidning ska samspela med verifieringssteget
- `AGENTPLAN-06-EFTERFLODE-DASHBOARD-CHECKLISTA-OCH-JAMFORELSER.md` dar QR- och SKV-status exponeras i dashboard

---

## Konfliktpunkter

- `app/dashboard/page.tsx`
- `app/adressandring/page.tsx`
- `components/skatteverket-guide.tsx`
- `app/api/move/route.ts` indirekt via status- och overlamningsbehov
- eventuella delade databaselement for QR-token, run-tracking och move-koppling

---

## Testkrav

Agenten ska verifiera:

- att SKV-flodet kan startas stabilt
- att status- och payloadhantering ar begripliga
- att QR-visning pa desktop har en tydlig strategi
- att fallback finns nar full autoifyllning eller mirroring inte fungerar
- att admin- och driftpunkter fortfarande hanger ihop

---

## Definition of done

Planen ar klar nar:

- BankID-, SKV- och QR-spar har tydlig ansvarsfodelning
- test- och overgangslosning ar dokumenterad
- gransen mot adressflode och dashboard ar tydlig
- senare implementatörer slipper gissa hur verifieringssparet ska fungera
