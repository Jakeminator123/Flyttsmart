# Arkitektur: Admin Cost Dashboard

**Datum:** 2026-03-04

---

## 1. Vad ändrades och varför

En ny underordnad del av admin-sidan har lagts till för att spåra och visualisera **usage- och kostnadsdata** över olika providers och flöden. Syftet är att ge en överblick av:

- Antal requests, tokens och uppskattad kostnad (USD)
- Latens och success rate
- Kostnadstrender per dag och provider

**Orsak:** Innan fanns ingen samlad vy över faktisk användning eller uppskattade kostnader för OpenAI, Brave, Eniro, OpenClaw gateway, jämförelser m.m. Nu samlas events i Turso och visas i en admin-dashboard.

---

## 2. Dataflödesdiagram (textbaserat)

### 2.1 Insamling (write path)

```
[API-rutter / tjänster]
   |
   |  trackUsage({ provider, flow, route, ... })
   v
[lib/usage/tracker.ts]
   |
   |  estimateCostUsd()  -- OpenAI: modelllookup | Brave: BRAVE_COST_PER_QUERY_USD
   |  persistUsage()     -- fire-and-forget INSERT
   v
[usage_events] (Turso/SQLite)
```

### 2.2 Instrumentation-punkter

```
+------------------+-----------------------------+------------------+
| Modul            | Flöde                        | Provider         |
+------------------+-----------------------------+------------------+
| explicit-web-search| web_search, web_search_fallback | brave, openai |
| lib/aida/enrich   | enrichment                  | pap, nominatim,  |
|                  |                             | eniro, scb, ratsit|
| lib/comparison    | comparison                  | openai           |
| brave-search.ts   | web_search                  | brave            |
| eniro.ts          | enrichment                  | eniro            |
| /api/did/chat     | gateway_simple/general/     | openclaw_gateway |
|                   | comparison                  |                  |
| /api/openclaw/chat| (samma)                    | openclaw_gateway |
+------------------+-----------------------------+------------------+
```

### 2.3 Admin-dashboard (read path)

```
[Admin: /admin/kostnader]
   |
   |  GET /api/admin/usage?period=24h|7d|30d
   v
[/api/admin/usage/route.ts]
   |
   |  runSql() x 4: summary, byProvider, byFlow, dailyTrend
   v
[usage_events] (Turso)
   |
   |  JSON { summary, byProvider, byFlow, dailyTrend }
   v
[Kostnader-sida]  -- statkort, tabeller, stackad AreaChart
```

---

## 3. Miljövariabler (subsystemet)

| Variabel                     | Typ    | Beskrivning                                           |
|-----------------------------|--------|-------------------------------------------------------|
| `BRAVE_COST_PER_QUERY_USD`  | number | Kostnad per Brave-sökning (USD). Överskrider default 0. |
| *(befintliga)*              |        |                                                       |
| `TURSO_DATABASE_URL`        | string | Turso DB för `usage_events` (samma som övrig app)   |
| `TURSO_AUTH_TOKEN`          | string | Turso auth (samma som övrig app)                     |

**Kostnadsuppskattning:**

- **OpenAI**: Inbyggd modelllookup (`gpt-4.1-mini`, `gpt-5.1-codex`, `gpt-5.3-codex`). Övriga modeller → 0.
- **Brave**: `BRAVE_COST_PER_QUERY_USD` (default 0) per sökning.
- **Övriga** (pap, eniro, nominatim, scb, ratsit, openclaw_gateway): Ingen kostnadsräkning i tracker → 0 (uppskattningen är approximativ).

---

## 4. Bevaret vs borttaget

| Status   | Beskrivning                                                             |
|----------|--------------------------------------------------------------------------|
| **Bevaret** | Alla befintliga API-rutter och tjänster fungerar som tidigare.         |
| **Bevaret** | Inga befintliga env-variabler togs bort eller ändrades i beteende.     |
| **Bevaret** | Admin-sidebar, admin-layout och övriga admin-sidor oförändrade.        |
| **Nytt** | Tabell `usage_events` i Turso.                                          |
| **Nytt** | `lib/usage/tracker.ts` med `trackUsage()`, `extractTokenUsage()`.      |
| **Nytt** | Instrumentation i explicit web search, compare, gateway-rutter, enrich, provider-klienter. |
| **Nytt** | API `/api/admin/usage`.                                                 |
| **Nytt** | Admin-sida `/admin/kostnader` + sidebar-länk "Kostnader".               |
| **Borttaget** | Inget. Detta är en additiv ändring.                                  |
