# Ratsit Scraper

Personnummeruppslag och personsökning via tre svenska sajter:
**Biluppgifter.se**, **Ratsit.se** och **Merinfo.se**.

Givet enbart ett personnummer hämtas namn, adress, ålder, kön, civilstånd,
bolagsengagemang och GPS-koordinater — utan inloggning, ~5 sekunder.

Se [ARCHITECTURE.md](ARCHITECTURE.md) för teknisk dokumentation av hur
sajt-triangeln och base64-tricket fungerar.

## Installation

```bash
npm install
```

## Användning

### Personnummeruppslag (huvudskript)

```bash
node lookup.js 19860528-0299
# eller via Python:
python main.py 19860528-0299
python main.py --json 19860528-0299      # med JSON-output
python main.py 19860528-0299 19860528-0109   # flera på en gång
```

Flödet:
1. **Biluppgifter.se** — base64-kodar personnumret, hämtar namn (~1s)
2. **Ratsit.se** — söker namn + personnummer, interceptar API:et (~2s)
3. **Merinfo.se** — berikar med medboende, fordon, statistik (~2s)

Exempelutput:

```
════════════════════════════════════════════════════════════
  19860528-0299 — Jakob Olof Eberg
════════════════════════════════════════════════════════════
  Tilltalsnamn:   Jakob
  Ålder:          39 år
  Kön:            Man
  Gift:           Ja
  Adress:         Folkungagatan 83 lgh 1401, Stockholm
  Bolagsengagemang: Ja
  Koordinater:    59.315234607808065, 18.080602191911787
  Källor:         biluppgifter, ratsit
════════════════════════════════════════════════════════════
```

### Interaktiv fritextsökning

```bash
node scraper.js
```

Stödjer namn, personnummer, adress och kombinationer.
Vid ≤10 träffar hämtas fullständiga personnummer automatiskt.

## Konfiguration

Kopiera `.env.example` till `.env`:

| Variabel   | Default | Beskrivning                                    |
|------------|---------|------------------------------------------------|
| `HEADLESS` | `true`  | `false` = visa webbläsarfönstret (debug-läge)  |

## Filstruktur

```
├── main.py              Python-entry: personnummer → max info
├── lookup.js            Node.js: orchestrerar alla tre sajter
├── scraper.js           Node.js: interaktiv fritextsökning
├── scrapers/
│   ├── index.js         Exporterar alla moduler
│   ├── browser.js       Playwright browser-hantering
│   ├── biluppgifter.js  biluppgifter.se (base64-trick, namnuppslag)
│   ├── ratsit.js        ratsit.se (sök-API, profilsidor, personnummer)
│   └── merinfo.js       merinfo.se (medboende, fordon, statistik)
├── ARCHITECTURE.md      Hur triangeln och base64-tricket fungerar
├── FINDINGS.txt         Alla tekniska fynd (rate limits, API:er, etc)
├── .env / .env.example  Konfiguration
└── package.json         Dependencies
```

## Dokumentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Triangeln av sajter, base64-knäckningen, dataflöde
- **[FINDINGS.txt](FINDINGS.txt)** — Rate limiting, sökkombinationer, API-format, URL-mönster
