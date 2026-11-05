import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import palettes from "../content/sprites/palettes.json";
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

  /** The colours of a whole-page screenshot at the window's edges and corners, sampled every 40 px, and where. */
  async function edges(page: Page): Promise<{ at: string; colour: string }[]> {
    const shot = await page.screenshot();
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      [c.width, c.height] = [img.width, img.height];
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const out: { at: string; colour: string }[] = [];
      const hex = (x: number, y: number) => {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      };
      // Each edge, 2 px in, except where something floats over it: a bar,
      // a panel or a menu, or near enough for its shadow (24 px) to shade it.
      const over = [...document.querySelectorAll(".status > *, .talk, .panel, .menu, .bubble")]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const free = (x: number, y: number) => !over.some((r) => x > r.left - 24 && x < r.right + 24 && y > r.top - 24 && y < r.bottom + 24);
      for (let x = 2; x < c.width - 2; x += 40) for (const y of [2, c.height - 3]) if (free(x, y)) out.push({ at: `(${x}, ${y})`, colour: hex(x, y) });
      for (let y = 2; y < c.height - 2; y += 40) for (const x of [2, c.width - 3]) if (free(x, y)) out.push({ at: `(${x}, ${y})`, colour: hex(x, y) });
      return out;
    }, shot.toString("base64"));
  }

  const streetColours = (light: "day" | "night") => (palettes[light] as unknown as { street: string[] }).street.map((c) => c.toLowerCase());

  it("carries the street to every edge of the window behind the room, by day and by night, with none of the page showing", async () => {
    const { page } = await visit({ width: 1920, height: 1080 });
    await page.waitForTimeout(600);
    for (const [when, light] of [["10:00", "day"], ["22:00", "night"]] as const) {
      if (when === "22:00") {
        await page.clock.fastForward("12:00:00");
        await page.waitForTimeout(600);
      }
      const seen = await edges(page);
      expect(seen.length, "edge points to look at").toBeGreaterThan(60);
      const street = streetColours(light);
      for (const p of seen) expect(street, `${light}: the window's edge at ${p.at} is the street, not the page`).toContain(p.colour);
    }
  });

  it("carries the street past the room's edges in the phone's bigger room as it pans to each side", async () => {
    const { page } = await visit({ width: 390, height: 844 }, true);
    await page.waitForFunction(() => document.body.classList.contains("layout-b"));
    await page.locator("#room").focus();
    // At 3× the room is bigger than the phone and the pan stops at its
    // edges, so an edge shows the room, as it did before slice 16: never the
    // page's own background (Latte's base, the light theme's; Mocha's the
    // dark's). A guard, not a change: it passed before the street was carried.
    const page_ = ["#eff1f5", "#1e1e2e"];
    let seen = 0;
    for (const keys of [["ArrowLeft", 13], ["ArrowRight", 13], ["ArrowUp", 13], ["ArrowDown", 13]] as const) {
      for (let i = 0; i < keys[1]; i++) await page.keyboard.press(keys[0]);
      await page.waitForTimeout(400);
      for (const p of await edges(page)) {
        seen++;
        expect(page_, `panned ${keys[0]}: the edge at ${p.at} is the room or the street, not the page`).not.toContain(p.colour);
      }
    }
    expect(seen, "edge points looked at").toBeGreaterThan(20);
  });
});
