import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { baseUrl, signUp, uniqueName, walkIn } from "./helpers";

// Slice 21: the guide over the café as it's entered, "Got it, no pop-up next
// time", and the shrink into its ⓘ. These visitors start with the guide on,
// as a newcomer's browser does; every other check starts with it off.

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
      if (await leave.isVisible().catch(() => false)) await leave.click({ force: true }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 100));
    await c.close();
  }
});

afterAll(async () => {
  await browser.close();
});

interface Opts {
  touch?: boolean;
  reducedMotion?: "reduce";
  /** The welcome rewritten to say this is a demo account, as the server says for one (slice 17). */
  demo?: boolean;
  /** Before the page loads, as the café's own reload for a new build notes it (slice 20). */
  backInside?: boolean;
}

/** A newcomer's browser, signed in, at the door. */
async function atDoor(viewport: { width: number; height: number }, opts: Opts = {}): Promise<Page> {
  const touch = opts.touch ?? false;
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, reducedMotion: opts.reducedMotion });
  contexts.push(context);
  const account = await signUp(uniqueName("g"));
  const [name, value] = account.cookie.split("=");
  await context.addCookies([{ name, value, url: baseUrl }]);
  const page = await context.newPage();
  if (opts.backInside) await page.addInitScript(() => sessionStorage.setItem("cafe.backInside", "1"));
  if (opts.demo) {
    await page.routeWebSocket(/\/ws$/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => {
        const f = JSON.parse(String(m));
        if (f.type === "welcome") ws.send(JSON.stringify({ ...f, demo: true }));
        else ws.send(m);
      });
      ws.onMessage((m) => server.send(m));
    });
  }
  await page.goto(baseUrl);
  return page;
}

const inside = (page: Page) => page.waitForFunction(() => /inside|window/.test(document.getElementById("status-text")?.textContent ?? ""));
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");
const inert = (page: Page) => page.evaluate(() => document.getElementById("cafe")!.inert);
const shown = (page: Page) => page.locator("#guide").isVisible();

/** Whether a box sits wholly inside the window. */
async function onScreen(page: Page, selector: string): Promise<boolean> {
  const box = await page.locator(selector).boundingBox();
  const size = page.viewportSize()!;
  return !!box && box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= size.width + 0.5 && box.y + box.height <= size.height + 0.5;
}

/** Which of the guide's width-bound lines show: every wide one, every narrow one, and none of the other. */
async function lines(page: Page): Promise<{ wide: boolean[]; narrow: boolean[]; demo: boolean[] }> {
  return page.evaluate(() => {
    const seen = (sel: string) => [...document.querySelectorAll<HTMLElement>(`#guide ${sel}`)].map((el) => el.checkVisibility());
    return { wide: seen(".for-wide"), narrow: seen(".for-narrow"), demo: seen(".for-demo") };
  });
}

/**
 * Closes the guide as `how` does, holding the shrink at its last frame to
 * measure it against the ⓘ, then lets it land. One evaluate, so the frame
 * can't finish before it's read.
 */
async function closeMeasured(page: Page, how: "close" | "escape" = "close") {
  const m = await page.evaluate((how) => {
    if (how === "close") document.getElementById("guide-close")!.click();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    const card = document.getElementById("guide-card")!;
    const shrink = card.getAnimations().at(-1);
    if (!shrink) return null;
    const frames = (shrink.effect as KeyframeEffect).getKeyframes();
    const ms = Number(shrink.effect!.getTiming().duration);
    shrink.pause();
    shrink.currentTime = ms;
    const c = card.getBoundingClientRect();
    const b = document.getElementById("guide-open")!.getBoundingClientRect();
    const out = {
      ms,
      transforms: frames.map((f) => (f.transform as string | undefined) ?? null),
      card: { x: c.left + c.width / 2, y: c.top + c.height / 2, w: c.width, h: c.height },
      button: { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height },
    };
    shrink.play();
    return out;
  }, how);
  await page.locator("#guide").waitFor({ state: "hidden" });
  return m;
}

/** The ⓘ stands just left of Add furniture, on its row, in the window. */
async function besideAddFurniture(page: Page): Promise<void> {
  const i = (await page.locator("#guide-open").boundingBox())!;
  const add = (await page.locator("#add-furniture").boundingBox())!;
  expect(i.x + i.width).toBeLessThanOrEqual(add.x);
  expect(add.x - (i.x + i.width)).toBeLessThan(24);
  expect(Math.abs(i.y + i.height / 2 - (add.y + add.height / 2))).toBeLessThan(3);
  expect(await onScreen(page, "#guide-open")).toBe(true);
  expect(await page.locator("#guide-open").getAttribute("aria-label")).toBe("How the café works");
}

describe("the guide (slice 21)", () => {
  it("pops up over an inert café as a newcomer walks in at 1920×1080, and Close shrinks it into the ⓘ", { timeout: 60_000 }, async () => {
    const page = await atDoor({ width: 1920, height: 1080 });
    await walkIn(page);
    await inside(page);
    await page.locator("#guide").waitFor();
    expect(await page.getByRole("dialog", { name: "How the café works" }).isVisible()).toBe(true);
    expect(await inert(page)).toBe(true);
    expect(await focused(page)).toBe("guide-words");
    // The desktop's lines, not the phone's; nobody's demo line.
    const l = await lines(page);
    expect(l.wide.length).toBeGreaterThan(0);
    expect(l.wide.every(Boolean)).toBe(true);
    expect(l.narrow.length).toBeGreaterThan(0);
    expect(l.narrow.some(Boolean)).toBe(false);
    expect(l.demo.some(Boolean)).toBe(false);
    expect(await onScreen(page, "#guide-card")).toBe(true);
    expect(await page.locator("#guide-off").isChecked()).toBe(false);
    await page.screenshot({ path: "docs/notes/screens/slice-21/desktop-guide.png" }).catch(() => {});
    // Its last frame: the card's middle on the ⓘ's, small enough to fit in it.
    const m = (await closeMeasured(page))!;
    expect(m).not.toBeNull();
    expect(m.ms).toBeGreaterThanOrEqual(300);
    expect(Math.abs(m.card.x - m.button.x)).toBeLessThan(1.5);
    expect(Math.abs(m.card.y - m.button.y)).toBeLessThan(1.5);
    expect(m.card.w).toBeLessThanOrEqual(m.button.w + 0.5);
    expect(m.card.h).toBeLessThanOrEqual(m.button.h + 0.5);
    expect(await inert(page)).toBe(false);
    expect(await focused(page)).toBe("room");
    await besideAddFurniture(page);
    await page.screenshot({ path: "docs/notes/screens/slice-21/desktop-closed.png" }).catch(() => {});
  });

  it("opens from the ⓘ by mouse and by keyboard, keeps Tab inside, and closes by Close, Escape or a press beside it", { timeout: 60_000 }, async () => {
    const page = await atDoor({ width: 1920, height: 1080 });
    await walkIn(page);
    await inside(page);
    await page.locator("#guide").waitFor();
    await page.locator("#guide-close").click();
    await page.locator("#guide").waitFor({ state: "hidden" });
    // By mouse, growing out of the ⓘ.
    await page.locator("#guide-open").click();
    await page.locator("#guide").waitFor();
    const grow = await page.evaluate(() => {
      const a = document.getElementById("guide-card")!.getAnimations().at(-1);
      return a ? ((a.effect as KeyframeEffect).getKeyframes()[0].transform as string) : null;
    });
    expect(grow).toMatch(/^translate\(.+\) scale\(.+\)$/);
    expect(await inert(page)).toBe(true);
    // Tab and Shift+Tab go round it, never out to the café.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.getElementById("guide-card")!.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await page.evaluate(() => document.getElementById("guide-card")!.contains(document.activeElement))).toBe(true);
    }
    // Escape, from the ⓘ: the focus goes back to it.
    await page.keyboard.press("Escape");
    await page.locator("#guide").waitFor({ state: "hidden" });
    expect(await focused(page)).toBe("guide-open");
    // By keyboard: Enter on the ⓘ, then Close by Space.
    await page.keyboard.press("Enter");
    await page.locator("#guide").waitFor();
    expect(await focused(page)).toBe("guide-words");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("guide-close");
    await page.keyboard.press("Space");
    await page.locator("#guide").waitFor({ state: "hidden" });
    expect(await focused(page)).toBe("guide-open");
    // A press beside it, in the window's corner.
    await page.locator("#guide-open").click();
    await page.locator("#guide").waitFor();
    await page.mouse.click(12, 1068);
    await page.locator("#guide").waitFor({ state: "hidden" });
    expect(await inert(page)).toBe(false);
    // A press on its own words doesn't.
    await page.locator("#guide-open").click();
    await page.locator("#guide").waitFor();
    await page.locator("#guide-words h2").click();
    await page.waitForTimeout(500);
    expect(await shown(page)).toBe(true);
    await page.keyboard.press("Escape");
    await page.locator("#guide").waitFor({ state: "hidden" });
  });

  it("ticked, stays down on Come back in and on a reload; the ⓘ shows it ticked; unticked, it pops up again", { timeout: 60_000 }, async () => {
    const page = await atDoor({ width: 1920, height: 1080 });
    await walkIn(page);
    await inside(page);
    await page.locator("#guide").waitFor();
    await page.getByLabel("Got it, no pop-up next time").check();
    // Escape keeps the tick: it's saved as it changes.
    await page.keyboard.press("Escape");
    await page.locator("#guide").waitFor({ state: "hidden" });
    // Leave, Come back in: no guide.
    await page.locator("#leave").click();
    await walkIn(page);
    await inside(page);
    await page.waitForTimeout(600);
    expect(await shown(page)).toBe(false);
    expect(await focused(page)).toBe("room");
    // A reload, Walk in: no guide.
    await page.reload();
    await walkIn(page);
    await inside(page);
    await page.waitForTimeout(600);
    expect(await shown(page)).toBe(false);
    // The ⓘ shows it ticked; unticked, it's back next time in.
    await page.locator("#guide-open").click();
    await page.locator("#guide").waitFor();
    expect(await page.locator("#guide-off").isChecked()).toBe(true);
    await page.getByLabel("Got it, no pop-up next time").uncheck();
    await page.locator("#guide-close").click();
    await page.locator("#guide").waitFor({ state: "hidden" });
    await page.locator("#leave").click();
    await walkIn(page);
    await inside(page);
    await page.locator("#guide").waitFor();
    expect(await page.locator("#guide-off").isChecked()).toBe(false);
  });

  it("doesn't pop up when the café reloads itself for a new build, which goes straight back in", { timeout: 60_000 }, async () => {
    const page = await atDoor({ width: 1920, height: 1080 }, { backInside: true });
    await inside(page);
    expect(await page.locator("#door").isVisible()).toBe(false);
    await page.waitForTimeout(600);
    expect(await shown(page)).toBe(false);
    expect(await inert(page)).toBe(false);
  });

  it("pops up at 390×844 by touch with the phone's lines, in both layouts, the ⓘ beside Add furniture", { timeout: 60_000 }, async () => {
    const page = await atDoor({ width: 390, height: 844 }, { touch: true });
    await page.locator("#door-in").tap();
    await inside(page);
    await page.locator("#guide").waitFor();
    const l = await lines(page);
    expect(l.narrow.every(Boolean)).toBe(true);
    expect(l.wide.some(Boolean)).toBe(false);
    expect(await onScreen(page, "#guide-card")).toBe(true);
    expect(await onScreen(page, "#guide-close")).toBe(true);
    expect(await onScreen(page, "#guide-off")).toBe(true);
    await page.screenshot({ path: "docs/notes/screens/slice-21/phone-guide.png" }).catch(() => {});
    const m = (await closeMeasured(page))!;
    expect(Math.abs(m.card.x - m.button.x)).toBeLessThan(1.5);
    expect(Math.abs(m.card.y - m.button.y)).toBeLessThan(1.5);
    expect(m.card.w).toBeLessThanOrEqual(m.button.w + 0.5);
    expect(m.card.h).toBeLessThanOrEqual(m.button.h + 0.5);
    // Layout B, the phone's default.
    expect(await page.evaluate(() => document.body.classList.contains("layout-b"))).toBe(true);
    await besideAddFurniture(page);
    await page.screenshot({ path: "docs/notes/screens/slice-21/phone-b-closed.png" }).catch(() => {});
    // Layout A: the ⓘ still beside Add furniture; a tap opens it, a tap closes it.
    await page.locator("#layout-switch").tap();
    expect(await page.evaluate(() => document.body.classList.contains("layout-b"))).toBe(false);
    await besideAddFurniture(page);
    // The ⓘ takes its room from the buttons' rows, not from the status
    // line, which stays on one line ("2/6 inside").
    expect(await page.locator("#status-text").evaluate((el) => el.getClientRects().length)).toBe(1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: "docs/notes/screens/slice-21/phone-a-closed.png" }).catch(() => {});
    await page.locator("#guide-open").tap();
    await page.locator("#guide").waitFor();
    expect(await onScreen(page, "#guide-close")).toBe(true);
    await page.locator("#guide-close").tap();
    await page.locator("#guide").waitFor({ state: "hidden" });
    expect(await focused(page)).toBe("guide-open");
  });

  it("survives a resize mid-use: its lines swap, it stays in the window, and it shrinks to where the ⓘ is now", { timeout: 60_000 }, async () => {
    const page = await atDoor({ width: 1920, height: 1080 });
    await walkIn(page);
    await inside(page);
    await page.locator("#guide").waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const l = await lines(page);
    expect(l.narrow.every(Boolean)).toBe(true);
    expect(l.wide.some(Boolean)).toBe(false);
    expect(await onScreen(page, "#guide-card")).toBe(true);
    expect(await onScreen(page, "#guide-close")).toBe(true);
    const m = (await closeMeasured(page, "escape"))!;
    expect(Math.abs(m.card.x - m.button.x)).toBeLessThan(1.5);
    expect(Math.abs(m.card.y - m.button.y)).toBeLessThan(1.5);
    // And back: open at the phone's size, then a desktop's.
    await page.locator("#guide-open").click();
    await page.locator("#guide").waitFor();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    const back = await lines(page);
    expect(back.wide.every(Boolean)).toBe(true);
    expect(back.narrow.some(Boolean)).toBe(false);
    expect(await onScreen(page, "#guide-card")).toBe(true);
    await page.keyboard.press("Escape");
    await page.locator("#guide").waitFor({ state: "hidden" });
  });

  it("only fades with reduced motion", { timeout: 60_000 }, async () => {
    const page = await atDoor({ width: 1920, height: 1080 }, { reducedMotion: "reduce" });
    await walkIn(page);
    await inside(page);
    await page.locator("#guide").waitFor();
    const m = (await closeMeasured(page))!;
    expect(m.transforms.every((t) => t === null || t === "none")).toBe(true);
    expect(await inert(page)).toBe(false);
  });

  it("tells a demo account what the demo bar does, and nobody else", { timeout: 60_000 }, async () => {
    const page = await atDoor({ width: 1920, height: 1080 }, { demo: true });
    await walkIn(page);
    await inside(page);
    await page.locator("#guide").waitFor();
    await expect.poll(async () => (await lines(page)).demo).toEqual([true]);
    await page.screenshot({ path: "docs/notes/screens/slice-21/desktop-demo-guide.png" }).catch(() => {});
    await page.keyboard.press("Escape");
    await page.locator("#guide").waitFor({ state: "hidden" });
  });
});
