// Flexibel personsökning: tar strukturerat JSON-input från CLI,
// söker optimalt och returnerar JSON-resultat.
// Kallas av main.py men kan också köras direkt.
//
// Argument: node search.js '<json-sträng>'
// t.ex.:   node search.js '{"fornamn":"Jakob","efternamn":"Eberg"}'

require("dotenv").config();
const { browser: br, biluppgifter, ratsit, merinfo } = require("./scrapers");

const input = JSON.parse(process.argv[2] || "{}");

function log(msg) {
  // Verbose logging till stderr — syns i terminalen men stör inte JSON-output
  process.stderr.write("  " + msg + "\n");
}

function buildQuery(inp) {
  const parts = [];
  if (inp.fornamn) parts.push(inp.fornamn);
  if (inp.efternamn) parts.push(inp.efternamn);
  if (inp.pnrDate) parts.push(inp.pnrDate); // t.ex. "19860528"
  else if (inp.pnr) parts.push(inp.pnr);
  if (inp.stad) parts.push(inp.stad);
  if (inp.gata) parts.push(inp.gata);
  return parts.join(" ");
}

function genderOpts(inp) {
  if (inp.kon === "man" || inp.kon === "m") return { male: true };
  if (inp.kon === "kvinna" || inp.kon === "k") return { female: true };
  // Kan räknas ut från fullständigt PNR
  if (inp.pnr && inp.pnr.length >= 11) {
    const digits = inp.pnr.replace("-", "");
    if (digits.length === 12) {
      const isMale = parseInt(digits[10], 10) % 2 === 1;
      return isMale ? { male: true } : { female: true };
    }
  }
  return {};
}

async function run() {
  const { browser, page } = await br.launch();
  const results = { strategy: null, totalCount: 0, hits: [], skipped: [] };

  try {
    // ─── Strategi 1: Fullständigt personnummer ───
    if (input.pnr && /^\d{8}-?\d{4}$/.test(input.pnr.replace(/\s/g, ""))) {
      const digits = input.pnr.replace("-", "").replace(/\s/g, "");
      const pnr = `${digits.substring(0, 8)}-${digits.substring(8)}`;
      results.strategy = "full_pnr";

      log(`Strategi: Fullständigt personnummer → Biluppgifter + Ratsit + Merinfo`);
      log(`Base64: ${biluppgifter.pnrToBase64(pnr)}`);

      // Steg 1: Biluppgifter
      log(`[1/3] biluppgifter.se/brukare/${biluppgifter.pnrToBase64(pnr)}`);
      let name = null;
      try { name = await biluppgifter.lookupName(page, pnr); } catch {}
      if (name) log(`→ Namn: ${name}`);
      else log("→ Inget namn (skyddad eller saknas)");

      // Steg 2: Ratsit
      const query = name ? `${name} ${pnr}` : pnr;
      const gOpts = !name ? genderOpts(input) : {};
      log(`[2/3] Ratsit söker: "${query}"`);
      const { totalCount, hits } = await ratsit.search(page, query, gOpts);
      results.totalCount = totalCount;
      log(`→ ${hits.length} av ${totalCount} träffar`);

      let match = null;
      if (hits.length === 1) {
        match = hits[0];
      } else if (hits.length > 1) {
        log("→ Flera träffar, verifierar personnummer...");
        for (const hit of hits) {
          if (!hit.profileUrl) continue;
          const resolved = await ratsit.resolvePnrViaProfile(page, hit.profileUrl);
          const ok = resolved === pnr;
          log(`  ${ok ? "✓" : "✗"} ${hit.name} → ${resolved || "skyddad"}`);
          if (ok) { match = hit; match.personnummer = pnr; break; }
        }
      }

      if (match) {
        match.personnummer = pnr;
        // Steg 3: Merinfo
        const merinfoName = match.givenName
          ? `${match.givenName} ${match.lastName}`
          : match.name;
        log(`[3/3] Merinfo söker: "${merinfoName}"`);
        try {
          const mHits = await merinfo.searchPerson(page, merinfoName);
          const mMatch = mHits[0];
          if (mMatch?.profileUrl) {
            log(`→ ${mMatch.name}`);
            const extras = await merinfo.getProfileExtras(page, mMatch.profileUrl);
            if (extras.medboende?.length) match.medboende = extras.medboende.filter(p => p.name !== match.name);
            if (extras.fordonAdress?.length) match.fordonAdress = extras.fordonAdress;
            if (extras.snittLonGata) match.snittLonGata = extras.snittLonGata;
            if (extras.anmarkningProcent) match.anmarkningProcent = extras.anmarkningProcent;
            log(`→ Medboende: ${match.medboende?.length || 0}, Fordon: ${match.fordonAdress?.length || 0}`);
          } else { log("→ Ingen träff"); }
        } catch (e) { log(`→ Merinfo-fel: ${e.message}`); }

        results.hits = [match];
      }

    // ─── Strategi 2: Sökning med vad vi har ───
    } else {
      results.strategy = "search";
      const query = buildQuery(input);
      const gOpts = genderOpts(input);

      if (!query.trim()) {
        log("FEL: Inget sökunderlag angivet.");
        process.stdout.write(JSON.stringify(results));
        return;
      }

      const genderLabel = gOpts.male ? " [man]" : gOpts.female ? " [kvinna]" : "";
      log(`Strategi: Fri sökning${genderLabel}`);
      log(`[1/2] Ratsit söker: "${query}"`);

      let { totalCount, hits } = await ratsit.search(page, query, gOpts);
      results.totalCount = totalCount;
      log(`→ ${totalCount} totalt, ${hits.length} hämtade`);

      // Smart-filter: om input har namn-termer, ranka träffar där
      // givenName/firstName/lastName matchar exakt högre, och filtrera
      // bort fuzzy-matchningar (t.ex. "Jakobsen" när man sökte "Jakob")
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
          if (exact.length < hits.length) {
            log(`→ Filtrerar: ${exact.length} exakt matchning(ar) av ${hits.length} (namn: ${nameTerms.join(", ")})`);
            hits = exact;
            totalCount = exact.length;
            results.totalCount = totalCount;
          }
        }
      }

      if (hits.length > 0 && hits.length <= 15) {
        log(`[2/2] Hämtar personnummer för ${hits.length} person(er)...`);
        for (let i = 0; i < hits.length; i++) {
          const hit = hits[i];
          if (!hit.profileUrl) continue;
          const pnr = await ratsit.resolvePnrViaProfile(page, hit.profileUrl);
          if (pnr) { hit.personnummer = pnr; log(`  ${i+1}. ${hit.name} → ${pnr}`); }
          else { log(`  ${i+1}. ${hit.name} → skyddad`); }
        }
      } else if (hits.length > 15) {
        log(`[2/2] Hoppas över PNR-hämtning (${hits.length} träffar, max 15)`);
        results.skipped = ["personnummer_lookup"];
      }

      results.hits = hits;
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  process.stderr.write(`FEL: ${e.message}\n`);
  process.exit(1);
});
