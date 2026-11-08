// Screenshots for the sitting look (the user, 2026-11-08: "add sitting look
// for users. currently they look like standing on things."), against a
// local café (APP_URL, default http://localhost:8080) on a fresh database.
// Four visitors sit over the WebSocket, on a sofa, a chair, the window seat
// and the cushion, by day; then a viewer signs in in a browser and the room
// is shot at 1920x1080 by mouse and at 390x844 by touch.
//   <name>-desktop-1920x1080.png  the whole room
//   <name>-phone-390x844.png  the phone's whole room
// Run once against a café serving main's client (NAME=before) and once
// against this change's (NAME=after); with both there, CLOSE=1 lays each
// seat's sitter side by side, before above after, at 2x:
//   close.png  the sofa, the window seat, the chair and the cushion
// Usage, from the repo root: NAME=after APP_URL=http://localhost:8091 node docs/notes/screens/sitting-pose/shoot.mjs
//   then CLOSE=1 node docs/notes/screens/sitting-pose/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import WebSocket from "ws";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:8080";
const name = process.env.NAME ?? "after";
const unique = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 20);

if (process.env.CLOSE) {
  // Crop boxes in the 1920x1080 shots, round each sitter on the default
  // room (content/room.toml): the sofa, the window seat, the chair, the cushion.
  const boxes = [
    { x: 520, y: 560, w: 180, h: 200 },
    { x: 330, y: 380, w: 180, h: 200 },
    { x: 900, y: 300, w: 180, h: 200 },
    { x: 1100, y: 420, w: 180, h: 200 },
  ];
  const k = 2;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: boxes.length * (180 * k + 8) + 8, height: 2 * (200 * k + 8) + 8 } });
  const { readFileSync } = await import("node:fs");
  const src = (n) => `data:image/png;base64,${readFileSync(path.join(out, `${n}-desktop-1920x1080.png`)).toString("base64")}`;
  const shots = { before: src("before"), after: src("after") };
  const cells = ["before", "after"]
    .map((n, row) =>
      boxes
        .map(
          (b, i) =>
            `<div style="position:absolute;left:${8 + i * (b.w * k + 8)}px;top:${8 + row * (b.h * k + 8)}px;width:${b.w * k}px;height:${b.h * k}px;overflow:hidden">` +
            `<img src="${shots[n]}" style="position:absolute;left:${-b.x * k}px;top:${-b.y * k}px;width:${1920 * k}px;image-rendering:pixelated"></div>`,
        )
        .join(""),
    )
    .join("");
  await page.setContent(`<body style="margin:0;background:#1e1e2e;position:relative">${cells}</body>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "close.png") });
  await browser.close();
  console.log("wrote close.png");
  process.exit(0);
}

async function signUp(prefix, look) {
  const res = await fetch(new URL("/api/signup", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: unique(prefix), password: "correct horse battery", look }),
  });
  if (res.status !== 200) throw new Error(`sign-up: ${res.status} ${await res.text()}`);
  return res.headers.getSetCookie().find((c) => c.startsWith("session=")).split(";")[0];
}

/** A visitor over the WebSocket, its welcome, and a wait for a message. */
async function visit(cookie) {
  const ws = new WebSocket(new URL("/ws", base.replace(/^http/, "ws")), { headers: { cookie } });
  const seen = [];
  ws.on("message", (d) => seen.push(JSON.parse(String(d))));
  await new Promise((r, j) => (ws.once("open", r), ws.once("error", j)));
  const until = async (test, ms = 15_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const m = seen.find(test);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("timed out");
  };
  const welcome = await until((m) => m.type === "welcome");
  return { ws, welcome, until, send: (m) => ws.send(JSON.stringify(m)) };
}

// Seat four people: the sofa nearest the door, a chair, the window seat, the cushion.
const first = await visit(await signUp("sitA", { avatar: 0, colour: 1 }));
const furniture = first.welcome.snapshot.room.furniture;
const want = ["sofa", "chair", "window_seat", "cushion"];
const seats = want.map((k) => furniture.find((f) => f.kind === k)).filter(Boolean);
const visitors = [first];
for (let i = 1; i < seats.length; i++) visitors.push(await visit(await signUp(`sit${"BCD"[i - 1]}`, { avatar: i, colour: i + 1 })));
for (let i = 0; i < seats.length; i++) {
  const v = visitors[i];
  v.send({ type: "sit", id: seats[i].id });
  const me = v.welcome.you;
  await v.until((m) => m.type === "personSat" && m.id === me, 20_000);
}
console.log(`seated on ${seats.map((s) => `${s.kind} (${s.x},${s.y})`).join(", ")}`);

const browser = await chromium.launch();
async function shoot(viewport, file, opts = {}) {
  const context = await browser.newContext({ viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch, colorScheme: "light" });
  const page = await context.newPage();
  // By day, whatever the hour here: the welcome is told 11:00 in Canberra.
  const start = new Date("2026-11-06T11:00:00+11:00").getTime();
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
  await page.locator("#signup input[name=name]").fill(unique("sitV"));
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  if (opts.touch && (await page.evaluate(() => document.body.classList.contains("layout-b")))) {
    await page.locator("#layout-switch").tap();
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.activeElement?.blur?.());
  if (!opts.touch) await page.mouse.move(viewport.width / 2, 2);
  await page.screenshot({ path: path.join(out, file) });
  await page.evaluate(() => document.getElementById("leave")?.click());
  await context.close();
}
await shoot({ width: 1920, height: 1080 }, `${name}-desktop-1920x1080.png`);
await shoot({ width: 390, height: 844 }, `${name}-phone-390x844.png`, { touch: true });
await browser.close();
for (const v of visitors) {
  v.send({ type: "leave" });
  await new Promise((r) => setTimeout(r, 50));
  v.ws.close();
}
console.log(`wrote ${name}-*.png`);
