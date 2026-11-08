import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Guide, guideWanted, saveGuideWanted, shrinkInto, takeGuideOpen } from "../src/guide";

// Slice 21: the guide over the café, whether it pops up on the way in, and
// the shrink into its ⓘ.

/** Swaps localStorage for one that throws, as a browser blocking storage does, for one test. */
function blockStorage(): () => void {
  const real = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  return () => Object.defineProperty(window, "localStorage", real);
}

describe("whether the guide pops up (slice 21)", () => {
  beforeEach(() => localStorage.clear());

  it("does by default", () => {
    expect(guideWanted()).toBe(true);
  });

  it("doesn't once the box is ticked, and does again once it's unticked", () => {
    saveGuideWanted(false);
    expect(localStorage.getItem("cafe.guide")).toBe("off");
    expect(guideWanted()).toBe(false);
    saveGuideWanted(true);
    expect(localStorage.getItem("cafe.guide")).toBeNull();
    expect(guideWanted()).toBe(true);
  });

  it("does where the browser won't store anything, and saving there throws nothing", () => {
    const restore = blockStorage();
    try {
      expect(guideWanted()).toBe(true);
      expect(() => saveGuideWanted(false)).not.toThrow();
    } finally {
      restore();
    }
  });

  it("holds a tick for the visit where the browser won't store it (slice 21's review, finding 6)", () => {
    const restore = blockStorage();
    try {
      saveGuideWanted(false);
      expect(guideWanted()).toBe(false);
      saveGuideWanted(true);
      expect(guideWanted()).toBe(true);
    } finally {
      restore();
    }
  });
});

describe("the shrink into the ⓘ (slice 21)", () => {
  const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

  it("moves the card's middle onto the button's", () => {
    // A 544 by 600 card in the middle of 1920×1080; a 40 px button top right.
    const card = box(688, 240, 544, 600);
    const button = box(1700, 8, 40, 40);
    const s = shrinkInto(card, button);
    expect(card.left + card.width / 2 + s.x).toBeCloseTo(1720);
    expect(card.top + card.height / 2 + s.y).toBeCloseTo(28);
  });

  it("scales it to fit inside the button, whichever way is tighter", () => {
    // Tall and narrow, as on a phone: its height decides.
    const tall = shrinkInto(box(16, 32, 358, 780), box(200, 8, 40, 40));
    expect(tall.scale).toBeCloseTo(40 / 780);
    expect(358 * tall.scale).toBeLessThanOrEqual(40);
    // Wide and short: its width does.
    const wide = shrinkInto(box(0, 0, 800, 200), box(0, 0, 40, 40));
    expect(wide.scale).toBeCloseTo(40 / 800);
  });
});

/** The guide's elements, as index.html has them, and a café behind. */
function page() {
  document.body.innerHTML = `
    <div id="cafe"><button id="guide-open">i</button><canvas id="room" tabindex="0"></canvas></div>
    <div id="guide-backdrop" hidden></div>
    <div id="guide" hidden>
      <section id="guide-card" role="dialog">
        <div id="guide-words" tabindex="-1"><h2>How the café works</h2></div>
        <div class="guide-foot">
          <label><input type="checkbox" id="guide-off" /> Got it, no pop-up next time</label>
          <button type="button" id="guide-close">Close</button>
        </div>
      </section>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  return {
    backdrop: $("guide-backdrop"),
    root: $("guide"),
    card: $("guide-card"),
    words: $("guide-words"),
    off: $<HTMLInputElement>("guide-off"),
    close: $<HTMLButtonElement>("guide-close"),
    button: $<HTMLButtonElement>("guide-open"),
    cafe: $("cafe"),
    room: $("room"),
  };
}

const key = (k: string, shift = false) => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true, cancelable: true }));

describe("the guide (slice 21)", () => {
  let els: ReturnType<typeof page>;
  let guide: Guide;
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // The last press was a pointer's, not a key's.
    document.dispatchEvent(new Event("pointerdown"));
    els = page();
    guide = new Guide(els);
  });
  afterEach(() => {
    guide.dispose();
    vi.unstubAllGlobals();
  });

  it("opens over an inert café, the focus on its words", () => {
    guide.open("entry");
    expect(guide.isOpen).toBe(true);
    expect(els.root.hidden).toBe(false);
    expect(els.backdrop.hidden).toBe(false);
    expect(els.cafe.inert).toBe(true);
    expect(document.activeElement).toBe(els.words);
  });

  it("shows the saved choice in its box, and saves the box as it changes", () => {
    saveGuideWanted(false);
    guide.open("button");
    expect(els.off.checked).toBe(true);
    els.off.checked = false;
    els.off.dispatchEvent(new Event("change", { bubbles: true }));
    expect(guideWanted()).toBe(true);
    els.off.checked = true;
    els.off.dispatchEvent(new Event("change", { bubbles: true }));
    expect(guideWanted()).toBe(false);
  });

  it("keeps the focus inside while it's open: Tab and Shift+Tab go round its words, the box and Close", () => {
    guide.open("entry");
    key("Tab");
    expect(document.activeElement).toBe(els.off);
    key("Tab");
    expect(document.activeElement).toBe(els.close);
    key("Tab");
    expect(document.activeElement).toBe(els.words);
    key("Tab", true);
    expect(document.activeElement).toBe(els.close);
    // From anywhere: a click on its plain words leaves the focus on the page.
    (document.activeElement as HTMLElement).blur();
    key("Tab");
    expect(els.card.contains(document.activeElement)).toBe(true);
  });

  it("rings its words only when Tab brings the focus there, not as it opens", () => {
    guide.open("entry");
    expect(els.words.classList.contains("tabbed")).toBe(false);
    key("Tab");
    key("Tab");
    key("Tab");
    expect(document.activeElement).toBe(els.words);
    expect(els.words.classList.contains("tabbed")).toBe(true);
    key("Tab");
    expect(els.words.classList.contains("tabbed")).toBe(false);
  });

  it("rings its words as it opens after a key, not after a pointer (slice 21's review, finding 7)", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    guide.open("button");
    expect(els.words.classList.contains("tabbed")).toBe(true);
    key("Escape");
    document.dispatchEvent(new Event("pointerdown"));
    guide.open("button");
    expect(els.words.classList.contains("tabbed")).toBe(false);
  });

  it("holds the page where it was while it's open, and the room takes the focus back without scrolling it (slice 21's review, finding 4)", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    const at = Object.getOwnPropertyDescriptor(window, "scrollY");
    try {
      guide.open("entry");
      // A swipe or a wheel scrolls the page under it: it goes back.
      Object.defineProperty(window, "scrollY", { configurable: true, value: 213 });
      window.dispatchEvent(new Event("scroll"));
      expect(scrollTo).toHaveBeenLastCalledWith(window.scrollX, 0);
      Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
      const focus = vi.spyOn(els.room, "focus");
      key("Escape");
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      // Closed, the page scrolls as it likes.
      scrollTo.mockClear();
      Object.defineProperty(window, "scrollY", { configurable: true, value: 300 });
      window.dispatchEvent(new Event("scroll"));
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      if (at) Object.defineProperty(window, "scrollY", at);
      else delete (window as { scrollY?: number }).scrollY;
    }
  });

  it("stops a wheel or a swipe beside its words from scrolling the page, and lets its words scroll (slice 21's review, finding 4)", () => {
    guide.open("entry");
    const roll = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    expect(roll(els.backdrop, "wheel")).toBe(false);
    expect(roll(els.close, "wheel")).toBe(false);
    expect(roll(els.backdrop, "touchmove")).toBe(false);
    expect(roll(els.words, "wheel")).toBe(true);
    expect(roll(els.words, "touchmove")).toBe(true);
    key("Escape");
    expect(roll(els.backdrop, "wheel")).toBe(true);
  });

  it("notes it's open, for the café's own reload, and forgets it once closed (slice 21's review, finding 3)", () => {
    guide.open("entry");
    expect(sessionStorage.getItem("cafe.guideOpen")).toBe("1");
    key("Escape");
    expect(sessionStorage.getItem("cafe.guideOpen")).toBeNull();
    expect(takeGuideOpen()).toBe(false);
    guide.open("button");
    // Read once: a later opening isn't the reload's.
    expect(takeGuideOpen()).toBe(true);
    expect(takeGuideOpen()).toBe(false);
  });

  it("calls its opening hook as it opens, so a menu closes (slice 21's review, finding 11)", () => {
    const opening = vi.fn();
    guide.dispose();
    guide = new Guide(els, { opening });
    els.button.click();
    expect(opening).toHaveBeenCalledOnce();
  });

  it("closes by Escape, and the focus goes back to the room when it opened on the way in", () => {
    guide.open("entry");
    key("Escape");
    expect(guide.isOpen).toBe(false);
    expect(els.root.hidden).toBe(true);
    expect(els.backdrop.hidden).toBe(true);
    expect(els.cafe.inert).toBe(false);
    expect(document.activeElement).toBe(els.room);
  });

  it("closes by Close, and the focus goes back to the ⓘ when it opened from there", () => {
    guide.open("button");
    els.close.click();
    expect(guide.isOpen).toBe(false);
    expect(document.activeElement).toBe(els.button);
  });

  it("opens from its ⓘ", () => {
    els.button.click();
    expect(guide.isOpen).toBe(true);
  });

  it("closes by a press that starts and ends beside it, and not by a click that only ends there", () => {
    guide.open("entry");
    els.backdrop.click();
    expect(guide.isOpen).toBe(true);
    els.backdrop.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    els.backdrop.click();
    expect(guide.isOpen).toBe(false);
  });

  it("listens to no key once it's closed", () => {
    guide.open("entry");
    key("Escape");
    els.room.focus();
    key("Tab");
    expect(document.activeElement).toBe(els.room);
  });

  describe("as it shrinks into the ⓘ", () => {
    /** An animation that never finishes on its own, recording what it was asked to do. */
    function stubAnimate() {
      const calls: { el: Element; frames: Keyframe[] }[] = [];
      const animate = function (this: Element, frames: Keyframe[]) {
        calls.push({ el: this, frames });
        return { finished: new Promise(() => {}), cancel() {} } as unknown as Animation;
      };
      Element.prototype.animate = animate as typeof Element.prototype.animate;
      return calls;
    }
    const sized = (el: HTMLElement, left: number, top: number, width: number, height: number) => {
      el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
    };
    afterEach(() => {
      delete (Element.prototype as { animate?: unknown }).animate;
    });

    it("moves into the button, and stays up until it lands", () => {
      const calls = stubAnimate();
      guide.open("entry");
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 1700, 8, 40, 40);
      guide.close();
      const shrink = calls.findLast((c) => c.el === els.card)!;
      const s = shrinkInto({ left: 688, top: 240, width: 544, height: 600 }, { left: 1700, top: 8, width: 40, height: 40 });
      expect(shrink.frames.at(-1)!.transform).toBe(`translate(${s.x}px, ${s.y}px) scale(${s.scale})`);
      expect(shrink.frames.at(-1)!.opacity).toBe(0);
      // Shut to the café straight away, shown until the shrink lands.
      expect(guide.isOpen).toBe(false);
      expect(els.cafe.inert).toBe(false);
      expect(els.root.hidden).toBe(false);
    });

    it("only fades with reduced motion", () => {
      const calls = stubAnimate();
      vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
      guide.open("entry");
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 1700, 8, 40, 40);
      guide.close();
      const fade = calls.findLast((c) => c.el === els.card)!;
      expect(fade.frames.every((f) => f.transform === undefined)).toBe(true);
      expect(fade.frames.at(-1)!.opacity).toBe(0);
    });

    it("only fades when the button has no size to shrink into", () => {
      const calls = stubAnimate();
      guide.open("entry");
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 0, 0, 0, 0);
      guide.close();
      expect(calls.findLast((c) => c.el === els.card)!.frames.every((f) => f.transform === undefined)).toBe(true);
    });

    it("grows out of the button when it opens from there", () => {
      const calls = stubAnimate();
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 1700, 8, 40, 40);
      guide.open("button");
      const grow = calls.findLast((c) => c.el === els.card)!;
      expect(grow.frames[0].transform).toMatch(/^translate\(.*\) scale\(/);
      expect(grow.frames.at(-1)!.transform).toBe("none");
    });

    it("takes no clicks as it shrinks, and takes them again once opened (slice 21's review, finding 5)", () => {
      stubAnimate();
      guide.open("entry");
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 1700, 8, 40, 40);
      guide.close();
      expect(els.root.classList.contains("closing")).toBe(true);
      expect(els.backdrop.classList.contains("closing")).toBe(true);
      guide.open("button");
      expect(els.root.classList.contains("closing")).toBe(false);
      expect(els.backdrop.classList.contains("closing")).toBe(false);
    });

    it("lands at once on a resize mid-shrink (slice 21's review, finding 12)", () => {
      stubAnimate();
      guide.open("entry");
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 1700, 8, 40, 40);
      guide.close();
      expect(els.root.hidden).toBe(false);
      window.dispatchEvent(new Event("resize"));
      expect(els.root.hidden).toBe(true);
      expect(els.backdrop.hidden).toBe(true);
    });

    it("shrinks from where a grow had got to (slice 21's review, finding 13)", () => {
      const calls = stubAnimate();
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 1700, 8, 40, 40);
      guide.open("button");
      const real = window.getComputedStyle.bind(window);
      vi.stubGlobal("getComputedStyle", (el: Element) => (el === els.card ? ({ transform: "matrix(0.5, 0, 0, 0.5, 10, 10)", opacity: "0.6" } as CSSStyleDeclaration) : real(el)));
      guide.close();
      const shrink = calls.findLast((c) => c.el === els.card)!;
      expect(shrink.frames[0]).toMatchObject({ transform: "matrix(0.5, 0, 0, 0.5, 10, 10)", opacity: 0.6 });
    });

    it("hides at once when closed now, as on Leave", () => {
      stubAnimate();
      guide.open("entry");
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 1700, 8, 40, 40);
      guide.close({ now: true });
      expect(els.root.hidden).toBe(true);
      expect(els.backdrop.hidden).toBe(true);
    });

    it("opened again mid-shrink, it's open and shown", () => {
      stubAnimate();
      guide.open("entry");
      sized(els.card, 688, 240, 544, 600);
      sized(els.button, 1700, 8, 40, 40);
      guide.close();
      guide.open("button");
      expect(guide.isOpen).toBe(true);
      expect(els.root.hidden).toBe(false);
      expect(els.cafe.inert).toBe(true);
    });
  });
});
