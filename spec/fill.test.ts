import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { baseUrl, uniqueName } from "./helpers";

// Slice 16's browser checks: at the 1920×1080 viewport the course marks at,
// the café fills the window. The 13 by 12 floor at 4×, the status and talk
// bars floating over the room, the street behind it to the window's edges,
// the terrace in its bottom corners, and on a phone's whole-room layout the
// room centred, its side corners cut evenly.

let browser: Browser;
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  browser = await chromium.launch();
});

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

type Frame = { type: string; [key: string]: unknown };

interface Visit {
  page: Page;
  sent: Frame[];
}

/** Opens the café in a fresh browser at 10:00 Canberra time and signs up through the page, by keyboard. */
async function visit(viewport: { width: number; height: number }, touch = false, at = "10:00"): Promise<Visit> {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  contexts.push(context);
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`2026-11-06T${at}:00+11:00`) });
  await page.clock.resume();
  const sent: Frame[] = [];
  page.on("websocket", (ws) => ws.on("framesent", (f) => sent.push(JSON.parse(String(f.payload)))));
  await page.goto(baseUrl);
  await page.locator("#signup input[name=name]").focus();
  await page.keyboard.type(uniqueName("f"));
  await page.keyboard.press("Tab");
  await page.keyboard.type("correct horse");
  await page.keyboard.press("Enter");
  await page.locator("#code-done:focus").waitFor();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  return { page, sent };
}

type Box = { x: number; y: number; width: number; height: number };
const boxOf = async (page: Page, selector: string): Promise<Box> => (await page.locator(selector).boundingBox())!;

/** Every floor tile's diamond on the page, its four corners, from the café's own read-only map. */
async function floorTiles(page: Page): Promise<{ x: number; y: number; corners: { x: number; y: number }[] }[]> {
  return page.evaluate(() => {
    const room = (window as unknown as { cafeRoom: { tileAt(x: number, y: number): { x: number; y: number } } }).cafeRoom;
    const out: { x: number; y: number; corners: { x: number; y: number }[] }[] = [];
    // tileAt gives a tile's middle; its corners are half a tile along each axis.
    for (let y = 1; y < 13; y++) {
      for (let x = 0; x < 13; x++) {
        const c = room.tileAt(x, y);
        const right = room.tileAt(x + 1, y);
        const down = room.tileAt(x, y + 1);
        const ax = { x: (right.x - c.x) / 2, y: (right.y - c.y) / 2 };
        const ay = { x: (down.x - c.x) / 2, y: (down.y - c.y) / 2 };
        out.push({
          x,
          y,
          corners: [
            { x: c.x - ax.x - ay.x, y: c.y - ax.y - ay.y },
            { x: c.x + ax.x - ay.x, y: c.y + ax.y - ay.y },
            { x: c.x + ax.x + ay.x, y: c.y + ax.y + ay.y },
            { x: c.x - ax.x + ay.x, y: c.y - ax.y + ay.y },
          ],
        });
      }
    }
    return out;
  });
}

const inside = (p: { x: number; y: number }, b: Box) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

describe("the café fills the window (slice 16)", { timeout: 30_000 }, () => {
  it("draws the 13 by 12 floor at 4× at 1920×1080, the bars floating over the room with no floor tile wholly under one", async () => {
    const { page } = await visit({ width: 1920, height: 1080 });
    expect(await page.evaluate(() => (window as unknown as { cafeRoom: { size: unknown } }).cafeRoom.size)).toEqual({ width: 400, height: 264 });
    const room = await boxOf(page, "#room");
    expect(Math.round(room.width), "the room at 4×").toBe(1600);
    expect(Math.round(room.height)).toBe(1056);
    // The bars float over the room: they overlap its box.
    const status = await boxOf(page, ".status");
    const talk = await boxOf(page, ".talk");
    expect(status.y + status.height, "the status bar over the room's top").toBeGreaterThan(room.y);
    expect(talk.y, "the talk bar over the room's foot").toBeLessThan(room.y + room.height);
    // Every bar on screen.
    for (const b of [status, talk]) expect(b.y >= 0 && b.y + b.height <= 1080 && b.x >= 0 && b.x + b.width <= 1920).toBe(true);
    // No floor tile has its whole diamond under a bar's buttons or the talk bar.
    const blockers = [talk, ...(await Promise.all(["#status-text", "#add-furniture", "#leave"].map((s) => boxOf(page, s))))];
    for (const t of await floorTiles(page)) {
      for (const b of blockers) expect(t.corners.every((c) => inside(c, b)), `tile (${t.x}, ${t.y}) wholly under a bar`).toBe(false);
    }
  });

  it("keeps every control in the floating bars working by mouse, keyboard and touch", async () => {
    const { page } = await visit({ width: 1920, height: 1080 });
    // Mouse: Say from the talk bar.
    await page.locator("#talk-input").click();
    await page.keyboard.type("by mouse");
    await page.locator("#talk button[type=submit]").click();
    await page.locator(".bubble", { hasText: "by mouse" }).waitFor();
    // Keyboard: an emote, then Add furniture opens its menu.
    await page.locator("#emotes button").first().focus();
    await page.keyboard.press("Enter");
    await page.locator("#add-furniture").focus();
    await page.keyboard.press("Enter");
    await page.locator(".menu").waitFor();
    await page.keyboard.press("Escape");
    // Touch, on a touch screen at the same size.
    const t = await visit({ width: 1920, height: 1080 }, true);
    await t.page.locator("#talk-input").tap();
    await t.page.keyboard.type("by touch");
    await t.page.locator("#talk button[type=submit]").tap();
    await t.page.locator(".bubble", { hasText: "by touch" }).first().waitFor();
    await t.page.locator(".put-treat").tap();
    await expect.poll(() => t.sent.some((f) => f.type === "putTreat")).toBe(true);
  });

  it("starts the panels clear of the floating bars", async () => {
    const { page } = await visit({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    const status = await boxOf(page, ".status");
    const talk = await boxOf(page, ".talk");
    const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const id of ["chalkboard", "cats-panel", "here-panel", "music-panel"]) {
      const p = await boxOf(page, `#${id}`);
      expect(overlaps(p, status), `${id} over the status bar`).toBe(false);
      expect(overlaps(p, talk), `${id} over the talk bar`).toBe(false);
    }
  });
});
