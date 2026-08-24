const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto("http://localhost:3001/home?mock=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const logo = page.locator("img[alt='JustGo Health']").first();
  await logo.screenshot({ path: "logo-check.png" });
  const box = await logo.boundingBox();
  console.log("rendered box:", box);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
