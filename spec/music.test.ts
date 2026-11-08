import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { baseUrl, closeGuide, guideOff, logInThroughPage, signUp, signUpThroughPage, uniqueName, walkIn } from "./helpers";

// Slice 15's browser checks: the café's music, each visitor's own. What a
// check reads is the page's one <audio> element (`paused`, `currentSrc`,
// `volume`), the panel's words, every request the page makes for one of the
// six tracks, and every frame it sends the café, which must be nothing but
// the presence ping any press sends.

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

/** The six tracks' names: a request is for one if its file starts with one and ends `.mp3`, wherever the build serves it. */
const TRACKS = ["bubbles", "ocean-breeze", "tranquil-mindscape", "moon-unit", "ease-into-night", "one-night-in-france"];
const trackIn = (url: string): string | null => {
  const file = new URL(url).pathname.split("/").pop() ?? "";
  return file.endsWith(".mp3") ? (TRACKS.find((t) => file.startsWith(t)) ?? null) : null;
};

interface Visit {
  page: Page;
  name: string;
  context: BrowserContext;
  /** What the page sent the café. */
  sent: Frame[];
  /** Each request the page made for a track, by the track's name. */
  fetched: string[];
}

interface VisitOptions {
  /** The Canberra time the page's clock starts at, `HH:MM` on 5 November 2026 (AEDT). */
  at?: string;
  /** Done to the page before it opens the café. */
  prepare?: (page: Page) => Promise<void>;
}

/** Opens the café in a fresh browser and signs up through the page, by keyboard. */
async function visit(viewport: { width: number; height: number }, touch = false, opts: VisitOptions = {}): Promise<Visit> {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  contexts.push(context);
  await guideOff(context);
  const page = await context.newPage();
  const at = new Date(`2026-11-05T${opts.at ?? "10:00"}:00+11:00`);
  await page.clock.install({ time: at });
  await page.clock.resume();
  // The café's clock is the server's, which the page keeps (slice 17): its
  // welcome says it's `at` too, so the café's hour starts there.
  const since = Date.now();
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((m) => {
      const f = JSON.parse(String(m));
      if (f.type === "welcome") f.now = at.getTime() + (Date.now() - since);
      ws.send(JSON.stringify(f));
    });
  });
  if (opts.prepare) await opts.prepare(page);
  const sent: Frame[] = [];
  const fetched: string[] = [];
  page.on("websocket", (ws) => ws.on("framesent", (f) => sent.push(JSON.parse(String(f.payload)))));
  page.on("request", (r) => {
    const t = trackIn(r.url());
    if (t) fetched.push(t);
  });
  await page.goto(baseUrl);
  const name = uniqueName("m");
  await signUpThroughPage(page, name, { keyboard: true });
  await inside(page);
  return { page, name, context, sent, fetched };
}

/**
 * In at the door by a script's click (slice 20). Chromium counts that as a
 * press, so it stands for an entry without one only under autoplayRule,
 * which refuses play() until a real key or tap (slice 20's review, finding
 * 16), as a reload straight into the café used to be.
 */
const walkInUnpressed = async (page: Page) => {
  await page.locator("#door-in").waitFor();
  await page.evaluate(() => document.getElementById("door-in")!.click());
};

const inside = (page: Page) => page.waitForFunction(() => /inside/.test(document.getElementById("status-text")?.textContent ?? ""));

/**
 * The browser's rule: a page can't start sound until someone has pressed
 * something in it. Headless Chromium keeps it, but a check's own
 * page.evaluate counts as a press there, so this keeps the rule as the HTML
 * standard words it, by the page's own input: a page is activated by a key
 * going down, a mouse button going down, or a finger lifting (its
 * "activation-triggering input events"). Until then play() refuses as
 * Chrome's does. A reload starts the page unactivated again.
 */
async function autoplayRule(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let active = false;
    const mark = (e: Event) => {
      if (!e.isTrusted) return;
      if (e.type === "keydown" && (e as KeyboardEvent).key === "Escape") return;
      if (e.type === "pointerdown" && (e as PointerEvent).pointerType !== "mouse") return;
      if (e.type === "pointerup" && (e as PointerEvent).pointerType === "mouse") return;
      active = true;
    };
    for (const type of ["keydown", "pointerdown", "pointerup"]) window.addEventListener(type, mark, true);
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!active) return Promise.reject(new DOMException("play() failed because the user didn't interact with the document first.", "NotAllowedError"));
      return play.call(this);
    };
  });
}

/** The café's own storage of the music, read in the page. */
const remembered = (page: Page) => page.evaluate(() => localStorage.getItem("cafe.music"));

/** The audio element as the page has it: playing or not, the file it has, and its volume. */
const audio = (page: Page) =>
  page.evaluate(() => {
    const a = document.getElementById("music-audio") as HTMLAudioElement;
    return { paused: a.paused, file: a.currentSrc ? (new URL(a.currentSrc).pathname.split("/").pop() ?? "") : "", volume: a.volume };
  });

/** What the panel says: the track's title and artist, and what its Play button does. */
const shown = (page: Page) =>
  page.evaluate(() => ({
    title: document.getElementById("music-title")?.textContent ?? "",
    artist: document.getElementById("music-artist")?.textContent ?? "",
    button: document.getElementById("music-play")?.getAttribute("aria-label") ?? "",
  }));

/**
 * The element plays `track`, and the panel offers Pause. The browser picks
 * the element's source a moment after play() (`currentSrc` is filled in by
 * its resource selection, after the call returns), so both are waited for.
 */
const playing = async (page: Page, track: string) => {
  const file = new RegExp(`^${track}.*\\.mp3$`);
  await expect
    .poll(async () => {
      const a = await audio(page);
      return !a.paused && file.test(a.file);
    }, { message: `${track} playing` })
    .toBe(true);
  expect((await shown(page)).button).toBe("Pause");
};

const paused = async (page: Page) => {
  await expect.poll(async () => (await audio(page)).paused && (await shown(page)).button === "Play", { message: "paused, and the panel offers Play" }).toBe(true);
};

const notPresence = (sent: Frame[], from: number) => sent.slice(from).filter((f) => f.type !== "here").map((f) => f.type);

describe("the café's music", { timeout: 60_000 }, () => {
  it("makes no sound and fetches no track on a first visit, then plays, skips, turns down and pauses by mouse at 1920×1080, naming what's loaded and sending nothing but presence; leaving stops it", async () => {
    // Signing up was a press, so the browser would play: silence is the café's doing.
    const v = await visit({ width: 1920, height: 1080 }, false, { prepare: autoplayRule });
    const page = v.page;
    // A first visit: the day set's first track ready, silent, nothing fetched.
    await page.waitForTimeout(1500);
    expect(v.fetched, "tracks fetched before Play").toEqual([]);
    expect(await audio(page)).toMatchObject({ paused: true, file: "" });
    expect(await shown(page)).toEqual({ title: "Bubbles", artist: "HoliznaCC0", button: "Play" });
    // The panel floats in the stage's bottom-right corner.
    const [stage, panel] = [(await page.locator("#stage").boundingBox())!, (await page.locator("#music-panel").boundingBox())!];
    expect(panel.x + panel.width / 2, "right of the middle").toBeGreaterThan(stage.x + stage.width / 2);
    expect(panel.y + panel.height / 2, "below the middle").toBeGreaterThan(stage.y + stage.height / 2);
    expect(panel.x + panel.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(panel.y + panel.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
    const from = v.sent.length;
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await playing(page, "bubbles");
    expect(new Set(v.fetched), "only the track that plays is fetched").toEqual(new Set(["bubbles"]));
    // Next and Previous, round the day set.
    await page.getByRole("button", { name: "Next track" }).click();
    await playing(page, "ocean-breeze");
    expect((await shown(page)).title).toBe("Ocean Breeze");
    await page.getByRole("button", { name: "Next track" }).click();
    await playing(page, "tranquil-mindscape");
    await page.getByRole("button", { name: "Next track" }).click();
    await playing(page, "bubbles");
    await page.getByRole("button", { name: "Previous track" }).click();
    await playing(page, "tranquil-mindscape");
    expect((await shown(page)).title).toBe("Tranquil Mindscape");
    // The volume: a click a fifth of the way along the slider. It starts at 40%.
    expect((await audio(page)).volume).toBeCloseTo(0.4, 2);
    const slider = (await page.locator("#music-volume").boundingBox())!;
    await page.mouse.click(slider.x + slider.width * 0.2, slider.y + slider.height / 2);
    // Where a click lands along a range depends on its thumb's width, so
    // this holds the side, not the exact value.
    await expect.poll(async () => (await audio(page)).volume).toBeLessThan(0.35);
    expect((await audio(page)).volume).toBeGreaterThan(0.05);
    // Pause, and Next while paused loads the next track without playing or fetching it.
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await paused(page);
    const fetchedBefore = v.fetched.length;
    await page.getByRole("button", { name: "Next track" }).click();
    await expect.poll(async () => (await shown(page)).title).toBe("Bubbles");
    await page.waitForTimeout(500);
    expect((await audio(page)).paused).toBe(true);
    // Nothing at all: not even the track a paused Next names (slice 15's review, finding 4).
    expect(v.fetched.slice(fetchedBefore), "nothing fetched while paused").toEqual([]);
    expect(notPresence(v.sent, from), "what the music sent the café").toEqual([]);
    // Playing, then Leave: it stops.
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await playing(page, "bubbles");
    await page.locator("#leave").click();
    await page.locator("#door").waitFor();
    await expect.poll(async () => (await audio(page)).paused).toBe(true);
  });

  it("plays, skips, turns down and pauses by keyboard at 1920×1080, reached by Tab from the talk bar", async () => {
    const v = await visit({ width: 1920, height: 1080 });
    const page = v.page;
    const from = v.sent.length;
    const focused = () => page.evaluate(() => document.activeElement?.id ?? "");
    // From the treat button beside the emotes, Tab goes on into the music.
    await page.locator("#put-treat").focus();
    for (let i = 0; i < 6 && (await focused()) !== "music-play"; i++) await page.keyboard.press("Tab");
    expect(await focused()).toBe("music-play");
    await page.keyboard.press("Enter");
    await playing(page, "bubbles");
    await page.keyboard.press("Tab");
    expect(await focused()).toBe("music-next");
    await page.keyboard.press("Space");
    await playing(page, "ocean-breeze");
    await page.keyboard.press("Tab");
    expect(await focused()).toBe("music-volume");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => (await audio(page)).volume).toBeCloseTo(0.3, 2);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await focused()).toBe("music-previous");
    await page.keyboard.press("Enter");
    await playing(page, "bubbles");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await paused(page);
    expect(notPresence(v.sent, from), "what the music sent the café").toEqual([]);
  });

  it("works by touch on a phone, in the drawer of the bigger room and under the whole room, and by mouse after a resize across 960 px", async () => {
    const v = await visit({ width: 390, height: 844 }, true);
    const page = v.page;
    const from = v.sent.length;
    await page.waitForFunction(() => document.body.classList.contains("layout-b"));
    // The bigger room: the music is in the drawer, out of sight until it opens.
    expect(await page.locator("#music-panel").isVisible()).toBe(false);
    await page.locator("#drawer-toggle").tap();
    const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
    let [music, here] = [await box("#music-panel"), await box("#here-panel")];
    expect(music.y + music.height, "at the drawer's top, above who's here").toBeLessThanOrEqual(here.y + 0.5);
    expect(music.x).toBeGreaterThanOrEqual(0);
    expect(music.x + music.width).toBeLessThanOrEqual(390);
    expect(music.height, "a slim row").toBeLessThan(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // The open drawer stands under the status bar, which wraps to two rows
    // at 390 px: every button on the bar still answers a tap there.
    const status = await box(".status");
    expect(music.y, "below the status bar").toBeGreaterThanOrEqual(status.y + status.height - 0.5);
    for (const id of ["drawer-toggle", "layout-switch", "leave"]) {
      const b = await box(`#${id}`);
      expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [b.x + b.width / 2, b.y + b.height / 2]), `#${id} under a finger`).toBe(id);
    }
    await page.locator("#music-play").tap();
    await playing(page, "bubbles");
    await page.locator("#music-next").tap();
    await playing(page, "ocean-breeze");
    const slider = await box("#music-volume");
    await page.touchscreen.tap(slider.x + slider.width * 0.8, slider.y + slider.height / 2);
    await expect.poll(async () => (await audio(page)).volume).toBeGreaterThan(0.6);
    expect((await audio(page)).volume).toBeLessThanOrEqual(0.95);
    // The whole room: a slim row under the talk bar, above who's here.
    await page.locator("#layout-switch").tap();
    await page.waitForFunction(() => !document.body.classList.contains("layout-b"));
    const talk = await box("#talk");
    [music, here] = [await box("#music-panel"), await box("#here-panel")];
    expect(music.y, "under the talk bar").toBeGreaterThanOrEqual(talk.y + talk.height - 0.5);
    expect(music.y + music.height, "above who's here").toBeLessThanOrEqual(here.y + 0.5);
    expect(music.height, "a slim row").toBeLessThan(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator("#music-previous").tap();
    await playing(page, "bubbles");
    await page.locator("#music-play").tap();
    await paused(page);
    // Across 960 px to a desktop: the panel floats in the stage, and the mouse works it.
    await page.setViewportSize({ width: 1920, height: 1080 });
    // The room at 4× (slice 16: the bars float, 1600 px for the 13 by 12 floor).
    await page.waitForFunction(() => {
      const size = (window as unknown as { cafeRoom: { size: { width: number } } }).cafeRoom.size;
      return document.getElementById("room")?.style.width === `${size.width * 4}px`;
    });
    const [stage, floating] = [await box("#stage"), await box("#music-panel")];
    expect(floating.x + floating.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(floating.y + floating.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
    expect((await shown(page)).title).toBe("Bubbles");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await playing(page, "bubbles");
    // And back to the phone, still playing.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    expect((await audio(page)).paused, "a resize doesn't stop it").toBe(false);
    expect(notPresence(v.sent, from), "what the music sent the café").toEqual([]);
  });

  it("remembers on, off and the volume through a reload, starts on entering at that volume, and after a reload the browser won't let play, at the first press in the café", async () => {
    const v = await visit({ width: 1920, height: 1080 }, false, { prepare: autoplayRule });
    const page = v.page;
    // Signing up was a touch: Play plays.
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await playing(page, "bubbles");
    await page.locator("#music-volume").focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await audio(page)).volume).toBeCloseTo(0.6, 2);
    await expect.poll(() => remembered(page)).toBe(JSON.stringify({ on: true, volume: 60 }));
    // A reload, then in at the door by a script's click, which the browser
    // doesn't count as a press (slice 20): it won't play yet. The panel
    // shows the track ready and Play, not a false Pause, and nothing loads.
    const fetchedBefore = v.fetched.length;
    await page.reload();
    await walkInUnpressed(page);
    await inside(page);
    await page.waitForTimeout(800);
    expect(await audio(page)).toMatchObject({ paused: true });
    expect(await shown(page)).toEqual({ title: "Bubbles", artist: "HoliznaCC0", button: "Play" });
    expect((await audio(page)).volume, "the remembered volume").toBeCloseTo(0.6, 2);
    expect(Number(await page.locator("#music-volume").inputValue())).toBe(60);
    expect(v.fetched.slice(fetchedBefore), "nothing fetched before the press (slice 15's review, finding 4)").toEqual([]);
    expect(await page.evaluate(() => document.getElementById("music-audio")!.hasAttribute("src")), "no source set while the browser won't play").toBe(false);
    // The first press in the café, a key in the room, starts it.
    await page.locator("#room").focus();
    await page.keyboard.press("ArrowRight");
    await playing(page, "bubbles");
    expect(v.fetched.length - fetchedBefore, "one fetch, when it plays").toBeGreaterThan(0);
    // Paused, and remembered off: a reload stays silent, even after a press.
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await paused(page);
    await expect.poll(() => remembered(page)).toBe(JSON.stringify({ on: false, volume: 60 }));
    await page.reload();
    await walkIn(page);
    await inside(page);
    await page.locator("#room").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(800);
    expect((await audio(page)).paused, "remembered off").toBe(true);
    // Leave and come back in: Come back in is a press, so remembered on plays at once.
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await playing(page, "bubbles");
    await page.locator("#leave").click();
    await page.locator("#door").waitFor();
    await expect.poll(async () => (await audio(page)).paused).toBe(true);
    await page.locator("#door-in").click();
    await inside(page);
    await playing(page, "bubbles");
    expect((await audio(page)).volume).toBeCloseTo(0.6, 2);
    // A reload, and Walk in at the door, a press: it plays at once (slice 20).
    await page.reload();
    await page.locator("#door").waitFor();
    await page.waitForTimeout(500);
    expect((await audio(page)).paused, "nothing plays at the door").toBe(true);
    await walkIn(page);
    await inside(page);
    await playing(page, "bubbles");
  });

  it("on a phone, by touch: the night set at night, and after a reload the phone won't let play, the first tap in the café starts it at the remembered volume", async () => {
    const v = await visit({ width: 390, height: 844 }, true, { at: "21:00", prepare: autoplayRule });
    const page = v.page;
    await page.locator("#drawer-toggle").tap();
    expect((await shown(page)).title).toBe("Moon Unit");
    await page.locator("#music-play").tap();
    await playing(page, "moon-unit");
    await page.locator("#music-next").tap();
    await playing(page, "ease-into-night");
    const slider = (await page.locator("#music-volume").boundingBox())!;
    await page.touchscreen.tap(slider.x + slider.width * 0.15, slider.y + slider.height / 2);
    await expect.poll(async () => (await audio(page)).volume).toBeLessThan(0.35);
    const volume = (await audio(page)).volume;
    await page.reload();
    await walkInUnpressed(page);
    await inside(page);
    await page.waitForTimeout(800);
    expect((await audio(page)).paused, "the phone won't play before a tap").toBe(true);
    expect((await shown(page)).button).toBe("Play");
    // A tap on the status bar, a press in the café like any other. The
    // browser lets a tap start sound only as the finger lifts.
    await page.locator("#status-text").tap();
    // From the set's first track, not where it was.
    await playing(page, "moon-unit");
    expect((await audio(page)).volume).toBeCloseTo(volume, 2);
  });

  it("plays on entering through the sign-in card, a press, from the set's first track at the remembered volume", async () => {
    const v = await visit({ width: 1920, height: 1080 }, false, { prepare: autoplayRule });
    const page = v.page;
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await playing(page, "bubbles");
    await page.getByRole("button", { name: "Next track" }).click();
    await playing(page, "ocean-breeze");
    await page.locator("#music-volume").focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => (await audio(page)).volume).toBeCloseTo(0.35, 2);
    // Signed out on this device (its session gone), then back in by the card.
    await v.context.clearCookies();
    await page.reload();
    await logInThroughPage(page, v.name, "correct horse");
    await inside(page);
    // Walk in was the press: it plays at once, from the set's first track.
    await playing(page, "bubbles");
    expect((await audio(page)).volume).toBeCloseTo(0.35, 2);
  });

  it("drags, pins and dims as the other panels do on a desktop, and pinned, its five controls still work while its words let clicks through to the café", async () => {
    const v = await visit({ width: 1920, height: 1080 });
    const page = v.page;
    const panel = page.locator("#music-panel");
    const box = async () => (await panel.boundingBox())!;
    // By mouse, by its title: 200 to the left and 150 up.
    const start = await box();
    const title = (await page.locator("#music-heading").boundingBox())!;
    await page.mouse.move(title.x + 10, title.y + title.height / 2);
    await page.mouse.down();
    await page.mouse.move(title.x - 90, title.y + title.height / 2 - 75, { steps: 5 });
    await page.mouse.move(title.x - 190, title.y + title.height / 2 - 150, { steps: 5 });
    await page.mouse.up();
    let now = await box();
    expect(Math.round(start.x - now.x)).toBe(200);
    expect(Math.round(start.y - now.y)).toBe(150);
    // By keyboard, by its grip.
    await page.locator("#music-panel .grip").focus();
    await page.keyboard.press("Shift+ArrowLeft");
    expect(Math.round(now.x - (await box()).x)).toBe(64);
    now = await box();
    // Left alone, it dims; a track's name changing brings it back.
    await page.locator("#room").focus();
    await page.mouse.move(960, 1075);
    await expect.poll(() => panel.evaluate((p) => p.classList.contains("dim")), { timeout: 8000 }).toBe(true);
    await page.locator("#music-next").focus();
    await page.keyboard.press("Enter");
    await page.locator("#room").focus();
    await expect.poll(() => panel.evaluate((p) => p.classList.contains("dim"))).toBe(false);
    // Pinned: Play, Previous, Next, the volume and Unpin still answer the mouse.
    await page.getByRole("button", { name: "Pin the music", exact: true }).click();
    expect(await page.getByRole("button", { name: "Unpin the music", exact: true }).isVisible()).toBe(true);
    const from = v.sent.length;
    await page.locator("#music-play").click();
    await playing(page, "ocean-breeze");
    await page.locator("#music-next").click();
    await playing(page, "tranquil-mindscape");
    await page.locator("#music-previous").click();
    await playing(page, "ocean-breeze");
    const slider = (await page.locator("#music-volume").boundingBox())!;
    await page.mouse.click(slider.x + slider.width * 0.9, slider.y + slider.height / 2);
    await expect.poll(async () => (await audio(page)).volume).toBeGreaterThan(0.7);
    await page.locator("#music-play").click();
    await paused(page);
    expect(notPresence(v.sent, from), "what the pinned controls sent the café").toEqual([]);
    // Its words let a click through to the café: over the title, the room's
    // canvas is what's under the pointer.
    const words = (await page.locator("#music-title").boundingBox())!;
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [words.x + 4, words.y + words.height / 2]), "under the track's name").toBe("room");
    // It stays put: a drag on its title doesn't move it.
    const pinnedAt = await box();
    const heading = (await page.locator("#music-heading").boundingBox())!;
    await page.mouse.move(heading.x + 10, heading.y + heading.height / 2);
    await page.mouse.down();
    await page.mouse.move(heading.x + 200, heading.y - 150, { steps: 5 });
    await page.mouse.up();
    expect(await box()).toEqual(pinnedAt);
    // Pinned, it never dims.
    await page.locator("#room").focus();
    await page.mouse.move(960, 1075);
    await page.waitForTimeout(5000);
    expect(await panel.evaluate((p) => p.classList.contains("dim"))).toBe(false);
    // By keyboard, Tab reaches its five controls and not its grip.
    await page.locator("#put-treat").focus();
    const reached: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const el = await page.evaluate(() => (document.activeElement?.closest("#music-panel") ? document.activeElement.getAttribute("aria-label") || document.activeElement.id : null));
      if (el) reached.push(el);
    }
    expect(reached).toEqual(expect.arrayContaining(["Unpin the music", "Previous track", "Play", "Next track", "Volume"]));
    expect(reached).not.toContain("Move the music");
    // Remembered through a reload, still pinned where it was.
    await page.reload();
    await walkIn(page);
    await inside(page);
    await expect.poll(async () => page.getByRole("button", { name: "Unpin the music", exact: true }).count()).toBe(1);
    await expect.poll(async () => { const b = await box(); return [Math.round(b.x), Math.round(b.y)]; }).toEqual([Math.round(pinnedAt.x), Math.round(pinnedAt.y)]);
  });

  // Slice 15's review, finding 1.
  it("plays a track on a second press after its first load failed, as on a dropped connection", async () => {
    let failed = 0;
    const v = await visit({ width: 1920, height: 1080 }, false, {
      prepare: async (page) => {
        await page.route(/\/bubbles[^/]*\.mp3/, (route) => {
          if (failed++ === 0) return route.abort("connectionreset");
          return route.continue();
        });
      },
    });
    const page = v.page;
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await audio(page)).paused && failed > 0).toBe(true);
    await page.waitForTimeout(500);
    expect((await shown(page)).button, "Play, not a false Pause").toBe("Play");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await playing(page, "bubbles");
  });

  // Slice 15's review, findings 5 and 7.
  it("keeps every control and its focus ring whole inside the panel, pinned and not, at 1920×1080 and in a short 960×540 window", async () => {
    const v = await visit({ width: 1920, height: 1080 });
    const page = v.page;
    const RING = 5;
    const whole = async (what: string) => {
      const body = (await page.locator(".music-body").boundingBox())!;
      const panel = (await page.locator("#music-panel").boundingBox())!;
      for (const id of ["music-previous", "music-play", "music-next", "music-volume"]) {
        const c = (await page.locator(`#${id}`).boundingBox())!;
        expect(c.x - RING, `${what}: ${id}'s ring, left`).toBeGreaterThanOrEqual(body.x - 0.5);
        expect(c.y - RING, `${what}: ${id}'s ring, top`).toBeGreaterThanOrEqual(body.y - 0.5);
        expect(c.x + c.width + RING, `${what}: ${id}'s ring, right`).toBeLessThanOrEqual(body.x + body.width + 0.5);
        expect(c.y + c.height + RING, `${what}: ${id}'s ring, bottom`).toBeLessThanOrEqual(body.y + body.height + 0.5);
        expect(c.y + c.height, `${what}: ${id} inside the panel`).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
      }
      const scrolls = await page.evaluate(() => { const b = document.querySelector(".music-body")!; return b.scrollHeight > b.clientHeight + 1; });
      expect(scrolls, `${what}: the music's body scrolls`).toBe(false);
    };
    // The longest title of the six, which wraps to two lines in the 17rem
    // panel (slice 16): the panel grows to it a frame later, once it's
    // measured again.
    await page.getByRole("button", { name: "Previous track" }).click();
    await page.waitForFunction(() => {
      const b = document.querySelector(".music-body")!;
      return b.scrollHeight <= b.clientHeight + 1;
    });
    await whole("1920×1080");
    await page.getByRole("button", { name: "Pin the music", exact: true }).click();
    await whole("1920×1080, pinned");
    await page.setViewportSize({ width: 960, height: 540 });
    await page.waitForTimeout(400);
    await whole("960×540, pinned");
    await page.getByRole("button", { name: "Unpin the music", exact: true }).click();
    await page.waitForTimeout(200);
    await whole("960×540");
  });

  // Slice 15's review, finding 6.
  it("in the bigger room, opening the drawer by keyboard takes the focus to the music, first on screen, and Escape gives it back", async () => {
    const v = await visit({ width: 390, height: 844 }, true);
    const page = v.page;
    await page.waitForFunction(() => document.body.classList.contains("layout-b"));
    const focused = () => page.evaluate(() => document.activeElement?.id ?? "");
    await page.locator("#drawer-toggle").focus();
    await page.keyboard.press("Enter");
    expect(await focused()).toBe("music-previous");
    await page.keyboard.press("Tab");
    expect(await focused()).toBe("music-play");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.body.classList.contains("drawer-open")), "Escape closes the drawer").toBe(false);
    expect(await focused()).toBe("drawer-toggle");
    await page.keyboard.press("Enter");
    // And Next tells a screen reader what's loaded.
    await page.locator("#music-next").focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => document.getElementById("announcer")?.textContent)).toBe("Ocean Breeze, by HoliznaCC0");
  });

  it("keeps on, off and the volume for the visit when the device won't store them", async () => {
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
    const page = v.page;
    // Nowhere to note "no pop-up next time", so the guide pops up (slice 21): closed first.
    await closeGuide(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await playing(page, "bubbles");
    await page.locator("#music-volume").focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => (await audio(page)).volume).toBeCloseTo(0.35, 2);
    // Leave and come back in: the visit kept it on, and its volume.
    await page.locator("#leave").click();
    await page.locator("#door-in").click();
    await inside(page);
    // Nothing kept the tick either, so the guide is back at this entry (slice 21).
    await closeGuide(page);
    await playing(page, "bubbles");
    expect((await audio(page)).volume).toBeCloseTo(0.35, 2);
    expect(Number(await page.locator("#music-volume").inputValue())).toBe(35);
  });

  // Slice 20's review, finding 16: the café's own reload for a new build is
  // the one way in with no press since the door, and the browser's
  // activation starts afresh on a reload: nothing plays or loads until one.
  it("after the café's own reload for a new build, waits for the first press, fetching nothing before it", async () => {
    const account = await signUp(uniqueName("m"));
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    contexts.push(context);
    await guideOff(context);
    const [cookieName, value] = account.cookie.split("=");
    await context.addCookies([{ name: cookieName, value, url: baseUrl }]);
    // Remembered on, at the default volume.
    await context.addInitScript(() => localStorage.setItem("cafe.music", JSON.stringify({ on: true, volume: 50 })));
    const page = await context.newPage();
    // A browser that won't play before a press in the page, as a real one
    // won't after a reload; Playwright's Chromium otherwise would.
    await autoplayRule(page);
    await page.clock.install({ time: new Date("2026-11-05T10:00:00+11:00") });
    await page.clock.resume();
    let builds = 0;
    await page.routeWebSocket(/\/ws$/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => {
        const f = JSON.parse(String(m));
        if (f.type === "welcome") {
          f.now = new Date("2026-11-05T10:00:00+11:00").getTime();
          // The first welcome says the café runs a newer build.
          if (builds++ === 0) f.build = "a-newer-build";
        }
        ws.send(JSON.stringify(f));
      });
      ws.onMessage((m) => server.send(m));
    });
    const fetched: string[] = [];
    page.on("request", (r) => {
      const t = trackIn(r.url());
      if (t) fetched.push(t);
    });
    // What's fetched counts from the reload's own load on.
    let loads = 0;
    let fromReload = Infinity;
    page.on("load", () => {
      loads++;
      if (loads === 2) fromReload = fetched.length;
    });
    await page.goto(baseUrl);
    // In with a real press: the music, remembered on, may start; then the
    // café reloads the tab for its build, and the press is forgotten.
    await page.locator("#door-in").click();
    await expect.poll(() => loads, { timeout: 10_000 }).toBe(2);
    await inside(page);
    await page.waitForTimeout(1000);
    expect((await audio(page)).paused, "nothing plays before a press").toBe(true);
    expect(await shown(page)).toMatchObject({ button: "Play" });
    expect(await page.evaluate(() => document.getElementById("music-audio")!.hasAttribute("src")), "no source held while the browser won't play").toBe(false);
    expect(fetched.slice(fromReload), "nothing fetched since the reload, before a press").toEqual([]);
    // The first press in the café starts it.
    await page.locator("#room").focus();
    await page.keyboard.press("ArrowRight");
    await playing(page, "bubbles");
  });
});

