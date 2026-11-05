// Screenshots for slice 15's judged line, the music panel sitting
// comfortably at both sizes, pinned and unpinned, against a local café
// (APP_URL, default http://localhost:8080):
//   desktop-<day|night>-1920x1080.png  the four panels as a first visit has
//     them, the music bottom right, playing; by day in the light theme and
//     by night in the dark
//   desktop-pinned-<day|night>-1920x1080.png  the music dragged over the
//     room's floor and pinned, with the other panels left to dim
//   phone-b-drawer-390x844.png  the bigger room with its drawer open, the
//     music's row at its top
//   phone-a-390x844.png  the whole room, the music's row under the talk bar
// Usage, from the repo root: node docs/notes/screens/slice-15/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:8080";
const browser = await chromium.launch();

async function enter(context, hour) {
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`2026-11-05T${hour}:00+11:00`) });
  await page.clock.resume();
  await page.goto(base);
  await page.locator("#signup input[name=name]").fill(`s15${Date.now().toString(36)}`);
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.waitForTimeout(800);
  return page;
}

for (const [hour, when, scheme] of [["10:00", "day", "light"], ["22:00", "night", "dark"]]) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: scheme });
  const page = await enter(context, hour);
  await page.locator("#music-play").click();
  await page.locator("#room").focus();
  await page.mouse.move(960, 1075);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `desktop-${when}-1920x1080.png`) });
  // The music over the floor's front, pinned; the rest left till they dim.
  await page.locator("#music-panel .grip").focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowLeft");
  for (let i = 0; i < 2; i++) await page.keyboard.press("Shift+ArrowUp");
  await page.getByRole("button", { name: "Pin the music" }).click();
  await page.locator("#room").focus();
  await page.mouse.move(960, 1075);
  await page.clock.fastForward(5000);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `desktop-pinned-${when}-1920x1080.png`) });
  await page.locator("#music-play").click();
  await page.locator("#leave").click();
  await context.close();
}

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await enter(phone, "10:00");
await page.locator("#drawer-toggle").tap();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, "phone-b-drawer-390x844.png") });
await page.locator("#drawer-toggle").tap();
await page.locator("#layout-switch").tap();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, "phone-a-390x844.png"), fullPage: true });
await page.locator("#leave").click();
await phone.close();
await browser.close();
console.log("shot slice 15's screens");
