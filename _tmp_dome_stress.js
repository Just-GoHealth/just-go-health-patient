const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  // desktop, wide - matches the real screenshot's ~1850px window
  let page = await browser.newPage({ viewport: { width: 1850, height: 900 } });
  await page.goto("http://localhost:3001/home?mock=board", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "stress-wide.png", fullPage: false });
  await page.close();

  // mobile narrow
  page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  await page.goto("http://localhost:3001/home?mock=board", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "stress-mobile.png", fullPage: true });
  const dome = page.locator("button[aria-expanded]").first();
  await dome.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "stress-mobile-open.png", fullPage: true });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
