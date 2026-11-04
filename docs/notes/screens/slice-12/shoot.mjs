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
/** Walk to (x, y) by clicking it, and shoot once the walk is under way. */
async function walkAndShoot(page, from, to, name) {
  let at = await tileAt(page, ...from);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(2500);
  at = await tileAt(page, ...to);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
}

for (const [viewport, touch, size] of [[{ width: 1920, height: 1080 }, false, "1920x1080"], [{ width: 390, height: 844 }, true, "390x844"]]) {
  const page = await inside(viewport, touch);
  // From the front of the room toward the street wall: up the screen, back shown.
  await walkAndShoot(page, [5, 8], [5, 2], `away-${size}`);
  // And back: down the screen, front shown.
  await walkAndShoot(page, [5, 2], [5, 8], `toward-${size}`);
  // Standing after walking away: still the back.
  let at = await tileAt(page, 5, 3);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `stopped-away-${size}.png`) });
  await page.locator("#leave").click();
}
await browser.close();
