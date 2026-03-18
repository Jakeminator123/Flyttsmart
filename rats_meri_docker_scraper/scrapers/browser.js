const { chromium } = require("playwright");

const HEADLESS = process.env.HEADLESS !== "false";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function launch() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    extraHTTPHeaders: { "accept-language": "sv-SE,sv;q=0.9" },
  });
  const page = await context.newPage();
  return { browser, page };
}

module.exports = { HEADLESS, launch };
