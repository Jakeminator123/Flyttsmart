# Agentplan 06 - Efterflode, dashboard, checklista och jamforelser

> Den har planen ager allt som ska ge tydligt varde efter att flytten ar registrerad: dashboard, AI-checklista, paminnelser, jamforelser och uppfoljning.

---

## Syfte

Gora efterflodet till en verklig del av erbjudandet, inte bara en restyta efter adressandringen.

Det innebar att:

- checklistan blir ett tydligt vardelofte efter flytten
- jamforelser och forslag kommer i ratt fas
- dashboarden binder ihop status, nasta steg och uppfoljning
- paminnelser och uppfoljning kanns nyttiga i stallet for storsande

---

## Malbild

Nar denna plan ar klar ska anvandaren efter registrerad flytt kunna:

- se vad som ar klart
- forsta vad som ar nasta steg
- fa tydlig checklista
- fa relevanta jamforelser efter flytten, inte for tidigt
- uppleva att `flytt.io` levererar verkligt eftervarde

---

## Agentens ansvar

Agenten far:

- bygga om eller forbattra `dashboard`
- definiera hur checklista presenteras och uppdateras
- styra var och nar compare-sparet ska synas
- forbattra paminnelser, uppfoljning och relaterade adminytor
- koordinera hur AI-varde uttrycks efter flytten

Agenten far inte:

- skriva om SKV- och QR-arkitekturen
- skriva om OpenClaw- eller DID-gateway
- skriva om startsidans marknadsytor
- ta over huvudansvaret for adressflodets stegsekvens

---

## Primart filagarskap

- `app/dashboard/page.tsx`
- `app/api/move/route.ts`
- `app/api/checklist/template/route.ts`
- `app/api/compare/[taskKey]/route.ts`
- `app/api/cron/reminders/route.ts`
- `app/api/admin/comparisons/config/route.ts`
- `app/admin/comparisons/page.tsx`
- `components/checklist-view.tsx`
- `components/move-timeline.tsx`
- `lib/checklist/template.ts`
- `lib/comparison/compare.ts`
- `lib/comparison/elarea.ts`
- `lib/comparison/providers/broadband.ts`
- `lib/comparison/providers/electricity.ts`
- `lib/comparison/providers/local-services.ts`
- `lib/aida/explicit-web-search.ts`
- `lib/aida/direct-suggestion.ts`
- `lib/email/send.ts`
- `app/api/email/send/route.ts`

---

## Filer som far lasas men inte agas

- `app/adressandring/page.tsx`
- `components/skatteverket-guide.tsx`
- `components/openclaw-chat-widget.tsx`
- `components/did-openclaw-bridge-widget.tsx`
- `app/api/openclaw/chat/route.ts`
- `app/api/skv/int7/start/route.ts`

---

## Do not touch

- `app/page.tsx`
- `components/hero-section.tsx`
- `app/api/skv/**` utover sma integrationsbehov som samordnas
- `inlogg/**`
- `claw/**` utover dokumenterade konsumtionskontrakt

---

## Viktiga gransdragningar

- Denna plan ager eftervardet, inte forsta konverteringen.
- Jamforelser ska komma efter flytten, inte dra isar huvudresan.
- Om `OpenClaw` ska hjalpa i dashboarden far agenten definiera visningsyta och kontrakt, men inte bygga om agentplattformen.

---

## Beroenden

Harda beroenden:

- `AGENTPLAN-03-ADRESSANDRINGSFLODE-OCH-STEGSEKVENS.md`

Mjuka beroenden:

- `AGENTPLAN-04-BANKID-SKV-OCH-QR-SPARET.md`
- `AGENTPLAN-05-OPENCLAW-OCH-DID-AGENTEN.md`

---

## Konfliktpunkter

- `app/dashboard/page.tsx`
- `app/api/move/route.ts`
- `components/checklist-view.tsx`
- `components/skatteverket-guide.tsx`
- compare- och promptberoenden som kan nuddas av OpenClaw

---

## Testkrav

Agenten ska verifiera:

- att dashboarden har tydlig informationshierarki
- att checklistan fungerar som huvudsakligt eftervarde
- att compare-sparet inte visas for tidigt eller for aggressivt
- att paminnelser och uppfoljning hanger ihop med flyttstatus
- att dashboarden fungerar aven om vissa integrationsdelar ar ofullstandiga

---

## Definition of done

Planen ar klar nar:

- efterflodet star pa egna ben som tydligt produktvarde
- dashboard, checklista och jamforelser har tydlig ansvarsfordelning
- gransen mot BankID och OpenClaw ar tydlig
- senare implementation inte behover gissa nar eftervardet ska visas eller hur det ska prioriteras
