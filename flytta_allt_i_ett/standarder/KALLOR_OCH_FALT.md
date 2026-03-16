# Källor och fält — komplett karta

## Datakällor

| ID  | Källa                  | Typ     | Env-nyckel            | Ger                                          |
|-----|------------------------|---------|-----------------------|----------------------------------------------|
| RS  | Ratsit /search         | API     | RATSIT_SCRAPER_URL    | namn, PNR, adress, stad, ålder, lgh, kön     |
| RL  | Ratsit /lookup         | API     | RATSIT_SCRAPER_URL    | medboende, fordon, snittlön, anmärkningar    |
| BIL | Biluppgifter.se        | Scrape  | —                     | namn, adress, stad, postnr, lgh-nr, ålder    |
| EP  | Eniro person (JSON-LD) | Scrape  | —                     | telefon, postnr, adress, stad, fastighet, fd |
| EC  | Eniro företag (REST)   | API     | ENIRO_API_KEY         | företag nära adress, möjlig ägare             |
| MC  | Eniro karta (företag)  | Scrape  | —                     | BRF/fastighetsbolag → ägare (ny adress)      |
| MP  | Eniro karta (person)   | Scrape  | —                     | fastighetsbeteckning (ny adress)              |
| PAP | PAP API                | API     | PAP_API_KEY           | ort, kommun, län (från postnr)                |
| MAN | Manuell input          | Input   | —                     | ny adress, flyttdatum, e-post                 |

---

## Fältkarta — vad hämtas varifrån

### SKV-fält (Skatteverkets blankett)

```
┌─────────────────────────┬──────────┬───────────────────────────────────────┐
│ Fält                    │ Krävs?   │ Källa (prioritetsordning)             │
├─────────────────────────┼──────────┼───────────────────────────────────────┤
│ name                    │ ✓        │ BIL > RS > EP > MAN                  │
│ personalNumber          │ ✓        │ RS > MAN  (PNR: MAN direkt)          │
│ inflyttningsdatum       │ ✓        │ MAN                                  │
│ period                  │ ✓        │ default "true" > MAN                 │
│ gatuadress (ny)         │ ✓        │ MAN                                  │
│ postnummer (ny)         │ ✓        │ MAN                                  │
│ postort (ny)            │ ✓        │ PAP > MAN                            │
│ lagenhetsnummer         │          │ BIL > RS (parse lgh)                 │
│ fastighetsbeteckning    │          │ MP > MAN                             │
│ fastighetsagare         │          │ MC > EC > MAN                        │
│ telefonnummer           │          │ EP > MAN                             │
│ email                   │          │ MAN (aldrig auto)                    │
└─────────────────────────┴──────────┴───────────────────────────────────────┘
```

### Interna fält (inte i SKV-payload)

```
┌─────────────────────────┬───────────────────────────────────────────────┐
│ Fält                    │ Källa                                         │
├─────────────────────────┼───────────────────────────────────────────────┤
│ fromStreet              │ BIL > RS > EP > MAN                          │
│ fromPostal              │ BIL > EP > PAP > MAN                         │
│ fromCity                │ BIL > RS > EP > PAP > MAN                    │
│ fastighet (nuv.adr)     │ EP (JSON-LD boende-sektion)                  │
└─────────────────────────┴───────────────────────────────────────────────┘
```

### Berikningsdata (separat fil, bara namn-skriptet)

```
┌─────────────────────────┬───────────┬──────────────────────────────────┐
│ Fält                    │ Källa     │ Beskrivning                      │
├─────────────────────────┼───────────┼──────────────────────────────────┤
│ medboende               │ RL        │ Vilka bor på samma adress        │
│ fordon                  │ RL        │ Registrerade fordon              │
│ snittLonGata            │ RL        │ Medellön på gatan (kr/år)        │
│ anmarkningProcent       │ RL        │ Andel med betalningsanmärkningar │
│ gift                    │ RL        │ Boolean                          │
│ harForetag              │ RL        │ Boolean                          │
│ koordinater             │ RL        │ lat/lng                          │
└─────────────────────────┴───────────┴──────────────────────────────────┘
```

---

## Flöden jämförda

### PNR-skriptet (pnr_lookup_v7.py)

```
Input: Personnummer
  │
  ├─[1] BIL ──→ namn, gatuadress, stad, postnr, lgh-nr
  ├─[2] EP  ──→ telefon, postnr, fastighet (nuv.adr)
  ├─[2b] EC ──→ företag nära nuv. adress (ägare-gissning)
  ├─[PAP]   ──→ ort från postnr
  │
  ├─ MAN    ──→ ny adress, postnr, flyttdatum
  │
  ├─[3] MC  ──→ företag på ny adress → ägare (BRF/HSB)
  ├─[3] MP  ──→ boende på ny adress → personsida → fastighet
  ├─ MAN    ──→ e-post, ev. telefon, ev. fastighet/ägare
  │
  └─→ skvPayload + flyttioPayload
```

### Namn-skriptet (name_lookup_v1.py)

```
Input: Namn (+ valfri stad)
  │
  ├─[1a] RS ──→ namn, PNR, gatuadress, stad, lgh-nr
  ├─[1b] EP ──→ fallback om RS missar (namn → Eniro sökning)
  ├─[2]  MAN ─→ PNR om RS inte gav det (birthDate + 4 siffror)
  │
  ├─[2b] RL ──→ medboende, fordon, snittlön    → enrichment.json
  ├─[2c] EP ──→ telefon, postnr, fastighet (nuv.adr)
  ├─[2d] EC ──→ företag nära nuv. adress (ägare-gissning)
  ├─[3] BIL ──→ bekräfta identitet + lgh-nr
  ├─[PAP]   ──→ ort från postnr
  │
  ├─ MAN    ──→ ny adress, postnr, flyttdatum
  │
  ├─[5] MC  ──→ företag på ny adress → ägare
  ├─[5] MP  ──→ boende på ny adress → fastighet
  ├─ MAN    ──→ e-post, ev. telefon, ev. fastighet/ägare
  │
  └─→ skvPayload + flyttioPayload + enrichment.json
```

---

## Output-format (gemensamt)

Båda skripten producerar en JSON-fil med samma struktur:

```json
{
  "generatedAt": "2026-03-16T06:00:00Z",
  "version": "v7",
  "entryMethod": "personnummer",
  "status": "complete",
  "lookups": {},
  "flyttioPayload": {
    "firstName": "", "lastName": "", "name": "",
    "personalNumber": "", "phone": "", "email": "",
    "fromStreet": "", "fromPostal": "", "fromCity": "",
    "toStreet": "", "toPostal": "", "toCity": "",
    "apartmentNumber": "", "propertyDesignation": "",
    "propertyOwner": "", "moveDate": ""
  },
  "skvPayload": {
    "name": "", "personalNumber": "",
    "inflyttningsdatum": "", "period": "true",
    "gatuadress": "", "postnummer": "", "postort": "",
    "lagenhetsnummer": "", "fastighetsbeteckning": "",
    "fastighetsagare": "", "telefonnummer": "", "email": ""
  },
  "requiredMissing": [],
  "diagnostics": []
}
```

Namn-skriptet sparar dessutom en `*_enrichment.json` med Ratsit-data.

---

## Regel: "Första källan som ger värde vinner"

Alla fält fylls i enligt prioritetsordning (se tabellen ovan).
Om t.ex. Biluppgifter ger `fromStreet` hoppar vi över att fråga Eniro om det.
Om ingen källa ger värde → manuell input (om fältet krävs).
