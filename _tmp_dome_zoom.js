

const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto("http://localhost:3001/home?mock=board", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "dome-full.png", fullPage: false });

  const dome = page.locator("button[aria-expanded]").first();
  await dome.screenshot({ path: "dome-zoom.png" });

  // click to open one and screenshot the open state too
  await dome.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "dome-open.png", fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
