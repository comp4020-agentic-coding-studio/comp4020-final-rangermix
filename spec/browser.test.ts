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
  /** What the page sent the café. */
  sent: Frame[];
}

/** Opens the café in a fresh browser and signs up through the page, by keyboard. */
async function visit(viewport: { width: number; height: number }, touch = false): Promise<Visit> {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  contexts.push(context);
  const page = await context.newPage();
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
  await page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));
  return { page, frames, sent };
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
      const cat = [...catsSeen(v.frames).values()].find((c) => !c.walking && c.heldBy === null);
      if (!cat) {
        await v.page.waitForTimeout(500);
        continue;
      }
      const box = (await v.page.locator("#room").boundingBox())!;
      await v.page.touchscreen.tap(box.x + (cat.at.x + 0.5) * (box.width / 12), box.y + (cat.at.y + 0.5) * (box.height / 10));
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
    const v = await visit({ width: 390, height: 844 }, true);
    await v.page.locator("#layout-switch").tap();
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
    const room = (await v.page.locator("#room").boundingBox())!;
    const px = room.width / 12;
    const tile = { x: room.x + (cat!.at.x + 0.5) * px, y: room.y + (cat!.at.y + 0.5) * px };
    const boxes = await Promise.all((await ring.getByRole("menuitem").all()).map((b) => b.boundingBox()));
    const centre = boxes.reduce((c, b) => ({ x: c.x + (b!.x + b!.width / 2) / boxes.length, y: c.y + (b!.y + b!.height / 2) / boxes.length }), { x: 0, y: 0 });
    expect(Math.hypot(centre.x - tile.x, centre.y - tile.y), "the ring is round its cat").toBeLessThanOrEqual(px * 1.5);
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
