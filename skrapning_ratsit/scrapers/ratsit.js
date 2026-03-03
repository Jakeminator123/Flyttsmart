// ratsit.se — SPA, internt POST-API /api/search/combined
// Sökresultat interceptas via Playwright response-events

const biluppgifter = require("./biluppgifter");

async function dismissCookies(page) {
  try {
    await page.getByRole("button", { name: "Tillåt alla cookies" }).click({ timeout: 3000 });
    await page.waitForTimeout(500);
  } catch {}
}

function interceptSearchApi(page) {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  const timeout = setTimeout(() => resolve(null), 20000);
  const handler = async (resp) => {
    if (resp.url().includes("/api/search/combined")) {
      try { clearTimeout(timeout); resolve(await resp.json()); } catch { resolve(null); }
    }
  };
  page.on("response", handler);
  return { promise, cleanup: () => page.off("response", handler) };
}

function buildSearchUrl(query, opts = {}) {
  const params = new URLSearchParams({
    vem: query,
    m: opts.male ? "1" : "0",
    k: opts.female ? "1" : "0",
    r: "0", er: "0", b: "0", eb: "0",
    amin: "16", amax: "120", fon: "1",
    page: String(opts.page || 1),
  });
  return `https://www.ratsit.se/sok/person?${params}`;
}

function mapHit(h) {
  return {
    id: h.id,
    firstName: h.firstName || "",
    lastName: h.lastName || "",
    name: [h.firstName, h.lastName].filter(Boolean).join(" "),
    givenName: h.givenName || "",
    age: h.age,
    address: [h.streetAddress, h.city].filter(Boolean).join(", "),
    streetAddress: h.streetAddress || "",
    city: h.city || "",
    gender: h.gender || "",
    married: h.married,
    hasCompany: h.hasCorporateEngagements,
    coordinates: h.coordinates || null,
    profileUrl: h.personUrl || "",
    personnummer: null,
  };
}

async function search(page, query, opts = {}) {
  const url = buildSearchUrl(query, { ...opts, page: 1 });
  const interceptor = interceptSearchApi(page);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissCookies(page);
  const data = await interceptor.promise;
  interceptor.cleanup();

  if (!data?.person) return { totalCount: 0, hits: [] };

  const totalCount = data.person.totalHits || 0;
  let hits = (data.person.hits || []).filter((h) => !h.hidden).map(mapHit);

  const maxPage = Math.min(data.person.pager?.pageCount || 1, 3);
  for (let p = 2; p <= maxPage; p++) {
    const nextUrl = buildSearchUrl(query, { ...opts, page: p });
    const next = interceptSearchApi(page);
    await page.goto(nextUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await dismissCookies(page);
    const nd = await next.promise;
    next.cleanup();
    if (nd?.person?.hits) {
      hits.push(...nd.person.hits.filter((h) => !h.hidden).map(mapHit));
    } else break;
  }

  return { totalCount, hits };
}

async function resolvePnrViaProfile(page, profileUrl) {
  const url = profileUrl.startsWith("http")
    ? profileUrl
    : `https://www.ratsit.se${profileUrl}`;

  let pnr = null;
  const handler = async (resp) => {
    if (!resp.url().includes("/person/biluppgifter/")) return;
    try {
      const data = await resp.json();
      pnr = biluppgifter.extractPnrFromSubjectUri(data?.subjectUri);
    } catch {}
  };

  page.on("response", handler);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  } catch {}
  page.off("response", handler);
  return pnr;
}

module.exports = { search, resolvePnrViaProfile, dismissCookies };
