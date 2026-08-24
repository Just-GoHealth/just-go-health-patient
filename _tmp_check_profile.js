const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto("http://localhost:3001/home?mock=board", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "check-profile.png", fullPage: false });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
