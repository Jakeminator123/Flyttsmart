# Agentplan 01 - Designsystem och tema

> Den har planen ager den visuella grunden for nya `flytt.io`. Fokus ar tokens, typografi, globala komponentstilar och den overgripande temariktningen.

---

## Syfte

Byta ut nuvarande visuella grund till chefens riktning:

- marin mork bas
- mintgron accent
- BankID-bla som sekundar signal
- lugnare premiumuttryck
- mindre "tech-demo", mer trygg och editorial kansla

---

## Malbild

Nar denna plan ar klar ska resten av teamet ha en stabil designgrund att bygga pa. Publika ytor, adressflode, dashboard och agentlager ska kunna anvanda samma tokens, typografi och UI-principer utan att varje agent skapar egna speciallosningar.

---

## Agentens ansvar

Agenten far:

- definiera nya fargtokens
- definiera typografi och fontstrategi
- justera globala komponentstilar for `button`, `badge`, `card`, `input` och liknande
- forenkla eller tona ned globala effekter som inte passar nya riktningen
- sakersalla att CTA-, trust- och formstilar fungerar som gemensam bas

Agenten far inte:

- skriva om copy eller informationshierarki
- bygga om startsidans sektioner
- andra stegsekvens i adressflodet
- andra BankID-, SKV-, OpenClaw- eller DID-logik

---

## Primart filagarskap

- `app/globals.css`
- `app/layout.tsx`
- `components/theme-provider.tsx`
- `components/ui/*`
- `components.json`
- `postcss.config.mjs`
- `lib/utils.ts`

---

## Filer som bara far lasas eller beroras mycket forsiktigt

- `app/page.tsx`
- `app/adressandring/page.tsx`
- `app/dashboard/page.tsx`
- `components/header.tsx`
- `components/site-footer.tsx`
- `components/logo.tsx`

Om dessa filer behover justeras for att koppla in ny designgrund ska andringarna vara sma och tydligt motiverade.

---

## Viktiga gransdragningar

- Agenten ager tokens och basstilar, inte innehallsbeslut.
- Agenten ager fonts och `themeColor`, men inte routing eller sektionernas copy.
- Om `app/globals.css` innehaller hero-specifika effekter ska agenten i forsta hand extrahera eller markera dem som startsideansvar, inte ga in och losa all hero-design sjalv.

---

## Beroenden

Denna plan har inga harda tekniska beroenden och bor ga forst.

Efterfoljande planer som ar beroende av denna:

- `AGENTPLAN-02-PUBLIK-STARTSIDA-OCH-MARKNADSYTOR.md`
- `AGENTPLAN-03-ADRESSANDRINGSFLODE-OCH-STEGSEKVENS.md`
- `AGENTPLAN-04-BANKID-SKV-OCH-QR-SPARET.md`
- `AGENTPLAN-05-OPENCLAW-OCH-DID-AGENTEN.md`
- `AGENTPLAN-06-EFTERFLODE-DASHBOARD-CHECKLISTA-OCH-JAMFORELSER.md`

---

## Konfliktpunkter

- `app/globals.css` blandar i dag tokenlager och vissa visuella effekter
- `app/layout.tsx` paverkar hela appen och kan krocka med global widget-montering
- `components/ui/*` anvands av i princip hela produkten

Om stora strukturandringar kravs ska agenten skriva ut vad som bor extraheras i stallet for att andra allt samtidigt.

---

## Testkrav

Agenten ska verifiera:

- att samtliga centrala sidor fortfarande renderar utan visuella krascher
- att kontrast och lasbarhet ar rimlig pa startsida, formularytor och dashboard
- att knappar, badges, cards och inputs fungerar i ljus och eventuell mork variant
- att inga gamla hardkodade farger ligger kvar i centrala CTA-floden utan beslut

---

## Definition of done

Planen ar klar nar:

- nya tokens och typografi ar etablerade
- globala UI-komponenter foljer samma riktning
- andra workstreams kan bygga vidare utan att uppfinna egna farg- eller knappsystem
- det finns tydlig dokumenterad grans mot startsideeffekter och produktlogik
