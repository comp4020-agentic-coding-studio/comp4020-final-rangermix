// Screens for the slice 16 study (docs/notes/slice-16-study.md): the room
// at 1920x1080 as it is, then with bigger tiles, the bars floating, the
// street across the whole window and the bottom corners filled, by day and
// by night. Run against a café whose client is main at 270cc8d with
// spike.patch (beside this) applied, a throwaway build, not the slice's
// code (APP_URL, default http://localhost:18917).
// Usage, from that build's root: node docs/notes/screens/slice-16-study/shoot.mjs [variant]
// then node docs/notes/screens/slice-16-study/sheet.mjs for the two sheets.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:18917";
const only = process.argv[2];
const VARIANTS = [
  ["0-now", ""],
  ["1-tile36", "tile=36"],
  ["2-float", "float=1"],
  ["3-float-tile36", "float=1&tile=36"],
  ["4-fill", "float=1&tile=36&fill=1"],
  ["5-fill-terrace", "float=1&tile=36&fill=1&corners=terrace"],
  ["6-fill-garden", "float=1&tile=36&fill=1&corners=garden"],
  ["7-fill-terrace-plinth", "float=1&tile=36&fill=1&corners=terrace&plinth=14"],
  ["8-fill-plinth", "float=1&tile=36&fill=1&plinth=14"],
];
const browser = await chromium.launch();
for (const [hour, when, scheme] of [["10:00", "day", "light"], ["22:00", "night", "dark"]]) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: scheme });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`2026-11-06T${hour}:00+11:00`) });
  await page.clock.resume();
  await page.goto(base);
  await page.locator("#signup input[name=name]").fill(`s16${Date.now().toString(36)}`);
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  for (const [name, query] of VARIANTS) {
    if (only && !name.startsWith(only)) continue;
    await page.goto(`${base}/?${query}`);
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    await page.waitForTimeout(900);
    await page.mouse.move(960, 2);
    const m = await page.evaluate(() => {
      const r = document.getElementById("room").getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) };
    });
    console.log(when, name, JSON.stringify(m));
    await page.screenshot({ path: path.join(out, `${name}-${when}.png`) });
  }
  await page.locator("#leave").click();
  await context.close();
}
await browser.close();
