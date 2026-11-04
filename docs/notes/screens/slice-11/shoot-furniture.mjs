// Slice 11's judged lines (slice 11's review, finding 8), from the café
// itself, against a local café (APP_URL, default http://localhost:8080):
//   furniture-<day|night>-<size>.png  every kind of furniture, standing in
//     the back rows and knocked over in the front ones, at 1920x1080 (4x)
//     and 390x844 (3x), by day and by night
//   scene-<day|night>.png  a cat on a lap, a cat asleep on the sofa, someone
//     carrying a box and someone holding a cat, at 1920x1080
// The page's socket rearranges what the café sends it (the furniture, who's
// where, what each cat is doing); only what this page draws changes.
// Usage, from the repo root: node docs/notes/screens/slice-11/shoot-furniture.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:8080";
const browser = await chromium.launch();

const KINDS = [
  ["cat_tower", 2, 2], ["window_seat", 2, 1], ["sofa", 3, 1], ["table", 2, 1], ["chair", 1, 1], ["cat_bed", 1, 1], ["box", 1, 1],
  ["plant", 1, 1], ["toys", 1, 1], ["bowls", 2, 1], ["cushion", 1, 1], ["scratching_post", 1, 1], ["lamp", 1, 1],
];
let id = 900;
const piece = (kind, x, y, w, h, toppled = false) => ({ id: id++, kind, x, y, w, h, movable: true, blocks: kind !== "rug", under: false, seats: ["sofa", "chair", "window_seat"].includes(kind), perch: kind === "window_seat", toppled });

/** Every kind standing across the back of the room and lying down across the front. */
function showroom() {
  const pieces = [];
  let x = 0, y = 1;
  for (const [kind, w, h] of KINDS) {
    if (x + w > 12) { x = 0; y += 3; }
    pieces.push(piece(kind, x, y, w, h));
    x += w + (w === 1 ? 0 : 0);
  }
  // Knocked over: the kinds a cat can knock over (content/furniture.toml's
  // `knocks`: the plant, the toys and the lamp), the only ones that fall in
  // the café, in the front row.
  let fx = 3;
  for (const [kind, w, h] of KINDS.filter(([k]) => ["plant", "toys", "lamp"].includes(k))) {
    pieces.push(piece(kind, fx, 8, w, h, true));
    fx += w + 1;
  }
  return pieces;
}

async function visit(viewport, touch, hour, scheme, rewrite) {
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(`2026-11-05T${hour}:00+11:00`) });
  await page.clock.resume();
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((m) => {
      const f = JSON.parse(String(m));
      if (f.type === "welcome") {
        rewrite(f);
        ws.send(JSON.stringify(f));
      } else if (!f.cat && f.type !== "personMoved" && f.type !== "furniturePlaced" && f.type !== "furnitureToppled") ws.send(m);
    });
  });
  await page.goto(base);
  await page.locator("#signup input[name=name]").fill(`s11${Date.now().toString(36)}`);
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.waitForTimeout(900);
  return { ctx, page };
}

for (const [hour, when] of [["10:00", "day"], ["22:00", "night"]]) {
  for (const [viewport, touch, size] of [[{ width: 1920, height: 1080 }, false, "1920x1080"], [{ width: 390, height: 844 }, true, "390x844"]]) {
    const { ctx, page } = await visit(viewport, touch, hour, when === "day" ? "light" : "dark", (f) => {
      f.snapshot.room.furniture = showroom();
      f.snapshot.cats = [];
      for (const p of f.snapshot.people) Object.assign(p, { place: "window" });
    });
    if (touch) await page.locator("#layout-switch").tap();
    await page.waitForTimeout(400);
    await page.locator("#room").screenshot({ path: path.join(out, `furniture-${when}-${size}.png`) });
    await ctx.close();
  }
  // The scene: a lap, a nap on the sofa, carrying, holding.
  const { ctx, page } = await visit({ width: 1920, height: 1080 }, false, hour, when === "day" ? "light" : "dark", (f) => {
    const me = f.you;
    f.snapshot.room.furniture = [piece("sofa", 2, 5, 3, 1), piece("chair", 7, 5, 1, 1), piece("box", 9, 7, 1, 1)];
    const [a, b, c] = f.snapshot.cats;
    f.snapshot.people = [
      { ...f.snapshot.people[0], id: me, at: { x: 7, y: 5 }, walk: null, sitting: true, place: "inside" },
      { ...f.snapshot.people[0], id: 9001, name: "carrier", at: { x: 5, y: 8 }, walk: null, sitting: false, place: "inside", look: { avatar: 1, colour: 2 } },
      { ...f.snapshot.people[0], id: 9002, name: "holder", at: { x: 9, y: 4 }, walk: null, sitting: false, place: "inside", look: { avatar: 3, colour: 4 } },
    ];
    // A on the lap of whoever sits on the chair; B asleep on the sofa; C held.
    Object.assign(a, { at: { x: 7, y: 5 }, pose: "nap", walk: null, heldBy: null });
    Object.assign(b, { at: { x: 3, y: 5 }, pose: "nap", walk: null, heldBy: null });
    Object.assign(c, { at: { x: 9, y: 4 }, pose: "held", walk: null, heldBy: 9002 });
    f.snapshot.held = [{ by: 9001, piece: piece("box", 0, 0, 1, 1) }];
  });
  await page.locator("#room").screenshot({ path: path.join(out, `scene-${when}.png`) });
  await ctx.close();
}
await browser.close();
console.log("shot the furniture and the scene");
