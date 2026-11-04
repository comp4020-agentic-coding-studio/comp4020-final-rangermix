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
