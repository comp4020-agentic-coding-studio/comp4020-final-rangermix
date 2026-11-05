import { type Browser, type BrowserContext, type Page, type WebSocketRoute, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { baseUrl, meetACat, signUp, uniqueName, Visitor } from "./helpers";
import heights from "../content/sprites/heights.json" with { type: "json" };
import palettes from "../content/sprites/palettes.json" with { type: "json" };

/** How big a cat is drawn, in room pixels (slice 11). */
const CAT_PX = 24;

/** How tall each kind of furniture is drawn, in canvas pixels (slice 09): a cat on one is drawn that high. */
const HEIGHTS = heights as Record<string, number>;

// Browser checks (design.md, "Checks"): the keyboard-only pass at both
// marking sizes with a resize mid-use, the phone by touch, the layout switch,
// something one visitor does reaching another's page, and the chalkboard read
// at both sizes by keyboard, touch and mouse.

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
  /** What the page sent the café. */
  sent: Frame[];
}

interface VisitOptions {
  /** Done to the page before it opens the café, such as routing its socket. */
  prepare?: (page: Page) => Promise<void>;
  /** Wait for the café's welcome before returning (the default). */
  waitInside?: boolean;
  reducedMotion?: "reduce" | "no-preference";
  colorScheme?: "light" | "dark";
}

/** Opens the café in a fresh browser and signs up through the page, by keyboard. */
async function visit(viewport: { width: number; height: number }, touch = false, opts: VisitOptions = {}): Promise<Visit> {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, reducedMotion: opts.reducedMotion, colorScheme: opts.colorScheme });
  contexts.push(context);
  const page = await context.newPage();
  if (opts.prepare) await opts.prepare(page);
  const frames: Frame[] = [];
  const sent: Frame[] = [];
  page.on("websocket", (ws) => {
    ws.on("framereceived", (f) => frames.push(JSON.parse(String(f.payload))));
    ws.on("framesent", (f) => sent.push(JSON.parse(String(f.payload))));
  });
  await page.goto(baseUrl);
  await page.locator("#signup input[name=name]").focus();
  await page.keyboard.type(uniqueName("b"));
  await page.keyboard.press("Tab");
  await page.keyboard.type("correct horse");
  await page.keyboard.press("Enter");
  await page.locator("#code-done:focus").waitFor();
  await page.keyboard.press("Enter");
  if (opts.waitInside ?? true) await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  return { page, frames, sent };
}

/** How many animations the waking overlay is running. */
const wakingAnimations = (page: Page) => page.evaluate(() => document.getElementById("waking")!.getAnimations({ subtree: true }).length);

/** Keeps everything the announcer says, in `window.said`, from the start. */
async function hearAnnouncer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const said: string[] = [];
    (window as unknown as { said: string[] }).said = said;
    document.addEventListener("DOMContentLoaded", () => {
      const region = document.getElementById("announcer")!;
      new MutationObserver(() => {
        if (region.textContent) said.push(region.textContent);
      }).observe(region, { childList: true, characterData: true, subtree: true });
    });
  });
}

/**
 * Has the café's socket say it's waking, and hold back the real welcome and
 * everything after it for `ms`, as a café still replaying its sleep does
 * (slice 07).
 */
function stillWaking(ms: number): (page: Page) => Promise<void> {
  return (page) =>
    page.routeWebSocket(/\/ws$/, (ws) => {
      const server = ws.connectToServer();
      ws.send(JSON.stringify({ type: "waking" }));
      const held: (string | Buffer)[] = [];
      let holding = true;
      setTimeout(() => {
        holding = false;
        for (const m of held.splice(0)) ws.send(m);
      }, ms);
      server.onMessage((m) => (holding ? held.push(m) : ws.send(m)));
    });
}

type Tile = { x: number; y: number };
interface CatSeen {
  id: string;
  name: string;
  at: Tile;
  walking: boolean;
  pose: string;
  heldBy: number | null;
}

/** Where each cat is, by the frames so far. */
function catsSeen(frames: Frame[]): Map<string, CatSeen> {
  const out = new Map<string, CatSeen>();
  for (const f of frames) {
    if (f.type === "welcome") {
      for (const c of f.snapshot.cats) out.set(c.id, { id: c.id, name: c.name, at: c.at, walking: c.walk !== null, pose: c.pose, heldBy: c.heldBy });
      continue;
    }
    const c = out.get(f.cat);
    if (!c) continue;
    if (f.type === "catMoved") Object.assign(c, { walking: true, pose: "walk" });
    if (f.type === "catPosed") Object.assign(c, { at: f.at, walking: false, pose: f.pose });
    if (f.type === "catHeld") c.heldBy = f.by;
  }
  return out;
}

/** Your id, and where you are or are headed, by the frames so far. */
function meSeen(frames: Frame[]): { id: number; at: Tile } {
  const welcome = frames.find((f) => f.type === "welcome")!;
  const id: number = welcome.you;
  let at: Tile = welcome.snapshot.people.find((p: Frame) => p.id === id).at;
  for (const f of frames) {
    if ((f.type === "personMoved" || f.type === "personSat") && f.id === id) at = f.walk ? f.walk.path[f.walk.path.length - 1] : f.at;
    if (f.type === "personJoined" && f.person.id === id) at = f.person.at;
  }
  return { id, at };
}

/** Tabs through the room's targets until the announcer names a still cat for which `ok` holds. */
async function tabToCat(v: Visit, ok: (c: CatSeen) => boolean = () => true): Promise<CatSeen | null> {
  await v.page.locator("#room").focus();
  await v.page.keyboard.press("ArrowRight");
  // Nearest first, through every cat, person and piece in the room.
  for (let i = 0; i < 30; i++) {
    await v.page.keyboard.press("Tab");
    await v.page.waitForTimeout(80);
    const said = await v.page.evaluate(() => document.getElementById("announcer")?.textContent ?? "");
    const cat = [...catsSeen(v.frames).values()].find((c) => c.name === said);
    if (cat && !cat.walking && cat.heldBy === null && ok(cat)) return cat;
  }
  return null;
}

/**
 * How far the open ring's centre is from a tile's centre on screen, and how
 * wide a tile is, in CSS pixels. The ring says where its centre is: with
 * one button, that button's spot is a radius away from it.
 */
async function ringFromTile(page: Page, tile: Tile): Promise<{ off: number; px: number }> {
  const room = (await page.locator("#room").boundingBox())!;
  // A tile's diamond is 32 of the canvas's 336 pixels across.
  const px = (room.width * 32) / 336;
  const at = await tileAt(page, tile);
  const ring = page.locator(".menu.ring");
  const centre = { x: Number(await ring.getAttribute("data-centre-x")), y: Number(await ring.getAttribute("data-centre-y")) };
  return { off: Math.hypot(centre.x - at.x, centre.y - at.y), px };
}

/** Every button of the open ring is on a 390-wide screen and clear of the bars floating over the room. */
async function expectRingClear(page: Page): Promise<void> {
  const bars = await page.evaluate(() => [document.querySelector(".status")!.getBoundingClientRect().bottom, document.querySelector(".talk")!.getBoundingClientRect().top]);
  const buttons = await page.locator(".menu.ring").getByRole("menuitem").all();
  expect(buttons.length).toBeGreaterThan(0);
  for (const b of buttons) {
    const r = (await b.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390);
    expect(r.y).toBeGreaterThanOrEqual(bars[0]);
    expect(r.y + r.height).toBeLessThanOrEqual(bars[1]);
  }
}

/**
 * The middle of the chalkboard's tile on the street wall, in CSS pixels, once
 * the room has stopped moving (in the bigger room it pans to follow you).
 */
async function boardTile(page: Page): Promise<{ x: number; y: number }> {
  const at = () => tileAt(page, { x: 8, y: 0 });
  let last = await at();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200);
    const now = await at();
    if (now.x === last.x && now.y === last.y) return now;
    last = now;
  }
  return last;
}

/**
 * Where a tile's middle is on screen, in viewport pixels, as the page draws
 * it: on the floor, or up the street wall for row 0 (slice 09). The room is
 * seen at an angle, so a fraction of the canvas isn't a tile.
 */
const tileAt = (page: Page, tile: Tile) =>
  page.evaluate(([x, y]) => (window as unknown as { cafeRoom: { tileAt(x: number, y: number): { x: number; y: number } } }).cafeRoom.tileAt(x, y), [tile.x, tile.y]);

const focused = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("role") || "");
const roomWidth = (page: Page) => page.evaluate(() => document.getElementById("room")?.style.width);

describe("in a browser", { timeout: 30_000 }, () => {
  it("does everything by keyboard at both sizes, through a resize mid-use", async () => {
    const { page } = await visit({ width: 1920, height: 1080 });
    expect(await focused(page)).toBe("room");
    // The room at an angle, 336 pixels wide at 1x, at 4x with the panels
    // floating over it (slice 14).
    expect(await roomWidth(page)).toBe("1344px");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.locator(".menu").waitFor();
    expect(await focused(page)).toBe("menuitem");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    expect(await page.locator(".menu").count()).toBe(0);
    expect(await focused(page)).toBe("room");
    // A phone opens in the bigger room, at 3x, panned to follow you.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.body.classList.contains("layout-b") && document.getElementById("room")?.style.width === "1008px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("talk-input");
    await page.keyboard.type("hello by keyboard");
    await page.keyboard.press("Enter");
    await page.locator(".bubble", { hasText: "hello by keyboard" }).waitFor();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => !document.body.classList.contains("layout-b") && document.getElementById("room")?.style.width === "1344px");
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("room");
    // Forward from the talk box, past Say and the emotes, to the treat
    // button beside them (slice 14).
    await page.locator("#talk-input").focus();
    for (let i = 0; i < 8 && (await focused(page)) !== "put-treat"; i++) await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("put-treat");
    // Back to the room, then past the panels' own buttons to Leave.
    await page.locator("#room").focus();
    for (let i = 0; i < 8 && (await focused(page)) !== "leave"; i++) await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("leave");
    await page.keyboard.press("Enter");
    await page.locator("#left-cafe").waitFor();
    expect(await focused(page)).toBe("come-back");
  });

  it("floats the chalkboard, your cats and who's here in the room's corners at 1920×1080, the room at 4× and every tile clear (slice 14)", async () => {
    const { page } = await visit({ width: 1920, height: 1080 });
    expect(await roomWidth(page)).toBe("1344px");
    const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
    // The panels are placed again once their content is in and they grow
    // (a resize observer, the frame after): wait for them to settle inside
    // the stage before reading, as the laptop check does. A café with a
    // full chalkboard grows them late.
    await expect
      .poll(async () => {
        const s = await box("#stage");
        const all = await Promise.all(["#chalkboard", "#cats-panel", "#here-panel"].map(box));
        return all.every((p) => p.y >= s.y - 0.5 && p.y + p.height <= s.y + s.height + 0.5);
      }, { timeout: 3000 })
      .toBe(true)
      .catch(() => {});
    const stage = await box("#stage");
    const panels = { chalkboard: await box("#chalkboard"), cats: await box("#cats-panel"), here: await box("#here-panel") };
    for (const [name, p] of Object.entries(panels)) {
      expect(p.x, `${name} inside the stage`).toBeGreaterThanOrEqual(stage.x - 0.5);
      expect(p.y, `${name} inside the stage`).toBeGreaterThanOrEqual(stage.y - 0.5);
      expect(p.x + p.width, `${name} inside the stage`).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
      expect(p.y + p.height, `${name} inside the stage`).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
    }
    const mid = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
    const centre = (p: { x: number; y: number; width: number; height: number }) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
    // The chalkboard top left, your cats bottom left, who's here top right.
    expect(centre(panels.chalkboard).x).toBeLessThan(mid.x);
    expect(centre(panels.chalkboard).y).toBeLessThan(mid.y);
    expect(centre(panels.cats).x).toBeLessThan(mid.x);
    expect(centre(panels.cats).y).toBeGreaterThan(mid.y);
    expect(centre(panels.here).x).toBeGreaterThan(mid.x);
    expect(centre(panels.here).y).toBeLessThan(mid.y);
    // Two on the left never overlap.
    expect(panels.chalkboard.y + panels.chalkboard.height).toBeLessThanOrEqual(panels.cats.y + 0.5);
    // Nothing important under them where they start: every tile's middle, and the chalkboard's, is the room's.
    const tiles = [{ x: 8, y: 0 }, ...Array.from({ length: 9 * 12 }, (_, i) => ({ x: i % 12, y: 1 + Math.floor(i / 12) }))];
    for (const t of tiles) {
      const at = await tileAt(page, t);
      expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [at.x, at.y]), `the tile (${t.x}, ${t.y})`).toBe("room");
    }
    // Each says what it is, and can be moved and pinned.
    for (const [sel, name] of [["#chalkboard", "the chalkboard"], ["#cats-panel", "your cats"], ["#here-panel", "who's here"]]) {
      expect(await page.locator(sel).getByRole("button", { name: `Move ${name}` }).isVisible()).toBe(true);
      expect(await page.locator(sel).getByRole("button", { name: `Pin ${name}` }).isVisible()).toBe(true);
    }
    // On a phone the panels are as they were: no grips, no pins.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.body.classList.contains("layout-b"));
    expect(await page.locator(".panel-bar button:visible").count()).toBe(0);
  });

  it("moves a panel by mouse, by touch and by keyboard, keeps it inside the stage through a drag past the edge and a resize, and remembers it (slice 14)", async () => {
    const v = await visit({ width: 1920, height: 1080 }, true);
    const page = v.page;
    const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
    const inside = async (sel: string) => {
      const [p, s] = [await box(sel), await box("#stage")];
      expect(p.x, `${sel} inside the stage`).toBeGreaterThanOrEqual(s.x - 0.5);
      expect(p.y, `${sel} inside the stage`).toBeGreaterThanOrEqual(s.y - 0.5);
      expect(p.x + p.width, `${sel} inside the stage`).toBeLessThanOrEqual(s.x + s.width + 0.5);
      expect(p.y + p.height, `${sel} inside the stage`).toBeLessThanOrEqual(s.y + s.height + 0.5);
    };
    // By mouse, by its title: 300 across and 100 down.
    const start = await box("#chalkboard");
    const title = await box("#chalkboard-heading");
    await page.mouse.move(title.x + 20, title.y + title.height / 2);
    await page.mouse.down();
    await page.mouse.move(title.x + 170, title.y + title.height / 2 + 50, { steps: 5 });
    await page.mouse.move(title.x + 320, title.y + title.height / 2 + 100, { steps: 5 });
    await page.mouse.up();
    let now = await box("#chalkboard");
    expect(Math.round(now.x - start.x)).toBe(300);
    expect(Math.round(now.y - start.y)).toBe(100);
    expect(v.sent.filter((f) => f.type === "walkTo"), "a drag over the room walks nobody anywhere").toEqual([]);
    // Far past the window's right and bottom: it stops at the stage's edge.
    const grab = await box("#chalkboard-heading");
    await page.mouse.move(grab.x + 20, grab.y + 5);
    await page.mouse.down();
    await page.mouse.move(5000, 5000, { steps: 4 });
    await page.mouse.up();
    await inside("#chalkboard");
    // By touch, by its grip: a finger drags who's here 200 to the left.
    const here = await box("#here-panel");
    const grip = await box("#here-panel .grip");
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const [gx, gy] = [grip.x + grip.width / 2, grip.y + grip.height / 2];
    await touch("touchStart", gx, gy);
    for (let i = 1; i <= 5; i++) await touch("touchMove", gx - 40 * i, gy);
    await touch("touchEnd", gx - 200, gy);
    now = await box("#here-panel");
    expect(Math.round(here.x - now.x)).toBe(200);
    // By keyboard: the grip, then the arrows, 16 px a press, 64 with Shift.
    const cats = await box("#cats-panel");
    await page.locator("#cats-panel .grip").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowUp");
    now = await box("#cats-panel");
    expect(Math.round(now.x - cats.x)).toBe(32);
    expect(Math.round(cats.y - now.y)).toBe(64);
    expect(await page.evaluate(() => document.activeElement === document.querySelector("#cats-panel .grip")), "the grip keeps the focus").toBe(true);
    // A smaller window, and a phone and back: each panel stays inside the stage.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(200);
    for (const sel of ["#chalkboard", "#cats-panel", "#here-panel"]) await inside(sel);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.body.classList.contains("layout-b"));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => document.getElementById("room")?.style.width === "1344px");
    for (const sel of ["#chalkboard", "#cats-panel", "#here-panel"]) await inside(sel);
    // Remembered through a reload.
    const before = await Promise.all(["#chalkboard", "#cats-panel", "#here-panel"].map(box));
    await page.reload();
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    // A panel is placed again once its lines come in and it grows, in the
    // frame after (a resize observer, before that frame paints), so this
    // waits for the panels to settle rather than read one instant.
    const where = async () => (await Promise.all(["#chalkboard", "#cats-panel", "#here-panel"].map(box))).map((b) => [Math.round(b.x), Math.round(b.y)]);
    await expect.poll(where, { timeout: 2000 }).toEqual(before.map((b) => [Math.round(b.x), Math.round(b.y)]));
  });

  it("keeps a moved panel where it was put for the visit when the device won't store it (slice 14)", async () => {
    const v = await visit({ width: 1920, height: 1080 }, false, {
      prepare: async (page) => {
        await page.addInitScript(() => {
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new DOMException("blocked", "SecurityError");
            },
          });
        });
      },
    });
    const box = async () => (await v.page.locator("#here-panel").boundingBox())!;
    const start = await box();
    await v.page.locator("#here-panel .grip").focus();
    for (let i = 0; i < 4; i++) await v.page.keyboard.press("Shift+ArrowLeft");
    expect(Math.round(start.x - (await box()).x)).toBe(256);
    await v.page.getByRole("button", { name: "Pin who's here", exact: true }).click();
    // A resize re-places every panel from what's kept: it stays where it was put.
    await v.page.setViewportSize({ width: 1900, height: 1080 });
    await v.page.waitForTimeout(200);
    await v.page.setViewportSize({ width: 1920, height: 1080 });
    await v.page.waitForTimeout(200);
    expect(Math.round(start.x - (await box()).x)).toBe(256);
    // Leave and come back in, the panels set up afresh from what the visit
    // kept (slice 14's review, finding 5): still moved, still pinned, and
    // its Unpin named exactly so (finding 3).
    await v.page.locator("#leave").click();
    await v.page.locator("#come-back").click();
    await v.page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    await expect.poll(async () => Math.round(start.x - (await box()).x)).toBe(256);
    expect(await v.page.getByRole("button", { name: "Unpin who's here", exact: true }).count()).toBe(1);
  });

  it("lets a click on a pinned panel through to the café under it, walking or opening a cat's menu, and keeps it still and unselectable but for Unpin (slice 14)", async () => {
    // A cat held still at (6,5) by the page's socket, as the window-seat check does.
    const CAT = { x: 6, y: 5 };
    const still = (page: Page) =>
      page.routeWebSocket(/\/ws$/, (ws) => {
        const server = ws.connectToServer();
        let pinned: string | null = null;
        server.onMessage((m) => {
          const f = JSON.parse(String(m));
          if (f.type === "welcome") {
            const cat = f.snapshot.cats[0];
            pinned = cat.id;
            Object.assign(cat, { at: CAT, walk: null, pose: "sit", heldBy: null });
            ws.send(JSON.stringify(f));
          } else if (f.cat !== pinned) ws.send(m);
        });
      });
    const v = await visit({ width: 1920, height: 1080 }, false, { prepare: still });
    const page = v.page;
    const name = v.frames.find((f) => f.type === "welcome")!.snapshot.cats[0].name;
    const panel = page.locator("#cats-panel");
    const box = async () => (await panel.boundingBox())!;
    // Over the cat by keyboard: the panel's middle onto the cat's middle.
    const sprite = async () => {
      const floor = await tileAt(page, CAT);
      const scale = (await page.locator("#room").boundingBox())!.width / 336;
      return { x: floor.x, y: floor.y - (CAT_PX / 2 - 2) * scale };
    };
    const target = await sprite();
    await page.locator("#cats-panel .grip").focus();
    for (let i = 0; i < 200; i++) {
      const b = await box();
      const [dx, dy] = [target.x - (b.x + b.width / 2), target.y - (b.y + b.height / 2)];
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) break;
      await page.keyboard.press(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : dy > 0 ? "ArrowDown" : "ArrowUp");
    }
    const over = await box();
    expect(target.x).toBeGreaterThan(over.x);
    expect(target.x).toBeLessThan(over.x + over.width);
    expect(target.y).toBeGreaterThan(over.y);
    expect(target.y).toBeLessThan(over.y + over.height);
    // Unpinned, it takes the click: no menu.
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(300);
    expect(await page.locator(".menu").count(), "an unpinned panel takes a click").toBe(0);
    // Pinned: the click reaches the cat.
    await page.getByRole("button", { name: "Pin your cats" }).click();
    expect(await page.getByRole("button", { name: "Unpin your cats" }).isVisible()).toBe(true);
    await page.mouse.click(target.x, target.y);
    await expect.poll(() => page.locator(".menu").getAttribute("aria-label"), { timeout: 3000 }).toBe(name);
    await page.keyboard.press("Escape");
    // And a click over a bare tile under it walks there.
    const sentBefore = v.sent.length;
    const bare = await (async () => {
      const b = await box();
      for (let y = 1; y < 10; y++)
        for (let x = 0; x < 12; x++) {
          if (x === CAT.x && y === CAT.y) continue;
          const at = await tileAt(page, { x, y });
          const inPanel = at.x > b.x + 4 && at.x < b.x + b.width - 4 && at.y > b.y + 4 && at.y < b.y + b.height - 4;
          if (!inPanel) continue;
          const welcome = v.frames.find((f) => f.type === "welcome")!;
          const taken = welcome.snapshot.room.furniture.some((f: Frame) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
          // Nor where someone stands in front of it: a 32-px person (slice
          // 11) covers the middle of the tiles just behind them, and a
          // click there picks them, as it should.
          const me = meSeen(v.frames).at;
          const near = (p: Tile) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1;
          if (!taken && !near(me) && !near(CAT)) return { x, y, at };
        }
      return null;
    })();
    expect(bare, "a bare tile under the panel").not.toBeNull();
    await page.mouse.click(bare!.at.x, bare!.at.y);
    await expect.poll(() => v.sent.slice(sentBefore).find((f) => f.type === "walkTo")?.tile).toEqual({ x: bare!.x, y: bare!.y });
    // A drag on its title doesn't move it; a drag across its text selects nothing.
    const pinnedAt = await box();
    const title = (await page.locator("#cats-heading").boundingBox())!;
    await page.mouse.move(title.x + 10, title.y + title.height / 2);
    await page.mouse.down();
    await page.mouse.move(title.x + 200, title.y + 150, { steps: 5 });
    await page.mouse.up();
    expect(await box()).toEqual(pinnedAt);
    const text = (await page.locator("#your-cats .cat-row").first().boundingBox())!;
    await page.mouse.move(text.x + 2, text.y + 4);
    await page.mouse.down();
    await page.mouse.move(text.x + text.width - 2, text.y + text.height - 2, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => String(getSelection() ?? "")), "nothing selected in a pinned panel").toBe("");
    // Nor by selecting the whole page: the pinned panel's text is left out.
    await page.evaluate(() => getSelection()?.selectAllChildren(document.body));
    expect(await page.evaluate(() => String(getSelection() ?? "")), "the pinned panel's text in a select-all").not.toContain("Treats today");
    await page.evaluate(() => getSelection()?.removeAllRanges());
    // Tab reaches its Unpin and not its grip; the arrows on Unpin don't move it.
    await page.locator("#leave").focus();
    const reached: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      reached.push(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.id || ""));
      if (reached.at(-1) === "room") break;
    }
    expect(reached).toContain("Unpin your cats");
    expect(reached).not.toContain("Move your cats");
    // Remembered through a reload.
    await page.reload();
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    await expect.poll(async () => (await page.getByRole("button", { name: "Unpin your cats" }).count())).toBe(1);
    await expect.poll(async () => { const b = await box(); return [Math.round(b.x), Math.round(b.y)]; }).toEqual([Math.round(pinnedAt.x), Math.round(pinnedAt.y)]);
    // Unpinned, it can be moved again.
    await page.getByRole("button", { name: "Unpin your cats" }).click();
    await page.locator("#cats-panel .grip").focus();
    await page.keyboard.press("Shift+ArrowLeft");
    expect(Math.round(pinnedAt.x - (await box()).x)).toBe(64);
  });

  it("dims an unpinned panel left unchanged, and brings it back when it changes (slice 14)", async () => {
    const v = await visit({ width: 1920, height: 1080 }, false, {
      prepare: async (page) => {
        await page.clock.install();
        await page.clock.resume();
      },
    });
    const page = v.page;
    const dim = (sel: string) => page.evaluate((s) => document.querySelector(s)!.classList.contains("dim"), sel);
    await page.mouse.move(960, 1075);
    expect(await dim("#here-panel"), "bright at first").toBe(false);
    await page.clock.fastForward(5000);
    await expect.poll(() => dim("#here-panel")).toBe(true);
    // Dimmed, its glass lets more of the room through.
    // The background's alpha, whatever colour space the browser reports it in, once its fade is done.
    const alpha = (sel: string) =>
      page.evaluate((s) => {
        const m = /\/\s*([\d.]+)\)$|rgba\([^)]*,\s*([\d.]+)\)$/.exec(getComputedStyle(document.querySelector(s)!).backgroundColor);
        return m ? Number(m[1] ?? m[2]) : 1;
      }, sel);
    // The glass's two alphas, as the page's own tokens set them.
    const glass = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return { normal: Number(s.getPropertyValue("--glass-alpha")), dim: Number(s.getPropertyValue("--glass-alpha-dim")) };
    });
    expect(glass.dim).toBeLessThan(glass.normal);
    await expect.poll(() => alpha("#here-panel")).toBeCloseTo(glass.dim, 2);
    // Someone arriving changes who's here: it comes back.
    await visit({ width: 1920, height: 1080 });
    await expect.poll(() => dim("#here-panel")).toBe(false);
    await expect.poll(() => alpha("#here-panel")).toBeCloseTo(glass.normal, 2);
    // The pointer over a dimmed panel brings it back too.
    await page.clock.fastForward(5000);
    await expect.poll(() => dim("#chalkboard")).toBe(true);
    const board = (await page.locator("#chalkboard").boundingBox())!;
    await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2);
    await expect.poll(() => dim("#chalkboard")).toBe(false);
    // A pinned panel never dims; the focus put back on the room, as the
    // click leaves it on the Unpin inside the panel, which would keep it
    // bright either way (slice 14's review, finding 6).
    await page.getByRole("button", { name: "Pin your cats" }).click();
    await page.locator("#room").focus();
    await page.mouse.move(960, 1075);
    await page.clock.fastForward(10_000);
    await page.waitForTimeout(200);
    expect(await dim("#cats-panel")).toBe(false);
  });

  it("fits each panel in the stage at a laptop's 1366×768, the left two never overlapping, and lets a pinned one's Unpin be its only Tab stop (slice 14's review, findings 2 and 9)", async () => {
    const v = await visit({ width: 1366, height: 768 });
    const page = v.page;
    const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
    // The panels are placed once their content is in (a resize observer, the
    // frame after), so wait for them to settle inside the stage before reading.
    await expect
      .poll(async () => {
        const s = await box("#stage");
        const all = await Promise.all(["#chalkboard", "#cats-panel", "#here-panel"].map(box));
        return all.every((p) => p.y >= s.y - 0.5 && p.y + p.height <= s.y + s.height + 0.5);
      }, { timeout: 3000 })
      .toBe(true);
    const [stage, board, cats] = [await box("#stage"), await box("#chalkboard"), await box("#cats-panel")];
    for (const [sel, p] of [["#chalkboard", board], ["#cats-panel", cats], ["#here-panel", await box("#here-panel")]] as const) {
      expect(p.y, `${sel} inside the stage`).toBeGreaterThanOrEqual(stage.y - 0.5);
      expect(p.y + p.height, `${sel} inside the stage`).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
    }
    expect(board.y + board.height, "the chalkboard above your cats").toBeLessThanOrEqual(cats.y + 0.5);
    // Your treats are on screen in your cats, not scrolled away.
    const treats = await box("#your-cats .treats");
    expect(treats.y + treats.height, "the treats line inside your cats").toBeLessThanOrEqual(cats.y + cats.height + 0.5);
    // A long visit, as the review had it: who's here's list longer than its
    // box, said within the café's limit (a burst of five, then one in two
    // seconds), and the panels made short enough that their bodies would
    // scroll, so what a pinned one lets Tab reach is the pinned rule's doing.
    for (let i = 0; i < 6; i++) {
      await page.locator("#talk-input").fill(`line ${i} of a long visit, long enough to wrap in the panel`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
    }
    await page.locator(".said li", { hasText: "line 4 of a long visit" }).waitFor();
    // A short window: the stage, and each panel's share of it, too short for what's in them.
    await page.setViewportSize({ width: 1366, height: 560 });
    await page.waitForTimeout(300);
    const said = await page.evaluate(() => {
      const l = document.getElementById("said")!;
      return { scrolls: l.scrollHeight > l.clientHeight || document.querySelector("#here-panel .panel-body")!.scrollHeight > document.querySelector("#here-panel .panel-body")!.clientHeight };
    });
    expect(said.scrolls, "who's here overflows").toBe(true);
    const catsScroll = await page.evaluate(() => { const b = document.getElementById("your-cats")!; return b.scrollHeight > b.clientHeight; });
    expect(catsScroll, "your cats overflows").toBe(true);
    // Pin each panel: from Leave, Tab meets its Unpin and nothing else in it.
    for (const [sel, name] of [["#chalkboard", "the chalkboard"], ["#cats-panel", "your cats"], ["#here-panel", "who's here"]] as const) {
      await page.getByRole("button", { name: `Pin ${name}`, exact: true }).click();
      await page.locator("#leave").focus();
      const inPanel: string[] = [];
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press("Tab");
        const where = await page.evaluate((s) => {
          const el = document.activeElement as HTMLElement;
          return el.closest(s) ? el.getAttribute("aria-label") || el.id || el.tagName : null;
        }, sel);
        if (where) inPanel.push(where);
        if ((await focused(page)) === "room") break;
      }
      expect(inPanel, `what Tab reaches in pinned ${name}`).toEqual([`Unpin ${name}`]);
      await page.getByRole("button", { name: `Unpin ${name}`, exact: true }).click();
    }
  });

  it("says where each tile is on the room seen at an angle, so a click there acts on what's on it", async () => {
    // The cats held in the room's far corner by the page's socket, as the
    // window-seat check holds one: a 24-px cat (slice 11) by the chair would
    // rightly take the click on what's drawn over it.
    const away = (page: Page) =>
      page.routeWebSocket(/\/ws$/, (ws) => {
        const server = ws.connectToServer();
        server.onMessage((m) => {
          const f = JSON.parse(String(m));
          if (f.type === "welcome") {
            f.snapshot.cats.forEach((c: Frame, i: number) => Object.assign(c, { at: { x: 11, y: 9 - i }, walk: null, pose: "sit", heldBy: null }));
            ws.send(JSON.stringify(f));
          } else if (!f.cat) ws.send(m);
        });
      });
    const { page, frames } = await visit({ width: 1920, height: 1080 }, false, { prepare: away });
    const welcome = frames.find((f) => f.type === "welcome")!;
    const chair = welcome.snapshot.room.furniture.find((f: Frame) => f.kind === "chair");
    // The chair's middle is on the room, and a click there opens the chair's menu.
    const at = await tileAt(page, chair);
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [at.x, at.y])).toBe("room");
    await page.mouse.click(at.x, at.y);
    await expect.poll(() => page.locator(".menu").getAttribute("aria-label")).toBe("Chair");
    await page.keyboard.press("Escape");
    // The chalkboard, up the street wall: a click there opens the board.
    const board = await tileAt(page, { x: [...welcome.snapshot.room.tiles[0]].indexOf("C"), y: 0 });
    await page.mouse.click(board.x, board.y);
    await page.locator("#board").waitFor();
    await page.getByRole("button", { name: "Close" }).click();
  });

  it("walks onto the rug by a click or tap, and opens its menu from there, at both sizes", async () => {
    // The user's ask after slice 14: a click on the rug opened its menu,
    // which only moves it, so nobody could stand on it. Now a click walks
    // you onto it, as on the floor, and a click on the tile you're on opens
    // its menu. The page is shown every cat off the rug, and held there, so
    // nothing alive is on the tile clicked.
    const offRug = (page: Page) =>
      page.routeWebSocket(/\/ws$/, (ws) => {
        const server = ws.connectToServer();
        server.onMessage((m) => {
          const f = JSON.parse(String(m));
          if (f.type === "welcome") {
            f.snapshot.cats.forEach((cat: Frame, i: number) => Object.assign(cat, { at: { x: 9 + i, y: 8 }, walk: null, pose: "sit", heldBy: null }));
            ws.send(JSON.stringify(f));
          } else if (f.cat === undefined) ws.send(m);
        });
      });
    for (const [viewport, touch] of [
      [{ width: 1920, height: 1080 }, false],
      [{ width: 390, height: 844 }, true],
    ] as const) {
      const v = await visit(viewport, touch, { prepare: offRug });
      const room = v.frames.find((f) => f.type === "welcome")!.snapshot.room;
      const rug = room.furniture.find((f: Frame) => f.kind === "rug");
      const me = meSeen(v.frames);
      const others: Tile[] = v.frames.find((f) => f.type === "welcome")!.snapshot.people.filter((p: Frame) => p.id !== me.id && p.place === "inside").map((p: Frame) => p.at);
      // A tile of the rug with nothing else on it, and nobody there.
      let spot: Tile | null = null;
      for (let y = rug.y; y < rug.y + rug.h && !spot; y++) {
        for (let x = rug.x; x < rug.x + rug.w && !spot; x++) {
          const covered = room.furniture.some((f: Frame) => f.id !== rug.id && x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
          if (!covered && !others.some((o) => o.x === x && o.y === y) && !(me.at.x === x && me.at.y === y)) spot = { x, y };
        }
      }
      expect(spot, "a bare tile of the rug").not.toBeNull();
      const tile = spot!;
      if (touch) {
        // In the bigger room the rug can be off screen: the keyboard's
        // pointer onto it pulls the view there, and the view stays when the
        // pointer is put away.
        await v.page.locator("#room").focus();
        await v.page.keyboard.press("ArrowRight");
        for (let i = 0; i < 12; i++) await v.page.keyboard.press("ArrowLeft");
        for (let i = 0; i < 10; i++) await v.page.keyboard.press("ArrowUp");
        for (let i = 0; i < tile.x; i++) await v.page.keyboard.press("ArrowRight");
        for (let i = 1; i < tile.y; i++) await v.page.keyboard.press("ArrowDown");
        await v.page.waitForTimeout(400);
      }
      const press = async () => {
        const at = await tileAt(v.page, tile);
        expect(at.x, "the rug is on screen").toBeGreaterThan(0);
        expect(at.x).toBeLessThan(viewport.width);
        if (touch) await v.page.touchscreen.tap(at.x, at.y);
        else await v.page.mouse.click(at.x, at.y);
      };
      const from = v.frames.length;
      await press();
      // A walk onto the rug, which the café accepts, and no menu.
      await expect.poll(() => v.sent.some((f) => f.type === "walkTo" && f.tile.x === tile.x && f.tile.y === tile.y), { timeout: 3000 }).toBe(true);
      await expect.poll(() => v.frames.slice(from).some((f) => f.type === "personMoved" && f.id === me.id), { timeout: 3000 }).toBe(true);
      expect(v.frames.slice(from).some((f) => f.type === "error"), "no refusal").toBe(false);
      expect(await v.page.locator(".menu").count(), "no menu on the way").toBe(0);
      // There, the same tile opens the rug's menu: it moves.
      const walk = v.frames.slice(from).find((f) => f.type === "personMoved" && f.id === me.id)!.walk;
      expect(walk.path.at(-1)).toEqual(tile);
      await v.page.waitForTimeout(((walk.path.length - 1) / walk.speed) * 1000 + 600);
      await press();
      await expect.poll(() => v.page.locator(".menu").getAttribute("aria-label"), { timeout: 3000 }).toBe("Rug");
      expect(await v.page.locator(".menu").getByRole("menuitem").allTextContents()).toEqual(["Move the rug"]);
      await v.page.keyboard.press("Escape");
    }
  });

  it("opens a cat's menu by a click or tap where it's drawn, up on the window seat, at both sizes", async () => {
    // Slice 09's review, finding 1: at an angle a cat on a piece is drawn
    // up off its tile, over the wall behind, and a click there used to walk
    // to the wall. The page is shown one napping on the window seat at (3,1),
    // as the low menu check below pins one, and held there.
    const SEAT = { x: 3, y: 1 };
    const napping = (page: Page) =>
      page.routeWebSocket(/\/ws$/, (ws) => {
        const server = ws.connectToServer();
        let pinned: string | null = null;
        server.onMessage((m) => {
          const f = JSON.parse(String(m));
          if (f.type === "welcome") {
            const cat = f.snapshot.cats[0];
            pinned = cat.id;
            Object.assign(cat, { at: SEAT, walk: null, pose: "nap", heldBy: null });
            ws.send(JSON.stringify(f));
          } else if (f.cat !== pinned) ws.send(m);
        });
      });
    for (const [viewport, touch] of [
      [{ width: 1920, height: 1080 }, false],
      [{ width: 390, height: 844 }, true],
    ] as const) {
      const v = await visit(viewport, touch, { prepare: napping });
      const name = v.frames.find((f) => f.type === "welcome")!.snapshot.cats[0].name;
      if (touch) {
        // In the bigger room the seat can be off screen: the keyboard's
        // pointer onto it pulls the view there, and the view stays when
        // the pointer is put away.
        await v.page.locator("#room").focus();
        await v.page.keyboard.press("ArrowRight");
        for (let i = 0; i < 12; i++) await v.page.keyboard.press("ArrowLeft");
        for (let i = 0; i < 10; i++) await v.page.keyboard.press("ArrowUp");
        for (let i = 0; i < SEAT.x; i++) await v.page.keyboard.press("ArrowRight");
        await v.page.waitForTimeout(400);
      }
      // The sprite's middle: 12 px up the seat, then half its 24 px (slice
      // 11), from feet 2 px below the tile's centre; times the room's scale.
      const scale = (await v.page.locator("#room").boundingBox())!.width / 336;
      const floor = await tileAt(v.page, SEAT);
      const at = { x: floor.x, y: floor.y - (12 + CAT_PX / 2 - 2) * scale };
      expect(at.x, "the cat is on screen").toBeGreaterThan(0);
      expect(at.x).toBeLessThan(viewport.width);
      if (touch) await v.page.touchscreen.tap(at.x, at.y);
      else await v.page.mouse.click(at.x, at.y);
      await expect.poll(() => v.page.locator(".menu").getAttribute("aria-label"), { timeout: 3000 }).toBe(name);
      expect(v.sent.some((f) => f.type === "walkTo"), "no walk to the wall behind it").toBe(false);
      await v.page.keyboard.press("Escape");
    }
  });

  it("keeps a cat's menu opened low in the room whole on screen, by mouse and by keyboard, at both desktop sizes", async () => {
    // A cat's menu is tall, and opened on the bottom row it ran off the
    // room's bottom, under the talk bar. Cats wander, so this page is shown
    // one sitting still on the bottom row at (5,9): its welcome says so, and
    // what the café says of that cat later is held back. Only what this page
    // draws changes; every action is still the café's to answer.
    const LOW = { x: 5, y: 9 };
    const lowCat = (page: Page) =>
      page.routeWebSocket(/\/ws$/, (ws) => {
        const server = ws.connectToServer();
        let pinned: string | null = null;
        server.onMessage((m) => {
          const f = JSON.parse(String(m));
          if (f.type === "welcome") {
            const cat = f.snapshot.cats[0];
            pinned = cat.id;
            Object.assign(cat, { at: LOW, walk: null, pose: "sit", heldBy: null });
            ws.send(JSON.stringify(f));
          } else if (f.cat !== pinned) ws.send(m);
        });
      });
    const expectMenuInStage = async (page: Page) => {
      const menu = page.locator(".menu");
      await menu.waitFor();
      const [m, s] = await Promise.all([menu.boundingBox(), page.locator("#stage").boundingBox()]);
      expect(m!.y + m!.height, "the menu's bottom within the stage").toBeLessThanOrEqual(s!.y + s!.height + 0.5);
      expect(m!.y).toBeGreaterThanOrEqual(s!.y - 0.5);
      expect(m!.x + m!.width, "the menu's right within the stage").toBeLessThanOrEqual(s!.x + s!.width + 0.5);
      expect(m!.x).toBeGreaterThanOrEqual(s!.x - 0.5);
      // Every action is the topmost thing where it's drawn, so a click lands on it.
      for (const item of await menu.getByRole("menuitem").all()) {
        const b = (await item.boundingBox())!;
        const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".menu") !== null, [b.x + b.width / 2, b.y + b.height / 2]);
        expect(hit, `${await item.textContent()} can be clicked`).toBe(true);
      }
    };
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ]) {
      const { page } = await visit(viewport, false, { prepare: lowCat });
      const at = await tileAt(page, LOW);
      await page.mouse.click(at.x, at.y);
      await expectMenuInStage(page);
      expect(await page.locator(".menu").getByRole("menuitem").count(), "a cat's whole menu").toBeGreaterThanOrEqual(4);
      await page.keyboard.press("Escape");
      // By keyboard: the pointer to the bottom row's left end, along to the cat, and Enter.
      await page.locator("#room").focus();
      for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown");
      for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowLeft");
      for (let i = 0; i < LOW.x; i++) await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      await expectMenuInStage(page);
      await page.keyboard.press("Escape");
    }
  });

  it("opens actions as a sheet from the bottom on a phone showing the whole room, by touch", async () => {
    const { page, frames } = await visit({ width: 390, height: 844 }, true);
    const welcome = frames.find((f) => f.type === "welcome")!;
    // A phone opens in the bigger room; the whole room is a tap away.
    await page.locator("#layout-switch").tap();
    await page.waitForFunction(() => !document.body.classList.contains("layout-b"));
    // A chair stays put, where a cat might wander off just as it's tapped.
    const chair = welcome.snapshot.room.furniture.find((f: Frame) => f.kind === "chair");
    const at = await tileAt(page, chair);
    await page.touchscreen.tap(at.x, at.y);
    const menu = page.locator(".menu.sheet");
    await menu.waitFor();
    const r = (await menu.boundingBox())!;
    expect(Math.round(r.y + r.height)).toBe(844);
    expect(Math.round(r.width)).toBe(390);
    await expect.poll(() => menu.getByRole("menuitem").count()).toBeGreaterThan(0);
  });

  it("opens a phone in the bigger room, follows the pointer, opens rings, and remembers a switch to the whole room", async () => {
    const { page } = await visit({ width: 390, height: 844 }, true);
    expect(await page.evaluate(() => document.body.classList.contains("layout-b"))).toBe(true);
    expect(await roomWidth(page)).toBe("1008px");
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
    await expectRingClear(page);
    await page.keyboard.press("Escape");
    // The whole room, at 1x across the phone, remembered through a reload.
    await page.locator("#layout-switch").tap();
    expect(await roomWidth(page)).toBe("336px");
    await page.reload();
    await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    expect(await page.evaluate(() => document.body.classList.contains("layout-b"))).toBe(false);
    expect(await roomWidth(page)).toBe("336px");
    await page.locator("#layout-switch").tap();
    expect(await roomWidth(page)).toBe("1008px");
  });

  it("puts a treat down from beside the emotes, by mouse on a desktop and by touch on a phone, and the other visitor sees it (slice 14)", async () => {
    const a = await visit({ width: 1920, height: 1080 });
    const b = await visit({ width: 390, height: 844 }, true);
    // In the talk bar, right of the emotes, at both sizes.
    for (const v of [a, b]) {
      const [put, emotes, talk] = await Promise.all([v.page.locator("#put-treat").boundingBox(), v.page.locator("#emotes").boundingBox(), v.page.locator("#talk").boundingBox()]);
      expect(put, "the treat button shows").not.toBeNull();
      expect(put!.x, "right of the emotes").toBeGreaterThanOrEqual(emotes!.x + emotes!.width - 1);
      expect(put!.y).toBeGreaterThanOrEqual(talk!.y - 1);
      expect(put!.y + put!.height).toBeLessThanOrEqual(talk!.y + talk!.height + 1);
      expect(await v.page.locator("#your-cats button").count(), "nothing to press in Your cats").toBe(0);
    }
    const fromB = b.frames.length;
    await a.page.getByRole("button", { name: "Put a treat down" }).click();
    await expect.poll(() => b.frames.slice(fromB).some((f) => f.type === "treatPlaced")).toBe(true);
    await expect.poll(() => a.page.locator(".treats").textContent()).toContain("Treats today: 2");
    const fromA = a.frames.length;
    await b.page.getByRole("button", { name: "Put a treat down" }).tap();
    await expect.poll(() => a.frames.slice(fromA).some((f) => f.type === "treatPlaced")).toBe(true);
  });

  // Phase 3's review, finding 34: the browser checks plan Task 8 asked for,
  // and those for findings 2, 3 and 33.

  it("offers a cat a treat by keyboard, and the café answers", async () => {
    const v = await visit({ width: 1920, height: 1080 });
    let offered = -1;
    for (let attempt = 0; attempt < 5 && offered < 0; attempt++) {
      const cat = await tabToCat(v);
      if (!cat) continue;
      await v.page.keyboard.press("Enter");
      const menu = v.page.locator(".menu");
      // The cat may have set off in the moment between Tab and Enter.
      if (!(await menu.isVisible().catch(() => false)) || (await menu.getAttribute("aria-label")) !== cat.name) {
        await v.page.keyboard.press("Escape");
        continue;
      }
      // Down the menu's items to the offer, by keyboard only.
      for (let i = 0; i < 6; i++) {
        const label = await v.page.evaluate(() => document.activeElement?.textContent ?? "");
        if (label === `Offer ${cat.name} a treat`) break;
        await v.page.keyboard.press("ArrowDown");
      }
      expect(await v.page.evaluate(() => document.activeElement?.textContent)).toBe(`Offer ${cat.name} a treat`);
      offered = v.frames.length;
      await v.page.keyboard.press("Enter");
    }
    expect(offered, "never reached a still cat by keyboard").toBeGreaterThanOrEqual(0);
    await expect.poll(() => v.sent.some((f) => f.type === "offerTreat")).toBe(true);
    const me = meSeen(v.frames).id;
    const answered = (f: Frame) =>
      (f.type === "catReacted" && Object.values(f.reaction).includes(me)) ||
      f.type === "yourTreats" ||
      f.type === "error" ||
      (f.type === "personMoved" && f.id === me);
    await expect.poll(() => v.frames.slice(offered).some(answered), { timeout: 10_000 }).toBe(true);
  });

  it("keeps the focus on the treat button while the café changes, and Enter puts one down", async () => {
    const v = await visit({ width: 1920, height: 1080 });
    const put = v.page.getByRole("button", { name: "Put a treat down" });
    await put.focus();
    // Every message from the café used to rebuild the panel; someone arriving
    // is one that comes for certain, where a cat may be asleep.
    const from = v.frames.length;
    await visit({ width: 1920, height: 1080 });
    await expect.poll(() => v.frames.slice(from).some((f) => f.type === "personJoined")).toBe(true);
    await v.page.waitForTimeout(100);
    expect(await v.page.evaluate(() => document.activeElement?.textContent)).toBe("Put a treat down");
    const pressed = v.frames.length;
    await v.page.keyboard.press("Enter");
    const me = meSeen(v.frames).id;
    await expect.poll(() => v.frames.slice(pressed).some((f) => f.type === "treatPlaced" && f.by === me)).toBe(true);
  });

  it("asks a cat by touch on a phone to be picked up, and puts it down from the bar if it agrees", async () => {
    // Whether a cat agrees is the cat's to say, and all three can be asleep
    // for minutes on end (CI caught them so, 2026-10-10), so this proves the
    // touch path to "Pick {name} up" and that the café answers it; when the
    // cat does agree, it also puts it down from the bar. The bar itself is
    // held by client/test/arms.test.ts.
    const v = await visit({ width: 390, height: 844 }, true);
    const me = meSeen(v.frames).id;
    let asked: CatSeen | null = null;
    let from = 0;
    for (let attempt = 0; attempt < 6 && !asked; attempt++) {
      // In the bigger room part of the room is off screen. The keyboard's
      // pointer onto a still cat pulls the view to it, and the view stays
      // when the pointer steps aside for the touch. Cats nap up on the
      // furniture, drawn as high as the piece is tall, so the tap goes there.
      const welcome = v.frames.find((f) => f.type === "welcome")!;
      const still = [...catsSeen(v.frames).values()].filter((c) => !c.walking && c.heldBy === null);
      const cat = still[attempt % Math.max(1, still.length)] ?? null;
      if (!cat) {
        await v.page.waitForTimeout(500);
        continue;
      }
      const under = welcome.snapshot.room.furniture.find(
        (f: Frame) => !f.under && !f.toppled && HEIGHTS[f.kind] > 4 && cat.at.x >= f.x && cat.at.x < f.x + f.w && cat.at.y >= f.y && cat.at.y < f.y + f.h,
      );
      const lift = under ? HEIGHTS[under.kind] : 0;
      await v.page.locator("#room").focus();
      await v.page.keyboard.press("ArrowRight");
      for (let i = 0; i < 12; i++) await v.page.keyboard.press("ArrowLeft");
      for (let i = 0; i < 10; i++) await v.page.keyboard.press("ArrowUp");
      for (let i = 0; i < cat.at.x; i++) await v.page.keyboard.press("ArrowRight");
      for (let i = 1; i < cat.at.y; i++) await v.page.keyboard.press("ArrowDown");
      await v.page.waitForTimeout(400);
      // The middle of its sprite, half its 24 px (slice 11) up from feet 2 px
      // below the tile's centre, and up on whatever it's on.
      const scale = (await v.page.locator("#room").boundingBox())!.width / 336;
      const floor = await tileAt(v.page, cat.at);
      await v.page.touchscreen.tap(floor.x, floor.y - (CAT_PX / 2 - 2 + lift) * scale);
      const pick = v.page.locator(".menu").getByRole("menuitem", { name: `Pick ${cat.name} up` });
      if (!(await pick.isVisible({ timeout: 1000 }).catch(() => false))) {
        // It moved just as it was tapped.
        await v.page.keyboard.press("Escape").catch(() => {});
        continue;
      }
      from = v.frames.length;
      await pick.tap();
      asked = cat;
    }
    expect(asked, "no still cat to tap").not.toBeNull();
    const cat = asked!;
    // Held (after a purr or a shrug), refused one way or another, or the walk over.
    const settled = (f: Frame) =>
      (f.type === "catHeld" && f.cat === cat.id) ||
      (f.type === "error" && f.code !== undefined) ||
      (f.type === "catReacted" && f.cat === cat.id && ["refuse", "scratch"].includes(f.reaction.kind) && Object.values(f.reaction).includes(me));
    const answered = (f: Frame) => settled(f) || (f.type === "personMoved" && f.id === me);
    await expect.poll(() => v.frames.slice(from).some(answered), { timeout: 8_000 }).toBe(true);
    await expect.poll(() => v.frames.slice(from).some(settled), { timeout: 15_000 }).toBe(true);
    if (!v.frames.slice(from).some((f) => f.type === "catHeld" && f.cat === cat.id && f.by === me)) return;
    const down = v.page.locator("#put-cat-down");
    await down.waitFor();
    expect(await down.textContent()).toBe(`Put ${cat.name} down`);
    const before = v.frames.length;
    await down.tap();
    await expect.poll(() => v.sent.some((f) => f.type === "putDown")).toBe(true);
    await expect.poll(() => v.frames.slice(before).some((f) => f.type === "catHeld" && f.cat === cat.id && f.by === null)).toBe(true);
    await v.page.locator("#carrying").waitFor({ state: "hidden" });
  });

  it("in the bigger room, keeps a keyboard-opened ring round a cat well away from you", async () => {
    // A phone opens in the bigger room (slice 09).
    const v = await visit({ width: 390, height: 844 }, true);
    await v.page.waitForFunction(() => document.body.classList.contains("layout-b"));
    const ring = v.page.locator(".menu.ring");
    let cat: CatSeen | null = null;
    for (let attempt = 0; attempt < 6 && !cat; attempt++) {
      const me = meSeen(v.frames).at;
      cat = await tabToCat(v, (c) => Math.abs(c.at.x - me.x) + Math.abs(c.at.y - me.y) >= 4);
      if (!cat) continue;
      await v.page.keyboard.press("Enter");
      if (!(await ring.isVisible({ timeout: 1000 }).catch(() => false)) || (await ring.getAttribute("aria-label")) !== cat.name) {
        cat = null;
        await v.page.keyboard.press("Escape");
      }
    }
    expect(cat, "no cat well away from you to open a ring on").not.toBeNull();
    // Long enough for the view to have gone back to you, had it.
    await v.page.waitForTimeout(500);
    const { off, px } = await ringFromTile(v.page, cat!.at);
    expect(off, "the ring is round its cat").toBeLessThanOrEqual(px * 1.5);
  });

  it("in the bigger room, moves the room over so a ring fits round something by its edge", async () => {
    // The view stops at the room's edges, so what's in the room's left
    // corner on screen sits at the screen's edge, where a ring round it
    // would hang off the screen. The ring used to slide inwards off its
    // tile, onto the thing it was for (CI caught it on a cat napping on the
    // cat bed, 2026-10-13); the room moves over instead while the ring is
    // open. Seen from the front-right, that corner is (0,1), by the street
    // wall's near end, where the cat tower stands (slice 09's review,
    // finding 5; the room turned 2026-10-22).
    const v = await visit({ width: 390, height: 844 }, true);
    await v.page.waitForFunction(() => document.body.classList.contains("layout-b"));
    const welcome = v.frames.find((f) => f.type === "welcome")!;
    const tower = welcome.snapshot.room.furniture.find((f: Frame) => f.kind === "cat_tower");
    expect(tower, "the cat tower stands in the room's corner by the street wall's near end").toMatchObject({ x: 0, y: 1 });
    const corner = { x: 0, y: 1 };
    // The pointer out, then left and up into the corner whatever the arrows
    // are clamped to.
    await v.page.locator("#room").focus();
    await v.page.keyboard.press("ArrowRight");
    for (let i = 0; i < 12; i++) await v.page.keyboard.press("ArrowLeft");
    for (let i = 0; i < 10; i++) await v.page.keyboard.press("ArrowUp");
    // The view has followed the pointer as far as it goes before Enter.
    const leftOf = () => v.page.evaluate(() => document.getElementById("room")!.style.left);
    let settled = await leftOf();
    for (let i = 0; i < 20; i++) {
      await v.page.waitForTimeout(100);
      const now = await leftOf();
      if (now === settled) break;
      settled = now;
    }
    expect(settled, "the view stops at the room's left edge").toBe("0px");
    await v.page.keyboard.press("Enter");
    await v.page.locator(".menu.ring").waitFor({ timeout: 3000 });
    await v.page.waitForTimeout(500);
    const { off } = await ringFromTile(v.page, corner);
    // Round the corner's tile itself: the room moved over by just as much as
    // the ring would otherwise have slid, so its centre is on the tile's to
    // the pixel, give or take rounding.
    expect(off, "the ring is round the cat tower's corner tile").toBeLessThanOrEqual(3);
    await expectRingClear(v.page);
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

  it("shows the chalkboard in the desktop's panel, with someone's new line within a second", async () => {
    const v = await visit({ width: 1920, height: 1080 });
    await expect.poll(() => v.page.locator("#chalkboard h2").textContent()).toBe("The chalkboard");
    expect(await v.page.locator("#chalkboard").isVisible()).toBe(true);
    // Someone else meets a cat, over the WebSocket: a line on everyone's board.
    const account = await signUp();
    const other = await Visitor.connect(account.cookie);
    try {
      await meetACat(other);
      const sniffed = Date.now();
      await v.page.locator("#chalk-lines li", { hasText: `met ${account.name} for the first time` }).waitFor({ timeout: 1000 });
      expect(Date.now() - sniffed).toBeLessThan(1000);
    } finally {
      await other.leave();
    }
  });

  it("opens the board from its tile in the room, by mouse and by keyboard", async () => {
    const v = await visit({ width: 1920, height: 1080 });
    const board = v.page.locator("#board");
    const at = await boardTile(v.page);
    await v.page.mouse.click(at.x, at.y);
    await board.waitFor();
    expect(await focused(v.page)).toBe("board-close");
    // The dialog shows the panel's lines (slice 02's review, finding 7).
    const texts = (list: string) => v.page.locator(`${list} li`).allTextContents();
    expect(await texts("#board-lines")).toEqual(await texts("#chalk-lines"));
    await v.page.locator("#board-close").click();
    await board.waitFor({ state: "hidden" });
    expect(await focused(v.page)).toBe("room");
    // By keyboard: the pointer out, and the chalkboard is last in the Tab
    // cycle, so one Shift+Tab reaches it; Enter opens it, Escape gives the room back.
    await v.page.keyboard.press("ArrowRight");
    await v.page.keyboard.press("Shift+Tab");
    await v.page.waitForTimeout(100);
    expect(await v.page.evaluate(() => document.getElementById("announcer")?.textContent ?? "")).toBe("the chalkboard");
    await v.page.keyboard.press("Enter");
    await board.waitFor();
    expect(await focused(v.page)).toBe("board-close");
    await v.page.keyboard.press("Tab");
    expect(await focused(v.page), "the dialog holds the focus").toBe("board-close");
    await v.page.keyboard.press("Escape");
    await board.waitFor({ state: "hidden" });
    expect(await focused(v.page)).toBe("room");
  });

  it("keeps the room out of reach while the board is open, and the nudge above it", async () => {
    // Slice 02's review, findings 1 and 2: a click beside the board closes it,
    // and acts on nothing behind it.
    const v = await visit({ width: 1920, height: 1080 });
    const board = v.page.locator("#board");
    const at = await boardTile(v.page);
    await v.page.mouse.click(at.x, at.y);
    await board.waitFor();
    // The window seat's left tile, behind the board's backdrop and clear of
    // the board itself, which hangs over the room's middle: a click that got
    // through would open the seat's menu (slice 10's review, finding 4; the
    // chair went under the board when the room turned).
    const seat = await tileAt(v.page, { x: 2, y: 1 });
    expect(await v.page.evaluate(([x, y]) => document.getElementById("board")!.contains(document.elementFromPoint(x, y)), [seat.x, seat.y])).toBe(false);
    const sent = v.sent.length;
    await v.page.mouse.click(seat.x, seat.y);
    await board.waitFor({ state: "hidden" });
    expect(await v.page.locator(".menu").count(), "no menu opened behind the board").toBe(0);
    expect(v.sent.slice(sent).filter((f) => f.type === "walkTo"), "no walk behind the board").toEqual([]);
    expect(await focused(v.page)).toBe("room");
    // Open again: Escape still closes it.
    await v.page.mouse.click(at.x, at.y);
    await board.waitFor();
    await v.page.keyboard.press("Escape");
    await board.waitFor({ state: "hidden" });
    // "Still there?" shows above an open board.
    await v.page.mouse.click(at.x, at.y);
    await board.waitFor();
    const nudge = await v.page.evaluate(() => {
      document.getElementById("still-there")!.hidden = false;
      const r = document.getElementById("im-here")!.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id;
    });
    expect(nudge).toBe("im-here");
    // Leave things as a visitor would find them, for the check that walks out.
    await v.page.evaluate(() => {
      document.getElementById("still-there")!.hidden = true;
    });
    await v.page.locator("#board-close").click();
    await board.waitFor({ state: "hidden" });
  });

  it("reads the board on a phone by keyboard in the bigger room, through a resize, and by a tap on the whole room", async () => {
    const v = await visit({ width: 390, height: 844 }, true);
    const board = v.page.locator("#board");
    // By keyboard at 390×844.
    await v.page.locator("#room").focus();
    await v.page.keyboard.press("ArrowRight");
    await v.page.keyboard.press("Shift+Tab");
    await v.page.keyboard.press("Enter");
    await board.waitFor();
    expect(await focused(v.page)).toBe("board-close");
    // Through a resize to the desktop and back, it stays on screen with the focus.
    for (const size of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
      await v.page.setViewportSize(size);
      await v.page.waitForTimeout(150);
      const r = (await board.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(size.width);
      expect(await focused(v.page)).toBe("board-close");
    }
    await v.page.keyboard.press("Escape");
    await board.waitFor({ state: "hidden" });
    // With the whole room on screen, by a tap.
    await v.page.locator("#layout-switch").tap();
    await v.page.waitForFunction(() => !document.body.classList.contains("layout-b"));
    const at = await boardTile(v.page);
    await v.page.touchscreen.tap(at.x, at.y);
    await board.waitFor();
    await v.page.locator("#board-close").tap();
    await board.waitFor({ state: "hidden" });
    // And by keyboard in the whole room too (slice 09's review, finding 6):
    // the board by Shift+Tab, then a menu from the sheet by Tab and Enter.
    await v.page.locator("#room").focus();
    await v.page.keyboard.press("ArrowRight");
    await v.page.keyboard.press("Shift+Tab");
    await v.page.keyboard.press("Enter");
    await board.waitFor();
    expect(await focused(v.page)).toBe("board-close");
    await v.page.keyboard.press("Escape");
    await board.waitFor({ state: "hidden" });
    await v.page.locator("#room").focus();
    await v.page.keyboard.press("ArrowRight");
    await v.page.keyboard.press("Tab");
    await v.page.keyboard.press("Enter");
    const sheet = v.page.locator(".menu.sheet");
    await sheet.waitFor();
    expect(await focused(v.page)).toBe("menuitem");
    await v.page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });
    expect(await focused(v.page)).toBe("room");
  });

  it("reaches every floor tile on a tablet upright, between the phone's and the desktop's sizes (slice 09's review, finding 10)", async () => {
    // At 820 wide the desktop's panels left the room a 196-px stage, too
    // narrow for the room at 1x, and a third of the floor was cut off.
    const v = await visit({ width: 820, height: 1180 }, true);
    const welcome = v.frames.find((f) => f.type === "welcome")!;
    // Whichever layout it opens in, the whole room is a tap away.
    if (await v.page.evaluate(() => document.body.classList.contains("layout-b"))) {
      await v.page.locator("#layout-switch").tap();
      await v.page.waitForFunction(() => !document.body.classList.contains("layout-b"));
    }
    const missed: string[] = [];
    for (let y = 1; y < welcome.snapshot.room.height; y++) {
      for (let x = 0; x < welcome.snapshot.room.width; x++) {
        const at = await tileAt(v.page, { x, y });
        const on = await v.page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.id === "room", [at.x, at.y]);
        if (!on) missed.push(`(${x},${y})`);
      }
    }
    expect(missed, "floor tiles that can't be clicked or tapped").toEqual([]);
  });

  it("in the bigger room, Tab and Shift+Tab from the room reach only what's on screen (slice 09's review, finding 4)", async () => {
    const v = await visit({ width: 390, height: 844 }, true);
    await v.page.waitForFunction(() => document.body.classList.contains("layout-b"));
    for (const key of ["Tab", "Shift+Tab"]) {
      await v.page.locator("#room").focus();
      for (let i = 0; i < 6; i++) {
        await v.page.keyboard.press(key);
        const seen = await v.page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body || el.id === "room") return { what: "the room", on: true };
          const r = el.getBoundingClientRect();
          // Wholly on the 390 by 844 screen, not clipped away to a pixel.
          const shown = r.width > 2 && r.height > 2 && r.left >= 0 && r.top >= 0 && r.right <= 390 && r.bottom <= 844;
          return { what: el.id || el.textContent || el.tagName, on: shown };
        });
        expect(seen.on, `${key} reached ${seen.what}, which isn't on screen`).toBe(true);
      }
    }
  });

  it("opens the board by tapping the chalkboard on a phone, where the panel's copy is out of sight but read", async () => {
    const v = await visit({ width: 390, height: 844 }, true);
    // Out of sight, but there for a screen reader (slice 02's review, noted for slice 06).
    const panel = (await v.page.locator("#chalkboard").boundingBox())!;
    expect(panel.width * panel.height).toBeLessThanOrEqual(1);
    expect(await v.page.getByRole("heading", { name: "The chalkboard" }).count()).toBeGreaterThan(0);
    const at = await boardTile(v.page);
    await v.page.touchscreen.tap(at.x, at.y);
    const board = v.page.locator("#board");
    await board.waitFor();
    const r = (await board.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390);
    expect(await v.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await v.page.locator("#board-close").tap();
    await board.waitFor({ state: "hidden" });
  });

  it("draws the room and its cats in the hour's light, and moves on to night on an open page (slice 10's review, finding 1)", async () => {
    // On this page only, every cat is pinned sitting still, the first on bare
    // floor at (6,6) so its coat's pixels can be read, the others in the far
    // corner, so none wanders over the floor read at (9,8) (CI and a local
    // run each caught a roaming cat there, 2026-10-22). What the café says of
    // the cats later is held back; it still answers everything.
    const CAT = { x: 6, y: 6 };
    const FLOOR = { x: 9, y: 8 };
    const ASIDE = [
      { x: 11, y: 1 },
      { x: 11, y: 2 },
    ];
    let coat = "";
    const pinned = (page: Page) =>
      page.routeWebSocket(/\/ws$/, (ws) => {
        const server = ws.connectToServer();
        const ids = new Set<string>();
        server.onMessage((m) => {
          const f = JSON.parse(String(m));
          if (f.type === "welcome") {
            f.snapshot.cats.forEach((cat: Frame, i: number) => {
              ids.add(cat.id);
              if (i === 0) coat = cat.coat;
              Object.assign(cat, { at: i === 0 ? CAT : ASIDE[(i - 1) % ASIDE.length], walk: null, pose: "sit", heldBy: null });
            });
            ws.send(JSON.stringify(f));
          } else if (!ids.has(f.cat)) ws.send(m);
        });
      });
    const v = await visit({ width: 1920, height: 1080 }, false, {
      prepare: async (page) => {
        await page.clock.install({ time: new Date("2026-10-22T10:00:00+11:00") });
        await page.clock.resume();
        await pinned(page);
      },
    });
    /**
     * Every colour painted on the canvas's own pixels within `r` room
     * pixels of a tile's spot, `up` room pixels above it. The canvas holds
     * the room at its scale (slice 12), so room pixels are counted through
     * the CSS size the room is shown at. Clear pixels, not yet drawn on, are
     * left out: a slow runner can be read before the first frame lands (CI
     * caught it reading #000000, 2026-10-22).
     */
    const coloursAt = (tile: Tile, up: number, r: number) =>
      v.page.evaluate(
        ([x, y, up, r]) => {
          const canvas = document.getElementById("room") as HTMLCanvasElement;
          const box = canvas.getBoundingClientRect();
          // Canvas pixels per CSS pixel, and the room's scale on the page.
          const perCss = canvas.width / box.width;
          const roomScale = box.width / 336;
          const at = (window as unknown as { cafeRoom: { tileAt(x: number, y: number): { x: number; y: number } } }).cafeRoom.tileAt(x, y);
          const k = roomScale * perCss;
          const cx = Math.round((at.x - box.left) * perCss);
          const cy = Math.round((at.y - box.top) * perCss - up * k);
          const rr = Math.round(r * k);
          const data = canvas.getContext("2d")!.getImageData(cx - rr, cy - rr, 2 * rr + 1, 2 * rr + 1).data;
          const seen = new Set<string>();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            seen.add(`#${[data[i], data[i + 1], data[i + 2]].map((c) => c.toString(16).padStart(2, "0")).join("")}`);
          }
          return [...seen];
        },
        [tile.x, tile.y, up, r],
      );
    const day = palettes.day;
    const night = palettes.night;
    const coatOf = (p: typeof day) => (p.coats as Record<string, string[]>)[coat];
    /** The colours at a spot once a frame has painted one of `want` there, or what was there after 5 s. */
    const settled = async (tile: Tile, up: number, r: number, want: string[]) => {
      let seen: string[] = [];
      await expect
        .poll(
          async () => {
            seen = await coloursAt(tile, up, r);
            return seen.some((c) => want.includes(c));
          },
          { timeout: 5000 },
        )
        .toBe(true)
        .catch(() => {});
      return seen;
    };
    // The diamond's middle at (9,8): one of the floor's two shades.
    const floorDay = await settled(FLOOR, 0, 1, day.room.slice(0, 2));
    // The cat's sprite: 16 px, feet 2 px below its tile's centre.
    const catDay = await settled(CAT, 6, 5, coatOf(day));
    expect(floorDay.some((c) => day.room.slice(0, 2).includes(c)), `day floor ${floorDay}`).toBe(true);
    expect(catDay.some((c) => coatOf(day).includes(c)), `day coat ${catDay}`).toBe(true);
    // The same page, on to 22:00: night, without a reload.
    await v.page.clock.fastForward("12:00:00");
    const floorNight = await settled(FLOOR, 0, 1, night.room.slice(0, 2));
    const catNight = await settled(CAT, 6, 5, coatOf(night));
    expect(floorNight.some((c) => night.room.slice(0, 2).includes(c)), `night floor ${floorNight}`).toBe(true);
    expect(floorNight.some((c) => day.room.slice(0, 2).includes(c)), "no day floor left at night").toBe(false);
    expect(catNight.some((c) => coatOf(night).includes(c)), `night coat ${catNight}`).toBe(true);
    expect(catNight.some((c) => coatOf(day).includes(c) && !coatOf(night).includes(c)), "no day coat left at night").toBe(false);
  });

  it("stands the room on its street, by day and by night, and takes no click or tap there, at both sizes (slice 13)", async () => {
    const v = await visit({ width: 1920, height: 1080 }, false, {
      prepare: async (page) => {
        await page.clock.install({ time: new Date("2026-11-04T10:00:00+11:00") });
        await page.clock.resume();
      },
    });
    const street = (light: "day" | "night") => (palettes[light] as unknown as { street: string[] }).street.map((c) => c.toLowerCase());
    /**
     * The colours in a block of the canvas's top-left corner, 12% of its
     * width by 20% of its height, read from the canvas itself.
     */
    const corner = () =>
      v.page.evaluate(() => {
        const canvas = document.getElementById("room") as HTMLCanvasElement;
        const w = Math.floor(canvas.width * 0.12);
        const h = Math.floor(canvas.height * 0.2);
        const d = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
        const seen = new Set<string>();
        for (let i = 0; i < d.length; i += 4) seen.add(`#${[d[i], d[i + 1], d[i + 2]].map((c) => c.toString(16).padStart(2, "0")).join("")}`);
        return [...seen];
      });
    // By day: the sky, a tower's lit face and its shaded side (the day's
    // street, slots 0, 2 and 3), which no flat fill has.
    const [skyTop, , tower, towerSide] = street("day");
    let seen: string[] = [];
    await expect.poll(async () => { seen = await corner(); return [skyTop, tower, towerSide].every((s) => seen.includes(s)); }, { timeout: 5000 }).toBe(true).catch(() => {});
    expect(seen, "the day's corner").toEqual(expect.arrayContaining([skyTop, tower, towerSide]));
    // No click on the street does anything: its four corners, and just
    // beside the floor's left, right and front tips. Each point is read
    // first, to be sure it's the street that's clicked.
    const box = (await v.page.locator("#room").boundingBox())!;
    const colourAt = (fx: number, fy: number) =>
      v.page.evaluate(
        ([fx, fy]) => {
          const canvas = document.getElementById("room") as HTMLCanvasElement;
          const [r, g, b] = canvas.getContext("2d")!.getImageData(Math.floor(canvas.width * fx), Math.floor(canvas.height * fy), 1, 1).data;
          return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
        },
        [fx, fy],
      );
    const sentBefore = v.sent.length;
    // The floor's tips at 1×: left (0, 152), right (336, 136) and front (176, 232) of 336 by 232.
    for (const [fx, fy] of [[0.01, 0.02], [0.99, 0.02], [0.01, 0.97], [0.99, 0.97], [0.01, 0.76], [0.99, 0.72], [0.4, 0.99]]) {
      expect(street("day"), `the point (${fx}, ${fy}) is the street`).toContain(await colourAt(fx, fy));
      await v.page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await v.page.waitForTimeout(150);
      expect(await v.page.locator(".menu").count(), `a click on the street at (${fx}, ${fy})`).toBe(0);
    }
    expect(v.sent.slice(sentBefore).filter((f) => f.type !== "here").map((f) => f.type), "what clicks on the street sent").toEqual([]);
    // On to 22:00 on the same page: the night's street, with a star or a lit
    // window among its dark sky and towers, which a flat dark fill hasn't.
    await v.page.clock.fastForward("12:00:00");
    const night = street("night");
    const [, , , , lit, , star] = night;
    const nightOk = (c: string[]) => c.includes(night[0]) && (c.includes(star) || c.includes(lit)) && c.filter((x) => night.includes(x)).length >= 3;
    await expect.poll(async () => nightOk((seen = await corner())), { timeout: 5000 }).toBe(true).catch(() => {});
    expect(nightOk(seen), `the night's corner: ${seen.join(" ")}`).toBe(true);
    // At 390×844, in the bigger room, a tap on the street does nothing. The
    // room pans, so the taps go where the canvas shows the street now: points
    // on screen whose canvas pixel is one of the street's colours.
    const phone = await visit({ width: 390, height: 844 }, true, {
      prepare: async (page) => {
        await page.clock.install({ time: new Date("2026-11-04T10:00:00+11:00") });
        await page.clock.resume();
      },
    });
    await phone.page.waitForFunction(() => document.body.classList.contains("layout-b"));
    await phone.page.waitForTimeout(600);
    const spots = await phone.page.evaluate((colours) => {
      const canvas = document.getElementById("room") as HTMLCanvasElement;
      const r = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d")!;
      const found: { x: number; y: number }[] = [];
      // Clear of the floating bars, top and bottom.
      for (let y = 130; y < 700 && found.length < 3; y += 23) {
        for (let x = 12; x < 380 && found.length < 3; x += 37) {
          if (document.elementFromPoint(x, y)?.id !== "room") continue;
          const [cr, cg, cb] = ctx.getImageData(Math.floor(((x - r.left) / r.width) * canvas.width), Math.floor(((y - r.top) / r.height) * canvas.height), 1, 1).data;
          const hex = `#${[cr, cg, cb].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
          if (colours.includes(hex)) found.push({ x, y });
        }
      }
      return found;
      // By day; the windows' light (slot 4) left out, as the café's own window could share it.
    }, street("day").filter((c, i) => i !== 4));
    expect(spots.length, "street showing on the phone").toBeGreaterThan(0);
    const tapsBefore = phone.sent.length;
    for (const { x, y } of spots) {
      await phone.page.touchscreen.tap(x, y);
      await phone.page.waitForTimeout(150);
    }
    expect(phone.sent.slice(tapsBefore).filter((f) => f.type !== "here").map((f) => f.type), "what taps on the street sent").toEqual([]);
    expect(await phone.page.locator(".menu").count()).toBe(0);
  });

  it("follows the device's light or dark setting in Catppuccin Latte or Mocha, at both sizes (slice 10)", async () => {
    const base = { light: "rgb(239, 241, 245)", dark: "rgb(30, 30, 46)" };
    for (const [viewport, touch] of [
      [{ width: 1920, height: 1080 }, false],
      [{ width: 390, height: 844 }, true],
    ] as const) {
      for (const scheme of ["light", "dark"] as const) {
        const v = await visit(viewport, touch, { colorScheme: scheme });
        const seen = await v.page.evaluate(() => ({ page: getComputedStyle(document.body).backgroundColor, talk: getComputedStyle(document.getElementById("talk-input")!).color }));
        expect(seen.page, `${scheme} at ${viewport.width}`).toBe(base[scheme]);
        // Every control still shows: the talk box's text isn't the page's colour.
        expect(seen.talk).not.toBe(seen.page);
        await v.page.locator("#leave").click();
      }
    }
  });

  it("dusts off the café while it wakes, with nothing of the café yet, then opens it", async () => {
    // Slice 07: logged in during a replay, the café page opens at once.
    const v = await visit({ width: 1920, height: 1080 }, false, { prepare: async (page) => (await hearAnnouncer(page), await stillWaking(3000)(page)), waitInside: false });
    const waking = v.page.locator("#waking");
    await waking.waitFor();
    expect(await waking.textContent()).toContain("Dusting off the café…");
    expect(await v.page.locator("#status-text").textContent()).toBe("Dusting off the café…");
    expect(await v.page.locator("#here").textContent(), "nobody shown before the welcome").toBe("");
    expect(await v.page.locator("#your-cats").textContent(), "no cats before the welcome").toBe("");
    expect(await wakingAnimations(v.page), "it moves").toBeGreaterThan(0);
    // Nothing to do while it wakes (slice 07's review, finding 5).
    expect(await v.page.locator("#add-furniture").isDisabled()).toBe(true);
    expect(await v.page.locator("#emotes button").first().isDisabled()).toBe(true);
    await v.page.locator("#talk-input").fill("typed while dusting");
    await v.page.locator("#talk-input").press("Enter");
    expect(await v.page.locator("#talk-input").inputValue(), "the words are kept").toBe("typed while dusting");
    expect(v.sent.filter((m) => !["presence", "here"].includes(m.type)), "nothing sent but presence").toEqual([]);
    await waking.waitFor({ state: "hidden", timeout: 10_000 });
    await v.page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    expect(await v.page.locator("#your-cats .cat-row").count()).toBeGreaterThan(0);
    expect(await v.page.locator("#add-furniture").isDisabled()).toBe(false);
    // Heard once while it wakes, and told when the café opens (slice 07's review, finding 7).
    const said = await v.page.evaluate(() => (window as unknown as { said: string[] }).said);
    expect(said.filter((s) => s === "Dusting off the café…")).toHaveLength(1);
    expect(said.indexOf("You're walking into the café.")).toBeGreaterThan(said.indexOf("Dusting off the café…"));
  });

  it("puts away what was on screen when a reconnect lands on a waking café", async () => {
    // Slice 07's review, findings 4 and 5: no stale carrying bar or menu.
    const route: { first?: WebSocketRoute } = {};
    let connections = 0;
    const v = await visit({ width: 1920, height: 1080 }, false, {
      prepare: (page) =>
        page.routeWebSocket(/\/ws$/, (ws) => {
          connections++;
          if (connections === 1) {
            ws.connectToServer();
            route.first = ws;
            return;
          }
          const server = ws.connectToServer();
          ws.send(JSON.stringify({ type: "waking" }));
          const held: (string | Buffer)[] = [];
          let holding = true;
          setTimeout(() => {
            holding = false;
            for (const m of held.splice(0)) ws.send(m);
          }, 2500);
          server.onMessage((m) => (holding ? held.push(m) : ws.send(m)));
        }),
    });
    await v.page.locator("#add-furniture").click();
    await v.page.locator(".menu").getByRole("menuitem", { name: "A lamp" }).click();
    await v.page.locator("#carrying").waitFor();
    const chair = await tileAt(v.page, { x: 9, y: 4 });
    await v.page.mouse.click(chair.x, chair.y);
    await route.first!.close();
    await v.page.locator("#waking").waitFor();
    expect(await v.page.locator(".menu").count(), "no menu left open over it").toBe(0);
    expect(await v.page.locator("#carrying").isHidden()).toBe(true);
    await v.page.locator("#waking").waitFor({ state: "hidden", timeout: 10_000 });
    await v.page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
    expect(await v.page.locator("#carrying").isHidden(), "the server put the lamp back").toBe(true);
    expect(await v.page.locator("#add-furniture").isDisabled()).toBe(false);
  });

  it("says it's reconnecting, not dusting, when the server goes away while waking", async () => {
    // Slice 07's review, finding 6.
    let connections = 0;
    const v = await visit({ width: 1920, height: 1080 }, false, {
      waitInside: false,
      prepare: (page) =>
        page.routeWebSocket(/\/ws$/, (ws) => {
          connections++;
          if (connections === 1) {
            ws.send(JSON.stringify({ type: "waking" }));
            setTimeout(() => ws.close(), 1000);
          } else {
            ws.close();
          }
        }),
    });
    await v.page.locator("#waking").waitFor();
    await v.page.waitForFunction(() => /Reconnecting/.test(document.getElementById("status-text")?.textContent ?? ""), null, { timeout: 8000 });
    expect(await v.page.locator("#waking").isHidden()).toBe(true);
  });

  it("dusts off the café on a phone, by touch, through a resize, and holds still for reduced motion", async () => {
    const v = await visit({ width: 390, height: 844 }, true, { prepare: stillWaking(6000), waitInside: false, reducedMotion: "reduce" });
    const waking = v.page.locator("#waking");
    await waking.waitFor();
    // Still, for reduced motion, counted while it shows (slice 07's review, finding 9).
    expect(await wakingAnimations(v.page)).toBe(0);
    expect(await waking.isVisible()).toBe(true);
    expect(await v.page.locator("#here").textContent()).toBe("");
    // A tap does nothing while it wakes.
    const r0 = (await waking.boundingBox())!;
    await v.page.touchscreen.tap(r0.x + r0.width / 2, r0.y + r0.height / 2);
    expect(v.sent.filter((m) => !["presence", "here"].includes(m.type))).toEqual([]);
    for (const size of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
      await v.page.setViewportSize(size);
      await v.page.waitForTimeout(100);
      const r = (await waking.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(size.width);
      expect(await v.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    }
    await waking.waitFor({ state: "hidden", timeout: 10_000 });
    await v.page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  });
});

// Slice 17: the demo bar, which only a demo account sees. The café the spec
// runs against must be seeded (`cafe demo seed`), as CI does; without
// APP_DEMO_PASSWORD these checks are skipped.
const demoPassword = process.env.APP_DEMO_PASSWORD;

/** Opens the café in a fresh browser and logs in as `name` through the page. */
async function visitAs(name: string, viewport: { width: number; height: number }, touch = false, init?: string): Promise<Visit> {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  contexts.push(context);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await hearAnnouncer(page);
  const frames: Frame[] = [];
  const sent: Frame[] = [];
  page.on("websocket", (ws) => {
    ws.on("framereceived", (f) => frames.push(JSON.parse(String(f.payload))));
    ws.on("framesent", (f) => sent.push(JSON.parse(String(f.payload))));
  });
  await page.goto(baseUrl);
  await page.locator("#tab-login").click();
  await page.locator("#login input[name=name]").fill(name);
  await page.locator("#login input[name=password]").fill(demoPassword!);
  await page.locator("#login input[name=password]").press("Enter");
  await page.waitForFunction(() => /inside|window/.test(document.getElementById("status-text")?.textContent ?? ""));
  return { page, frames, sent };
}

const HHMM = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The light the café's hour gives (design.md, "Numbers to tune"). */
function lightOf(ms: number): string {
  const hour = Number(HHMM.format(new Date(ms)).slice(0, 2));
  return String(hour >= 21 || hour < 6 ? 1 : hour >= 17 ? 0.5 : 0);
}

describe.skipIf(!demoPassword)("the demo bar (slice 17)", () => {
  it("is a demo account's alone; by keyboard it moves the café on, and the page keeps the café's clock", async () => {
    const visitor = await visit({ width: 1920, height: 1080 });
    expect(await visitor.page.locator("#demo-bar").isHidden()).toBe(true);
    // This device's clock is twelve hours out: the café's light must follow
    // the server's clock all the same.
    const twelveHours = 12 * 3_600_000;
    const shifted = `(() => {
      const Real = Date;
      class Shifted extends Real {
        constructor(...args) { super(...(args.length ? args : [Real.now() + ${twelveHours}])); }
        static now() { return Real.now() + ${twelveHours}; }
      }
      globalThis.Date = Shifted;
    })();`;
    const demo = await visitAs("demo1", { width: 1920, height: 1080 }, false, shifted);
    const page = demo.page;
    await page.locator("#demo-bar").waitFor();
    const welcome = demo.frames.find((f) => f.type === "welcome")!;
    expect(welcome.demo).toBe(true);
    await page.waitForFunction(() => document.getElementById("room")?.dataset.light !== undefined);
    expect(await page.locator("#room").getAttribute("data-light")).toBe(lightOf(welcome.now));
    expect(await page.locator("#demo-time").textContent()).toMatch(/^\d\d:\d\d$/);
    // The bar is in the page's tab order.
    await page.locator("#leave").focus();
    let reached = false;
    for (let n = 0; n < 40 && !reached; n++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.getElementById("demo-bar")!.contains(document.activeElement));
    }
    expect(reached).toBe(true);
    // The clock moves at most once a minute: wait out another check's jump.
    await page.locator("#demo-wait").waitFor({ state: "hidden", timeout: 70_000 });
    // Two minutes on from the café's time as the bar shows it.
    const [h, m] = (await page.locator("#demo-time").textContent())!.split(":").map(Number);
    const t = (h * 60 + m + 2) % (24 * 60);
    const target = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    await page.locator("#demo-at").fill(target);
    await page.locator("#demo-at").focus();
    await page.keyboard.press("Enter");
    // Two minutes replay in a moment, so the cover is up too briefly to
    // catch: what it said is heard, and the café comes back at the new time.
    const told = `demo1 moved the café on to ${target}. Time passes…`;
    await page.waitForFunction((t) => (window as unknown as { said: string[] }).said.includes(t), told, { timeout: 10_000 });
    expect(demo.frames.some((f) => f.type === "jumping" && f.by === "demo1")).toBe(true);
    await page.locator("#waking").waitFor({ state: "hidden", timeout: 15_000 });
    await expect.poll(() => page.locator("#demo-time").textContent()).toBe(target);
    // The visitor's page went with it.
    await visitor.page.waitForFunction(() => document.getElementById("waking")!.hidden);
    expect(visitor.frames.some((f) => f.type === "jumping" && f.by === "demo1")).toBe(true);
  }, 120_000);

  it("works by touch on a phone, closes with Escape, and survives a resize", async () => {
    const demo = await visitAs("demo2", { width: 390, height: 844 }, true);
    const page = demo.page;
    const toggle = page.locator("#demo-bar .demo-toggle", { hasText: "Bots" });
    await toggle.tap();
    expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    await page.locator("#demo-add-bot").tap();
    await expect.poll(() => demo.frames.some((f) => f.type === "personJoined" && f.person.bot)).toBe(true);
    await expect.poll(() => page.locator("#demo-bot-count").textContent()).toBe("1 bot");
    await page.locator("#demo-remove-bot").tap();
    await expect.poll(() => page.locator("#demo-bot-count").textContent()).toBe("No bots");
    await page.locator("#demo-add-bot").focus();
    await page.keyboard.press("Escape");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent)).toBe("Bots");
    expect(await page.locator("#demo-bots").isHidden()).toBe(true);
    // Mid-use, to a desktop: the groups stand in one row, no buttons to open them.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(() => page.locator("#demo-bots").isVisible()).toBe(true);
    expect(await toggle.isHidden()).toBe(true);
    const bar = (await page.locator("#demo-bar").boundingBox())!;
    expect(bar.height).toBeLessThan(80);
  }, 60_000);
});
