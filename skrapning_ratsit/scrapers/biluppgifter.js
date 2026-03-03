// biluppgifter.se — server-side rendered, htmx
// personnummer → base64 → URL → namn + adress + fordon

function pnrToBase64(pnr) {
  return Buffer.from(pnr.replace("-", "")).toString("base64");
}

function base64ToPnr(b64) {
  try {
    const d = Buffer.from(b64, "base64").toString("utf8");
    if (/^\d{12}$/.test(d)) return d.substring(0, 8) + "-" + d.substring(8);
  } catch {}
  return null;
}

function buildUrl(pnr) {
  return `https://biluppgifter.se/brukare/${pnrToBase64(pnr)}`;
}

async function lookupName(page, pnr) {
  const url = buildUrl(pnr);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

  return page.evaluate(() => {
    const body = document.body?.innerText || "";
    const link = body.match(/Visa\s+(.+?)\s+på Ratsit/);
    if (link) return link[1].trim();
    const h1 = body.match(/Ägarinformation\s+(.+?)\s*,\s*en /);
    if (h1) return h1[1].trim();
    return null;
  });
}

function extractPnrFromSubjectUri(uri) {
  const m = uri?.match(/brukare\/([A-Za-z0-9+/=]+)/);
  return m ? base64ToPnr(m[1]) : null;
}

module.exports = { pnrToBase64, base64ToPnr, buildUrl, lookupName, extractPnrFromSubjectUri };
