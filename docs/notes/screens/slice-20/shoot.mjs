// Screenshots for slice 20's judged line: the door and the one way in, on a
// phone and a desktop, in the light theme (Latte) and the dark (Mocha),
// against a local café (APP_URL, default http://localhost:8080). The door's
// greeting follows the device's Canberra hour, so each shot fakes one.
//   door-<theme>-<size>.png     opening the café signed in, by the hour
//   left-<theme>-<size>.png     after Leave
//   way-in-<theme>-<size>.png   the one form, with a refused log-in's words
//   look-<theme>-<size>.png     "I'm new"'s look step
//   still-up-dark-390x844.png   the door after 22:00
// Usage, from the repo root: node docs/notes/screens/slice-20/shoot.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const out = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? "http://localhost:8080";
const browser = await chromium.launch();
const sizes = [
  { name: "390x844", viewport: { width: 390, height: 844 }, touch: true },
  { name: "1920x1080", viewport: { width: 1920, height: 1080 }, touch: false },
];
const themes = [
  { name: "light", scheme: "light", hour: "09:30" },
  { name: "dark", scheme: "dark", hour: "19:30" },
];

/** A fresh account, made through the API, and its session cookie. */
async function account(prefix) {
  // A short tail keeps it a name's length, as a visitor's would be.
  const name = `${prefix}_${Date.now().toString(36).slice(-3)}`;
  const res = await fetch(new URL("/api/signup", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, password: "correct horse battery", look: { avatar: 2, colour: 4 } }),
  });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session=")).split(";")[0];
  return { name, cookie };
}

async function opened({ viewport, touch }, scheme, hour, cookie) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, colorScheme: scheme });
  if (cookie) {
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: base }]);
  }
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`2026-11-08T${hour}:00+11:00`) });
  await page.clock.resume();
  await page.goto(base);
  return { context, page };
}

const shot = (page, file) => page.screenshot({ path: path.join(out, file) });

for (const size of sizes) {
  for (const theme of themes) {
    const tag = `${theme.name}-${size.name}`;
    // The door, opening the café signed in.
    const a = await account("mochi_fan");
    await new Promise((r) => setTimeout(r, 50));
    let { context, page } = await opened(size, theme.scheme, theme.hour, a.cookie);
    await page.locator("#door").waitFor();
    await page.waitForTimeout(300);
    await shot(page, `door-${tag}.png`);
    // In, then Leave: the door says hi.
    await page.locator("#door-in").click();
    await page.waitForFunction(() => /inside|window/.test(document.getElementById("status-text")?.textContent ?? ""));
    await page.locator("#leave").click();
    await page.locator("#door").waitFor();
    await page.waitForTimeout(300);
    await shot(page, `left-${tag}.png`);
    await context.close();
    // The way in, with a refused log-in's words.
    ({ context, page } = await opened(size, theme.scheme, theme.hour));
    await page.locator("#way-in").waitFor();
    await page.locator("#way-in-name").fill("nobody_here");
    await page.locator("#way-in-password").fill("wrong horse");
    await page.locator("#log-in").click();
    await page.waitForFunction(() => /New here/.test(document.getElementById("auth-error")?.textContent ?? ""));
    await shot(page, `way-in-${tag}.png`);
    // I'm new: the look step.
    await page.locator("#way-in-name").fill(`pip_${Date.now().toString(36).slice(-4)}`);
    await page.locator("#way-in-password").fill("correct horse battery");
    await page.locator("#im-new").click();
    await page.locator("#look-step").waitFor();
    await page.waitForTimeout(200);
    await shot(page, `look-${tag}.png`);
    await context.close();
  }
}
// After 22:00, the door asks who's still up.
const late = await account("night_owl");
const { context, page } = await opened(sizes[0], "dark", "23:15", late.cookie);
await page.locator("#door").waitFor();
await page.waitForTimeout(300);
await shot(page, "still-up-dark-390x844.png");
await context.close();
await browser.close();
