const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  await page.goto("http://localhost:3001/home?mock=board", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "mobile-closed.png", fullPage: true });
  const hasHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  console.log("horizontal scroll present:", hasHScroll);

  const dome = page.locator("button[aria-expanded]").first();
  await dome.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "mobile-open.png", fullPage: true });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
