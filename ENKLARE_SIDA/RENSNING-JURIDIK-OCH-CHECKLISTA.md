# Rensning, juridik och checklista

> Syftet med detta dokument är att samla det som bör städas bort, det juridiska som måste skärpas och hur flyttchecklistan kan göras betydligt snyggare och enklare.

---

## 1. Det som bör rensas eller arkiveras

### A. Troliga dödkodskandidater i frontend

Följande komponenter finns kvar i kodbasen, men gav inga träffar i aktuell `ts/tsx`-sökning:

- `components/hero-cinemagraph.tsx`
- `components/hero-wave-electrons.tsx`
- `components/floating-lines.tsx`
- `components/magnetic-button.tsx`

### Rekommendation

- markera dessa som `archive/remove candidates`
- kör en sista grep + regressionstest innan radering
- om någon ska sparas, flytta dem till en tydlig `archive`-yta så att den nya riktningen inte blandas med gamla show-/demoinslag

### Varför

De hör till det äldre, mer effekttunga uttrycket som vi redan har valt bort till förmån för en lugnare, mer premium och mer konverteringsstark riktning.

---

## 2. Dokument som bör få ny status

### Behåll som källmaterial, inte som sanningskälla för implementation

- `övrigt/FLYTT-WIREFRAMES-SAMMANFATTNING.md`
- `övrigt/FRONTEND-BESLUT-FLYTT-IO.md`

### Behåll som nuvarande huvudunderlag

- `ENKLARE_SIDA/MASTERPLAN-FLYTT-IO.md`
- `ENKLARE_SIDA/BUILDPLAN-AGENTER-FLYTT-IO.md`
- `ENKLARE_SIDA/AGENTPLAN-01-DESIGNSYSTEM-OCH-TEMA.md`
- `ENKLARE_SIDA/AGENTPLAN-02-PUBLIK-STARTSIDA-OCH-MARKNADSYTOR.md`
- `ENKLARE_SIDA/AGENTPLAN-03-ADRESSANDRINGSFLODE-OCH-STEGSEKVENS.md`
- `ENKLARE_SIDA/AGENTPLAN-04-BANKID-SKV-OCH-QR-SPARET.md`
- `ENKLARE_SIDA/AGENTPLAN-05-OPENCLAW-OCH-DID-AGENTEN.md`
- `ENKLARE_SIDA/AGENTPLAN-06-EFTERFLODE-DASHBOARD-CHECKLISTA-OCH-JAMFORELSER.md`

### Rekommendation

- lägg en kort statusrad i äldre underlag: `historiskt beslutsunderlag - delar överskrivna av masterplan/agentplaner`
- undvik att låta externa agenter ta implementationstaktik direkt från `övrigt`-filerna

---

## 3. Juridiken som bör skärpas

De juridiska sidorna finns redan och är användbara, men de ligger fortfarande på en relativt generell nivå jämfört med hur produkten faktiskt fungerar.

### Det som bör förtydligas

- att `Flytt.io` är en privat tjänst och inte en myndighet
- att `Skatteverket`-spåret är ett myndighetsnära flöde, men att `Flytt.io` är hjälp- och samordningslagret runt det
- att `BankID` används för säker identifiering och för att minska manuell inmatning där det är möjligt
- att uppgifter kan användas för förifyllnad, checklista, påminnelser och relevanta jämförelser
- att jämförelser och erbjudanden måste skiljas från själva kärntjänsten juridiskt och kommunikativt
- att e-post/SMS-marknadsföring kräver tydlig samtyckesmodell och tydlig avregistrering
- att partnerdelning bara ska ske vid aktivt intresse eller separat samtycke
- att `OpenClaw` och `DID` inte behöver beskrivas med interna tekniska namn publikt, men att AI-stödet bör beskrivas ärligt som hjälp- och rekommendationsstöd
- att AI-hjälp, checklistor och jämförelser är beslutsstöd och inte bindande rådgivning

### Särskilt viktigt att justera

`app/cookiepolicy/page.tsx` säger i dag att användaren får möjlighet att acceptera, avvisa eller anpassa cookies via cookieinställningar på webbplatsen. Jag hittade ingen faktisk cookie-banner eller inställningsyta i nuvarande app.

### Rekommendation

- antingen implementera riktig cookie-consent-ui
- eller tona ned texten så att policyn bara lovar det som faktiskt finns

---

## 4. Samtycken som bör separeras tydligare

I den fortsatta juridik-/copy-rundan bör samtycken delas upp i minst tre lager:

### A. Nödvändigt tjänstesamtycke

För att:

- skapa konto/session
- spara flyttdata
- skapa checklista
- guida vidare i det registrerade flyttflödet

### B. Partner- och erbjudandesamtycke

För att:

- visa personligt anpassade erbjudanden
- skicka erbjudanden via e-post/SMS
- dela uppgifter vidare till partner när användaren uttryckligen vill det

### C. Cookie-/analysval

För att:

- köra analys
- mäta kampanjer
- spara icke-nödvändiga preferenser

Detta bör inte klumpas ihop till ett enda svepande godkännande.

---

## 5. Varför checklistan känns svag i dag

Checklistan fungerar tekniskt, men visuellt och produktmässigt känns den fortfarande mer som ett internt systemlager än som ett starkt premiumverktyg.

### Problem i nuvarande upplägg

- den är uppdelad i för många små sektioner
- sektionerna känns systemlogiska snarare än användarlogiska
- den ser mer administrativ än värdeskapande ut
- jämför-/hjälp-funktionerna blir lite gömda
- den säljer inte in "sparar tid och pengar" tillräckligt starkt

---

## 6. Rekommenderad ny struktur för checklistan

Nuvarande sju grupper kan med fördel slås ihop till fyra tydligare huvudblock.

### 1. Före flytten

Samla:

- uppsägning/försäljning
- besiktning/överlämning/nycklar
- flyttfirma eller släp
- packmaterial
- parkering/lastzon

### 2. Adress och myndigheter

Samla:

- folkbokföring/adressändring
- eftersändning
- adress hos myndigheter/tjänster
- bank/fakturaadress

### 3. Hem och avtal

Samla:

- el
- hemförsäkring
- vatten/fjärrvärme/gas
- bredband och teknik

### 4. Efter inflytt

Samla:

- säkerhet i bostaden
- abonnemang och uppdateringar
- slutavstämning

### Varför denna struktur är bättre

- färre accordion-block
- lättare att förstå på 3 sekunder
- bättre anpassad till mänsklig flyttlogik
- tydligare plats för "jämför" och "behöver hjälp"
- känns mer som ett verktyg och mindre som en datalista

---

## 7. Konkreta merge-kandidater

Följande steg kan slås ihop utan att värdet försvinner:

### A. Bank och fakturaadress

Slå ihop:

- `bank_address`
- `autogiro_bills`

Ny rubrik:

- `Uppdatera bank, autogiro och fakturaadress`

### B. Bredband före inflytt

Slå ihop:

- `broadband_tech_check`
- `broadband_order_install`

Ny rubrik:

- `Beställ bredband till nya adressen`

Behåll gärna teknikcheck som undertips, inte som egen huvudrad.

### C. Energi och drift

Slå ihop visuellt:

- `electricity_contract`
- `water_heating_gas`

Ny rubrik:

- `Säkra el och drift i nya bostaden`

Låt vatten/fjärrvärme/gas bli valfri undertask när relevant.

### D. Hemförsäkring

Behåll gärna separat, men placera den intill el/boende så att användaren upplever det som ett sammanhållet avtalspaket.

---

## 8. Hur checklistan bör göras snyggare

### Visuell riktning

- färre nivåer samtidigt
- tydligare första rad med `klart`, `näst på tur`, `kan spara pengar`
- mer premiumkort och mindre "rå adminlista"
- en tydlig progressrad högst upp
- tydligare deadlines och statuschips

### Innehållsriktning

- visa 1-3 rekommenderade nästa steg överst
- visa jämförbara moment som särskilda "spara pengar"-kort
- visa `Behöver hjälp` som mer mänskligt stöd, inte bara en flagga
- gör efterflyttsvärdet mer konkret: påminnelser, jämförelser, uppföljning

### Viktigt

Checklistan ska fortfarande bära samma backenddata, men den ska upplevas som en modern produktfunktion och ett starkt skäl att välja tjänsten.

---

## 9. Rekommenderad arbetsordning

1. Rensa eller arkivera dödkodskandidater.
2. Bestäm en canonical juridisk linje för samtycke, partnerdelning och cookies.
3. Skriv om juridiksidorna så att de matchar faktisk produktlogik.
4. Rita om checklistan till fyra huvudblock.
5. Slå ihop de steg som ovan utan att tappa backendkontrakten.
6. Först därefter polish på copy och visual design.

---

## 10. Slutsats

Det viktigaste som återstår är inte ny teknik, utan att:

- städa bort rester från den gamla frontendriktningen
- göra juridiken mer exakt mot faktisk produktbeteende
- göra checklistan enklare, snyggare och mer säljande

Kort sagt:

**mindre gammal demo-rest, tydligare juridik, mycket starkare efterflytt-produkt**
