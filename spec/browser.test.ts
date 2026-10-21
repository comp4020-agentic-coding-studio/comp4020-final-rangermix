import { type Browser, type BrowserContext, type Page, type WebSocketRoute, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { baseUrl, meetACat, signUp, uniqueName, Visitor } from "./helpers";
import heights from "../content/sprites/heights.json" with { type: "json" };

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
    // The room at an angle, 336 pixels wide at 1x, at 3x (slice 09).
    expect(await roomWidth(page)).toBe("1008px");
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
    await page.waitForFunction(() => !document.body.classList.contains("layout-b") && document.getElementById("room")?.style.width === "1008px");
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

  it("says where each tile is on the room seen at an angle, so a click there acts on what's on it", async () => {
    const { page, frames } = await visit({ width: 1920, height: 1080 });
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
      // The sprite's middle: 12 px up the seat, then half its 16 px, from feet
      // 2 px below the tile's centre; times the room's scale.
      const scale = (await v.page.locator("#room").boundingBox())!.width / 336;
      const floor = await tileAt(v.page, SEAT);
      const at = { x: floor.x, y: floor.y - (12 + 8 - 2) * scale };
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

  it("puts a treat down from the panel, and the other visitor sees it", async () => {
    const a = await visit({ width: 1920, height: 1080 });
    const b = await visit({ width: 1920, height: 1080 });
    const from = b.frames.length;
    await a.page.getByRole("button", { name: "Put a treat down" }).click();
    await expect.poll(() => b.frames.slice(from).some((f) => f.type === "treatPlaced")).toBe(true);
    await expect.poll(() => a.page.locator(".treats").textContent()).toContain("Treats today: 2");
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
      // The middle of its sprite, half its 16 px up from feet 2 px below the
      // tile's centre, and up on whatever it's on.
      const scale = (await v.page.locator("#room").boundingBox())!.width / 336;
      const floor = await tileAt(v.page, cat.at);
      await v.page.touchscreen.tap(floor.x, floor.y - (6 + lift) * scale);
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
    // A tile low in the room, behind the board's backdrop and clear of the board
    // itself, which hangs over the room's middle (the chair went under it
    // when the room turned, 2026-10-22).
    const seat = await tileAt(v.page, { x: 3, y: 8 });
    expect(await v.page.evaluate(([x, y]) => document.getElementById("board")!.contains(document.elementFromPoint(x, y)), [seat.x, seat.y])).toBe(false);
    await v.page.mouse.click(seat.x, seat.y);
    await board.waitFor({ state: "hidden" });
    expect(await v.page.locator(".menu").count(), "no menu opened behind the board").toBe(0);
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
