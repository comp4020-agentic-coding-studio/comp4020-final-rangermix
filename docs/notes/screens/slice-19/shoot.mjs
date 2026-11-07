// Screenshots for slice 19's judged line, the balcony ending with the café:
// the deck, its glass and the café's building ending at the café's walls,
// the glass turning back to each, the street beside them, by day and by
// night, against a local café (APP_URL, default http://localhost:8080).
// The page keeps the café's hour, the server's (slice 17), so each visit's
// welcome is told the hour it's shot at, as the browser checks do.
//   wide-<day|night>-2560x1080.png  a wide window, where the ends show most
//   desktop-<day|night>-1920x1080.png  by day in the light theme, by night in the dark
//   ends-<day|night>.png  both ends close, at 1×, from the wide window, the panels and bars set aside
//   phone-a-<day|night>-390x844.png  the phone's whole room
//   phone-b-<left|right>-390x844.png  the phone's bigger room, panned by the keyboard's pointer to
//     each end, by day: it pans only to the room canvas's edges, and the balcony's ends stand just
//     past them, so these show the phone as it was; the pointer's tile marker is in them, since
//     the bigger room follows the pointer only while it's out
// Usage, from the repo root: node docs/notes/screens/slice-19/shoot.mjs
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
  await page.locator("#signup input[name=name]").fill(`s19${Date.now().toString(36)}`);
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
  if (opts.wholeRoom && (await page.evaluate(() => document.body.classList.contains("layout-b")))) {
    await page.locator("#layout-switch").tap();
    await page.waitForTimeout(400);
  }
  if (opts.pan) {
    // The bigger room follows the keyboard's pointer while it's out: down
    // the left edge to the street wall's end, or along the front to the
    // plain wall's, so that end of the balcony shows.
    await page.locator("#room").focus();
    const keys = opts.pan === "left" ? [["ArrowLeft", 14], ["ArrowUp", 14]] : [["ArrowDown", 14], ["ArrowRight", 14]];
    for (const [key, n] of keys) for (let i = 0; i < n; i++) await page.keyboard.press(key);
    await page.waitForTimeout(800);
    await page.evaluate(() => document.activeElement?.blur?.());
  }
  if (!opts.touch) await page.mouse.move(viewport.width / 2, 2);
  await page.screenshot({ path: path.join(out, name) });
  if (opts.ends) {
    await page.addStyleTag({ content: ".panel, .status, .talk { visibility: hidden !important; }" });
    // Each end, from the wide window: the left by the street wall's end, the right by the plain wall's.
    const left = await page.screenshot({ clip: { x: 280, y: 480, width: 560, height: 420 } });
    const right = await page.screenshot({ clip: { x: 1860, y: 400, width: 560, height: 420 } });
    const tab = await browser.newPage({ viewport: { width: 1124, height: 420 } });
    const img = (b) => `data:image/png;base64,${b.toString("base64")}`;
    await tab.setContent(`<body style="margin:0;display:flex;gap:4px;background:#1e1e2e"><img src="${img(left)}"><img src="${img(right)}"></body>`);
    await tab.screenshot({ path: path.join(out, opts.ends), clip: { x: 0, y: 0, width: 1124, height: 420 } });
    await tab.close();
  }
  await page.evaluate(() => document.getElementById("leave")?.click());
  await context.close();
}

await shoot({ width: 2560, height: 1080 }, "10:00", "light", "wide-day-2560x1080.png", { ends: "ends-day.png" });
await shoot({ width: 2560, height: 1080 }, "22:00", "dark", "wide-night-2560x1080.png", { ends: "ends-night.png" });
await shoot({ width: 1920, height: 1080 }, "10:00", "light", "desktop-day-1920x1080.png");
await shoot({ width: 1920, height: 1080 }, "22:00", "dark", "desktop-night-1920x1080.png");
await shoot({ width: 390, height: 844 }, "10:00", "light", "phone-a-day-390x844.png", { touch: true, wholeRoom: true });
await shoot({ width: 390, height: 844 }, "22:00", "dark", "phone-a-night-390x844.png", { touch: true, wholeRoom: true });
await shoot({ width: 390, height: 844 }, "10:00", "light", "phone-b-left-390x844.png", { touch: true, pan: "left" });
await shoot({ width: 390, height: 844 }, "10:00", "light", "phone-b-right-390x844.png", { touch: true, pan: "right" });
await browser.close();
console.log("shot slice 19's screens");
