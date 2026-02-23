# Autofill Orchestrator

Central logik for alla formularforslag i flyttanmalan.

---

## Arkitektur

```
lib/autofill/config.ts          <-- konfiguration + env-variabler
hooks/use-autofill.tsx           <-- React-hook som kapslar allt
app/adressandring/page.tsx       <-- konsument (anropar hooken)
app/api/enrich/postal/route.ts   <-- PAP API (postnummer -> ort)
app/api/ai/autofill/route.ts     <-- OpenAI GPT-4o-mini (komplettering)
components/openclaw-chat-widget   <-- Aida-chat (suggestion-block)
```

### Dataflode

```
                   ┌─────────────────────┐
                   │   useAutofill hook   │
                   │                     │
                   │  queueSuggestion()  │ <── postal lookup (auto)
                   │  acceptSuggestion() │ <── AI autofill (manuell knapp)
                   │  dismissSuggestion()│ <── OpenClaw/Aida (chat)
                   │                     │
                   │  prioritet:         │
                   │    postal  = 3      │
                   │    ai      = 2      │
                   │    openclaw = 1     │
                   └────────┬────────────┘
                            │
                   ┌────────▼────────────┐
                   │  mode == "auto"?    │
                   │  JA:  updateForm()  │
                   │  NEJ: visa banner   │
                   │  [Acceptera/Avvisa] │
                   └─────────────────────┘
```

---

## Env-variabler

Alla prefixas med `NEXT_PUBLIC_AUTOFILL_` for att finnas client-side.

| Variabel | Default | Beskrivning |
|----------|---------|-------------|
| `_ENABLED` | `true` | Master on/off |
| `_DEV_ONLY` | `true` | Bara i development |
| `_MODE` | `manual` | `auto` fyller direkt, `manual` visar banner |
| `_DEBUG` | `false` | Loggar kalla/falt/varde i browser console |
| `_SOURCE_POSTAL` | `true` | PAP API postnummer->ort |
| `_SOURCE_AI` | `true` | OpenAI GPT-4o-mini komplettering |
| `_SOURCE_OPENCLAW` | `true` | Aida-chat suggestions |

### Debug-logg (NEXT_PUBLIC_AUTOFILL_DEBUG=true)

I webbläsarens DevTools Console visas:
```
[autofill] queued     { field: "fromCity", value: "Stockholm", source: "postal" }
[autofill] accepted   { field: "fromCity", value: "Stockholm", source: "postal" }
[autofill] blocked    { field: "toCity", source: "ai", reason: "source disabled" }
[autofill] skipped    { field: "x", source: "openclaw", reason: "existing postal has higher priority" }
[autofill] dismissed  { field: "fromCity" }
[autofill] auto-accepted { field: "fromCity", value: "Stockholm", source: "postal" }
```

---

## Kallor

### 1. Postal lookup (automatisk)

- **Trigger:** nar postnummerfalt har exakt 5 siffror OCH ort-faltet ar tomt
- **API:** `GET /api/enrich/postal?postalCode=XXXXX`
- **Uppstromstjanst:** PAP API (`api.papapi.se`) med fallback-tabell
- **Ger:** ort, kommun, lan, koordinater
- **Prioritet:** 3 (hogst)

### 2. AI autofill (manuell knapp)

- **Trigger:** klick pa "Hamta AI-forslag" i steg 2
- **API:** `POST /api/ai/autofill`
- **Uppstromstjanst:** OpenAI GPT-4o-mini
- **Ger:** kompletteringar av saknade falt (postnr, ort, telefon-format)
- **Prioritet:** 2

### 3. OpenClaw/Aida (chat)

- **Trigger:** Aida skickar suggestion-block i chatt-svar
- **Format:** ```suggestion\n{"toCity":"Goteborg"}\n```
- **Callback:** `onSuggestion` prop pa OpenClawChatWidget
- **Prioritet:** 1 (lagst)

---

## Prioriteringsregler

Nar en suggestion koar:
1. Om faltet redan har en suggestion med hogre prioritet: ny suggestion ignoreras
2. Om faltet redan har en suggestion med lagre/lika prioritet: ny suggestion ersatter
3. Accepterad suggestion: falt fylls i, suggestion tas bort
4. Dismissed suggestion: suggestion tas bort
5. Manuell inmatning i falt: suggestion for det faltet tas bort automatiskt

---

## Schema (FormData)

Falten som orchestratorn hanterar:

```typescript
interface FormData {
  firstName: string;
  lastName: string;
  personalNumber: string;
  email: string;
  phone: string;
  fromStreet: string;
  fromPostal: string;    // trigger for postal lookup -> fromCity
  fromCity: string;      // target for postal lookup
  toStreet: string;
  toPostal: string;      // trigger for postal lookup -> toCity
  toCity: string;        // target for postal lookup
  apartmentNumber: string;
  propertyDesignation: string;
  propertyOwner: string;
  moveDate: string;
  householdType: string;
  reason: string;
  hasChildren: boolean;
}
```
