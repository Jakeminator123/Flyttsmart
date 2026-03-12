# Agentplan 05 - OpenClaw och DID-agenten

> Den har planen ager AI-lagret i nya `flytt.io`: `OpenClaw` som backendhjarna och `DID`-agenten som visuellt guidelager och hjalpare genom resan.

---

## Syfte

Tydliggora hur AI faktiskt ska fungera i produkten:

- `OpenClaw` som intelligenslager, spegling, logik och svarsmotor
- `DID` som visuell guide nar anvandaren behover hjalp
- en tydlig skillnad mellan "backendhjarna" och "ansikte utat"

---

## Malbild

Nar denna plan ar klar ska det vara tydligt:

- var AI kommer in i resan
- vilken roll `OpenClaw` har pa startsida, i adressflode och pa dashboard
- vilken roll `DID` har om anvandaren behover guidning
- hur prompts, site access och handoff mellan delar ska fungera

---

## Agentens ansvar

Agenten far:

- justera eller definiera `OpenClaw`-gateway och mirror-beteende
- forbattra prompt- och accesslogik
- definiera nar och hur chat/widget/guide ska visas
- separera ansvarsrollerna mellan `OpenClaw` och `DID`
- justera admin- och driftpunkter som direkt hor till detta agentlager

Agenten far inte:

- bygga om startsidans sektioner
- bygga om hela adressflodets UX
- bygga om BankID- eller SKV-lagret
- ta agarskap over compare- eller checklistelogik utom dar OpenClaw uttryckligen konsumerar den

---

## Primart filagarskap

- `app/api/did/chat/route.ts`
- `app/api/openclaw/chat/route.ts`
- `app/api/openclaw/access/route.ts`
- `app/api/openclaw/health/route.ts`
- `app/api/openclaw/webhook/route.ts`
- `app/api/admin/openclaw/config/route.ts`
- `app/api/admin/openclaw/readiness/route.ts`
- `app/api/admin/openclaw/redeploy/route.ts`
- `app/api/admin/openclaw/events/route.ts`
- `app/api/admin/openclaw/automation/route.ts`
- `app/api/admin/openclaw/automation/test-candidate/route.ts`
- `app/api/admin/did/config/route.ts`
- `app/admin/did/page.tsx`
- `app/admin/openclaw/page.tsx`
- `components/did-openclaw-bridge-widget.tsx`
- `components/openclaw-chat-widget.tsx`
- `hooks/use-openclaw-mirror.ts`
- `lib/openclaw/response.ts`
- `lib/openclaw/server-config.ts`
- `lib/admin/openclaw-events.ts`
- `lib/did/session-store.ts`
- `claw/config/agents/aida-flyttagent/agent/IDENTITY.md`
- `claw/config/openclaw.json.example`
- `claw/DEPLOY_INFO.txt`
- `claw/Dockerfile`
- `claw/render.yaml`
- `claw/docker-entrypoint.sh`
- `claw/docker-healthcheck.sh`
- `docs/OPENCLAW.md`
- `docs/DID-OPENCLAW-INTEGRATION.md`

---

## Filer som far lasas men inte agas

- `app/page.tsx`
- `app/adressandring/page.tsx`
- `app/dashboard/page.tsx`
- `hooks/use-autofill.tsx`
- `lib/comparison/**`
- `lib/checklist/template.ts`

---

## Do not touch

- `app/api/skv/**`
- `components/bankid-qr-mirror.tsx`
- `inlogg/**`
- `components/hero-section.tsx`
- `components/trust-section.tsx`
- `components/cta-section.tsx`

---

## Viktiga gransdragningar

- Denna plan ager AI-beteende och agentskikt, inte hela produktens UI.
- Om widgetplacering eller visningslogik maste andras i sida-filer ska det goras sa litet som mojligt och i samrad med respektive planagare.
- Om `OpenClaw` konsumerar compare- eller checklistedata far agenten beskriva kontraktet, men ska inte ensam ta over de domansparen.

---

## Beroenden

Mjuka beroenden:

- `AGENTPLAN-02-PUBLIK-STARTSIDA-OCH-MARKNADSYTOR.md`
- `AGENTPLAN-03-ADRESSANDRINGSFLODE-OCH-STEGSEKVENS.md`
- `AGENTPLAN-06-EFTERFLODE-DASHBOARD-CHECKLISTA-OCH-JAMFORELSER.md`

Arbetsordning:

- kan starta nar produktresans huvudriktning ar tillrackligt tydlig
- bor synkas innan dashboardens slutliga AI-ytor spikas

---

## Konfliktpunkter

- `app/layout.tsx`
- `app/page.tsx`
- `app/adressandring/page.tsx`
- `app/dashboard/page.tsx`
- `hooks/use-autofill.tsx`
- `lib/openclaw/server-config.ts` dar compare- och accessdata motas

---

## Testkrav

Agenten ska verifiera:

- att rollerna mellan `OpenClaw` och `DID` ar tydliga
- att chat- och mirror-floden fortfarande hanger ihop
- att admin- och driftvyer for agentlagret ar begripliga
- att site access och promptlogik inte bryter beroenden mot compare eller checklista

---

## Definition of done

Planen ar klar nar:

- `OpenClaw` och `DID` har tydligt separerade roller
- AI-ytorna har en dokumenterad plats i produktresan
- andra agenter vet vilka integration points de ska anropa eller visa
- inga centrala produktbeslut langre ar oklara i agentlagret
