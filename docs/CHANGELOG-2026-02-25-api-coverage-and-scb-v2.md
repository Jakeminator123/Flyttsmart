# CHANGELOG 2026-02-25 — API coverage, SCB v2, DID autofill

## 1) Vad som ändrades och varför

- D-ID chat-route (`/api/did/chat`) har fått en deterministisk autofill-fallback:
  - Om användaren skriver tydliga kommandon som `fyll i Jakob i förnamn`
    returnerar backend ett korrekt `suggestion`-block direkt.
  - Syfte: fältfyllning ska synas på skärmen även om modellen ibland missar formatet.
- SCB-integration i `lib/aida/enrich.ts` migrerades från äldre SCB v1 endpoint till SCB v2:
  - Från: `https://api.scb.se/.../BefolkningNy`
  - Till: `https://statistikdatabasen.scb.se/api/v2/tables/TAB638/data`
  - Syfte: stabilare endpoint och modern API-struktur.
- SCB-lookup fick cache för att minska onödiga API-anrop och undvika throttling.

## 2) Dataflöden (textdiagram)

### 2.1 D-ID röstchat + formulärfyllning

```text
User speech/text
  -> components/did-openclaw-bridge-widget.tsx
  -> POST /api/did/chat
     -> (A) direct autofill command? yes -> return suggestion block directly
     -> (B) otherwise -> OpenClaw /v1/chat/completions
  -> parse suggestion block in widget
  -> applySuggestions() to DOM fields
  -> dispatch input/change events
```

### 2.2 Enrichment före LLM-svar

```text
formContext fields
  -> enrichContext()
     -> PAP (postal -> city/municipality/county)
     -> Nominatim (address validation + geodata)
     -> Eniro (nearby services by toCity)
     -> SCB v2 (population + growth by municipality)
  -> enrichedData injected in system prompt
  -> OpenClaw response
```

## 3) API-karta: vilken API leder till vad

| API / Källa | Används i | Input | Output | Primär nytta |
|---|---|---|---|---|
| OpenClaw Gateway (`/v1/chat/completions`) | `app/api/did/chat/route.ts`, `app/api/openclaw/chat/route.ts` | chat history + formContext | assistent-svar + ev suggestion block | resonemang, dialog, förslag |
| PAP API | `lib/aida/enrich.ts` | postnummer | ort, kommun/län (om tillgängligt) | härledning av ort från postnummer |
| Nominatim (OpenStreetMap) | `lib/aida/enrich.ts` | gata + ort (+ postnummer) | validerad adress + koordinater | adresskontroll/normalisering |
| Eniro Company Search | `lib/aida/enrich.ts` | sökterm + ort | företag/listor (matbutik, vårdcentral, apotek) | lokala rekommendationer |
| SCB API v2 (`TAB638`) | `lib/aida/enrich.ts` | kommunkod + år | folkmängd + folkökning | kontext om inflyttningskommun |
| D-ID Client SDK | `components/did-openclaw-bridge-widget.tsx` | text att tala | avatarvideo + TTS | avatar och röstupplevelse |
| Lokal route-fallback (ingen extern API) | `app/api/did/chat/route.ts` | tydlig fältfyllningsfras | `suggestion`-block | robust visuell autofill |

## 4) 15-fältsmodell (Skatteverket-liknande) och täckning

Projektets kärnfält (15 st):
`firstName`, `lastName`, `personalNumber`, `fromStreet`, `fromPostal`, `fromCity`,
`toStreet`, `toPostal`, `toCity`, `apartmentNumber`, `propertyDesignation`,
`propertyOwner`, `email`, `phone`, `moveDate`.

### 4.1 Vad som kan härledas säkert via API-kombinationer

- **Hög säkerhet (ofta 97%+)**
  - `fromCity` från `fromPostal` via PAP.
  - `toCity` från `toPostal` via PAP.
  - adressens rimlighet (inte personidentitet) via PAP + Nominatim.

- **Medel säkerhet**
  - lokala tjänster nära `toCity` via Eniro (rekommendation, inte identitetsfält).
  - kommunens befolkningsfakta via SCB (beslutsstöd, inte identitetsfält).

- **Kan normalt inte hämtas säkert utan auktoritativ personkälla**
  - `firstName`, `lastName`, `personalNumber`, `email`, `phone`,
    `apartmentNumber`, `propertyDesignation`, `propertyOwner`, `moveDate`,
    stora delar av gatunivådata.

## 5) Kombinationsmatris för träffsäkerhet (tankexperiment)

Detta är en teknisk sannolikhetsbedömning, inte juridisk rådgivning.

| Uppgiftstyp | Minsta input | API-kombination | Realistisk säkerhet |
|---|---|---|---|
| Ort från postnummer | 5-siffrigt postnummer | PAP | 98-99% |
| Adressrimlighet (inte personmatchning) | gata + postnummer + ort | PAP + Nominatim | 97-99% |
| Lokala serviceförslag | ort | Eniro | 90-95% (relevans varierar) |
| Kommunfakta | ort/kommunkod | SCB v2 | 99% för statistikvärden |
| Personmatchning (privatperson) med endast öppna källor | 4 viktiga + 1 halvviktig uppgift | PAP + Nominatim + Eniro + SCB | typiskt <70% |
| Personmatchning 97%+ | personnummer + namn + verifierad källa + laglig grund | auktoritativa personregister (ej i nuvarande stack) | 97%+ möjligt först då |

### 5.1 Slutsats för "4 viktiga + 1 halvviktig"

- Med nuvarande API-stack kan ni nå hög säkerhet för **adress- och ortdata**.
- För **personidentifiering** (97%+) räcker inte öppna API:er.
- För 97%+ personmatchning krävs normalt:
  - auktoritativ persondatakälla,
  - legal grund/avtal,
  - verifierad identitetssignal (t.ex. stark auth-flöde).

## 6) Miljövariabler (berörda)

| Variabel | Funktion |
|---|---|
| `SCB_ENABLED` | Slår på/av SCB enrichment |
| `SCB_TABLE_ID` | SCB-tabell (default `TAB638`) |
| `SCB_YEAR` | År för SCB-query (default `2024`) |
| `PAP_API_KEY` | Nyckel för PAP postnummeruppslag |
| `ENIRO_API_KEY` | Nyckel för Eniro företagssök |
| `NOMINATIM_ENABLED` | Slår på/av Nominatim lookup |
| `OPENCLAW_GATEWAY_URL` | OpenClaw gateway URL |
| `OPENCLAW_GATEWAY_TOKEN` | Token till OpenClaw gateway |
| `OPENCLAW_AGENT_ID` | Agent-id i OpenClaw |

## 7) Bevarat vs borttaget

### Bevarat

- Existerande OpenClaw-flöde via `/api/did/chat`.
- Suggestion-block format i klienten (`parseOpenClawResponse` + `applySuggestions`).
- Enrichment med PAP, Nominatim, Eniro, SCB.

### Ändrat

- SCB endpoint och queryformat uppgraderat till v2.
- Ny lokal fallback för tydliga autofill-kommandon i DID-route.

### Borttaget

- Ingen funktionellt borttagen del i denna ändring.

