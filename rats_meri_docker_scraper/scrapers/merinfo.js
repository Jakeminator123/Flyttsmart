// merinfo.se — SPA med server-side HTML för sökresultat
// Kompletterar med medboende, fordon på adressen, lönestatistik

async function dismissCookies(page) {
  try {
    await page.getByRole("button", { name: "GODKÄNN" }).click({ timeout: 3000 });
    await page.waitForTimeout(500);
  } catch {}
}

async function searchPerson(page, name) {
  const url = `https://www.merinfo.se/search?who=${encodeURIComponent(name)}&where=&page=1`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await dismissCookies(page);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  return page.evaluate(() => {
    const results = [];
    const seen = new Set();

    for (const a of document.querySelectorAll('a[href*="/person/"]')) {
      const href = a.getAttribute("href") || "";
      if (!href.includes("/person/") || href.includes("#") || href.includes("/login")) continue;
      const name = a.textContent.trim();
      if (!name || name.length < 3 || seen.has(href)) continue;
      seen.add(href);
      results.push({ name, profileUrl: href });
    }
    return results;
  });
}

async function getProfileExtras(page, profileUrl) {
  const url = profileUrl.startsWith("http")
    ? profileUrl
    : `https://www.merinfo.se${profileUrl}`;

  const collected = {};

  const handler = async (resp) => {
    const u = resp.url();
    if (!u.includes("/api/v1/people/")) return;
    try {
      const data = await resp.json();
      if (u.includes("/addresses/people")) collected.medboende = data?.data?.people || [];
      if (u.includes("/addresses/vehicles")) collected.fordonAdress = data?.data?.vehicles || [];
    } catch {}
  };

  page.on("response", handler);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  page.off("response", handler);

  const bodyText = await page.evaluate(() => document.body?.innerText || "");

  const salaryMatch = bodyText.match(/([\d\s]+)\s*kr om året/);
  if (salaryMatch) {
    collected.snittLonGata = parseInt(salaryMatch[1].replace(/\s/g, ""), 10) || null;
  }
  const fogdeMatch = bodyText.match(/([\d,]+)\s*%\s*av alla personer en anmärkning/);
  if (fogdeMatch) collected.anmarkningProcent = fogdeMatch[1];

  return collected;
}

module.exports = { searchPerson, getProfileExtras };
