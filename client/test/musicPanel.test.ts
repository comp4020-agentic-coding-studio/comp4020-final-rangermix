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
function fakeAudio(policy: { refuse: boolean } | boolean = false): HTMLAudioElement {
  const rule = typeof policy === "boolean" ? { refuse: policy } : policy;
  const a = document.createElement("audio");
  let paused = true;
  let time = 0;
  Object.defineProperty(a, "paused", { get: () => paused });
  Object.defineProperty(a, "currentTime", { get: () => time, set: (t: number) => (time = t) });
  // A new source starts from its beginning, as a browser's load does.
  Object.defineProperty(a, "src", {
    get: () => a.getAttribute("src") ?? "",
    set: (v: string) => {
      a.setAttribute("src", v);
      time = 0;
    },
  });
  a.play = () => {
    if (rule.refuse) {
      a.dispatchEvent(new Event("pause"));
      return Promise.reject(new DOMException("no gesture yet", "NotAllowedError"));
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
});
