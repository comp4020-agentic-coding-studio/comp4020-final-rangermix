// Screens of slice 17, part 2: each furniture set at 1920×1080, and the
// Furniture group on a phone. Run against a café seeded with `cafe demo
// seed`: APP_URL=http://localhost:8181 APP_DEMO_PASSWORD=... node shoot.mjs
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.APP_URL ?? "http://localhost:8080";
const password = process.env.APP_DEMO_PASSWORD;
const out = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();

async function demo(name, viewport, touch = false) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(base);
  await page.locator("#way-in-name").fill(name);
  await page.locator("#way-in-password").fill(password);
  await page.locator("#way-in-password").press("Enter");
  await page.waitForFunction(() => /inside|window/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.locator("#demo-bar").waitFor();
  return { context, page };
}

const { context, page } = await demo("demo1", { width: 1920, height: 1080 });
for (const [set, file] of [["Lap time", "lap-time"], ["Play room", "play-room"], ["Opening day", "opening-day"]]) {
  // The café lays out a set at most every few seconds.
  await page.locator("#demo-sets-wait").waitFor({ state: "hidden", timeout: 15_000 });
  await page.locator("#demo-furniture button", { hasText: set }).click();
  await page.locator(".toast", { hasText: `You laid out ${set}.` }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `desktop-${file}.png`) });
}
await context.close();

const phone = await demo("demo2", { width: 390, height: 844 }, true);
await phone.page.locator("#demo-bar .demo-toggle", { hasText: "Furniture" }).tap();
await phone.page.waitForTimeout(300);
await phone.page.screenshot({ path: join(out, "phone-b-furniture-open.png") });
await phone.page.locator("#demo-sets-wait").waitFor({ state: "hidden", timeout: 15_000 });
await phone.page.locator("#demo-furniture button", { hasText: "Lap time" }).tap();
await phone.page.locator(".toast", { hasText: "You laid out Lap time." }).waitFor();
await phone.page.waitForTimeout(300);
await phone.page.screenshot({ path: join(out, "phone-b-lap-time.png") });
await phone.page.locator("#demo-bar .demo-toggle", { hasText: "Furniture" }).tap();
await phone.page.locator("#demo-sets-wait").waitFor({ state: "hidden", timeout: 15_000 });
await phone.page.locator("#demo-furniture button", { hasText: "Opening day" }).tap();
await phone.page.locator(".toast", { hasText: "You laid out Opening day." }).waitFor();
await phone.page.waitForTimeout(300);
await phone.context.close();
await browser.close();
