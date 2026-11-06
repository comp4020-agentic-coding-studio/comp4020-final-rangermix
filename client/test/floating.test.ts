import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dimmer } from "../src/floating";

// Slice 14: an unpinned panel whose content hasn't changed for 4 seconds
// dims and grows more see-through, and comes back when its content changes,
// or the pointer comes over it, or the keyboard's focus goes into it. A
// pinned one never dims: the pointer can't come over it to bring it back.

function panel(): { box: HTMLElement; body: HTMLElement } {
  const box = document.createElement("section");
  box.className = "panel";
  const body = document.createElement("div");
  body.className = "panel-body";
  body.innerHTML = "<p>Mochi knows you.</p>";
  box.append(body);
  document.body.append(box);
  return { box, body };
}

describe("dimming a panel left unchanged", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("dims at 4 seconds unchanged, not before", () => {
    const { box } = panel();
    const d = new Dimmer(box, () => false);
    vi.advanceTimersByTime(3900);
    d.check();
    expect(box.classList.contains("dim")).toBe(false);
    vi.advanceTimersByTime(200);
    d.check();
    expect(box.classList.contains("dim")).toBe(true);
    d.dispose();
  });

  it("comes back when its content changes, and waits 4 seconds again", () => {
    const { box, body } = panel();
    const d = new Dimmer(box, () => false);
    vi.advanceTimersByTime(4100);
    d.check();
    expect(box.classList.contains("dim")).toBe(true);
    body.innerHTML = "<p>Mochi is your friend.</p>";
    d.check();
    expect(box.classList.contains("dim")).toBe(false);
    vi.advanceTimersByTime(3900);
    d.check();
    expect(box.classList.contains("dim")).toBe(false);
    vi.advanceTimersByTime(200);
    d.check();
    expect(box.classList.contains("dim")).toBe(true);
    d.dispose();
  });

  it("stays dim when its content is rebuilt the same, as who's here is on every message", () => {
    const { box, body } = panel();
    const d = new Dimmer(box, () => false);
    vi.advanceTimersByTime(4100);
    d.check();
    body.replaceChildren(Object.assign(document.createElement("p"), { textContent: "Mochi knows you." }));
    d.check();
    expect(box.classList.contains("dim")).toBe(true);
    d.dispose();
  });

  it("comes back while the pointer is over it or the focus is in it, and dims again after", () => {
    const { box } = panel();
    const button = document.createElement("button");
    box.append(button);
    const d = new Dimmer(box, () => false);
    vi.advanceTimersByTime(4100);
    d.check();
    box.dispatchEvent(new Event("pointerenter"));
    expect(box.classList.contains("dim")).toBe(false);
    vi.advanceTimersByTime(10_000);
    d.check();
    expect(box.classList.contains("dim"), "not while the pointer is over it").toBe(false);
    box.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(4100);
    d.check();
    expect(box.classList.contains("dim")).toBe(true);
    button.focus();
    expect(box.classList.contains("dim")).toBe(false);
    vi.advanceTimersByTime(10_000);
    d.check();
    expect(box.classList.contains("dim"), "not while the focus is in it").toBe(false);
    button.blur();
    vi.advanceTimersByTime(4100);
    d.check();
    expect(box.classList.contains("dim")).toBe(true);
    d.dispose();
  });

  it("never dims a pinned panel, and brings one back when it's pinned", () => {
    const { box } = panel();
    let pinned = false;
    const d = new Dimmer(box, () => pinned);
    vi.advanceTimersByTime(4100);
    d.check();
    expect(box.classList.contains("dim")).toBe(true);
    pinned = true;
    d.check();
    expect(box.classList.contains("dim")).toBe(false);
    vi.advanceTimersByTime(60_000);
    d.check();
    expect(box.classList.contains("dim")).toBe(false);
    d.dispose();
  });
});

describe("a panel's Pin button, through leaving and coming back (slice 14's review, finding 3)", () => {
  it("keeps its name exact when the panels are set up again over the same page", async () => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    localStorage.clear();
    const { Floating } = await import("../src/floating");
    document.body.innerHTML = `<div id="stage"></div><section id="cats-panel" class="panel"><div class="panel-bar"><h2>Your cats</h2><button class="grip" aria-label="Move your cats"></button><button class="pin" aria-label="Pin your cats" data-name="your cats">Pin</button></div><div class="panel-body"></div></section>`;
    const stage = document.getElementById("stage")!;
    const panel = document.getElementById("cats-panel")!;
    const pin = panel.querySelector<HTMLButtonElement>(".pin")!;
    let f = new Floating(stage, [panel]);
    pin.click();
    expect(pin.getAttribute("aria-label")).toBe("Unpin your cats");
    // Leave, and come back in: a new Floating over the same page.
    f.dispose();
    f = new Floating(stage, [panel]);
    expect(pin.getAttribute("aria-label")).toBe("Unpin your cats");
    pin.click();
    expect(pin.getAttribute("aria-label")).toBe("Pin your cats");
    f.dispose();
    f = new Floating(stage, [panel]);
    expect(pin.getAttribute("aria-label")).toBe("Pin your cats");
    f.dispose();
    localStorage.clear();
  });
});

describe("dragging a panel (slice 14's review, finding 7)", () => {
  async function setUp() {
    globalThis.ResizeObserver ??= class {
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const phone = { matches: false, addEventListener() {}, removeEventListener() {} };
    window.matchMedia = (() => phone) as unknown as typeof window.matchMedia;
    localStorage.clear();
    const { Floating } = await import("../src/floating");
    document.body.innerHTML = `<div id="stage"></div><section id="chalkboard" class="panel"><div class="panel-bar"><h2>The chalkboard</h2><button class="grip" aria-label="Move the chalkboard"></button><button class="pin" aria-label="Pin the chalkboard" data-name="the chalkboard">Pin</button></div><div class="panel-body"></div></section>`;
    const stage = document.getElementById("stage")!;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1900, height: 950, right: 1900, bottom: 950, x: 0, y: 0, toJSON: () => ({}) });
    const panel = document.getElementById("chalkboard")!;
    Object.defineProperty(panel, "offsetWidth", { value: 288 });
    Object.defineProperty(panel, "offsetHeight", { value: 200 });
    panel.getBoundingClientRect = () => {
      const x = parseFloat(panel.style.getPropertyValue("--x")) || 0;
      const y = parseFloat(panel.style.getPropertyValue("--y")) || 0;
      return { left: x, top: y, width: 288, height: 200, right: x + 288, bottom: y + 200, x, y, toJSON: () => ({}) };
    };
    const f = new Floating(stage, [panel]);
    const title = panel.querySelector("h2")!;
    const ev = (type: string, x: number, buttons = 1) => title.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 20, buttons, button: 0 }), { pointerId: 1, pointerType: "mouse" }));
    const at = () => parseFloat(panel.style.getPropertyValue("--x"));
    return { f, panel, ev, at, phone };
  }

  it("ends a drag when the button's no longer held, though no button-up arrived", async () => {
    const { f, ev, at } = await setUp();
    ev("pointerdown", 20);
    ev("pointermove", 120);
    const moved = at();
    // The button-up went elsewhere: the next move has no button held.
    ev("pointermove", 400, 0);
    ev("pointermove", 600, 0);
    expect(at(), "no longer following").toBe(moved);
    f.dispose();
  });

  it("ends a drag when the panel's capture is lost", async () => {
    const { f, ev, at } = await setUp();
    ev("pointerdown", 20);
    ev("pointermove", 120);
    const moved = at();
    ev("lostpointercapture", 120);
    ev("pointermove", 500);
    expect(at()).toBe(moved);
    f.dispose();
  });

  it("stops following once the panel is pinned, or the page becomes a phone's", async () => {
    const { f, panel, ev, at, phone } = await setUp();
    ev("pointerdown", 20);
    ev("pointermove", 120);
    panel.querySelector<HTMLButtonElement>(".pin")!.click();
    const pinnedAt = at();
    ev("pointermove", 500);
    expect(at(), "pinned mid-drag").toBe(pinnedAt);
    panel.querySelector<HTMLButtonElement>(".pin")!.click();
    ev("pointerdown", 20);
    ev("pointermove", 80);
    const before = at();
    phone.matches = true;
    ev("pointermove", 700);
    expect(at(), "a phone's page mid-drag").toBe(before);
    f.dispose();
  });
});

describe("moving a panel by keyboard, heard (slice 14's review, finding 10)", () => {
  it("says the arrows move it, and says where it went", async () => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    localStorage.clear();
    const { Floating } = await import("../src/floating");
    document.body.innerHTML = `<div id="announcer"></div><div id="stage"></div><section id="here-panel" class="panel"><div class="panel-bar"><h2>Who's here</h2><button class="grip" aria-label="Move who's here"></button><button class="pin" aria-label="Pin who's here" data-name="who's here">Pin</button></div><div class="panel-body"></div></section>`;
    const stage = document.getElementById("stage")!;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1900, height: 950, right: 1900, bottom: 950, x: 0, y: 0, toJSON: () => ({}) });
    const panel = document.getElementById("here-panel")!;
    Object.defineProperty(panel, "offsetWidth", { value: 288 });
    Object.defineProperty(panel, "offsetHeight", { value: 200 });
    panel.getBoundingClientRect = () => {
      const x = parseFloat(panel.style.getPropertyValue("--x")) || 0;
      const y = parseFloat(panel.style.getPropertyValue("--y")) || 0;
      return { left: x, top: y, width: 288, height: 200, right: x + 288, bottom: y + 200, x, y, toJSON: () => ({}) };
    };
    const f = new Floating(stage, [panel]);
    const grip = panel.querySelector<HTMLButtonElement>(".grip")!;
    const hint = document.getElementById(grip.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent, "the grip's description").toMatch(/arrow/i);
    // Moved to the far left by keyboard: said where it is.
    for (let i = 0; i < 30; i++) grip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true }));
    // Said once the presses stop (debounced), through the live region's own 30-ms turn.
    await new Promise((r) => setTimeout(r, 700));
    expect(document.getElementById("announcer")!.textContent).toMatch(/who's here.*top left/i);
    f.dispose();
  });
});

describe("the music panel's height (slice 16)", () => {
  it("is measured again when its title or controls change size, since its own box is held at its last height", async () => {
    const watched: Element[] = [];
    const saved = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe(el: Element) {
        watched.push(el);
      }
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    localStorage.clear();
    try {
      const { Floating } = await import("../src/floating");
      document.body.innerHTML = `<div id="stage"></div><section id="music-panel" class="panel"><div class="panel-bar"><h2>Music</h2><button class="grip" aria-label="Move the music"></button><button class="pin" aria-label="Pin the music" data-name="the music">Pin</button></div><div class="panel-body music-body"><p class="music-now"></p><div class="music-controls"></div></div></section>`;
      const panel = document.getElementById("music-panel")!;
      const f = new Floating(document.getElementById("stage")!, [panel]);
      expect(watched).toContain(panel.querySelector(".music-now"));
      expect(watched).toContain(panel.querySelector(".music-controls"));
      f.dispose();
    } finally {
      globalThis.ResizeObserver = saved;
      localStorage.clear();
    }
  });
});

describe("the panels and the floating bars (slice 16's review, finding 5)", () => {
  it("watches the status line and the talk bar, so a bar that wraps moves the panels clear of it", async () => {
    const watched: Element[] = [];
    const saved = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe(el: Element) {
        watched.push(el);
      }
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    localStorage.clear();
    try {
      const { Floating } = await import("../src/floating");
      document.body.innerHTML = `<header class="status"></header><div id="stage"></div><form class="talk"></form><section id="cats-panel" class="panel"><div class="panel-bar"><h2>Your cats</h2><button class="grip" aria-label="Move your cats"></button><button class="pin" aria-label="Pin your cats" data-name="your cats">Pin</button></div><div class="panel-body"></div></section>`;
      const f = new Floating(document.getElementById("stage")!, [document.getElementById("cats-panel")!]);
      expect(watched).toContain(document.querySelector(".status"));
      expect(watched).toContain(document.querySelector(".talk"));
      f.dispose();
    } finally {
      globalThis.ResizeObserver = saved;
      localStorage.clear();
    }
  });
});
