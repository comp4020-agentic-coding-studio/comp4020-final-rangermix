// Slice 21 on the live café: one agent_ visitor, a fresh random password
// never written down, at 1920×1080 by mouse and 390×844 by touch. Walks in,
// sees the guide, closes it into the ⓘ, opens it from the ⓘ, ticks "Got it,
// no pop-up next time", comes back in to no guide, and leaves. Run from the
// repo root: node docs/notes/screens/slice-21/live.mjs
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const base = process.env.APP_URL ?? "https://comp4020-final-rangermix.fly.dev";
const dir = "docs/notes/screens/slice-21";
const name = `agent_g${Date.now().toString(36).slice(-6)}`;
const password = randomBytes(18).toString("base64url");
const said = [];
const note = (line) => {
  said.push(line);
  console.log(line);
};

const res = await fetch(`${base}/api/signup`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ name, password, look: { avatar: 1, colour: 2 } }),
});
if (res.status !== 200) throw new Error(`sign-up refused: ${res.status} ${await res.text()}`);
const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session=")).split(";")[0];
const [cn, cv] = cookie.split("=");
note(`signed up ${name}`);

const browser = await chromium.launch();
for (const [label, viewport, touch] of [
  ["desktop", { width: 1920, height: 1080 }, false],
  ["phone", { width: 390, height: 844 }, true],
]) {
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  await ctx.addCookies([{ name: cn, value: cv, url: base }]);
  const page = await ctx.newPage();
  const press = (sel) => (touch ? page.locator(sel).tap() : page.locator(sel).click());
  await page.goto(base);
  await press("#door-in");
  await page.waitForFunction(() => /inside|window/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.locator("#guide").waitFor({ timeout: 10_000 });
  const inert = await page.evaluate(() => document.getElementById("cafe").inert);
  note(`${label}: walked in, the guide up, the café inert: ${inert}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/live-${label}-guide.png` });
  await press("#guide-close");
  await page.locator("#guide").waitFor({ state: "hidden" });
  const i = await page.locator("#guide-open").boundingBox();
  const add = await page.locator("#add-furniture").boundingBox();
  note(`${label}: closed; the ⓘ at ${Math.round(i.x)},${Math.round(i.y)}, Add furniture at ${Math.round(add.x)},${Math.round(add.y)}`);
  await page.screenshot({ path: `${dir}/live-${label}-closed.png` });
  await press("#guide-open");
  await page.locator("#guide").waitFor();
  if (label === "phone") {
    // Ticked on the phone's browser only: the desktop's stays a newcomer's.
    await press("#guide-off");
    note(`${label}: the ⓘ opened it; ticked "Got it, no pop-up next time": ${await page.locator("#guide-off").isChecked()}`);
  } else note(`${label}: the ⓘ opened it`);
  await press("#guide-close");
  await page.locator("#guide").waitFor({ state: "hidden" });
  await press("#leave");
  await press("#door-in");
  await page.waitForFunction(() => /inside|window/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.waitForTimeout(800);
  const back = await page.locator("#guide").isVisible();
  note(`${label}: Come back in, the guide ${back ? "up" : "not up"}`);
  if (back) {
    await press("#guide-close");
    await page.locator("#guide").waitFor({ state: "hidden" });
  }
  await press("#leave");
  await ctx.close();
}
await browser.close();
note("left");
