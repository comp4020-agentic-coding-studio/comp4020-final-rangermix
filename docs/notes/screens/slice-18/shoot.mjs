// Screenshots for slice 18's judged line, the balcony under the terrace:
// the deck, the 18-px glass and the café's building under it, by day and
// by night, against a local café (APP_URL, default http://localhost:8080).
// The page keeps the café's hour, the server's (slice 17), so each visit's
// welcome is told the hour it's shot at, as the browser checks do.
//   desktop-<day|night>-1920x1080.png  by day in the light theme, by night in the dark
//   corner-<day|night>.png  the front corner, close, the panels and bars set aside
//   phone-a-390x844.png  the phone's whole room
//   phone-b-390x844.png  the phone's bigger room, panned to the front
// Usage, from the repo root: node docs/notes/screens/slice-18/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:8080";
const browser = await chromium.launch();

async function enter(context, hour) {
  const page = await context.newPage();
  const start = new Date(`2026-11-06T${hour}:00+11:00`).getTime();
  const since = Date.now();
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((m) => {
      const f = JSON.parse(String(m));
      if (f.type === "welcome") f.now = start + (Date.now() - since);
      ws.send(JSON.stringify(f));
    });
  });
  await page.clock.install({ time: new Date(start) });
  await page.clock.resume();
  await page.goto(base);
  await page.locator("#signup input[name=name]").fill(`s18${Date.now().toString(36)}`);
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.waitForTimeout(1200);
  // The room takes the focus as the café opens; its keyboard ring isn't what's judged.
  await page.evaluate(() => document.activeElement?.blur?.());
  return page;
}

async function shoot(viewport, hour, scheme, name, opts = {}) {
  const context = await browser.newContext({ viewport, colorScheme: scheme, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await enter(context, hour);
  if (opts.wholeRoom) {
    await page.locator("#layout-switch").tap();
    await page.waitForTimeout(400);
  }
  if (opts.front) {
    // The bigger room follows the keyboard's pointer while it's out: down
    // to the floor's front row and along it, so the balcony's corner shows.
    await page.locator("#room").focus();
    for (let i = 0; i < 14; i++) await page.keyboard.press("ArrowDown");
    for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(800);
  }
  if (!opts.front) await page.mouse.move(viewport.width / 2, 2);
  await page.screenshot({ path: path.join(out, name), fullPage: !!opts.wholeRoom });
  if (opts.corner) {
    await page.addStyleTag({ content: ".panel, .status, .talk { visibility: hidden !important; }" });
    await page.screenshot({ path: path.join(out, opts.corner), clip: { x: 1000, y: 600, width: 920, height: 480 } });
  }
  await page.evaluate(() => document.getElementById("leave")?.click());
  await context.close();
}

await shoot({ width: 1920, height: 1080 }, "10:00", "light", "desktop-day-1920x1080.png", { corner: "corner-day.png" });
await shoot({ width: 1920, height: 1080 }, "22:00", "dark", "desktop-night-1920x1080.png", { corner: "corner-night.png" });
await shoot({ width: 390, height: 844 }, "10:00", "light", "phone-b-390x844.png", { touch: true, front: true });
await shoot({ width: 390, height: 844 }, "10:00", "light", "phone-a-390x844.png", { touch: true, wholeRoom: true });
await browser.close();
console.log("shot slice 18's screens");
