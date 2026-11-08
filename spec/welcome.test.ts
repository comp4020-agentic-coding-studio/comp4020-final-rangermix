import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Visitor, baseUrl, logInThroughPage, post, signUp, signUpThroughPage, uniqueName } from "./helpers";

// Slice 20 (ADR 0023): the door a returning visitor meets, the page after
// Leave as the same door, "I'm not <name>", and one way in for everyone.

let browser: Browser;
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  browser = await chromium.launch();
});

// Each visitor walks out through the door, so their seat is free at once.
afterEach(async () => {
  for (const c of contexts.splice(0)) {
    for (const page of c.pages()) {
      const leave = page.locator("#leave");
      if (await leave.isVisible().catch(() => false)) await leave.click().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 100));
    await c.close();
  }
});

afterAll(async () => {
  await browser.close();
});

interface Opened {
  page: Page;
  context: BrowserContext;
  /** Every WebSocket the page opened, by URL. */
  sockets: string[];
}

/** A fresh browser, its page opened on the café but not yet anywhere. */
async function open(viewport: { width: number; height: number }, touch = false, cookie?: string): Promise<Opened> {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  contexts.push(context);
  if (cookie) {
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: baseUrl }]);
  }
  const page = await context.newPage();
  const sockets: string[] = [];
  page.on("websocket", (ws) => sockets.push(ws.url()));
  await page.goto(baseUrl);
  return { page, context, sockets };
}

const inside = (page: Page) => page.waitForFunction(() => /inside|window/.test(document.getElementById("status-text")?.textContent ?? ""));
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");
const text = (page: Page, id: string) => page.locator(`#${id}`).textContent();

/** The greeting the device's Canberra hour gives, as the door says it. */
function greetingNow(name: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" }).format(new Date())) % 24;
  if (hour >= 5 && hour < 12) return `Good morning, ${name}.`;
  if (hour >= 12 && hour < 18) return `Good afternoon, ${name}.`;
  if (hour >= 18 && hour < 22) return `Good evening, ${name}.`;
  return `Still up, ${name}?`;
}

/** Whether a box sits wholly inside the window. */
async function onScreen(page: Page, selector: string): Promise<boolean> {
  const box = await page.locator(selector).boundingBox();
  const size = page.viewportSize()!;
  return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 0.5 && box.y + box.height <= size.height + 0.5;
}

describe("the door (slice 20)", () => {
  it("greets a returning visitor by name and the hour, joins nothing until Walk in, then walks in by keyboard at 1920×1080", async () => {
    const account = await signUp(uniqueName("w"));
    // Someone already inside, who'd see a newcomer arrive.
    const watcher = await Visitor.connect((await signUp(uniqueName("w"))).cookie);
    const { page, sockets } = await open({ width: 1920, height: 1080 }, false, account.cookie);
    await page.locator("#door").waitFor();
    expect(await text(page, "door-greeting")).toBe(greetingNow(account.name));
    expect(await text(page, "door-text")).toBe("The cats are about. Come in when you're ready.");
    expect(await text(page, "door-in")).toBe("Walk in");
    expect(await text(page, "not-me")).toBe(`I'm not ${account.name}`);
    expect(await focused(page)).toBe("door-in");
    expect(await page.locator("#door-avatar").isVisible()).toBe(true);
    expect(await page.locator("#cafe").isHidden()).toBe(true);
    expect(await page.locator("#auth").isHidden()).toBe(true);
    // A while at the door: no connection, and nobody inside sees them.
    await page.waitForTimeout(1500);
    expect(sockets, "no WebSocket before Walk in").toEqual([]);
    expect(watcher.messages.some((m) => m.type === "personJoined" && m.person?.id === account.id), "the watcher saw nobody arrive").toBe(false);
    // In, by keyboard.
    await page.keyboard.press("Enter");
    await inside(page);
    expect(sockets.length).toBe(1);
    await watcher.next((m) => m.type === "personJoined" && m.person?.id === account.id, 5000);
    await watcher.leave();
  });

  it("walks in by touch at 390×844, and by mouse after a resize to 1920×1080 and back", async () => {
    const account = await signUp(uniqueName("w"));
    const phone = await open({ width: 390, height: 844 }, true, account.cookie);
    await phone.page.locator("#door").waitFor();
    for (const id of ["#door-in", "#not-me", "#door-avatar", "#door-greeting"]) expect(await onScreen(phone.page, id), `${id} on a phone`).toBe(true);
    // A resize mid-use: the door stays whole, its buttons on screen.
    await phone.page.setViewportSize({ width: 1920, height: 1080 });
    for (const id of ["#door-in", "#not-me"]) expect(await onScreen(phone.page, id), `${id} on a desktop`).toBe(true);
    await phone.page.setViewportSize({ width: 390, height: 844 });
    for (const id of ["#door-in", "#not-me"]) expect(await onScreen(phone.page, id), `${id} back on a phone`).toBe(true);
    await phone.page.locator("#door-in").tap();
    await inside(phone.page);
    await phone.page.locator("#leave").tap();
    // By mouse, on a desktop.
    const desk = await open({ width: 1920, height: 1080 }, false, account.cookie);
    await desk.page.locator("#door-in").click();
    await inside(desk.page);
  });

  it("after Leave says hi above what it said before, with Come back in, at both sizes", async () => {
    const account = await signUp(uniqueName("w"));
    for (const [viewport, touch] of [
      [{ width: 1920, height: 1080 }, false],
      [{ width: 390, height: 844 }, true],
    ] as const) {
      const { page } = await open(viewport, touch, account.cookie);
      await page.locator("#door-in").click();
      await inside(page);
      await page.locator("#leave").click();
      await page.locator("#door").waitFor();
      expect(await text(page, "door-greeting")).toBe(`Hi, ${account.name}.`);
      expect(await text(page, "door-text")).toBe("You've left the café. The cats will remember you.");
      expect(await text(page, "door-in")).toBe("Come back in");
      expect(await text(page, "not-me")).toBe(`I'm not ${account.name}`);
      expect(await focused(page)).toBe("door-in");
      for (const id of ["#door-in", "#not-me"]) expect(await onScreen(page, id), `${id} at ${viewport.width}`).toBe(true);
      await page.locator("#door-in").click();
      await inside(page);
      await page.locator("#leave").click();
    }
  });

  it("signs the session out for someone else, who then logs in as themselves", async () => {
    const first = await signUp(uniqueName("w"));
    const second = await signUp(uniqueName("w"));
    const { page, sockets } = await open({ width: 1920, height: 1080 }, false, first.cookie);
    await page.locator("#door").waitFor();
    await page.locator("#not-me").click();
    // The way in, empty, the name focused.
    await page.locator("#way-in").waitFor();
    expect(await focused(page)).toBe("way-in-name");
    expect(await page.locator("#way-in-name").inputValue()).toBe("");
    expect(await page.locator("#way-in-password").inputValue()).toBe("");
    expect(sockets, "never joined").toEqual([]);
    // The session is gone on the server: the old cookie no longer answers.
    const me = await fetch(new URL("/api/me", baseUrl), { headers: { cookie: first.cookie } });
    expect(me.status).toBe(401);
    // A reload shows the way in, not the door.
    await page.reload();
    await page.locator("#way-in").waitFor();
    expect(await page.locator("#door").isHidden()).toBe(true);
    // Someone else, as themselves.
    await logInThroughPage(page, second.name, second.password);
    await inside(page);
    await page.locator("#leave").click();
    expect(await text(page, "door-greeting")).toBe(`Hi, ${second.name}.`);
  });

  it("an open tab takes no place in the line until Walk in", async () => {
    // A tab at the door holds nothing: the café counts only who walked in.
    const account = await signUp(uniqueName("w"));
    await open({ width: 390, height: 844 }, true, account.cookie);
    // Long enough for a page that walked straight in to have arrived, as
    // one did before slice 20.
    await new Promise((r) => setTimeout(r, 2000));
    const watcher = await Visitor.connect((await signUp(uniqueName("w"))).cookie);
    const people = watcher.welcome.snapshot.people as { id: number }[];
    expect(people.some((p) => p.id === account.id)).toBe(false);
    await watcher.leave();
  });
});

describe("a reload the café makes for a new build (slice 20)", () => {
  it("goes straight back in, not out to the door, and a later opening meets the door", { timeout: 30_000 }, async () => {
    const account = await signUp(uniqueName("w"));
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    contexts.push(context);
    const [name, value] = account.cookie.split("=");
    await context.addCookies([{ name, value, url: baseUrl }]);
    const page = await context.newPage();
    // The café says it runs another build, so the tab reloads itself once.
    await page.routeWebSocket(/\/ws$/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => {
        const f = JSON.parse(String(m));
        ws.send(f.type === "welcome" ? JSON.stringify({ ...f, build: "a-newer-build" }) : m);
      });
      ws.onMessage((m) => server.send(m));
    });
    let loads = 0;
    page.on("load", () => loads++);
    await page.goto(baseUrl);
    await page.locator("#door-in").click();
    // Reloaded for the build, and back inside without the door.
    await expect.poll(() => loads, { timeout: 10_000 }).toBe(2);
    await inside(page);
    expect(await page.locator("#door").isHidden()).toBe(true);
    // A reload of the visitor's own meets the door again.
    await page.reload();
    await page.locator("#door").waitFor();
    expect(await page.locator("#cafe").isHidden()).toBe(true);
  });
});

describe("one way in (slice 20)", () => {
  it("signs up by keyboard: a name, a password, I'm new, a look, the recovery code, and in", async () => {
    const { page } = await open({ width: 1920, height: 1080 });
    await page.locator("#way-in").waitFor();
    expect(await page.locator("[role=tab]").count(), "no tabs").toBe(0);
    const name = uniqueName("w");
    await signUpThroughPage(page, name, { keyboard: true });
    await inside(page);
  });

  it("I'm new with a taken name, or one of the café's own, stays to say why; Back keeps the fields; a wrong password points to I'm new", async () => {
    const taken = await signUp(uniqueName("w"));
    const { page } = await open({ width: 390, height: 844 }, true);
    await page.locator("#way-in-name").fill(taken.name.toUpperCase());
    await page.locator("#way-in-password").fill("correct horse");
    await page.locator("#im-new").tap();
    await expect.poll(() => text(page, "auth-error")).toBe("That name is taken.");
    expect(await page.locator("#look-step").isHidden()).toBe(true);
    await page.locator("#way-in-name").fill("demo9");
    await page.locator("#im-new").tap();
    await expect.poll(() => text(page, "auth-error")).toBe("That name is the café's own.");
    // A free name: the look step by name, and Back with the fields kept.
    const fresh = uniqueName("w");
    await page.locator("#way-in-name").fill(fresh);
    await page.locator("#im-new").tap();
    await page.locator("#look-step").waitFor();
    expect(await text(page, "look-heading")).toBe(`Choose your look, ${fresh}`);
    for (const id of ["#sign-up", "#look-back"]) expect(await onScreen(page, id), id).toBe(true);
    await page.locator("#look-back").tap();
    expect(await page.locator("#way-in-name").inputValue()).toBe(fresh);
    expect(await page.locator("#way-in-password").inputValue()).toBe("correct horse");
    // Walk in with a name that has no account: refused, and pointed to I'm new.
    await page.locator("#log-in").tap();
    await expect.poll(() => text(page, "auth-error")).toBe("That name and password don't match. New here? Press I'm new.");
    // Nothing was signed up along the way.
    const check = await post("/api/check-name", { name: fresh });
    expect(check.status).toBe(204);
  });

  it("logs in by Enter from the password, and survives a resize mid-use", async () => {
    const account = await signUp(uniqueName("w"));
    const { page } = await open({ width: 390, height: 844 }, true);
    await page.locator("#way-in-name").fill(account.name);
    await page.setViewportSize({ width: 1920, height: 1080 });
    for (const id of ["#log-in", "#im-new", "#show-recover"]) expect(await onScreen(page, id), id).toBe(true);
    await page.locator("#way-in-password").fill(account.password);
    await page.locator("#way-in-password").press("Enter");
    await inside(page);
  });
});
