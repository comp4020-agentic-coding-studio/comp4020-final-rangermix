// Slice 18's study: the café's terrace as it is, and on a balcony deck with
// a glass balustrade (12 or 18 px) or a low parapet; and below the deck a
// deep slab, the towers carried on down, the towers fading into haze, or
// the café's own building (round 2), at 1920×1080 by day and by night, and on the
// phone, against a café built with spike.patch applied to main at 4740c3b
// (APP_URL, default http://localhost:18917). Usage, from spec/ (for its
// playwright): RESTART=<script> node ../docs/notes/screens/slice-18-study/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:18917";
// The page keeps the café's hour, the server's (slice 17), so the café is
// restarted with its clock at each light: RESTART names a script that
// restarts it with CAFE_CLOCK_START set to the instant it's given.
const restart = process.env.RESTART;
const browser = await chromium.launch();
for (const [hour, when, scheme] of [["10:00", "day", "light"], ["22:00", "night", "dark"]]) {
  if (restart) execFileSync(restart, [`2026-11-06T${hour}:00+11:00`], { stdio: "inherit" });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: scheme });
  const page = await context.newPage();
  await page.goto(base);
  await page.locator("#signup input[name=name]").fill(`tx${Date.now().toString(36)}`);
  await page.locator("#signup input[name=password]").fill("correct horse battery");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  for (const [deck, query] of [["none", "deck=none"], ["glass", "deck=glass"], ["glass-tall", "deck=glass&rail=18"], ["glass-deep", "deck=glass&rail=18&slab=24"], ["glass-high", "deck=glass&rail=18&below=towers"], ["glass-haze", "deck=glass&rail=18&below=haze"], ["glass-face", "deck=glass&rail=18&face=wall"], ["glass-face-haze", "deck=glass&rail=18&face=wall&below=haze"], ["parapet", "deck=parapet"]]) {
    await page.goto(`${base}/?${query}`);
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    await page.waitForTimeout(1200);
    await page.mouse.move(960, 2);
    // The room takes the focus as the page opens; its keyboard ring isn't the study's.
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.screenshot({ path: path.join(out, `${deck}-${when}.png`) });
    // The bottom corners, close.
    await page.screenshot({ path: path.join(out, `${deck}-${when}-corner.png`), clip: { x: 1100, y: 640, width: 720, height: 440 } });
  }
  await page.locator("#leave").click();
  await context.close();
}

// The phone at 390×844, by day: layout B (the room at 3×, panned to the
// front corner) and layout A (the whole room at 1×), with no deck and with
// the tall glass.
if (restart) execFileSync(restart, ["2026-11-06T10:00:00+11:00"], { stdio: "inherit" });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light", hasTouch: true, isMobile: true });
const p = await phone.newPage();
await p.goto(base);
await p.locator("#signup input[name=name]").fill(`tp${Date.now().toString(36)}`);
await p.locator("#signup input[name=password]").fill("correct horse battery");
await p.locator("#signup button[type=submit]").tap();
await p.locator("#code-done").tap();
for (const [deck, query] of [["none", "deck=none"], ["glass-tall", "deck=glass&rail=18"], ["glass-face", "deck=glass&rail=18&face=wall"]]) {
  await p.goto(`${base}/?${query}`);
  await p.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.screenshot({ path: path.join(out, `phone-b-${deck}.png`) });
  await p.locator("#layout-switch").tap();
  await p.waitForTimeout(400);
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.screenshot({ path: path.join(out, `phone-a-${deck}.png`) });
  await p.locator("#layout-switch").tap();
}
await p.locator("#leave").tap();
await phone.close();
await browser.close();
