# rats_meri_docker_scraper

REST API för personnummeruppslag via Biluppgifter.se, Ratsit.se och Merinfo.se.

**Fordon krävs inte.** Biluppgifter.se visar personens namn även för privatpersoner utan registrerade fordon ("Ägarinformation [Namn], en privatperson...").

## API

| Endpoint | Method | Body | Beskrivning |
|----------|--------|------|-------------|
| `/lookup` | POST | `{ "pnr": "19860528-0299" }` | En person, full data |
| `/search` | POST | `{ "fornamn": "Jakob", "efternamn": "Eberg", "stad": "Stockholm" }` | Fri sökning, lista kandidater |
| `/batch` | POST | `{ "pnrs": ["19860528-0299", "19900101-1234"] }` | Upp till 10 personnummer |
| `/health` | GET | — | Health check |

## Lokalt

```bash
npm install
npm start
# eller: HEADLESS=false npm start  (visa browser)
```

## Render

1. Skapa ny Web Service på Render
2. Connect repo, Root Directory: `rats_meri_docker_scraper`
3. Runtime: Docker
4. Deploy

Render sätter `PORT` automatiskt. Health check: `GET /health`.
