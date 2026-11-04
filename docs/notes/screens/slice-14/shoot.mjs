// Screenshots for slice 14, against a local café (APP_URL, default
// http://localhost:8080): at 1920×1080, by day (light) and by night (dark),
// the panels in their corners as a first visit has them; then your cats
// dragged over the room and pinned, and who's here left to dim. And the
// phone at 390×844, in both layouts, to show it unchanged.
// Usage, from the repo root: node docs/notes/screens/slice-14/shoot.mjs
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
  await page.locator("#signup input[name=name]").fill(`s14${Date.now().toString(36)}`);
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
  await page.mouse.move(960, 1075);
  await page.screenshot({ path: path.join(out, `${when}-corners-1920x1080.png`) });
  // Your cats over the room's middle-left, pinned; who's here left alone till it dims.
  await page.locator("#cats-panel .grip").focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowUp");
  await page.getByRole("button", { name: "Pin your cats" }).click();
  await page.locator("#room").focus();
  await page.mouse.move(960, 1075);
  await page.clock.fastForward(5000);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${when}-pinned-dimmed-1920x1080.png`) });
  await page.locator("#leave").click();
  await context.close();
}

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await enter(phone, "10:00");
await page.screenshot({ path: path.join(out, "phone-b-390x844.png") });
await page.locator("#layout-switch").tap();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, "phone-a-390x844.png"), fullPage: true });
await page.locator("#leave").click();
await phone.close();
await browser.close();
