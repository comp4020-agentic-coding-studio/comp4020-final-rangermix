import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import palettes from "../content/sprites/palettes.json";
import { baseUrl, uniqueName } from "./helpers";

// Slice 18's browser checks: the terrace stands on a balcony, a deck of
// stone round the room's two front edges with a glass rail at its edge and
// the café's own building under it. All of it is the backdrop both the
// room's canvas and the street's draw (client/src/backdrop.ts), so it
// carries on past the room's canvas, lined up with it, to the café's walls'
// lines, where it ends (slice 19); and it's scenery, so a click on it does
// nothing.

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

describe("the balcony under the terrace (slices 18 and 19)", { timeout: 60_000 }, () => {
  // Slice 19 (the user, 2026-11-08: "1A 2A 3A"): the balcony and the café's
  // building end where the café's walls end, the street wall's line on the
  // left and the plain wall's at the front, whatever the window; past each
  // end the street's canvas shows the street, as it does past the walls
  // above. Slice 18 ran them on to the window's edges, which the user found
  // wrong ("it should just show the cafe corner").
  //
  // Each end is held from both sides, found from the floor's corners
  // through tileAt, not from the backdrop: past the end the street's own
  // colours, inside it the balcony's. A balcony running on fails at every
  // size (at 1920×1080 by the deck's level past each end, which that
  // window shows); one stopping short of a wall fails at the two wide
  // windows, where the building's end lines show, from 0.08 tiles in
  // (slice 19's review, findings 2 and 3). At 1920×1080 those lines stand
  // just past the window's edges, and a short balcony is the unit tests'
  // (the end edges, the returns' posts, what the room covers). Every point
  // the street's canvas shows is the backdrop's own pixel, and the two
  // canvases agree across the seam. A wide window shows the ends most (the
  // user's own screenshot was one), a wide short one most of the left arm,
  // and 1920×1080 is the desktop every slice is held at.
  for (const [width, height] of [
    [2560, 1080],
    [2560, 540],
    [1920, 1080],
  ] as const) {
    it(`ends the balcony and the building at the café's walls, the street past each end, by day and by night, at ${width}×${height}`, async () => {
      for (const [at, light] of [
        ["10:00", "day"],
        ["22:00", "night"],
      ] as const) {
        const { page } = await visit({ width, height }, at);
        await page.addStyleTag({ content: ".panel, .status, .talk { visibility: hidden !important; }" });
        // Two frames, so the stage has placed both canvases for the change.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const room = (await page.locator("#room").boundingBox())!;
        const streetColours = (palettes[light] as unknown as { street: string[] }).street.map((c) => c.toLowerCase());
        // The street's own colours, leaving out any the balcony shares: its
        // lit windows are the street's lamplight at night.
        const streetOnly = streetColours.filter((c) => !balcony(light).includes(c));
        const seen = await page.evaluate(
          ([width, height, out, slab, storey]) => {
            const room = (window as unknown as { cafeRoom: { tileAt(x: number, y: number): { x: number; y: number }; grid: { width: number; height: number }; size: { width: number }; backdropAt(x: number, y: number): string | null } }).cafeRoom;
            const canvas = document.getElementById("street") as HTMLCanvasElement;
            const r = canvas.getBoundingClientRect();
            const ctx = canvas.getContext("2d")!;
            const at = (v: number, size: number, css: number) => Math.floor((v * size) / css + 1e-6);
            const read = (x: number, y: number) => {
              const [cr, cg, cb] = ctx.getImageData(at(x - r.left, canvas.width, r.width), at(y - r.top, canvas.height, r.height), 1, 1).data;
              return `#${[cr, cg, cb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
            };
            // A grid spot's screen point, `z` room px up: tileAt gives a
            // tile's middle, so a spot is half a tile back on each axis.
            const scale = (document.getElementById("room") as HTMLCanvasElement).getBoundingClientRect().width / room.size.width;
            const spot = (gx: number, gy: number, z = 0) => {
              const m = room.tileAt(gx - 0.5, gy - 0.5);
              return { x: m.x, y: m.y - z * scale };
            };
            const { width: gw, height: gh } = room.grid;
            const on = (p: { x: number; y: number }) => p.x >= 1 && p.y >= 1 && p.x < width - 1 && p.y < height - 1;
            type Point = { x: number; y: number; shown: string; backdrop: string | null; where: string };
            const look = (where: string, p: { x: number; y: number }): Point[] => {
              if (!on(p)) return [];
              const [x, y] = [Math.round(p.x), Math.round(p.y)];
              return [{ x, y, shown: read(x, y), backdrop: room.backdropAt(x + 0.5, y + 0.5), where }];
            };
            const past: Point[] = [];
            const inside: Point[] = [];
            // Down the building's height under the deck, either side of each
            // end's line, every 2 px: 0.08 tiles off it (1.3 room px, clear
            // of the dark edge drawn on it), so a balcony stopping even 0.1
            // tiles short of a wall shows the street inside (slice 19's
            // review, finding 2); and 0.35 tiles in, which 1920×1080 shows
            // (it shows nothing of the building past the ends' lines).
            for (let z = -slab - 1; z > -slab - storey * 3; z -= 2) {
              for (const d of [0.08, 0.35]) {
                // The left end, at the street wall's line (y = 1): along the
                // left face, y < 1 is past it.
                past.push(...look(`past the left end by ${d}, ${z} px`, spot(-out, 1 - d, z)));
                inside.push(...look(`inside the left end by ${d}, ${z} px`, spot(-out, 1 + d, z)));
                // The front end, at the plain wall's line (x = width).
                past.push(...look(`past the front end by ${d}, ${z} px`, spot(gw + d, gh + out, z)));
                inside.push(...look(`inside the front end by ${d}, ${z} px`, spot(gw - d, gh + out, z)));
              }
            }
            // On the deck's level just past each end, beside the room's
            // canvas where 1920×1080 shows it (room x −40 to 440), and over
            // the glass's return there on screen, by 4 px or more: the street
            // since slice 19, the run-on deck before it (slice 19's review,
            // finding 3).
            for (const [gx, gy] of [
              [-0.3, -0.6],
              [-0.6, -0.8],
              [-0.2, -0.9],
            ])
              past.push(...look(`past the left end on the deck's level at (${gx}, ${gy})`, spot(gx, gy, -slab)));
            for (const [gx, gy] of [
              [14.6, 13.1],
              [14.8, 13.3],
              [14.5, 13.2],
            ])
              past.push(...look(`past the front end on the deck's level at (${gx}, ${gy})`, spot(gx - 13 + gw, gy - 13 + gh, -slab)));
            // On the deck's line, at the slab's foot, half way across it: far
            // enough past each end to be clear of the glass's return there,
            // which runs back from the deck's outer corner to the wall and,
            // on screen, stands in front of the street up to 1.22 tiles past
            // (the returns themselves are the unit tests').
            for (const d of [1.5, 2.5, 5]) {
              past.push(...look(`past the left end on the deck's line, ${d} tiles`, spot(-out / 2, 1 - d, -slab)));
              past.push(...look(`past the front end on the deck's line, ${d} tiles`, spot(gw + d, gh + out / 2, -slab)));
            }
            inside.push(...look("on the deck by the left end", spot(-out / 2, 1.4, -slab)));
            inside.push(...look("on the deck by the front end", spot(gw - 0.4, gh + out / 2, -slab)));
            return { past, inside };
          },
          [width, height, 2.6, 6, 56] as const,
        );
        // At 1920×1080 the room at 4× leaves 160 px either side, and each
        // end's line down the building stands about 6 px past the window's
        // edge (41.6 room px past the room's canvas), but the deck's level
        // past each end shows: the six points there (finding 3).
        expect(seen.past.length, `${light} ${width}×${height}: points past the ends`).toBeGreaterThan(width > 1920 ? 20 : 5);
        expect(seen.inside.length, `${light} ${width}×${height}: points inside the ends`).toBeGreaterThan(20);
        // Every point is the backdrop's own pixel, as the room's canvas is.
        const off = [...seen.past, ...seen.inside].filter((p) => p.shown !== p.backdrop);
        expect(off.slice(0, 5), `${light} ${width}×${height}: the street's canvas isn't the backdrop at ${off.length} points`).toEqual([]);
        // Past each end, the street: none of the balcony's or the building's.
        const notStreet = seen.past.filter((p) => !streetColours.includes(p.shown));
        expect(notStreet.slice(0, 5).map((p) => `${p.where} (${p.x},${p.y}) ${p.shown}`), `${light} ${width}×${height}: the balcony past its ends`).toEqual([]);
        // Inside each end, the balcony and the building: none of the street's own.
        const street = seen.inside.filter((p) => streetOnly.includes(p.shown));
        expect(street.slice(0, 5).map((p) => `${p.where} (${p.x},${p.y}) ${p.shown}`), `${light} ${width}×${height}: the street inside the balcony's ends`).toEqual([]);
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
      // And the glass's returns at the balcony's two ends (slice 19), half
      // way up the glass, found from the floor's corners. They lie wholly
      // outside the room's canvas (room x −40 to 0 and 400 to 440), over
      // the street's canvas, which takes no pointer events (style.css), so
      // no click there can reach the café whatever it lands on: at
      // 1920×1080 the left return's points land on the "Your cats" panel
      // (slice 19's review, finding 6). What's held is that nothing reaches
      // the café from them.
      const returns = await page.evaluate(() => {
        const room = (window as unknown as { cafeRoom: { size: { width: number }; tileAt(x: number, y: number): { x: number; y: number }; grid: { width: number; height: number } } }).cafeRoom;
        const scale = (document.getElementById("room") as HTMLCanvasElement).getBoundingClientRect().width / room.size.width;
        const { width: gw, height: gh } = room.grid;
        const spot = (gx: number, gy: number, z: number) => {
          const m = room.tileAt(gx - 0.5, gy - 0.5);
          return { x: Math.round(m.x), y: Math.round(m.y - z * scale) };
        };
        const out: { x: number; y: number }[] = [];
        for (const t of [0.3, 0.6, 0.9]) out.push(spot(-0.3 - 2 * t, 1, -6 + 9), spot(gw, gh + 0.3 + 2 * t, -6 + 9));
        return out.filter((p) => p.x >= 0 && p.y >= 0 && p.x < innerWidth && p.y < innerHeight);
      });
      expect(returns.length, `${touch ? "touch" : "mouse"}: points on the glass's returns`).toBeGreaterThan(3);
      const before = sent.length;
      // Every fourth balcony point, so the check stays short, and every
      // point on the returns.
      for (const p of [...points.filter((_, i) => i % 4 === 0), ...returns]) {
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
