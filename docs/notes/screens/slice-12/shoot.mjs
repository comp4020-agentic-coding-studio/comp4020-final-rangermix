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
 * Get to `from` a few tiles at a time, each in view (layout B follows you),
 * then walk to `to` and shoot once that walk is under way.
 */
async function walkAndShoot(page, via, to, name) {
  for (const tile of via) {
    await walkTo(page, ...tile);
    await page.waitForTimeout(2000);
  }
  await walkTo(page, ...to);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
}

// Column 3 is bare floor from row 2 to 8 (content/room.toml), so a tap
// walks there rather than opening a piece's menu.
for (const [viewport, touch, size] of [[{ width: 1920, height: 1080 }, false, "1920x1080"], [{ width: 390, height: 844 }, true, "390x844"]]) {
  const page = await inside(viewport, touch);
  // Down the screen, away from the street wall: front shown.
  await walkAndShoot(page, [[5, 2], [3, 2]], [3, 6], `toward-${size}`);
  // Up the screen, toward the street wall: back shown.
  await walkAndShoot(page, [], [3, 2], `away-${size}`);
  // Standing after walking away: still the back.
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(out, `stopped-away-${size}.png`) });
  await page.locator("#leave").click();
}
await browser.close();
