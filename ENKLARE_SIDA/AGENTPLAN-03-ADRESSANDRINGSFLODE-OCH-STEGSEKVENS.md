# Agentplan 03 - Adressandringsflode och stegsekvens

> Den har planen ager sjalva huvudresan i `flytt.io`: hur anvandaren tar sig genom adressandringen, vilka steg som finns, vad som ska fyllas i manuellt och hur flodet leder vidare.

---

## Syfte

Forenkla och forbattra huvudresan sa att anvandaren snabbare kommer till ett klart resultat.

Detta innebar bland annat:

- tidigare identifiering
- fa och tydliga steg
- sa lite manuell inmatning som mojligt
- ett smartare forsta steg
- en mjuk overlamning till vidare verifiering och efterflode

---

## Malbild

Nar denna plan ar klar ska huvudflodet kannas:

- kortare
- tydligare
- mer guidat
- mindre blankettaktigt
- battre anpassat till den nya publika positioneringen

---

## Agentens ansvar

Agenten far:

- skriva om struktur, sekvens och presentation i `app/adressandring/page.tsx`
- forenkla stegindelningen
- justera vilka uppgifter som samlas in var i resan
- justera success- och overlamningsdelen sa att anvandaren leds vidare pa ett logiskt satt
- justera det formularschema som styr denna sida

Agenten far inte:

- andra BankID-, SKV- eller QR-routes
- bygga om OpenClaw- eller DID-backend
- bygga om dashboarden
- ta agarskap over checklistans centrala modell eller jamforelse-API:er

---

## Primart filagarskap

- `app/adressandring/page.tsx`
- `schemas/forms/adressandring-form.schema.json`

---

## Filer som far anvandas men normalt inte agas

- `hooks/use-autofill.tsx`
- `hooks/use-openclaw-mirror.ts`
- `components/checklist-view.tsx`
- `components/skatteverket-guide.tsx`
- `components/bookmarklet-button.tsx`
- `app/api/ai/validate/route.ts`
- `app/api/ai/autofill/route.ts`
- `app/api/checklist/template/route.ts`
- `app/api/move/route.ts`

Om agenten maste foresla andringar i dessa filer ska det goras som tydliga integration points, inte som full omskrivning.

---

## Do not touch

- `app/api/skv/**`
- `components/bankid-qr-mirror.tsx`
- `app/api/openclaw/**`
- `app/api/did/**`
- `components/did-openclaw-bridge-widget.tsx`
- `components/openclaw-chat-widget.tsx`
- `app/dashboard/page.tsx`
- `lib/checklist/template.ts`
- `app/api/compare/[taskKey]/route.ts`

---

## Viktiga gransdragningar

- Agenten ager huvudresan, inte hela integrationslandskapet runt omkring.
- Om checklista visas i flodet far agenten styra nar och hur den visas, men inte definiera om hela checklistelogiken globalt.
- Om OpenClaw eller DID ska hjalpa i flodet far agenten konsumera befintliga integrationer, men inte bygga om deras interna arkitektur.

---

## Beroenden

Harda beroenden:

- `AGENTPLAN-01-DESIGNSYSTEM-OCH-TEMA.md`
- `AGENTPLAN-02-PUBLIK-STARTSIDA-OCH-MARKNADSYTOR.md` som referens for vad som lovas publikt

Efterfoljande planer som ar beroende av denna:

- `AGENTPLAN-04-BANKID-SKV-OCH-QR-SPARET.md`
- `AGENTPLAN-06-EFTERFLODE-DASHBOARD-CHECKLISTA-OCH-JAMFORELSER.md`

Mjuka beroenden:

- `AGENTPLAN-05-OPENCLAW-OCH-DID-AGENTEN.md`

---

## Konfliktpunkter

- `components/checklist-view.tsx`
- `app/api/checklist/template/route.ts`
- `app/api/move/route.ts`
- `components/skatteverket-guide.tsx`
- `components/bookmarklet-button.tsx`

---

## Testkrav

Agenten ska verifiera:

- att huvudflodet kanns kortare och tydligare
- att stegsekvensen hanger ihop med vad startsidan lovar
- att formdata fortfarande kan sparas pa ett stabilt satt
- att eventuella AI- eller autofill-hjalper inte blockerar grundresan
- att overlamningen till efterfoljande steg fortfarande fungerar

---

## Definition of done

Planen ar klar nar:

- det finns en tydligt beslutad och implementerbar stegsekvens
- flodet har ett rimligt minimiantal manuella moment
- gransen mot BankID, OpenClaw och efterflode ar tydlig
- senare agenter kan ta over verifiering och dashboard utan att huvudflodet rivs upp igen
