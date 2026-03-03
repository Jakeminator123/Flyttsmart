# Arkitektur — Triangeln

Tre publika sajter korsrefereras för att gå från **enbart personnummer** till
**fullständig personinformation** — utan inloggning, utan BankID.

```
                    ┌──────────────────────┐
                    │    PERSONNUMMER       │
                    │    19860528-0299      │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┤
             │                 │
             ▼                 │
  ┌─────────────────────┐     │
  │   BILUPPGIFTER.SE   │     │
  │                     │     │
  │  base64(pnr) → URL  │     │
  │  Ger: namn           │     │
  └──────────┬──────────┘     │
             │                 │
             │   namn + pnr    │
             │                 │
             ▼                 │
  ┌─────────────────────┐     │
  │     RATSIT.SE       │     │
  │                     │◄────┘  (fallback: pnr + könsfilter)
  │  Sök-API → 1 träff   │
  │  Ger: namn, adress,  │
  │  ålder, kön, gift,   │
  │  bolag, koordinater  │
  └──────────┬──────────┘
             │
             │   namn
             │
             ▼
  ┌─────────────────────┐
  │    MERINFO.SE       │
  │                     │
  │  Sök på namn+stad   │
  │  Ger: medboende,    │
  │  fordon på adressen,│
  │  lönestatistik,     │
  │  kronofogde-snitt   │
  └─────────────────────┘
```

## Så knäcktes koden

### Problemet

Ratsit maskerar personnumrets sista 4 siffror: `19860528-XXXX`.
Sökning med personnummer utan inloggning ignorerar individnumret helt
och returnerar alla ~400 personer födda samma dag.

### Upptäckten: base64 i biluppgifter-URL

Varje profilsida på Ratsit anropar ett internt API:

```
GET https://www.ratsit.se/person/biluppgifter/{person-hash}
```

Svaret innehåller:

```json
{
  "subjectUri": "https://biluppgifter.se/brukare/MTk4NjA1MjgwMjk5",
  "subjectNumberOfVehicles": 0,
  "vehiclesOnAddress": [...]
}
```

Strängen `MTk4NjA1MjgwMjk5` är standard **base64**:

```
base64("198605280299") = "MTk4NjA1MjgwMjk5"
Buffer.from("MTk4NjA1MjgwMjk5", "base64").toString() = "198605280299"
```

Det fullständiga personnumret — i klartext — kodat med enbart base64 (ingen kryptering).

### Den omvända vägen: personnummer → namn

Om base64(personnummer) finns i URL:en **till** biluppgifter.se, kan vi
bygga URL:en **från** personnumret:

```
personnummer:  19860528-0299
utan streck:   198605280299
base64:        MTk4NjA1MjgwMjk5
URL:           https://biluppgifter.se/brukare/MTk4NjA1MjgwMjk5
```

Biluppgifter.se renderar **server-side** (htmx, ingen JS krävs) och visar:

> *"Emelie Lundqvist, en privatperson som är 39 år..."*
> *"Visa Emelie Lundqvist på Ratsit"*

### Kombinerat flöde

Med namnet från biluppgifter söker vi `"Emelie Lundqvist 19860528-0109"`
på Ratsit — och får **exakt 1 träff** med fullständig data.

Total tid: **3–6 sekunder**, 100% headless.


## Datakällor per sajt

### Biluppgifter.se (steg 1)

| Fält | Tillgängligt |
|------|-------------|
| Namn (för+efternamn) | Ja |
| Ålder | Ja |
| Stad | Ja |
| Adress | Ja |
| Fordon (personen) | Ja |
| Fordon (adressen) | Ja |

Teknik: Server-side rendering (htmx). Innehåll klart vid `domcontentloaded`.
Ingen cookie-banner, inga API-anrop att intercepta.

### Ratsit.se (steg 2)

| Fält | Tillgängligt |
|------|-------------|
| Fullständigt namn | Ja |
| Tilltalsnamn | Ja |
| Ålder | Ja |
| Gatuadress + postnr | Ja |
| Stad | Ja |
| Kön | Ja |
| Civilstånd | Ja |
| Bolagsengagemang | Ja |
| GPS-koordinater | Ja |
| Personnummer (fullt) | Via biluppgifter-API |
| Lön | Kräver betalning |
| Kreditupplysning | Kräver BankID |

Teknik: SPA med internt POST-API (`/api/search/combined`). Interceptas
via Playwright response-events.

### Merinfo.se (steg 3)

| Fält | Tillgängligt |
|------|-------------|
| Namn, ålder, adress | Ja (samma som Ratsit) |
| Medboende (namn+ålder) | Ja |
| Fordon på adressen | Ja |
| Lönestatistik (gatusnitt) | Ja |
| Kronofogde-statistik | Ja (kommun-snitt) |
| Personnummer (fullt) | Nej (XXXX, kräver login) |
| Telefonnummer | Kräver betalning |

Teknik: SPA med REST-API (`/api/v1/search/results`, `/api/v1/people/{uuid}/*`).
Cookie-consent krävs. Personnummersökning fungerar ej.

## Säkerhet och begränsningar

- **Sekretessmarkerade personer** (~1%) syns inte på någon sajt
- **Utan inloggning** visar Ratsit max 30 sökresultat (3 sidor)
- **Rate limiting** testat med 20 snabba anrop — inga blockeringar
- **Cloudflare** sitter framför alla tre sajter men triggas inte vid normal volym
