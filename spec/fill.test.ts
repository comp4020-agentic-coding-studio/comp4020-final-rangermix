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
    const room = (window as unknown as { cafeRoom: { grid: { width: number; height: number }; tileAt(x: number, y: number): { x: number; y: number } } }).cafeRoom;
    const out: { x: number; y: number; corners: { x: number; y: number }[] }[] = [];
    // tileAt gives a tile's middle; its corners are half a tile along each axis.
    for (let y = 1; y < room.grid.height; y++) {
      for (let x = 0; x < room.grid.width; x++) {
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
        .filter((e) => getComputedStyle(e).visibility !== "hidden")
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
    // The bars float over the screen's top and foot, where the 13 by 12 room
    // at 3× (792 px tall in 844) leaves the street to show: they're set
    // aside for the sample, so the sample is the screen's own edges (slice
    // 16's review, finding 6). Nothing of the page may show there.
    const unfloat = await page.addStyleTag({ content: ".status, .talk { visibility: hidden !important; }" });
    const page_ = ["#eff1f5", "#1e1e2e"];
    const street = streetColours("day");
    let seen = 0;
    for (const keys of [["ArrowLeft", 13], ["ArrowRight", 13], ["ArrowUp", 13], ["ArrowDown", 13]] as const) {
      await page.locator("#room").focus();
      for (let i = 0; i < keys[1]; i++) await page.keyboard.press(keys[0]);
      await page.waitForTimeout(400);
      // The keyboard's focus ring runs round the room, along the screen's
      // edges here: it's put away for the sample, the view where it was.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      for (const p of await edges(page)) {
        seen++;
        expect(page_, `panned ${keys[0]}: the edge at ${p.at} is the room or the street, not the page`).not.toContain(p.colour);
      }
    }
    expect(seen, "edge points looked at").toBeGreaterThan(80);
    // Above and below the room the screen is the street's.
    const shot = await edges(page);
    expect(shot.some((p) => street.includes(p.colour)), "the street shows past the room").toBe(true);
    await unfloat.evaluate((el) => (el as Element).remove());
  });

  it("draws the terrace in the bottom corners, and a click or tap anywhere on it does nothing", { timeout: 90_000 }, async () => {
    const { page, sent } = await visit({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    // Every point off the room's floor and walls, in reach of a click, whose
    // pixel isn't the street's: the terrace's own drawn pixels, whatever its
    // things, sampled every 6 px. That none of them falls over the floor,
    // the walls or anyone standing there, where a click would reach the
    // café behind, is held by the render test that draws the real floor
    // with and without the terrace (slice 16's review, finding 2): this
    // check can't tell a terrace pixel over the floor from the floor's own.
    const points = await page.evaluate((street) => {
      const canvas = document.getElementById("room") as HTMLCanvasElement;
      const r = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d")!;
      const room = (window as unknown as { cafeRoom: { size: { width: number }; grid: { width: number; height: number }; tileAt(x: number, y: number): { x: number; y: number } } }).cafeRoom;
      const scale = r.width / room.size.width;
      // The floor and its walls as drawn, from the café's own map.
      const corner = (gx: number, gy: number) => {
        const m = room.tileAt(gx, gy);
        const right = room.tileAt(gx + 1, gy);
        const down = room.tileAt(gx, gy + 1);
        return { x: m.x - (right.x - m.x) / 2 - (down.x - m.x) / 2, y: m.y - (right.y - m.y) / 2 - (down.y - m.y) / 2 };
      };
      const { width: gw, height: gh } = room.grid;
      const [left, back, rightTip, front] = [corner(0, 1), corner(gw, 1), corner(gw, gh), corner(0, gh)];
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
      const out: { x: number; y: number }[] = [];
      for (let y = Math.max(0, r.top); y < Math.min(innerHeight, r.bottom); y += 6)
        for (let x = Math.max(0, r.left); x < Math.min(innerWidth, r.right); x += 6) {
          if (inRoom(x, y) || document.elementFromPoint(x, y)?.id !== "room") continue;
          const [cr, cg, cb] = ctx.getImageData(Math.floor(((x - r.left) / r.width) * canvas.width), Math.floor(((y - r.top) / r.height) * canvas.height), 1, 1).data;
          if (!street.includes(`#${[cr, cg, cb].map((v) => v.toString(16).padStart(2, "0")).join("")}`)) out.push({ x, y });
        }
      return out;
    }, streetColours("day"));
    // The terrace is there, by the left edge and out front.
    const room = await boxOf(page, "#room");
    expect(points.filter((p) => p.x < room.x + room.width / 2).length, "terrace pixels by the left edge").toBeGreaterThan(10);
    expect(points.filter((p) => p.x > room.x + room.width / 2).length, "terrace pixels out front").toBeGreaterThan(10);
    const before = sent.length;
    for (const p of points) {
      await page.mouse.click(p.x, p.y);
      if ((await page.locator(".menu").count()) > 0) throw new Error(`a click on the terrace at (${p.x}, ${p.y}) opened a menu`);
    }
    await page.waitForTimeout(300);
    expect(sent.slice(before).filter((f) => f.type !== "here").map((f) => f.type), `what ${points.length} clicks on the terrace sent`).toEqual([]);
  });

  it("shows the phone's whole room at 1× centred on the room's middle, its two side corners cut evenly, with no sideways scroll", async () => {
    const { page } = await visit({ width: 390, height: 844 }, true);
    await page.locator("#layout-switch").tap();
    await page.waitForFunction(() => !document.body.classList.contains("layout-b"));
    await page.waitForTimeout(300);
    const room = await boxOf(page, "#room");
    expect(Math.round(room.width), "the room at 1×").toBe(400);
    // Centred: as much cut off at the left as at the right, 5 px each.
    const left = -room.x;
    const right = room.x + room.width - 390;
    expect(Math.round(left), "cut at the left").toBe(5);
    expect(Math.round(right), "cut at the right").toBe(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), "no sideways scroll").toBeLessThanOrEqual(390);
    // Every floor tile's middle is still on screen and can be tapped.
    for (const t of await floorTiles(page)) {
      const mid = { x: t.corners.reduce((n, c) => n + c.x, 0) / 4, y: t.corners.reduce((n, c) => n + c.y, 0) / 4 };
      expect(mid.x >= 0 && mid.x <= 390, `tile (${t.x}, ${t.y})'s middle on screen`).toBe(true);
    }
    // On a wider phone it fits, and stays centred.
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(300);
    const wide = await boxOf(page, "#room");
    expect(Math.round(wide.x), "centred on a 430 px phone").toBe(15);
  });

  // Slice 16's review, finding 1: the stage made no layer of its own, so a
  // menu, a bubble or the waking screen paints over a panel dragged there.
  it("paints an open menu and a speech bubble over a panel dragged across them", { timeout: 90_000 }, async () => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
    ]) {
      const { page } = await visit(viewport);
      // A bubble: say something.
      await page.locator("#talk-input").fill("over the panels");
      await page.locator("#talk-input").press("Enter");
      const bubble = page.locator(".bubble", { hasText: "over the panels" });
      await bubble.waitFor();
      // A menu, by keyboard, on whatever Tab reaches first.
      await page.locator("#room").focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      const menu = page.locator(".menu");
      await menu.waitFor();
      // The chalkboard dragged by its title over the menu, then over the bubble.
      const drag = async (to: Box) => {
        const title = await boxOf(page, "#chalkboard .panel-bar h2");
        await page.mouse.move(title.x + 10, title.y + title.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
        await page.mouse.up();
      };
      const topAt = (b: Box) => page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest(".menu") ? "menu" : el?.closest(".bubble") ? "bubble" : el?.closest(".panel")?.id ?? el?.id ?? "";
      }, [b.x + b.width / 2, b.y + b.height / 2]);
      const m = await boxOf(page, ".menu");
      await drag(m);
      for (const item of await menu.getByRole("menuitem").all()) {
        expect(await topAt((await item.boundingBox())!), `${viewport.width}: a menu item under the chalkboard`).toBe("menu");
      }
      await page.keyboard.press("Escape");
      await drag(await bubble.boundingBox().then((b) => b!));
      // A bubble takes no pointer, so what's painted is read from the page
      // itself: its middle is the bubble's own paper, not the panel's frost.
      const b = (await bubble.boundingBox())!;
      const p = await boxOf(page, "#chalkboard");
      expect(p.x < b.x + b.width / 2 && b.x + b.width / 2 < p.x + p.width && p.y < b.y + b.height / 2 && b.y + b.height / 2 < p.y + p.height, "the chalkboard is over the bubble's middle").toBe(true);
      // The bubble's inside, inset past its 2 px border: most of it is its
      // paper, which the panel's frost never is exactly.
      const clip = { x: Math.round(b.x + 4), y: Math.round(b.y + 4), width: Math.round(b.width - 8), height: Math.round(b.height - 8) };
      const shot = await page.screenshot({ clip });
      const paper = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        [c.width, c.height] = [img.width, img.height];
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] === 0xff && d[i + 1] === 0xfd && d[i + 2] === 0xf9) n++;
        return n / (d.length / 4);
      }, shot.toString("base64"));
      expect(paper, `${viewport.width}: the bubble's paper shows over the chalkboard`).toBeGreaterThan(0.5);
    }
  });

  // Slice 16's review, finding 3: the café's refusals showed at the stage's
  // foot, under the floating talk bar, so a sighted visitor saw nothing.
  it("shows the café's refusal clear of the talk bar, on a desktop and in the phone's bigger room", { timeout: 60_000 }, async () => {
    for (const [viewport, touch] of [
      [{ width: 1920, height: 1080 }, false],
      [{ width: 1440, height: 900 }, false],
      [{ width: 390, height: 844 }, true],
    ] as const) {
      const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
      contexts.push(context);
      const page = await context.newPage();
      // The café's own frames through, and one refusal after the welcome, as the café sends it.
      await page.routeWebSocket(/\/ws$/, (ws) => {
        const server = ws.connectToServer();
        server.onMessage((m) => {
          ws.send(m);
          if (JSON.parse(String(m)).type === "welcome") {
            setTimeout(() => ws.send(JSON.stringify({ type: "error", code: "cantPlace", detail: "The way in from the door stays clear." })), 800);
          }
        });
      });
      await page.goto(baseUrl);
      await page.locator("#signup input[name=name]").fill(uniqueName("f"));
      await page.locator("#signup input[name=password]").fill("correct horse");
      await page.locator("#signup button[type=submit]").click();
      await page.locator("#code-done").click();
      const toast = page.locator(".toast", { hasText: "stays clear" });
      await toast.waitFor();
      const t = (await toast.boundingBox())!;
      const talk = await boxOf(page, ".talk");
      expect(t.y + t.height, `${viewport.width}: the refusal above the talk bar`).toBeLessThanOrEqual(talk.y + 0.5);
      // A note takes no pointer, so what covers it is read from the boxes
      // that float: no bar, panel or menu overlaps it.
      const over = await page.evaluate((t) => {
        const hit: string[] = [];
        for (const e of document.querySelectorAll(".status > *, .talk, .panel, .menu")) {
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || getComputedStyle(e).visibility === "hidden") continue;
          if (r.left < t.x + t.width && t.x < r.right && r.top < t.y + t.height && t.y < r.bottom) hit.push(e.id || e.className);
        }
        return hit;
      }, t);
      expect(over, `${viewport.width}: nothing floats over the refusal`).toEqual([]);
    }
  });

  // Slice 16's review, finding 5: a status line wrapped to two rows (the
  // café updated and something carried, in a narrow window) covered the
  // top-left panel's controls, and the panels didn't move for it.
  it("moves the panels clear of a status line that wraps to two rows", { timeout: 60_000 }, async () => {
    const context = await browser.newContext({ viewport: { width: 960, height: 800 } });
    contexts.push(context);
    const page = await context.newPage();
    // The café's own frames, the welcome's build id changed, so the page says the café was updated.
    await page.routeWebSocket(/\/ws$/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => {
        const f = JSON.parse(String(m));
        if (f.type === "welcome") ws.send(JSON.stringify({ ...f, build: "another-build" }));
        else ws.send(m);
      });
      ws.onMessage((m) => server.send(m));
    });
    await page.goto(baseUrl);
    await page.locator("#signup input[name=name]").fill(uniqueName("f"));
    await page.locator("#signup input[name=password]").fill("correct horse");
    await page.locator("#signup button[type=submit]").click();
    await page.locator("#code-done").click();
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    await page.locator("#outdated").waitFor();
    // Something carried: a piece from the catalogue.
    await page.locator("#add-furniture").click();
    await page.locator(".menu").getByRole("menuitem").first().click();
    await page.locator("#carrying").waitFor();
    const status = await boxOf(page, ".status");
    expect(status.height, "the status line wrapped").toBeGreaterThan(60);
    // Every panel's title, grip and pin are what a click reaches.
    await expect
      .poll(async () => {
        const out: string[] = [];
        for (const id of ["chalkboard", "here-panel"]) {
          for (const sel of [".panel-bar h2", ".grip", ".pin"]) {
            const b = await boxOf(page, `#${id} ${sel}`);
            const hit = await page.evaluate(([x, y, id]) => document.elementFromPoint(x, y)?.closest(".panel")?.id === id, [b.x + b.width / 2, b.y + b.height / 2, id] as const);
            if (!hit) out.push(`${id} ${sel}`);
          }
        }
        return out;
      }, { timeout: 3000 })
      .toEqual([]);
  });

  // Slice 16's review, finding 7: the panels cleared every tile's middle
  // only for today's content. A fourth cat (a data file) grew your cats over
  // the floor's left corner tile, and a long chat grew who's here over its
  // right tip.
  it("keeps the floor's corner tiles clear of the panels as their content grows: a fourth cat, a long chat", { timeout: 90_000 }, async () => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    contexts.push(context);
    const page = await context.newPage();
    // A fourth cat in the welcome, as one more file in content/cats/ would give.
    await page.routeWebSocket(/\/ws$/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => {
        const f = JSON.parse(String(m));
        if (f.type === "welcome") {
          const c = f.snapshot.cats[0];
          f.snapshot.cats.push({ ...c, id: "kuro", name: "Kuro", at: { x: 6, y: 6 }, walk: null, heldBy: null });
          ws.send(JSON.stringify(f));
        } else ws.send(m);
      });
      ws.onMessage((m) => server.send(m));
    });
    await page.goto(baseUrl);
    await page.locator("#signup input[name=name]").fill(uniqueName("f"));
    await page.locator("#signup input[name=password]").fill("correct horse");
    await page.locator("#signup button[type=submit]").click();
    await page.locator("#code-done").click();
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    await expect.poll(() => page.locator("#your-cats .cat-row").count()).toBe(4);
    // A long chat: fourteen lines said this visit, paced to the café's
    // limit on speech (a burst of 5, then one every 2 s).
    for (let i = 0; i < 14; i++) {
      await page.locator("#talk-input").fill(`line ${i + 1} of a long chat about the cats and the weather today`);
      await page.locator("#talk-input").press("Enter");
      await page.waitForTimeout(i < 4 ? 300 : 2100);
    }
    await expect.poll(() => page.locator("#said li").count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(14);
    await page.waitForTimeout(400);
    // Every floor tile's middle is the room's.
    const covered: string[] = [];
    for (const t of await floorTiles(page)) {
      const mid = { x: t.corners.reduce((n, c) => n + c.x, 0) / 4, y: t.corners.reduce((n, c) => n + c.y, 0) / 4 };
      const on = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".panel")?.id ?? null, [mid.x, mid.y]);
      if (on) covered.push(`(${t.x}, ${t.y}) under ${on}`);
    }
    expect(covered).toEqual([]);
  });
});
