# Agentplan 02 - Publik startsida och marknadsytor

> Den har planen ager den publika fasaden for nya `flytt.io`: startsida, hero, trust, CTA, FAQ och ovriga marknadsytor som formar forsta intrycket.

---

## Syfte

Skapa en ny publik upplevelse som:

- snabbare forklarar vad tjansten ar
- leder anvandaren mot ett klart resultat
- tydligt forbereder overgangen till `adressandring`
- bevarar chefens visuella riktning
- tonar ned video, showiga effekter och onodig teknikestetik

---

## Malbild

Nar denna plan ar klar ska en besokare snabbt forsta:

- vad `flytt.io` gor
- varfor tjansten ar vard att anvanda
- att resan ar enkel och trygg
- att `BankID`, `Skatteverket`, AI-hjalp och eftervarde finns, utan att allt kastas pa anvandaren direkt

---

## Agentens ansvar

Agenten far:

- bygga om hero och overgripande startsidesstruktur
- justera ordning och innehall i trust-, FAQ- och CTA-sektioner
- minska eller ta bort videobakgrund och overstylade animationer
- justera header, footer och legal-layout om det behovs for ny publik riktning
- se till att overgangen till `adressandring` ar tydlig och konverteringsstark

Agenten far inte:

- definiera globala tokens eller UI-bas pa egen hand
- skriva om adressflodets interna steglogik
- andra BankID-, SKV-, OpenClaw- eller DID-backendlogik
- bygga om dashboardens efterflode

---

## Primart filagarskap

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

---

## Filer som bara far lasas eller beroras mycket forsiktigt

- `app/globals.css`
- `app/layout.tsx`
- `components/ui/*`
- `app/adressandring/page.tsx`
- `components/openclaw-chat-widget.tsx`
- `components/did-openclaw-bridge-widget.tsx`

---

## Viktiga gransdragningar

- Denna plan ager budskap, hierarki och sektioner pa publika ytor.
- Den ager inte produktens djupare integrationslager.
- Om AI ska lyftas tidigt pa startsidan far det goras via copy, placering och enklare UI, men inte genom att bygga om OpenClaw-backenden.

---

## Beroenden

Harda beroenden:

- `AGENTPLAN-01-DESIGNSYSTEM-OCH-TEMA.md`

Mjuka beroenden:

- viss sync med `AGENTPLAN-03-ADRESSANDRINGSFLODE-OCH-STEGSEKVENS.md` sa att CTA och landning motsvarar det faktiska flodet
- viss sync med `AGENTPLAN-05-OPENCLAW-OCH-DID-AGENTEN.md` om AI-komponenten ska lyftas fram tidigt

---

## Konfliktpunkter

- `components/header.tsx`
- `components/site-footer.tsx`
- `components/logo.tsx`
- `app/layout.tsx` om globala effekter eller widgets flyttas
- eventuella rester av hero-effekter i `app/globals.css`

---

## Testkrav

Agenten ska verifiera:

- att startsidan forklarar tjansten tydligare an tidigare
- att primar CTA leder ratt och ar tydlig pa desktop och mobil
- att video/animationer inte langre dominerar upplevelsen
- att legal- och infosidor fortfarande hanger ihop med nya publika uttrycket

---

## Definition of done

Planen ar klar nar:

- startsidan har en ny tydlig informationshierarki
- hero, trust, FAQ och CTA foljer malbilden
- startsidan kanns lugnare, tryggare och mer premium
- en extern agent for adressflodet kan ta vid utan att behova bygga om startsidan igen
