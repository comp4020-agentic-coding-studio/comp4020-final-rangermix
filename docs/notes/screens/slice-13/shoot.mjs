// Screenshots for slice 13, against a local café (APP_URL, default
// http://localhost:8080): the room crisp on its street at 10:00 and 22:00,
// at 1920×1080 and 390×844, and the room's canvas on its own at 10:00 and
// 22:00 for the judged line.
// Usage, from the repo root: node docs/notes/screens/slice-13/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:8080";
const browser = await chromium.launch();

for (const [hour, when] of [["10:00", "day"], ["22:00", "night"]]) {
  for (const [viewport, touch, size] of [[{ width: 1920, height: 1080 }, false, "1920x1080"], [{ width: 390, height: 844 }, true, "390x844"]]) {
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, colorScheme: when === "day" ? "light" : "dark" });
    const page = await context.newPage();
    await page.clock.install({ time: new Date(`2026-11-04T${hour}:00+11:00`) });
    await page.clock.resume();
    await page.goto(base);
    await page.locator("#signup input[name=name]").fill(`s13${Date.now().toString(36)}`);
    await page.locator("#signup input[name=password]").fill("correct horse battery");
    await page.locator("#signup button[type=submit]").click();
    await page.locator("#code-done").click();
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(out, `${when}-${size}.png`) });
    if (size === "1920x1080") await page.locator("#room").screenshot({ path: path.join(out, `room-${when}.png`) });
    await page.locator("#leave").click();
    await context.close();
  }
}
await browser.close();
