// Slice 17 part 2 on the live café: demo1 at 1920×1080 lays out each set by
// mouse; demo2 on a phone (layout B) sees each within a second, is told its
// and lays out Opening day by touch; a set too soon is refused. Run as
// node live.mjs [out-dir] (screens default to this folder).
import { chromium } from "playwright";
const base = "https://comp4020-final-rangermix.fly.dev";
const out = process.argv[2] ?? new URL(".", import.meta.url).pathname;
const browser = await chromium.launch();
async function visit(name, viewport, touch) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const frames = [];
  page.on("websocket", (ws) => ws.on("framereceived", (f) => frames.push({ at: Date.now(), m: JSON.parse(String(f.payload)) })));
  await page.goto(base);
  await page.locator("#way-in-name").fill(name);
  await page.locator("#way-in-password").fill("catppuccino");
  await page.locator("#way-in-password").press("Enter");
  await page.waitForFunction(() => /inside|window/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.locator("#demo-bar").waitFor();
  return { context, page, frames };
}
const d1 = await visit("demo1", { width: 1920, height: 1080 }, false);
const d2 = await visit("demo2", { width: 390, height: 844 }, true);
const welcome = d2.frames.find((f) => f.m.type === "welcome").m;
console.log("sets offered:", welcome.layouts.map((l) => l.name).join(", "));
const rows = await d2.page.evaluate(() => new Set([...document.querySelectorAll("#demo-bar .demo-toggle")].map((t) => Math.round(t.getBoundingClientRect().top))).size);
console.log("phone bar rows:", rows, "| ahead shown:", await d2.page.locator("#demo-ahead").getAttribute("data-short"));
const me2 = welcome.you;
for (const [set, file] of [["Lap time", "lap-time"], ["Play room", "play-room"]]) {
  await d1.page.locator("#demo-sets-wait").waitFor({ state: "hidden", timeout: 20_000 });
  const from = d2.frames.length;
  const sent = Date.now();
  await d1.page.locator("#demo-furniture button", { hasText: set }).click();
  await d2.page.waitForFunction((s) => [...document.querySelectorAll(".toast")].some((t) => t.textContent === `demo1 laid out ${s}.`), set, { timeout: 5000 });
  const laid = d2.frames.slice(from).find((f) => f.m.type === "laidOut");
  console.log(`${set}: seen by demo2 in ${laid.at - sent} ms (incl. the click), ${laid.m.furniture.length} pieces, next in ${Math.round((laid.m.next - welcome.now) / 1000)}s from welcome`);
  // Too soon, at once.
  const off = await d1.page.locator("#demo-furniture button", { hasText: "Opening day" }).isDisabled();
  console.log(`  set buttons off at once: ${off}, says: ${await d1.page.locator("#demo-sets-wait").textContent()}`);
  await d1.page.waitForTimeout(800);
  await d1.page.screenshot({ path: `${out}/live-desktop-${file}.png` });
}
await d2.page.screenshot({ path: `${out}/live-phone-play-room.png` });
// Back to Opening day, by touch from the phone.
await d2.page.locator("#demo-bar .demo-toggle", { hasText: "Furniture" }).tap();
await d2.page.locator("#demo-sets-wait").waitFor({ state: "hidden", timeout: 20_000 });
await d2.page.locator("#demo-furniture button", { hasText: "Opening day" }).tap();
await d1.page.waitForFunction(() => [...document.querySelectorAll(".toast")].some((t) => t.textContent === "demo2 laid out Opening day."), null, { timeout: 5000 });
console.log("Opening day by touch from the phone: seen on the desktop");
for (const v of [d1, d2]) {
  await v.page.locator("#leave").click().catch(() => {});
  await v.context.close();
}
await browser.close();
