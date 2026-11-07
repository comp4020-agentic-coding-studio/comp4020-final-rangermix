import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import palettes from "../content/sprites/palettes.json";
import { baseUrl, uniqueName } from "./helpers";

// Slice 18's browser checks: the terrace stands on a balcony, a deck of
// stone round the room's two front edges with a glass rail at its edge and
// the café's own building under it. All of it is the backdrop both the
// room's canvas and the street's draw (client/src/backdrop.ts), so it runs
// on past the room's canvas to the window's edges, lined up with it; and
// it's scenery, so a click on it does nothing.

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

/** Opens the café in a fresh browser at `at` Canberra time, the café's clock said to be the same (slice 17), and signs up. */
async function visit(viewport: { width: number; height: number }, at = "10:00", touch = false): Promise<{ page: Page; sent: Frame[] }> {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  contexts.push(context);
  const page = await context.newPage();
  const start = new Date(`2026-11-06T${at}:00+11:00`);
  await page.clock.install({ time: start });
  await page.clock.resume();
  const since = Date.now();
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((m) => {
      const f = JSON.parse(String(m));
      if (f.type === "welcome") f.now = start.getTime() + (Date.now() - since);
      ws.send(JSON.stringify(f));
    });
  });
  const sent: Frame[] = [];
  page.on("websocket", (ws) => ws.on("framesent", (f) => sent.push(JSON.parse(String(f.payload)))));
  await page.goto(baseUrl);
  await page.locator("#signup input[name=name]").fill(uniqueName("b"));
  await page.locator("#signup input[name=password]").fill("correct horse");
  await page.locator("#signup button[type=submit]").click();
  await page.locator("#code-done").click();
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  await page.waitForTimeout(600);
  return { page, sent };
}

const balcony = (light: "day" | "night") => (palettes[light] as unknown as { balcony: string[] }).balcony.map((c) => c.toLowerCase());

/**
 * The colour of each canvas at a point on the page, read from the canvas
 * itself: the room's, and the street's behind it, at the same screen pixel.
 */
async function both(page: Page, points: { x: number; y: number }[]): Promise<{ room: string | null; street: string | null }[]> {
  return page.evaluate((points) => {
    const read = (id: string, x: number, y: number) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const r = canvas.getBoundingClientRect();
      if (x < r.left || y < r.top || x >= r.right || y >= r.bottom) return null;
      // Multiplied before divided, and a hair over: (704 / 1104) * 1104 is
      // 703.999…, a row too high.
      const at = (v: number, size: number, css: number) => Math.floor((v * size) / css + 1e-6);
      const [cr, cg, cb] = canvas.getContext("2d")!.getImageData(at(x - r.left, canvas.width, r.width), at(y - r.top, canvas.height, r.height), 1, 1).data;
      return `#${[cr, cg, cb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    };
    return points.map((p) => ({ room: read("room", p.x, p.y), street: read("street", p.x, p.y) }));
  }, points);
}

describe("the balcony under the terrace (slice 18)", { timeout: 60_000 }, () => {
  it("runs the deck past the room's canvas to the window's edges, lined up with the room's, by day and by night", async () => {
    for (const [at, light] of [
      ["10:00", "day"],
      ["22:00", "night"],
    ] as const) {
      const { page } = await visit({ width: 1920, height: 1080 }, at);
      const room = (await page.locator("#room").boundingBox())!;
      // Past the room's canvas on the left and the right, where the deck's
      // two arms carry on: points in the strips beside the canvas, down its
      // lower half, every 4 px. The bars and panels float over the canvas,
      // not these strips' outer parts, which is where they're read.
      const points: { x: number; y: number }[] = [];
      for (let y = Math.round(room.y + room.height * 0.55); y < Math.min(1080, room.y + room.height); y += 4) {
        for (const x of [Math.round(room.x) - 6, Math.round(room.x + room.width) + 5]) if (x >= 0 && x < 1920) points.push({ x, y });
      }
      const seen = await both(page, points);
      const [stoneA, stoneB] = balcony(light);
      const deck = seen.filter((s) => s.street === stoneA || s.street === stoneB).length;
      expect(deck, `${light}: deck pixels beside the room's canvas, of ${points.length}`).toBeGreaterThan(20);
      // The street's canvas lies under the room's too: wherever the room's
      // canvas shows the deck, near its two side edges, the street's shows
      // the very same pixel, so the deck carries on across the seam.
      const seam: { x: number; y: number }[] = [];
      for (let y = Math.round(room.y + room.height * 0.55); y < Math.min(1076, room.y + room.height); y += 3)
        for (let dx = 1; dx < 40; dx += 6) seam.push({ x: Math.round(room.x) + dx, y }, { x: Math.round(room.x + room.width) - 1 - dx, y });
      const onDeck = (await both(page, seam)).filter((s) => s.room === stoneA || s.room === stoneB);
      expect(onDeck.length, `${light}: deck pixels just inside the room's canvas`).toBeGreaterThan(20);
      expect(onDeck.filter((s) => s.street !== s.room), `${light}: the street's canvas differs from the room's under the deck`).toEqual([]);
      await page.locator("#leave").click();
    }
  });
});
