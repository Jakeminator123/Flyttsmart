/**
 * rats_meri_docker_scraper — REST API för personnummeruppslag
 *
 * Endpoints:
 *   POST /lookup     { "pnr": "19860528-0299" }
 *   POST /search     { "fornamn": "Jakob", "efternamn": "Eberg", "stad": "Stockholm" }
 *   POST /batch      { "pnrs": ["19860528-0299", "19900101-1234"] }
 *   GET  /health
 */

require("dotenv").config();
const express = require("express");
const { runSearch } = require("./search-core");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8766;

function normalizePnr(v) {
  const s = String(v || "").replace(/\s|-/g, "");
  if (/^\d{12}$/.test(s)) return `${s.slice(0, 8)}-${s.slice(8)}`;
  return null;
}

function log(req, msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// POST /lookup — personnummer → en person
app.post("/lookup", async (req, res) => {
  try {
    const pnr = normalizePnr(req.body?.pnr);
    if (!pnr) {
      return res.status(400).json({ error: "pnr required (YYYYMMDD-NNNN)" });
    }
    log(req, `lookup ${pnr}`);
    const result = await runSearch({ pnr }, (m) => log(req, m));
    if (result.hits.length === 0) {
      return res.status(404).json({ error: "Person hittades inte", strategy: result.strategy });
    }
    res.json(result.hits[0]);
  } catch (err) {
    console.error("[lookup]", err);
    res.status(500).json({ error: err.message || "Internt fel" });
  }
});

// POST /search — fri sökning → lista kandidater
app.post("/search", async (req, res) => {
  try {
    const { fornamn, efternamn, pnrDate, pnr, stad, gata, kon } = req.body || {};
    const input = { fornamn, efternamn, pnrDate, pnr, stad, gata, kon };
    if (!input.pnr && !input.pnrDate && !input.fornamn && !input.efternamn && !input.stad && !input.gata) {
      return res.status(400).json({ error: "Anges minst ett sökfält" });
    }
    log(req, `search ${JSON.stringify(input)}`);
    const result = await runSearch(input, (m) => log(req, m));
    res.json(result);
  } catch (err) {
    console.error("[search]", err);
    res.status(500).json({ error: err.message || "Internt fel" });
  }
});

// POST /batch — flera personnummer → lista resultat
app.post("/batch", async (req, res) => {
  try {
    const raw = req.body?.pnrs;
    const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const pnrs = arr.map((v) => normalizePnr(v)).filter(Boolean);
    if (pnrs.length === 0) {
      return res.status(400).json({ error: "pnrs required (array av YYYYMMDD-NNNN)" });
    }
    if (pnrs.length > 10) {
      return res.status(400).json({ error: "Max 10 personnummer per batch" });
    }
    log(req, `batch ${pnrs.length} PNR`);
    const results = [];
    for (const pnr of pnrs) {
      try {
        const result = await runSearch({ pnr }, () => {});
        const hit = result.hits[0] || null;
        results.push({ pnr, ...(hit ? { ok: true, data: hit } : { ok: false, error: "Ej hittad" }) });
      } catch (e) {
        results.push({ pnr, ok: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (err) {
    console.error("[batch]", err);
    res.status(500).json({ error: err.message || "Internt fel" });
  }
});

// GET /health
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "rats-meri-docker-scraper",
    version: "1.0.0",
    time: new Date().toISOString(),
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`rats_meri_docker_scraper listening on port ${PORT}`);
});
