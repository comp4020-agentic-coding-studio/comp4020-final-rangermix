// The balcony's ends study (slice 19): how the balcony and the café's
// building end past the café's walls, against a café built from main at
// 1d7d7b0 with spike.patch applied (APP_URL, default http://localhost:18920):
// at 2560×1080 (a wide window, where the ends show most), 1920×1080 and on a
// phone, by day and by night. The page keeps the café's hour, the server's
// (slice 17), so each visit's welcome is told the hour. A 1280×1440 window
// was shot the same way for compare-tall.png. Usage, from spec/ (for its
// playwright): node ../docs/notes/screens/slice-19-study/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:18920";
const only = process.env.ONLY;
const browser = await chromium.launch();
const VARIANTS = [
  ["run", "ends=run"],
  ["corner", "ends=corner"],
  ["corner-towers", "ends=corner&below=towers"],
  ["corner-haze", "ends=corner&below=haze"],
  ["fade", "ends=fade&fade=4"],
  ["corner-open", "ends=corner&returns=0"],
];
for (const [hour, when, scheme] of [["10:00", "day", "light"], ["22:00", "night", "dark"]]) {
  for (const [w, h, touch] of [[2560, 1080, false], [1920, 1080, false], [390, 844, true]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    const start = new Date(`2026-11-06T${hour}:00+11:00`).getTime();
    const since = Date.now();
    await page.routeWebSocket(/\/ws$/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => { const f = JSON.parse(String(m)); if (f.type === "welcome") f.now = start + (Date.now() - since); ws.send(JSON.stringify(f)); });
    });
    await page.clock.install({ time: new Date(start) });
    await page.clock.resume();
    await page.goto(base);
    await page.locator("#signup input[name=name]").fill(`en${Date.now().toString(36)}`);
    await page.locator("#signup input[name=password]").fill("correct horse battery");
    await page.locator("#signup button[type=submit]").click();
    await page.locator("#code-done").click();
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    for (const [name, query] of VARIANTS) {
      if (only && !only.split(",").includes(name)) continue;
      await page.goto(`${base}/?${query}`);
      await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
      if (touch && (await page.evaluate(() => document.body.classList.contains("layout-b")))) {
        // The phone's whole room, where the balcony's ends show.
        await page.locator("#layout-switch").tap();
      }
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.activeElement?.blur?.());
      if (!touch) await page.mouse.move(w / 2, 2);
      await page.screenshot({ path: path.join(out, `${name}-${when}-${w}x${h}.png`) });
    }
    await page.evaluate(() => document.getElementById("leave")?.click());
    await context.close();
  }
}
await browser.close();
console.log("shot");
