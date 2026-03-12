# Flytt.io - agentplaner for extern build

> Det har dokumentet delar upp framtida ombyggnad av `flytt.io` i tydliga arbetsplaner for externa agenter. Fokus ar planering, scope och agarskap. Ingen produktkod andras har.

---

## 1. Slutsats

Rekommenderad uppdelning ar:

- **6 MD-filer** for externa agenter
- **1 valfri extra MD-fil** om copy, content och juridik ska brytas ut som ett eget spar

Det betyder att vi bor jobba med:

1. en **masterplan** som beskriver malbilden
2. en **overgripande build-plan** som beskriver hur arbetet delas upp
3. **6 separata agentplaner** som varje extern agent faktiskt far som uppdrag

Det ar alltsa inte bara "tva planer". De tva forsta ar styrdokument. De sex senare ar genomforandeplaner.

---

## 2. Varfor 6 planer ar ratt niva

Sex planer ar tillrackligt fa for att vara hanterbara, men tillrackligt manga for att undvika att flera agenter samtidigt skriver i samma filer.

Den nuvarande sajten delar redan upp sig ganska naturligt i sex tekniska och produktmassiga spar:

- ett designsystem och globalt temalager
- en publik startsida och marknadsytor
- ett separat adressandringsflode
- ett separat BankID, SKV och QR-spar
- ett separat OpenClaw och DID-spar
- ett separat efterflode med dashboard, checklista och jamforelser

Om vi forsoker trycka ihop detta till 4 eller 5 planer blir minst ett av de har sparen for brett och far for manga konfliktpunkter.

---

## 3. Rekommenderade agentplaner

## Plan 1. Designsystem och tema

**Syfte**

Ersatta nuvarande Nordic Tech-uttryck med chefens visuella riktning: marin mork ton, mintgron accent, BankID-bla, lugnare premiumkansla och ny typografi.

**Primart filagarskap**

- `app/globals.css`
- `app/layout.tsx`
- `components/theme-provider.tsx`
- `components/ui/*`
- `components.json`
- `postcss.config.mjs`
- `lib/utils.ts`

**Ska fa andra**

- fargtokens
- typografi
- spacing- och ytriktning
- CTA- och badge-stilar
- ny grund for hero, kort, formular och trustytor

**Ska inte aga**

- innehallet pa startsidan
- steglogiken i `app/adressandring/page.tsx`
- BankID- eller OpenClaw-logik

**Delade konfliktpunkter**

- `app/globals.css` innehaller bade tokens och visst startside-specifikt effektlager
- `app/layout.tsx` paverkar global widget-montering och fonts pa alla sidor

**Beroenden**

- bor ga forst

---

## Plan 2. Publik startsida och marknadsytor

**Syfte**

Bygga om den publika upplevelsen sa att forsta sidan snabbare forklarar varde, leder vidare mot adressandring och kanns mer lik den riktiga `flytt.io` enligt chefens riktning.

**Primart filagarskap**

- `app/page.tsx`
- `components/hero-section.tsx`
- `components/hero-cinemagraph.tsx`
- `components/hero-wave-electrons.tsx`
- `components/hero-visual.tsx`
- `components/steps-section.tsx`
- `components/trust-section.tsx`
- `components/faq-section.tsx`
- `components/cta-section.tsx`
- `components/mobile-cta.tsx`
- `components/header.tsx`
- `components/site-footer.tsx`
- `components/logo.tsx`
- `app/om/page.tsx`
- `app/integritetspolicy/page.tsx`
- `app/anvandarvillkor/page.tsx`
- `app/cookiepolicy/page.tsx`
- `components/legal-page-layout.tsx`
- `public/media/videos/hero.mp4`
- `public/media/images/*`

**Ska fa andra**

- ny informationshierarki
- lugnare hero
- tydligare CTA till `/adressandring`
- mindre showiga animationer
- mer fortroende, mindre tech-demo

**Ska inte aga**

- globala tokens i `app/globals.css`
- steglogik eller datalogik i adressflodet
- OpenClaw-backend, DID, BankID eller dashboardlogik

**Delade konfliktpunkter**

- `components/header.tsx`
- `components/site-footer.tsx`
- `components/logo.tsx`
- `app/layout.tsx` om globala effekter eller widgets ska flyttas

**Beroenden**

- beroende av Plan 1 for nya tokens och typografi

---

## Plan 3. Adressandringsflode och stegsekvens

**Syfte**

Gora huvudresan kortare och smartare: tidig identifiering, fa manuella steg, bara komplettera det som saknas, och en tydligare vag mot klart resultat.

**Primart filagarskap**

- `app/adressandring/page.tsx`
- `schemas/forms/adressandring-form.schema.json`

**Narliggande beroenden som planen far konsumera men normalt inte aga**

- `hooks/use-autofill.tsx`
- `hooks/use-openclaw-mirror.ts`
- `components/checklist-view.tsx`
- `components/skatteverket-guide.tsx`
- `components/bookmarklet-button.tsx`
- `app/api/ai/validate/route.ts`
- `app/api/ai/autofill/route.ts`
- `app/api/checklist/template/route.ts`
- `app/api/move/route.ts`

**Ska fa andra**

- ny stegordning
- nytt fokus pa tidig anvandarinput
- tydligare validering
- mjukare overlamning till BankID, OpenClaw och efterflode

**Ska inte aga**

- `app/api/skv/**`
- `components/bankid-qr-mirror.tsx`
- `app/api/openclaw/**`
- `app/api/did/**`
- `components/did-openclaw-bridge-widget.tsx`
- `components/openclaw-chat-widget.tsx`
- `app/dashboard/page.tsx`

**Delade konfliktpunkter**

- `components/checklist-view.tsx`
- `app/api/checklist/template/route.ts`
- `app/api/move/route.ts`

**Beroenden**

- bor starta efter att Plan 1 och Plan 2 har satt visuell riktning
- maste vara stabil innan Plan 4 och Plan 6 kan slutforas

---

## Plan 4. BankID, SKV och QR-sparet

**Syfte**

Hantera hela identitets- och myndighetsspåret: start av SKV-flode, BankID-verifiering, QR-spegel for desktop, fallbacklogik och teknisk integrationsstabilitet.

**Primart filagarskap**

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
- `inlogg/formular/flytt_form_filler.py`
- `inlogg/config.txt`
- `inlogg/Dockerfile`
- `inlogg/docker-compose.yml`

**Ska fa andra**

- ett tydligt desktop-QR-spar
- en ren fallback om autoifyllning inte fungerar fullt ut
- mindre osakerhet mellan temporar klonad QR och framtida officiell losning

**Ska inte aga**

- full layout for `app/dashboard/page.tsx`
- startsidans copy eller visuell identitet
- OpenClaw- eller DID-logik

**Delade konfliktpunkter**

- `app/dashboard/page.tsx`
- `components/skatteverket-guide.tsx`
- `app/adressandring/page.tsx`
- datamodeller for SKV-runner och QR-token-hantering

**Beroenden**

- beroende av att Plan 3 satter stabilt move-flode och move-id
- kan ga parallellt med Plan 5 efter att grundkontrakt ar tydliga

---

## Plan 5. OpenClaw och DID-agenten

**Syfte**

Tydliggora rollerna: `OpenClaw` som backendhjarna och `DID`-agenten som visuellt guidelager. Den har planen styr hur AI kommer in tidigt och hur agentskiktet beter sig genom resan.

**Primart filagarskap**

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

**Ska fa andra**

- tydlig AI-roll i produkten
- battre koppling mellan startsida, adressflode och dashboard
- tydlig separation mellan backend-intelligens och visuell guide

**Ska inte aga**

- full ombyggnad av `app/adressandring/page.tsx`
- SKV- eller QR-logik
- dashboardens hela efterflodesstruktur

**Delade konfliktpunkter**

- `app/layout.tsx`
- `app/page.tsx`
- `app/adressandring/page.tsx`
- `app/dashboard/page.tsx`
- `hooks/use-autofill.tsx`
- compare-beroenden i `lib/openclaw/server-config.ts`

**Beroenden**

- bor synkas med Plan 3 om tidig AI-hjalp ska in i huvudflodet
- bor synkas med Plan 6 eftersom prompts och site access kan bero pa jamforelsespar

---

## Plan 6. Efterflode: dashboard, checklista och jamforelser

**Syfte**

Starka upp allt som kommer efter registrerad flytt: AI-checklista, uppfoljning, paminnelser, compare-sparet och dashboard som faktiskt levererar vardet efter att flytten ar registrerad.

**Primart filagarskap**

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

**Ska fa andra**

- tydligt eftervarde
- checklista som huvudsakligt vardeargument efter flytten
- jamforelser och paminnelser utan att sta i vagen for huvudflodet

**Ska inte aga**

- primar BankID- och QR-implementation
- OpenClaw-gateway eller DID-widget
- startsidans design och copy

**Delade konfliktpunkter**

- `app/dashboard/page.tsx`
- `app/api/move/route.ts`
- `components/checklist-view.tsx`
- `components/skatteverket-guide.tsx`
- OpenClaw-prompts som laser compare- och checklistedata

**Beroenden**

- beroende av Plan 3 for korrekt registrerad flytt och move-id
- bor forankras mot Plan 4 och Plan 5 innan dashboarden spikas

---

## Plan 7. Valfri separat plan: copy, content och juridik

**Syfte**

Bryta ut tonalitet, vardelofte, FAQ, trygghetsbudskap och juridiska texter i ett eget spar om ni vill att externa agenter ska jobba mer redaktionellt an tekniskt.

**Primart filagarskap**

- `components/hero-section.tsx`
- `components/trust-section.tsx`
- `components/faq-section.tsx`
- `app/om/page.tsx`
- `app/anvandarvillkor/page.tsx`
- `app/integritetspolicy/page.tsx`
- `app/cookiepolicy/page.tsx`

**Nar planen ar vard att skapa**

- om ni vill ha en separat copy-agent
- om juridiskt innehal ska skrivas om i egen process
- om hero- och trustbudskap ska testas separat fran design och implementation

**Nar planen inte behovs**

- om Plan 2 och Plan 6 far med copyansvar som del av respektive uppdrag

---

## 4. Delade filer som behover tydlig samordning

De viktigaste konfliktpunkterna mellan planer ar:

- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/adressandring/page.tsx`
- `app/dashboard/page.tsx`
- `components/header.tsx`
- `components/site-footer.tsx`
- `components/logo.tsx`
- `components/checklist-view.tsx`
- `components/skatteverket-guide.tsx`
- `hooks/use-autofill.tsx`
- `hooks/use-openclaw-mirror.ts`
- `app/api/move/route.ts`

For de har filerna bor varje agentplan uttryckligen skriva om den far:

- aga filen helt
- bara lasa filen
- lagga till en liten integration utan att skriva om resten
- begara extraktion till egen delkomponent innan arbete startar

---

## 5. Rekommenderad genomforandeordning

Rekommenderad ordning ar:

1. **Plan 1: Designsystem och tema**
2. **Plan 2: Publik startsida och marknadsytor**
3. **Plan 3: Adressandringsflode och stegsekvens**
4. **Plan 5: OpenClaw och DID-agenten**
5. **Plan 4: BankID, SKV och QR-sparet**
6. **Plan 6: Efterflode, checklista och jamforelser**

**Varfor den ordningen ar bast**

- Plan 1 satter visuella kontrakt for resten
- Plan 2 satter publik riktning och konverteringsram
- Plan 3 satter den centrala produktresan och move-kontraktet
- Plan 5 bor in nar vi vet hur AI ska synas i resan
- Plan 4 bor landa efter att huvudflodet vet nar och hur SKV/BankID ska ske
- Plan 6 bor spikas sist eftersom dashboarden knyter ihop resultatet fran flera tidigare planer

**Vad som kan ga parallellt**

- Plan 4 och Plan 5 kan delvis ga parallellt efter att Plan 3 ar tillrackligt stabil
- Plan 7 kan ga parallellt med Plan 2 och Plan 6 om den skapas

---

## 6. Exakt uppskattning av antal MD-filer

Om vi raknar bara de arbetsplaner som externa agenter faktiskt ska fa:

- **Rekommenderat:** 6 MD-filer
- **Med separat copy/juridik:** 7 MD-filer

Om vi raknar in styrdokumenten ocksa:

- `MASTERPLAN-FLYTT-IO.md`
- den har overgripande agentplanen
- 6 separata agentplaner

Da landar totalen pa:

- **8 MD-filer totalt** i grundupplagget
- **9 MD-filer totalt** om copy/juridik bryts ut

---

## 7. Nasta steg

Nasta steg bor vara att skapa en egen MD-fil per plan med exakt samma struktur:

- syfte
- malbild
- vilka filer agenten ager
- vilka filer agenten inte far andra
- beroenden
- testkrav
- definition of done

Da kan externa agenter fa tydliga uppdrag utan att krocka i samma delar av systemet.
