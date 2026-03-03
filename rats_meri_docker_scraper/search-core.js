/**
 * Kärnlogik för personsökning — används av server.js API:et.
 * Stöder både fullständigt personnummer och fri sökning.
 */

const { browser: br, biluppgifter, ratsit, merinfo } = require("./scrapers");

function buildQuery(inp) {
  const parts = [];
  if (inp.fornamn) parts.push(inp.fornamn);
  if (inp.efternamn) parts.push(inp.efternamn);
  if (inp.pnrDate) parts.push(inp.pnrDate);
  else if (inp.pnr) parts.push(inp.pnr);
  if (inp.stad) parts.push(inp.stad);
  if (inp.gata) parts.push(inp.gata);
  return parts.join(" ");
}

function genderOpts(inp) {
  if (inp.kon === "man" || inp.kon === "m") return { male: true };
  if (inp.kon === "kvinna" || inp.kon === "k") return { female: true };
  if (inp.pnr && inp.pnr.length >= 11) {
    const digits = inp.pnr.replace("-", "");
    if (digits.length === 12) {
      const isMale = parseInt(digits[10], 10) % 2 === 1;
      return isMale ? { male: true } : { female: true };
    }
  }
  return {};
}

async function runSearch(input, log = () => {}) {
  const { browser, page } = await br.launch();
  const results = { strategy: null, totalCount: 0, hits: [], skipped: [] };

  try {
    if (input.pnr && /^\d{8}-?\d{4}$/.test(input.pnr.replace(/\s/g, ""))) {
      const digits = input.pnr.replace("-", "").replace(/\s/g, "");
      const pnr = `${digits.substring(0, 8)}-${digits.substring(8)}`;
      results.strategy = "full_pnr";

      log(`[1/3] Biluppgifter`);
      let name = null;
      try { name = await biluppgifter.lookupName(page, pnr); } catch {}
      if (name) log(`→ Namn: ${name}`); else log("→ Inget namn (skyddad/saknas)");

      const query = name ? `${name} ${pnr}` : pnr;
      const gOpts = !name ? genderOpts(input) : {};
      log(`[2/3] Ratsit söker`);
      const { totalCount, hits } = await ratsit.search(page, query, gOpts);
      results.totalCount = totalCount;

      let match = null;
      if (hits.length === 1) match = hits[0];
      else if (hits.length > 1) {
        for (const hit of hits) {
          if (!hit.profileUrl) continue;
          const resolved = await ratsit.resolvePnrViaProfile(page, hit.profileUrl);
          if (resolved === pnr) { match = hit; match.personnummer = pnr; break; }
        }
      }

      if (match) {
        match.personnummer = pnr;
        const merinfoName = match.givenName ? `${match.givenName} ${match.lastName}` : match.name;
        log(`[3/3] Merinfo`);
        try {
          const mHits = await merinfo.searchPerson(page, merinfoName);
          const mMatch = mHits[0];
          if (mMatch?.profileUrl) {
            const extras = await merinfo.getProfileExtras(page, mMatch.profileUrl);
            if (extras.medboende?.length) match.medboende = extras.medboende.filter(p => p.name !== match.name);
            if (extras.fordonAdress?.length) match.fordonAdress = extras.fordonAdress;
            if (extras.snittLonGata) match.snittLonGata = extras.snittLonGata;
            if (extras.anmarkningProcent) match.anmarkningProcent = extras.anmarkningProcent;
          }
        } catch {}
        results.hits = [match];
      }
    } else {
      results.strategy = "search";
      const query = buildQuery(input);
      const gOpts = genderOpts(input);
      if (!query.trim()) return results;

      log(`[1/2] Ratsit söker`);
      let { totalCount, hits } = await ratsit.search(page, query, gOpts);
      results.totalCount = totalCount;

      const nameTerms = [input.fornamn, input.efternamn].filter(Boolean).map(s => s.toLowerCase());
      if (nameTerms.length > 0 && hits.length > 1) {
        const score = (h) => {
          let s = 0;
          const parts = [h.givenName, h.firstName, h.lastName].map(x => (x || "").toLowerCase());
          for (const term of nameTerms) {
            if (parts.some(p => p.split(" ").includes(term))) s += 10;
            else if (parts.some(p => p.includes(term))) s += 1;
          }
          return s;
        };
        hits.sort((a, b) => score(b) - score(a));
        const topScore = score(hits[0]);
        if (topScore >= 10) {
          const exact = hits.filter(h => score(h) >= 10);
          if (exact.length < hits.length) { hits = exact; results.totalCount = exact.length; }
        }
      }

      if (hits.length > 0 && hits.length <= 15) {
        log(`[2/2] Hämtar personnummer`);
        for (const hit of hits) {
          if (!hit.profileUrl) continue;
          const pnr = await ratsit.resolvePnrViaProfile(page, hit.profileUrl);
          if (pnr) hit.personnummer = pnr;
        }
      } else if (hits.length > 15) results.skipped = ["personnummer_lookup"];
      results.hits = hits;
    }
  } finally {
    await browser.close();
  }
  return results;
}

module.exports = { runSearch };
