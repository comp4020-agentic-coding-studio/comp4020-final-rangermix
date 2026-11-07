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
  // Slice 18's review, finding 4: counted on both sides together, the deck
  // beside the canvas could be gone from one side and pass; the seam was
  // compared only on stone; and only 1920×1080 was looked at, where finding
  // 1's cut didn't show. Each side is held on its own, every point the
  // street's canvas shows is the backdrop's own pixel there, the seam is
  // compared wherever the room's canvas isn't the room, and a wide, short
  // window is looked at too.
  // The second a wide, short window: where finding 1's cut showed.
  for (const [width, height] of [
    [1920, 1080],
    [2560, 540],
  ] as const) {
    it(`runs the balcony past the room's canvas on both sides to the window's edges, lined up with the room's, by day and by night, at ${width}×${height}`, async () => {
      for (const [at, light] of [
        ["10:00", "day"],
        ["22:00", "night"],
      ] as const) {
        const { page } = await visit({ width, height }, at);
        await page.addStyleTag({ content: ".panel, .status, .talk { visibility: hidden !important; }" });
        // Two frames, so the stage has placed both canvases for the change.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const room = (await page.locator("#room").boundingBox())!;
        const balconyColours = balcony(light);
        // Beside the room's canvas on each side, from the window's edge to the
        // canvas, down the window, every 4 px: the street's canvas there is
        // exactly the backdrop, and some of it is the balcony's.
        for (const side of ["left", "right"] as const) {
          const points: { x: number; y: number }[] = [];
          const [x0, x1] = side === "left" ? [1, Math.floor(room.x) - 1] : [Math.ceil(room.x + room.width) + 1, width - 1];
          for (let y = 1; y < height - 1; y += 4) for (let x = x0; x < x1; x += 8) points.push({ x, y });
          if (points.length === 0) continue;
          const seen = await page.evaluate((points) => {
            const room = (window as unknown as { cafeRoom: { backdropAt(x: number, y: number): string | null } }).cafeRoom;
            const canvas = document.getElementById("street") as HTMLCanvasElement;
            const r = canvas.getBoundingClientRect();
            const ctx = canvas.getContext("2d")!;
            const at = (v: number, size: number, css: number) => Math.floor((v * size) / css + 1e-6);
            return points.map((p) => {
              const [cr, cg, cb] = ctx.getImageData(at(p.x - r.left, canvas.width, r.width), at(p.y - r.top, canvas.height, r.height), 1, 1).data;
              return { ...p, shown: `#${[cr, cg, cb].map((v) => v.toString(16).padStart(2, "0")).join("")}`, backdrop: room.backdropAt(p.x + 0.5, p.y + 0.5) };
            });
          }, points);
          const off = seen.filter((p) => p.shown !== p.backdrop);
          expect(off.slice(0, 5), `${light} ${width}×${height}: the street's canvas ${side} of the room isn't the backdrop at ${off.length} of ${seen.length}`).toEqual([]);
          const mine = seen.filter((p) => balconyColours.includes(p.shown) || p.shown !== null && !(palettes[light] as unknown as { street: string[] }).street.map((c) => c.toLowerCase()).includes(p.shown));
          expect(mine.length, `${light} ${width}×${height}: the balcony or the building ${side} of the room's canvas`).toBeGreaterThan(5);
        }
        // At the window's own edges, under the line the deck's outer edge
        // runs along (found from the floor's corners, not from the backdrop,
        // so a balcony cut short shows): nothing of the street, only the
        // balcony and the building, down to the window's foot. A check that
        // held the screen to the backdrop alone couldn't see an arm cut
        // short, since both would be cut alike.
        const edge = await page.evaluate(
          ([width, height, out, streetColours]) => {
            const room = (window as unknown as { cafeRoom: { tileAt(x: number, y: number): { x: number; y: number }; grid: { width: number; height: number } } }).cafeRoom;
            const canvas = document.getElementById("street") as HTMLCanvasElement;
            const r = canvas.getBoundingClientRect();
            const ctx = canvas.getContext("2d")!;
            // A grid spot's screen point: tileAt gives a tile's middle, so a
            // spot is half a tile back on each axis from the tile it's in.
            const spot = (gx: number, gy: number) => {
              const m = room.tileAt(gx - 0.5, gy - 0.5);
              return m;
            };
            const { height: gh } = room.grid;
            // The deck's outer corner and a point along each arm, at the floor's level.
            const corner = spot(-out, gh + out);
            const upLeft = spot(-out, gh + out - 4);
            const upRight = spot(-out + 4, gh + out);
            const lineY = (a: { x: number; y: number }, b: { x: number; y: number }, x: number) => a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
            const at = (v: number, size: number, css: number) => Math.floor((v * size) / css + 1e-6);
            const bad: string[] = [];
            let looked = 0;
            for (const x of [2, width - 3]) {
              const top = x < corner.x ? lineY(corner, upLeft, x) : lineY(corner, upRight, x);
              // From well under the deck's edge (its slab, the glass's foot) to the window's foot.
              for (let y = Math.max(2, Math.ceil(top + 40)); y < height - 2; y += 6) {
                looked++;
                const [cr, cg, cb] = ctx.getImageData(at(x - r.left, canvas.width, r.width), at(y - r.top, canvas.height, r.height), 1, 1).data;
                const hex = `#${[cr, cg, cb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
                if (streetColours.includes(hex)) bad.push(`(${x},${y}) ${hex}`);
              }
            }
            return { bad, looked };
          },
          [
            width,
            height,
            2.6,
            // The street's own colours, leaving out any the building shares:
            // its lit windows are the street's lamplight at night.
            (palettes[light] as unknown as { street: string[] }).street.map((c) => c.toLowerCase()).filter((c) => !balcony(light).includes(c)),
          ] as const,
        );
        expect(edge.looked, `${light} ${width}×${height}: points under the balcony at the window's edges`).toBeGreaterThan(4);
        expect(edge.bad.slice(0, 5), `${light} ${width}×${height}: the street under the balcony at the window's edges`).toEqual([]);
        // Across the seam: just inside the room's canvas, wherever it shows
        // the backdrop (not the room's own drawing), the street's canvas under
        // it shows the very same pixel.
        const seam: { x: number; y: number }[] = [];
        for (let y = Math.max(1, Math.round(room.y)); y < Math.min(height - 1, room.y + room.height); y += 3)
          for (let dx = 1; dx < 40; dx += 5) seam.push({ x: Math.round(room.x) + dx, y }, { x: Math.round(room.x + room.width) - 1 - dx, y });
        const across = await both(page, seam);
        const backdropAt = await page.evaluate((pts) => pts.map((p) => (window as unknown as { cafeRoom: { backdropAt(x: number, y: number): string | null } }).cafeRoom.backdropAt(p.x + 0.5, p.y + 0.5)), seam);
        const outside = across.map((s, i) => ({ ...s, ...seam[i], backdrop: backdropAt[i] })).filter((s) => s.room !== null && s.room === s.backdrop);
        expect(outside.length, `${light} ${width}×${height}: backdrop pixels just inside the room's canvas`).toBeGreaterThan(40);
        expect(outside.filter((s) => s.street !== s.room).slice(0, 5), `${light} ${width}×${height}: the two canvases differ across the seam`).toEqual([]);
        await page.evaluate(() => document.getElementById("leave")?.click());
      }
    });
  }

  it("takes no click or tap on the deck, the glass or the building, by mouse or by touch", { timeout: 120_000 }, async () => {
    for (const touch of [false, true]) {
      const { page, sent } = await visit({ width: 1920, height: 1080 }, "10:00", touch);
      // Points on the room's canvas that are the balcony's own (the deck's
      // stones, the glass and rail, the building), off the floor and its
      // walls, where a click reaches the canvas: read from the canvas, every
      // 10 px, so each one clicked is the balcony's.
      const points = await page.evaluate((own) => {
        const canvas = document.getElementById("room") as HTMLCanvasElement;
        const r = canvas.getBoundingClientRect();
        const ctx = canvas.getContext("2d")!;
        const room = (window as unknown as { cafeRoom: { size: { width: number }; grid: { width: number; height: number }; tileAt(x: number, y: number): { x: number; y: number } } }).cafeRoom;
        const scale = r.width / room.size.width;
        const corner = (gx: number, gy: number) => {
          const m = room.tileAt(gx, gy);
          const right = room.tileAt(gx + 1, gy);
          const down = room.tileAt(gx, gy + 1);
          return { x: m.x - (right.x - m.x) / 2 - (down.x - m.x) / 2, y: m.y - (right.y - m.y) / 2 - (down.y - m.y) / 2 };
        };
        const { width: gw, height: gh } = room.grid;
        const [left, back, rightTip, front] = [corner(0, 1), corner(gw, 1), corner(gw, gh), corner(0, gh)];
        // The room as one shape: up the walls from the back edges, down its slab under the front ones.
        const shape = [
          { x: left.x, y: left.y - 56 * scale },
          { x: back.x, y: back.y - 56 * scale },
          { x: rightTip.x, y: rightTip.y - 56 * scale },
          { x: rightTip.x, y: rightTip.y + 8 * scale },
          { x: front.x, y: front.y + 8 * scale },
          { x: left.x, y: left.y + 8 * scale },
        ];
        const inRoom = (x: number, y: number) => {
          let inside = false;
          for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
            const [a, b] = [shape[i], shape[j]];
            if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
          }
          return inside;
        };
        const at = (v: number, size: number, css: number) => Math.floor((v * size) / css + 1e-6);
        const out: { x: number; y: number }[] = [];
        for (let y = Math.max(0, r.top + r.height * 0.5); y < Math.min(innerHeight, r.bottom); y += 10)
          for (let x = Math.max(0, r.left); x < Math.min(innerWidth, r.right); x += 10) {
            if (inRoom(x, y) || document.elementFromPoint(x, y)?.id !== "room") continue;
            const [cr, cg, cb] = ctx.getImageData(at(x - r.left, canvas.width, r.width), at(y - r.top, canvas.height, r.height), 1, 1).data;
            const c = `#${[cr, cg, cb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
            if (own.includes(c)) out.push({ x, y });
          }
        return out;
      }, [...balcony("day"), ...(palettes.day as unknown as { room: string[] }).room.map((c) => c.toLowerCase())]);
      expect(points.length, `${touch ? "touch" : "mouse"}: balcony points to try`).toBeGreaterThan(30);
      const before = sent.length;
      // Every fourth one, so the check stays short.
      for (const p of points.filter((_, i) => i % 4 === 0)) {
        if (touch) await page.touchscreen.tap(p.x, p.y);
        else await page.mouse.click(p.x, p.y);
        if ((await page.locator(".menu").count()) > 0) throw new Error(`a ${touch ? "tap" : "click"} on the balcony at (${p.x}, ${p.y}) opened a menu`);
      }
      await page.waitForTimeout(300);
      expect(sent.slice(before).filter((f) => f.type !== "here").map((f) => f.type), `what ${touch ? "taps" : "clicks"} on the balcony sent`).toEqual([]);
      await page.evaluate(() => document.getElementById("leave")!.click());
    }
  });
});
