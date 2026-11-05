import { afterEach, describe, expect, it, vi } from "vitest";
import { rememberMusic, rememberedMusic } from "../src/music";
import { Music, type MusicEls } from "../src/musicPanel";

// Slice 15: the panel's wiring to its one <audio> element, with a fake
// element (jsdom plays nothing) and a fake clock. The choices themselves are
// music.test.ts's; this holds that the panel acts on them: nothing loads
// before Play, a skip while paused loads nothing, a song that ends after
// 17:00 is followed by the night set's first track, and the panel names
// what's loaded and says Play or Pause truly.

/** An <audio> that plays nothing but keeps `paused`, as a browser's does, and fires play and pause. */
interface Rule {
  /** play() refuses, as a browser before a press does. */
  refuse: boolean;
  /** The next source set fails to load, as on a dropped connection: the element sits in error and plays nothing until a source is set again. */
  fail?: boolean;
}

function fakeAudio(policy: Rule | boolean = false): HTMLAudioElement {
  const rule: Rule = typeof policy === "boolean" ? { refuse: policy } : policy;
  const a = document.createElement("audio");
  let paused = true;
  let time = 0;
  let error: MediaError | null = null;
  /** How many times a source was set: each is a fetch, in a browser. */
  let loads = 0;
  Object.defineProperty(a, "paused", { get: () => paused });
  Object.defineProperty(a, "error", { get: () => error });
  Object.defineProperty(a, "loads", { get: () => loads });
  Object.defineProperty(a, "currentTime", { get: () => time, set: (t: number) => (time = t) });
  // A new source starts from its beginning, as a browser's load does.
  Object.defineProperty(a, "src", {
    get: () => a.getAttribute("src") ?? "",
    set: (v: string) => {
      a.setAttribute("src", v);
      time = 0;
      loads++;
      error = null;
      if (rule.fail) {
        rule.fail = false;
        error = { code: 4, message: "network" } as MediaError;
      }
    },
  });
  a.play = () => {
    if (rule.refuse) {
      a.dispatchEvent(new Event("pause"));
      return Promise.reject(new DOMException("no gesture yet", "NotAllowedError"));
    }
    // An element in error plays nothing, and fetches nothing, as a browser's.
    if (error) {
      a.dispatchEvent(new Event("error"));
      return Promise.reject(new DOMException("no supported source", "NotSupportedError"));
    }
    paused = false;
    a.dispatchEvent(new Event("play"));
    return Promise.resolve();
  };
  a.pause = () => {
    paused = true;
    a.dispatchEvent(new Event("pause"));
  };
  a.load = () => {
    time = 0;
  };
  return a;
}

function panel(audio = fakeAudio()): MusicEls {
  const el = <T extends HTMLElement>(tag: string) => document.body.appendChild(document.createElement(tag)) as T;
  const volume = el<HTMLInputElement>("input");
  volume.type = "range";
  return { audio, title: el("span"), artist: el("span"), play: el("button"), previous: el("button"), next: el("button"), volume };
}

const loads = (a: HTMLAudioElement) => (a as unknown as { loads: number }).loads;
const file = (a: HTMLAudioElement) => a.getAttribute("src")?.split("/").pop()?.replace(/[?#].*/, "") ?? "";

describe("the music panel", () => {
  let music: Music | null = null;
  afterEach(() => {
    music?.dispose();
    music = null;
    vi.useRealTimers();
    document.body.replaceChildren();
    // What the visit keeps goes back to the start too, as a new page's would.
    rememberMusic({ on: false, volume: 40 });
    localStorage.removeItem("cafe.music");
  });

  it("names the clock's set's first track and offers Play, loading nothing until it's pressed", () => {
    const els = panel();
    music = new Music(els, () => 10);
    expect(els.title.textContent).toBe("Bubbles");
    expect(els.artist.textContent).toBe("HoliznaCC0");
    expect(els.play.getAttribute("aria-label")).toBe("Play");
    expect(els.audio.getAttribute("src")).toBeNull();
    expect(els.audio.preload).toBe("none");
    els.play.click();
    expect(file(els.audio)).toMatch(/^bubbles.*\.mp3$/);
    expect(els.play.getAttribute("aria-label")).toBe("Pause");
    els.play.click();
    expect(els.audio.paused).toBe(true);
    expect(els.play.getAttribute("aria-label")).toBe("Play");
  });

  it("skips while paused without loading anything, and Play starts the track it shows from its start", () => {
    const els = panel();
    music = new Music(els, () => 10);
    els.play.click();
    els.audio.currentTime = 42;
    els.play.click();
    els.next.click();
    expect(els.title.textContent).toBe("Ocean Breeze");
    expect(els.audio.getAttribute("src"), "nothing loaded while paused").toBeNull();
    els.previous.click();
    expect(els.title.textContent).toBe("Bubbles");
    els.play.click();
    expect(file(els.audio)).toMatch(/^bubbles/);
    expect(els.audio.currentTime, "from its start, not where it was paused").toBe(0);
  });

  it("follows a song that ends with the next, and one that ends after 17:00 with the night set's first", () => {
    let hour = 16;
    vi.useFakeTimers();
    const els = panel();
    music = new Music(els, () => hour);
    els.next.click();
    els.next.click();
    els.play.click();
    expect(file(els.audio)).toMatch(/^tranquil-mindscape/);
    els.audio.currentTime = 100;
    hour = 17;
    vi.advanceTimersByTime(60_000);
    expect(els.title.textContent, "the song begun finishes first").toBe("Tranquil Mindscape");
    els.audio.dispatchEvent(new Event("ended"));
    expect(file(els.audio)).toMatch(/^moon-unit/);
    expect(els.title.textContent).toBe("Moon Unit");
    expect(els.audio.paused).toBe(false);
  });

  it("moves a track not yet begun to the new set when the clock crosses 17:00, so the panel names what Play will play", () => {
    let hour = 16;
    vi.useFakeTimers();
    const els = panel();
    music = new Music(els, () => hour);
    hour = 17;
    vi.advanceTimersByTime(60_000);
    expect(els.title.textContent).toBe("Moon Unit");
  });

  it("starts at 40% and turns down by its slider, in steps of 5", () => {
    const els = panel();
    music = new Music(els, () => 10);
    expect(els.audio.volume).toBeCloseTo(0.4, 5);
    expect(els.volume.value).toBe("40");
    expect(els.volume.step).toBe("5");
    els.volume.value = "25";
    els.volume.dispatchEvent(new Event("input"));
    expect(els.audio.volume).toBeCloseTo(0.25, 5);
  });

  it("shows Play, not a false Pause, when the browser won't play yet", async () => {
    const els = panel(fakeAudio(true));
    music = new Music(els, () => 10);
    els.play.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(els.audio.paused).toBe(true);
    expect(els.play.getAttribute("aria-label")).toBe("Play");
  });

  it("stops and unloads when the visit ends", () => {
    const els = panel();
    music = new Music(els, () => 10);
    els.play.click();
    music.dispose();
    music = null;
    expect(els.audio.paused).toBe(true);
    expect(els.audio.getAttribute("src")).toBeNull();
  });

  it("remembers on or off and the volume as they change", () => {
    const els = panel();
    music = new Music(els, () => 10);
    els.play.click();
    expect(rememberedMusic()).toEqual({ on: true, volume: 40 });
    els.volume.value = "70";
    els.volume.dispatchEvent(new Event("input"));
    expect(rememberedMusic()).toEqual({ on: true, volume: 70 });
    els.play.click();
    expect(rememberedMusic()).toEqual({ on: false, volume: 70 });
  });

  it("starts from what's remembered: the volume, and playing on entering if it was on", () => {
    rememberMusic({ on: true, volume: 25 });
    const els = panel();
    music = new Music(els, () => 22);
    expect(els.audio.volume).toBeCloseTo(0.25, 5);
    expect(els.volume.value).toBe("25");
    music.enter();
    expect(els.audio.paused).toBe(false);
    expect(file(els.audio)).toMatch(/^moon-unit/);
  });

  it("stays silent on entering if it was off", () => {
    rememberMusic({ on: false, volume: 25 });
    const els = panel();
    music = new Music(els, () => 10);
    music.enter();
    music.pressed();
    expect(els.audio.paused).toBe(true);
    expect(els.audio.getAttribute("src")).toBeNull();
  });

  it("when the browser won't play on entering, starts at the first press in the café, and only then", async () => {
    rememberMusic({ on: true, volume: 40 });
    const rule = { refuse: true };
    const audio = fakeAudio(rule);
    const els = panel(audio);
    music = new Music(els, () => 10);
    music.enter();
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.paused).toBe(true);
    expect(els.play.getAttribute("aria-label")).toBe("Play");
    expect(rememberedMusic().on, "a refusal isn't the visitor turning it off").toBe(true);
    // The press comes; the browser now lets it play.
    rule.refuse = false;
    music.pressed();
    expect(audio.paused).toBe(false);
    expect(els.play.getAttribute("aria-label")).toBe("Pause");
  });

  it("doesn't start again at a press once the visitor has paused it", () => {
    rememberMusic({ on: true, volume: 40 });
    const els = panel();
    music = new Music(els, () => 10);
    music.enter();
    els.play.click();
    expect(els.audio.paused).toBe(true);
    music.pressed();
    expect(els.audio.paused).toBe(true);
  });

  // Slice 15's review, finding 1.
  it("loads a track again when Play is pressed after it failed to load, rather than doing nothing", async () => {
    const rule: Rule = { refuse: false, fail: true };
    const els = panel(fakeAudio(rule));
    music = new Music(els, () => 10);
    els.play.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(els.audio.paused).toBe(true);
    expect(els.play.getAttribute("aria-label")).toBe("Play");
    expect(loads(els.audio)).toBe(1);
    els.play.click();
    await Promise.resolve();
    expect(loads(els.audio), "the source set again").toBe(2);
    expect(els.audio.paused).toBe(false);
    expect(file(els.audio)).toMatch(/^bubbles/);
  });

  // Slice 15's review, finding 2.
  it("plays the clock's set when Play is pressed just after 17:00, before the clock is next looked at", () => {
    let hour = 16;
    vi.useFakeTimers();
    const els = panel();
    music = new Music(els, () => hour);
    expect(els.title.textContent).toBe("Bubbles");
    hour = 17;
    els.play.click();
    expect(file(els.audio)).toMatch(/^moon-unit/);
    expect(els.title.textContent).toBe("Moon Unit");
  });

  it("starts the clock's set at the first press, if the clock has crossed 17:00 while it waited", async () => {
    rememberMusic({ on: true, volume: 40 });
    let hour = 16;
    const rule = { refuse: true };
    const els = panel(fakeAudio(rule));
    music = new Music(els, () => hour);
    music.enter();
    await Promise.resolve();
    hour = 17;
    rule.refuse = false;
    music.pressed();
    expect(file(els.audio)).toMatch(/^moon-unit/);
    expect(els.audio.paused).toBe(false);
  });

  // Slice 15's review, finding 3.
  it("remembers a pause or a play from outside the panel, as a media key or a headset's button makes", () => {
    const els = panel();
    music = new Music(els, () => 10);
    els.play.click();
    expect(rememberedMusic().on).toBe(true);
    els.audio.pause();
    expect(rememberedMusic().on, "paused by a media key").toBe(false);
    expect(els.play.getAttribute("aria-label")).toBe("Play");
    void els.audio.play();
    expect(rememberedMusic().on, "played by a media key").toBe(true);
  });

  it("doesn't count as turning it off the pause the browser makes as a song ends, a refusal, or the visit ending", async () => {
    rememberMusic({ on: true, volume: 40 });
    const rule = { refuse: true };
    const els = panel(fakeAudio(rule));
    music = new Music(els, () => 10);
    music.enter();
    await Promise.resolve();
    expect(rememberedMusic().on, "a refusal").toBe(true);
    rule.refuse = false;
    music.pressed();
    // A browser fires pause just before ended, with `ended` true.
    Object.defineProperty(els.audio, "ended", { configurable: true, get: () => true });
    els.audio.pause();
    expect(rememberedMusic().on, "a song ending").toBe(true);
    Object.defineProperty(els.audio, "ended", { configurable: true, get: () => false });
    els.audio.dispatchEvent(new Event("ended"));
    expect(els.audio.paused).toBe(false);
    music.dispose();
    music = null;
    expect(rememberedMusic().on, "the visit ending").toBe(true);
  });

  it("names the track for the system's media controls, and their Next and Previous skip", () => {
    const handlers: Record<string, () => void> = {};
    const session = { metadata: null as unknown, setActionHandler: (a: string, fn: (() => void) | null) => (fn ? (handlers[a] = fn) : delete handlers[a]) };
    Object.defineProperty(navigator, "mediaSession", { configurable: true, value: session });
    class Meta {
      constructor(readonly init: { title: string; artist: string }) {}
    }
    vi.stubGlobal("MediaMetadata", Meta);
    try {
      const els = panel();
      music = new Music(els, () => 10);
      els.play.click();
      expect((session.metadata as Meta).init).toMatchObject({ title: "Bubbles", artist: "HoliznaCC0" });
      handlers.nexttrack();
      expect(els.title.textContent).toBe("Ocean Breeze");
      expect((session.metadata as Meta).init.title).toBe("Ocean Breeze");
      handlers.previoustrack();
      expect(els.title.textContent).toBe("Bubbles");
      music.dispose();
      music = null;
      expect(handlers.nexttrack, "let go when the visit ends").toBeUndefined();
    } finally {
      delete (navigator as unknown as { mediaSession?: unknown }).mediaSession;
      vi.unstubAllGlobals();
    }
  });

  // Slice 15's review, finding 6.
  it("tells a screen reader what's loaded after a skip", async () => {
    vi.useFakeTimers();
    const region = Object.assign(document.createElement("div"), { id: "announcer" });
    document.body.append(region);
    const els = panel();
    music = new Music(els, () => 10);
    els.next.click();
    vi.advanceTimersByTime(100);
    expect(region.textContent).toBe("Ocean Breeze, by HoliznaCC0");
  });

  // Slice 15's review, finding 4: a source is set only once play() is allowed.
  it("sets no source while the browser won't play, so nothing can load before the press", async () => {
    rememberMusic({ on: true, volume: 40 });
    const rule = { refuse: true };
    const els = panel(fakeAudio(rule));
    els.audio.play = function (this: HTMLAudioElement) {
      return rule.refuse ? Promise.reject(new DOMException("no", "NotAllowedError")) : HTMLMediaElement.prototype.play.call(this);
    } as typeof els.audio.play;
    music = new Music(els, () => 10);
    music.enter();
    await Promise.resolve();
    await Promise.resolve();
    expect(els.audio.getAttribute("src"), "no source while refused").toBeNull();
  });
});
