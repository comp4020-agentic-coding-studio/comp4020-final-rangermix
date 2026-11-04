// Screenshots for slice 12, against a local café (APP_URL, default
// http://localhost:8080): someone walking away from the viewer (toward the
// street wall) and toward them, at 1920×1080 and 390×844, each mid-walk.
// Usage, from the repo root: node docs/notes/screens/slice-12/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:8080";
const browser = await chromium.launch();

async function inside(viewport, touch) {
  const page = await (await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, colorScheme: "light" })).newPage();
  // What the café tells the page: your id, the server's clock, and your walks.
  page.frames_ = [];
  page.on("websocket", (ws) => ws.on("framereceived", (f) => page.frames_.push({ at: Date.now(), msg: JSON.parse(String(f.payload)) })));
  await page.goto(base);
  await page.locator("#signup input[name=name]").fill(`s12${Date.now().toString(36)}`);
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  return page;
}
const tileAt = (page, x, y) => page.evaluate(([x, y]) => window.cafeRoom.tileAt(x, y), [x, y]);
/**
 * Click a tile. In layout B the room pans, so a tile is found again before
 * each click, and must be on screen: one off it would never be clicked.
 */
async function walkTo(page, x, y) {
  const at = await tileAt(page, x, y);
  const view = page.viewportSize();
  if (at.x < 0 || at.y < 0 || at.x > view.width || at.y > view.height) throw new Error(`(${x},${y}) is off screen at ${JSON.stringify(at)}`);
  await page.mouse.click(at.x, at.y);
}
/**
 * Whether you're on your way somewhere: your walk, as the page last heard
 * it, has a step ahead at this moment. Read from the page's own state, not
 * a timer (slice 12's review, finding 9).
 */
function walking(page) {
  const welcome = page.frames_.find((f) => f.msg.type === "welcome");
  if (!welcome) return false;
  const me = welcome.msg.you;
  const offset = welcome.msg.now - welcome.at;
  const walk = page.frames_.filter((f) => f.msg.type === "personMoved" && f.msg.id === me).at(-1)?.msg.walk;
  if (!walk) return false;
  const ends = walk.start + ((walk.path.length - 1) * 1000) / walk.speed;
  return Date.now() + offset < ends;
}
/** Waits till you've arrived, so the next walk starts from where you stand. */
async function arrive(page) {
  await page.waitForTimeout(300);
  for (let i = 0; i < 60 && walking(page); i++) await page.waitForTimeout(100);
}
/**
 * Get to the start a few tiles at a time, each in view (layout B follows
 * you), then walk to `to` and shoot while that walk is still under way.
 */
async function walkAndShoot(page, via, to, name) {
  for (const tile of via) {
    await walkTo(page, ...tile);
    await arrive(page);
  }
  await walkTo(page, ...to);
  for (let i = 0; i < 20 && !walking(page); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(250);
  if (!walking(page)) throw new Error(`${name}: not walking when shot`);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  await arrive(page);
}

// Column 3 is bare floor from row 2 to 8 (content/room.toml), so a tap
// walks there rather than opening a piece's menu.
for (const [viewport, touch, size] of [[{ width: 1920, height: 1080 }, false, "1920x1080"], [{ width: 390, height: 844 }, true, "390x844"]]) {
  const page = await inside(viewport, touch);
  // Down the screen, away from the street wall: front shown, mid-walk.
  await walkAndShoot(page, [[5, 2], [3, 2]], [3, 6], `toward-${size}`);
  // Up the screen, toward the street wall: back shown, mid-walk, the whole
  // four tiles, since the walk toward the viewer was let finish first.
  await walkAndShoot(page, [], [3, 2], `away-${size}`);
  // Standing after walking away: still the back.
  await page.screenshot({ path: path.join(out, `stopped-away-${size}.png`) });
  await page.locator("#leave").click();
}
await browser.close();
