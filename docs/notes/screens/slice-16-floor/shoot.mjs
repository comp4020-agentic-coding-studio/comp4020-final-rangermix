// Screens for slice 16's floor sizes (docs/notes/slice-16-study.md, round
// 2): the café at 1920x1080 with 32-px tiles, the bars floating, the street
// across the window and the terrace, its floor at each size, by day and by
// night. Each size runs against a café started with that size's room.toml
// (the study's run2.sh), and a client built with spike.patch.
// Usage: node shoot.mjs <cols>x<rows> <name>
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:18917";
const [size, name] = process.argv.slice(2);
const [cols, rows] = size.split("x");
const browser = await chromium.launch();
for (const [hour, when, scheme] of [["10:00", "day", "light"], ["22:00", "night", "dark"]]) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: scheme });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`2026-11-06T${hour}:00+11:00`) });
  await page.clock.resume();
  await page.goto(`${base}/?cols=${cols}&rows=${rows}&float=1&fill=1&corners=terrace`);
  await page.locator("#signup input[name=name]").fill(`s16${Date.now().toString(36)}`);
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.waitForTimeout(1500);
  await page.mouse.move(960, 2);
  const scale = await page.evaluate(() => getComputedStyle(document.getElementById("room")).width);
  console.log(when, name, size, scale);
  await page.screenshot({ path: path.join(out, `${name}-${when}.png`) });
  await page.locator("#leave").click();
  await context.close();
}
await browser.close();
