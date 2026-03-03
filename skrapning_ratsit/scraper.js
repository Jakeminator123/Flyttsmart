// Interaktiv fritextsökning via Ratsit
// Användning:  node scraper.js   (eller npm run search)

require("dotenv").config();
const readline = require("readline");
const { browser: br, ratsit, biluppgifter } = require("./scrapers");

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function printResults(query, totalCount, hits) {
  console.log();
  console.log(`Sökterm: "${query}"`);
  console.log(`Totalt: ${totalCount}  |  Hämtade: ${hits.length}`);
  console.log("─".repeat(60));

  if (hits.length === 0) {
    console.log("Inga träffar.");
  } else {
    hits.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      if (p.personnummer) console.log(`   Personnr:  ${p.personnummer}`);
      if (p.address) console.log(`   Adress:    ${p.address}`);
      if (p.age) console.log(`   Ålder:     ${p.age} år`);
      if (p.gender) console.log(`   Kön:       ${p.gender === "male" ? "Man" : "Kvinna"}`);
      if (p.married != null) console.log(`   Gift:      ${p.married ? "Ja" : "Nej"}`);
      if (p.hasCompany != null) console.log(`   Bolag:     ${p.hasCompany ? "Ja" : "Nej"}`);
    });
  }

  console.log("─".repeat(60));
}

async function main() {
  console.log("=== Ratsit Scraper ===");
  console.log(`Läge: ${br.HEADLESS ? "headless" : "synlig webbläsare"}\n`);

  const { browser, page } = await br.launch();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let running = true;
  rl.on("close", () => { running = false; });

  try {
    while (running) {
      let query;
      try { query = (await ask(rl, 'Sökterm (eller "exit"): ')).trim(); } catch { break; }
      if (!query || query.toLowerCase() === "exit") break;

      console.log(`\nSöker: "${query}"...\n`);
      try {
        const { totalCount, hits } = await ratsit.search(page, query);

        if (hits.length <= 10 && hits.length > 0) {
          process.stdout.write("  Hämtar personnummer...\n");
          for (const hit of hits) {
            if (!hit.profileUrl) continue;
            hit.personnummer = await ratsit.resolvePnrViaProfile(page, hit.profileUrl);
          }
        }

        printResults(query, totalCount, hits);
      } catch (err) {
        console.error("Fel:", err.message);
      }

      if (!running) break;
      let again;
      try { again = (await ask(rl, "\nSöka igen? (j/n): ")).trim().toLowerCase(); } catch { break; }
      if (again !== "j" && again !== "ja") break;
      console.log();
    }
  } finally {
    rl.close();
    await browser.close();
    console.log("Klar.");
  }
}

main().catch((err) => {
  console.error("Oväntat fel:", err);
  process.exit(1);
});
