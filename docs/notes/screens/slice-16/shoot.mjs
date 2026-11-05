// Screenshots for slice 16's judged line, the café filling the window:
// the 13 by 12 floor at 4×, the bars floating, the street to the window's
// edges and the terrace, against a local café (APP_URL, default
// http://localhost:8080):
//   desktop-<day|night>-1920x1080.png  by day in the light theme, by night in the dark
//   laptop-day-1440x900.png  a laptop's window, the room at 3×
//   phone-a-390x844.png  the phone's whole room, centred, its tips cut
//   phone-b-390x844.png  the phone's bigger room
// Usage, from the repo root: node docs/notes/screens/slice-16/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:8080";
const browser = await chromium.launch();

async function enter(context, hour) {
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`2026-11-06T${hour}:00+11:00`) });
  await page.clock.resume();
  await page.goto(base);
  await page.locator("#signup input[name=name]").fill(`s16${Date.now().toString(36)}`);
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.waitForTimeout(1200);
  return page;
}

async function shoot(viewport, hour, scheme, name, opts = {}) {
  const context = await browser.newContext({ viewport, colorScheme: scheme, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await enter(context, hour);
  if (opts.wholeRoom) {
    await page.locator("#layout-switch").tap();
    await page.waitForTimeout(400);
  }
  await page.mouse.move(viewport.width / 2, 2);
  await page.screenshot({ path: path.join(out, name), fullPage: !!opts.wholeRoom });
  await page.locator("#leave").click();
  await context.close();
}

await shoot({ width: 1920, height: 1080 }, "10:00", "light", "desktop-day-1920x1080.png");
await shoot({ width: 1920, height: 1080 }, "22:00", "dark", "desktop-night-1920x1080.png");
await shoot({ width: 1440, height: 900 }, "10:00", "light", "laptop-day-1440x900.png");
await shoot({ width: 390, height: 844 }, "10:00", "light", "phone-b-390x844.png", { touch: true });
await shoot({ width: 390, height: 844 }, "10:00", "light", "phone-a-390x844.png", { touch: true, wholeRoom: true });
await browser.close();
console.log("shot slice 16's screens");
