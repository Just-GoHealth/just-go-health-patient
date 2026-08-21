import { chromium } from "playwright";
const out = process.argv[2];
const browser = await chromium.launch({ channel: "msedge" });
try {
  const sizes = [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "desktop", width: 1600, height: 900 },
  ];
  for (const sz of sizes) {
    const page = await browser.newPage({
      viewport: { width: sz.width, height: sz.height },
    });
    await page.goto("http://localhost:3001", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/resp-${sz.name}-landing.png` });
    await page.click("text=LOCK IN FOR NSMQ 2026");
    await page.waitForSelector("text=Welcome to LOCK IN 2.0");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/resp-${sz.name}-modal.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
