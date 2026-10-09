import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { baseUrl, uniqueName } from "./helpers";

// Browser checks (design.md, "Checks"): the keyboard-only pass at both
// marking sizes with a resize mid-use, the phone by touch, the layout switch,
// and something one visitor does reaching another's page.

let browser: Browser;
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  browser = await chromium.launch();
});

// Each visitor walks out through the door, so their seat is free at once for
// the next check rather than held for the grace period.
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

type Frame = { type: string; [key: string]: any };

interface Visit {
  page: Page;
  frames: Frame[];
}

/** Opens the café in a fresh browser and signs up through the page, by keyboard. */
async function visit(viewport: { width: number; height: number }, touch = false): Promise<Visit> {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  contexts.push(context);
  const page = await context.newPage();
  const frames: Frame[] = [];
  page.on("websocket", (ws) => ws.on("framereceived", (f) => frames.push(JSON.parse(String(f.payload)))));
  await page.goto(baseUrl);
  await page.locator("#signup input[name=name]").focus();
  await page.keyboard.type(uniqueName("b"));
  await page.keyboard.press("Tab");
  await page.keyboard.type("correct horse");
  await page.keyboard.press("Enter");
  await page.locator("#code-done:focus").waitFor();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  return { page, frames };
}

const focused = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("role") || "");
const roomWidth = (page: Page) => page.evaluate(() => document.getElementById("room")?.style.width);

describe("in a browser", { timeout: 30_000 }, () => {
  it("does everything by keyboard at both sizes, through a resize mid-use", async () => {
    const { page } = await visit({ width: 1920, height: 1080 });
    expect(await focused(page)).toBe("room");
    expect(await roomWidth(page)).toBe("960px");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.locator(".menu").waitFor();
    expect(await focused(page)).toBe("menuitem");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    expect(await page.locator(".menu").count()).toBe(0);
    expect(await focused(page)).toBe("room");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.getElementById("room")?.style.width === "384px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("talk-input");
    await page.keyboard.type("hello by keyboard");
    await page.keyboard.press("Enter");
    await page.locator(".bubble", { hasText: "hello by keyboard" }).waitFor();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => document.getElementById("room")?.style.width === "960px");
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("room");
    // Back past the panel's own buttons (putting a treat down) to Leave.
    const passed: string[] = [];
    for (let i = 0; i < 4 && (await focused(page)) !== "leave"; i++) {
      await page.keyboard.press("Shift+Tab");
      passed.push(await page.evaluate(() => document.activeElement?.textContent ?? ""));
    }
    expect(passed).toContain("Put a treat down");
    expect(await focused(page)).toBe("leave");
    await page.keyboard.press("Enter");
    await page.locator("#left-cafe").waitFor();
    expect(await focused(page)).toBe("come-back");
  });

  it("opens actions as a sheet from the bottom on a phone, by touch", async () => {
    const { page, frames } = await visit({ width: 390, height: 844 }, true);
    const welcome = frames.find((f) => f.type === "welcome")!;
    const box = (await page.locator("#room").boundingBox())!;
    // A chair stays put, where a cat might wander off just as it's tapped.
    const chair = welcome.snapshot.room.furniture.find((f: Frame) => f.kind === "chair");
    await page.touchscreen.tap(box.x + (chair.x + 0.5) * (box.width / 12), box.y + (chair.y + 0.5) * (box.height / 10));
    const menu = page.locator(".menu.sheet");
    await menu.waitFor();
    const r = (await menu.boundingBox())!;
    expect(Math.round(r.y + r.height)).toBe(844);
    expect(Math.round(r.width)).toBe(390);
    await expect.poll(() => menu.getByRole("menuitem").count()).toBeGreaterThan(0);
  });

  it("switches the phone to the bigger room, follows the pointer, opens rings, and remembers it", async () => {
    const { page, frames } = await visit({ width: 390, height: 844 }, true);
    await page.locator("#layout-switch").tap();
    await page.waitForFunction(() => document.body.classList.contains("layout-b"));
    expect(await roomWidth(page)).toBe("576px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // The keyboard's pointer pulls the view along with it.
    const leftOf = () => page.evaluate(() => document.getElementById("room")?.style.left);
    await page.locator("#room").focus();
    const before = await leftOf();
    for (let i = 0; i < 6; i++) await page.keyboard.press(i === 0 ? "ArrowRight" : before === "0px" ? "ArrowRight" : "ArrowLeft");
    await expect.poll(leftOf).not.toBe(before);
    await page.keyboard.press("Escape");
    // Whatever the pointer settles on, its actions open as a ring, every button
    // on screen and clear of the bars. (Cats wander, and a third of the room is
    // off screen at 3x, so the pointer finds a target rather than a tap
    // guessing where a cat will be.)
    const ring = page.locator(".menu.ring");
    await page.locator("#room").focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await ring.waitFor({ timeout: 3000 });
    const bars = await page.evaluate(() => [document.querySelector(".status")!.getBoundingClientRect().bottom, document.querySelector(".talk")!.getBoundingClientRect().top]);
    const buttons = await ring.getByRole("menuitem").all();
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      const r = (await b.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(390);
      expect(r.y).toBeGreaterThanOrEqual(bars[0]);
      expect(r.y + r.height).toBeLessThanOrEqual(bars[1]);
    }
    await page.keyboard.press("Escape");
    await page.reload();
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    expect(await page.evaluate(() => document.body.classList.contains("layout-b"))).toBe(true);
    await page.locator("#layout-switch").tap();
    expect(await roomWidth(page)).toBe("384px");
  });

  it("puts a treat down from the panel, and the other visitor sees it", async () => {
    const a = await visit({ width: 1920, height: 1080 });
    const b = await visit({ width: 1920, height: 1080 });
    const from = b.frames.length;
    await a.page.getByRole("button", { name: "Put a treat down" }).click();
    await expect.poll(() => b.frames.slice(from).some((f) => f.type === "treatPlaced")).toBe(true);
    await expect.poll(() => a.page.locator(".treats").textContent()).toContain("Treats today: 2");
  });

  it("shows one visitor's new lamp in the other's café", async () => {
    const a = await visit({ width: 1920, height: 1080 });
    const b = await visit({ width: 1920, height: 1080 });
    await a.page.locator("#add-furniture").click();
    const sent = Date.now();
    await a.page.locator(".menu").getByRole("menuitem", { name: "A lamp" }).click();
    await b.page.waitForFunction(() => /picked up the lamp/.test(document.getElementById("announcer")?.textContent ?? ""), null, { timeout: 1000 });
    expect(Date.now() - sent).toBeLessThan(1000);
    await a.page.locator("#carrying").waitFor();
    await a.page.locator("#put-back").click();
    await a.page.locator("#carrying").waitFor({ state: "hidden" });
  });
});
