// Personnummer → maximal personinfo via Biluppgifter + Ratsit + Merinfo
// Användning:  node lookup.js 19860528-0299

require("dotenv").config();
const { browser: br, biluppgifter, ratsit, merinfo } = require("./scrapers");

const input = process.argv[2];
const digits = input ? input.replace("-", "") : "";

if (!/^\d{12}$/.test(digits)) {
  console.error("Användning:  node lookup.js <personnummer>");
  console.error("Exempel:     node lookup.js 19860528-0299");
  process.exit(1);
}

const pnr = digits.substring(0, 8) + "-" + digits.substring(8);
const isMale = parseInt(digits[10], 10) % 2 === 1;

async function main() {
  const gender = isMale ? "man" : "kvinna";
  console.log(`\n  Personnummer:  ${pnr}`);
  console.log(`  Kön (siffra ${digits[10]}): ${gender}`);
  console.log(`  Base64:       ${biluppgifter.pnrToBase64(pnr)}\n`);

  const { browser, page } = await br.launch();

  const result = {
    personnummer: pnr,
    source: {},
  };

  try {
    // ═══════════════════════════════════════════════════
    //  STEG 1 — Biluppgifter.se (base64-trick → namn)
    // ═══════════════════════════════════════════════════
    console.log("─── Steg 1: Biluppgifter.se ───");
    console.log(`  ${biluppgifter.buildUrl(pnr)}`);

    let name = null;
    try {
      name = await biluppgifter.lookupName(page, pnr);
    } catch (e) {
      console.log(`  Fel: ${e.message}`);
    }

    if (name) {
      result.source.biluppgifter = true;
      console.log(`  → ${name}\n`);
    } else {
      result.source.biluppgifter = false;
      console.log("  → Inget namn (skyddad eller saknas)\n");
    }

    // ═══════════════════════════════════════════════════
    //  STEG 2 — Ratsit.se (fullständig persondata)
    // ═══════════════════════════════════════════════════
    console.log("─── Steg 2: Ratsit.se ───");

    const query = name ? `${name} ${pnr}` : pnr;
    const genderOpts = !name ? { male: isMale, female: !isMale } : {};
    console.log(`  Söker: "${query}"`);

    const { totalCount, hits } = await ratsit.search(page, query, genderOpts);
    console.log(`  → ${hits.length} av ${totalCount} träffar`);

    let match = null;

    if (hits.length === 1) {
      match = hits[0];
    } else if (hits.length > 1) {
      console.log("  Verifierar personnummer via profilsidor...");
      for (const hit of hits) {
        if (!hit.profileUrl) continue;
        const resolved = await ratsit.resolvePnrViaProfile(page, hit.profileUrl);
        const ok = resolved === pnr;
        console.log(`    ${ok ? "✓" : "✗"} ${hit.name.padEnd(38)} ${resolved || "skyddad"}`);
        if (ok) { match = hit; break; }
      }
    }

    if (match) {
      result.source.ratsit = true;
      result.namn = match.name;
      result.tilltalsnamn = match.givenName;
      result.adress = match.address;
      result.gatuadress = match.streetAddress;
      result.stad = match.city;
      result.alder = match.age;
      result.kon = match.gender === "male" ? "Man" : "Kvinna";
      result.gift = match.married;
      result.bolag = match.hasCompany;
      result.koordinater = match.coordinates;
      result.profilUrl = match.profileUrl;
      console.log(`  → ${result.namn}\n`);
    } else {
      result.source.ratsit = false;
      console.log("  → Ingen matchning\n");
    }

    // ═══════════════════════════════════════════════════
    //  STEG 3 — Merinfo.se (medboende, fordon, statistik)
    // ═══════════════════════════════════════════════════
    if (result.namn) {
      console.log("─── Steg 3: Merinfo.se ───");
      // Merinfo söker bäst på tilltalsnamn + efternamn (utan stad)
      const merinfoName = result.tilltalsnamn
        ? `${result.tilltalsnamn} ${result.namn.split(" ").pop()}`
        : result.namn;
      console.log(`  Söker: "${merinfoName}"`);

      try {
        let merinfoHits = await merinfo.searchPerson(page, merinfoName);
        if (merinfoHits.length === 0 && merinfoName !== result.namn) {
          merinfoHits = await merinfo.searchPerson(page, result.namn);
        }
        const merinfoMatch = merinfoHits[0];

        if (merinfoMatch?.profileUrl) {
          console.log(`  → ${merinfoMatch.name}`);
          const extras = await merinfo.getProfileExtras(page, merinfoMatch.profileUrl);
          result.source.merinfo = true;

          if (extras.medboende?.length > 0) {
            result.medboende = extras.medboende
              .filter((p) => p.name !== result.namn)
              .map((p) => ({ namn: p.name, alder: p.age }));
          }
          if (extras.fordonAdress?.length > 0) {
            result.fordonPaAdressen = extras.fordonAdress.map((v) => ({
              regnr: v.regno,
              modell: v.model,
              ar: v.year,
              agare: v.owner,
            }));
          }
          if (extras.snittLonGata) result.snittLonGata = parseInt(extras.snittLonGata, 10);
          if (extras.anmarkningProcent) result.anmarkningProcentKommun = extras.anmarkningProcent;

          console.log(`  → Medboende: ${result.medboende?.length || 0}`);
          console.log(`  → Fordon på adressen: ${result.fordonPaAdressen?.length || 0}\n`);
        } else {
          result.source.merinfo = false;
          console.log("  → Ingen träff\n");
        }
      } catch (e) {
        result.source.merinfo = false;
        console.log(`  → Fel: ${e.message}\n`);
      }
    }

    // ═══════════════════════════════════════════════════
    //  RESULTAT
    // ═══════════════════════════════════════════════════
    if (result.namn) {
      console.log("═".repeat(60));
      console.log(`  ${pnr} — ${result.namn}`);
      console.log("═".repeat(60));
      console.log(`  Tilltalsnamn:   ${result.tilltalsnamn || "-"}`);
      console.log(`  Ålder:          ${result.alder} år`);
      console.log(`  Kön:            ${result.kon}`);
      console.log(`  Gift:           ${result.gift ? "Ja" : "Nej"}`);
      console.log(`  Adress:         ${result.adress || "-"}`);
      console.log(`  Bolagsengagemang: ${result.bolag ? "Ja" : "Nej"}`);

      if (result.koordinater?.lat)
        console.log(`  Koordinater:    ${result.koordinater.lat}, ${result.koordinater.lng}`);

      if (result.medboende?.length > 0) {
        console.log(`  Medboende:`);
        result.medboende.forEach((m) => console.log(`    - ${m.namn} (${m.alder} år)`));
      }

      if (result.fordonPaAdressen?.length > 0) {
        console.log(`  Fordon på adressen:`);
        result.fordonPaAdressen.forEach((f) =>
          console.log(`    - ${f.regnr}: ${f.modell} (${f.ar}) — ${f.agare}`)
        );
      }

      if (result.snittLonGata)
        console.log(`  Snittlön (gatan): ${result.snittLonGata.toLocaleString("sv-SE")} kr/år`);
      if (result.anmarkningProcentKommun)
        console.log(`  Anmärkningar (kommun): ${result.anmarkningProcentKommun}%`);

      console.log(`  Källor:         ${Object.entries(result.source).filter(([, v]) => v).map(([k]) => k).join(", ")}`);
      console.log("═".repeat(60));

      // JSON-output till stdout för Python-parsning
      if (process.env.JSON_OUTPUT === "true") {
        console.log("\n__JSON_START__");
        console.log(JSON.stringify(result, null, 2));
        console.log("__JSON_END__");
      }
    } else {
      console.log(`Personnumret ${pnr} kunde inte identifieras.`);
      console.log("Personen kan ha skyddade uppgifter (sekretessmarkering).");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Oväntat fel:", err);
  process.exit(1);
});
