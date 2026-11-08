import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DemoBar, PRESETS, aheadShort, aheadText, botsText, clockText, hourOn, minuteOf, movesAgainAt, waitText, type DemoBarEls } from "../src/demoBar";
import type { ClientMsg } from "../src/protocol/ClientMsg";
import type { CafeState } from "../src/state";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Slice 17: the bar a demo account moves the café's clock and adds bots with.
describe("the demo bar", () => {
  it("offers four times picked for the cats", () => {
    expect(PRESETS.map((p) => [p.label, p.minute])).toEqual([
      ["Morning", 7 * 60],
      ["Afternoon", 13 * 60 + 30],
      ["Evening", 18 * 60 + 30],
      ["Night", 23 * 60 + 30],
    ]);
  });

  it("says how far ahead of Canberra the café's clock runs", () => {
    expect(aheadText(0)).toBe("on Canberra time");
    expect(aheadText(2 * 60_000)).toBe("2 min ahead");
    expect(aheadText(20_000)).toBe("1 min ahead");
    // Whole hours, rounded down, so nearly a day never reads "24 h" (slice 17's review, finding 8).
    expect(aheadText(9.5 * HOUR)).toBe("9 h ahead");
    expect(aheadText(23.9 * HOUR)).toBe("23 h ahead");
    expect(aheadText(DAY + 23.9 * HOUR)).toBe("a day and 23 h ahead");
    expect(aheadText(DAY)).toBe("a day ahead");
    expect(aheadText(DAY + 3 * HOUR)).toBe("a day and 3 h ahead");
    expect(aheadText(2 * DAY)).toBe("2 days ahead");
  });

  it("reads a typed time as minutes past midnight", () => {
    expect(minuteOf("23:30")).toBe(23 * 60 + 30);
    expect(minuteOf("07:05")).toBe(7 * 60 + 5);
    expect(minuteOf("")).toBeNull();
    expect(minuteOf("25:00")).toBeNull();
    expect(minuteOf("noon")).toBeNull();
  });

  it("moves an hour on from the café's own time", () => {
    // 14:20 in Canberra, by the café's clock.
    expect(hourOn(Date.parse("2026-11-06T03:20:00Z"))).toBe(15 * 60 + 20);
    // 23:40: an hour on is 00:40 the next day.
    expect(hourOn(Date.parse("2026-11-06T12:40:00Z"))).toBe(40);
  });

  it("shows the café's time, and how long until it can move again", () => {
    expect(clockText(Date.parse("2026-11-06T12:30:00Z"))).toBe("23:30");
    expect(waitText(100_000, 60_000)).toBe("Next move in 40 s");
    expect(waitText(100_000, 99_001)).toBe("Next move in 1 s");
    expect(waitText(100_000, 100_000)).toBeNull();
    expect(waitText(0, 5_000)).toBeNull();
  });

  it("says once, not every second, when the clock can move again (slice 17's review, finding 7)", () => {
    expect(movesAgainAt(Date.parse("2026-11-06T12:31:00Z"))).toBe("The clock can move on again at 23:31.");
  });

  it("keeps an opaque card, so its text holds 4.5:1 by the page's own colours (slice 17's review, finding 11)", () => {
    const css = readFileSync(join(process.cwd(), "src/style.css"), "utf8");
    const rule = /\.demo-bar \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain("background: var(--card)");
    expect(css).not.toMatch(/\.demo-bar[^{]*\{[^}]*backdrop-filter/);
  });

  it("says how far ahead in a few characters on a phone, so the bar keeps to one row (slice 17 part 2's review, finding 5)", () => {
    expect(aheadShort(0)).toBe("");
    expect(aheadShort(6 * 60_000)).toBe("+6m");
    expect(aheadShort(9.5 * HOUR)).toBe("+9h");
    expect(aheadShort(DAY)).toBe("+1d");
    expect(aheadShort(2 * DAY + 23.9 * HOUR)).toBe("+2d 23h");
    // Never longer than that, however far ahead.
    for (const ms of [59_000, 23.99 * HOUR, 9 * DAY + 23 * HOUR]) expect(aheadShort(ms).length).toBeLessThanOrEqual(8);
  });

  it("counts the bots", () => {
    expect(botsText(0)).toBe("No bots");
    expect(botsText(1)).toBe("1 bot");
    expect(botsText(4)).toBe("4 bots");
  });

  describe("its furniture sets (slice 17, part 2)", () => {
    /** The bar's elements as index.html has them, and what it sends. */
    function build(): { els: DemoBarEls; sent: ClientMsg[]; bar: DemoBar } {
      document.body.innerHTML = `
        <section id="demo-bar" hidden>
          <strong id="demo-time" tabindex="-1"></strong><span id="demo-ahead"></span>
          <button class="demo-toggle" aria-expanded="false" aria-controls="demo-times">Time</button>
          <button class="demo-toggle" aria-expanded="false" aria-controls="demo-furniture">Furniture</button>
          <div id="demo-times"><button id="demo-hour-on"></button><input id="demo-at" /><button id="demo-go"></button><button id="demo-canberra"></button><span id="demo-wait"></span></div>
          <div id="demo-furniture"><span id="demo-sets-wait" hidden></span></div>
          <div id="demo-bots"><button id="demo-remove-bot"></button><span id="demo-bot-count"></span><button id="demo-add-bot"></button></div>
        </section>`;
      const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
      const els: DemoBarEls = {
        bar: $("demo-bar"),
        time: $("demo-time"),
        ahead: $("demo-ahead"),
        wait: $("demo-wait"),
        toggles: [...document.querySelectorAll<HTMLButtonElement>(".demo-toggle")],
        hourOn: $("demo-hour-on"),
        at: $("demo-at"),
        go: $("demo-go"),
        canberra: $("demo-canberra"),
        sets: $("demo-furniture"),
        setsWait: $("demo-sets-wait"),
        botCount: $("demo-bot-count"),
        addBot: $("demo-add-bot"),
        removeBot: $("demo-remove-bot"),
      };
      const sent: ClientMsg[] = [];
      return { els, sent, bar: new DemoBar(els, (m) => sent.push(m)) };
    }

    const state = (layouts: { id: string; name: string }[], nextLayout = 0) =>
      ({ demo: true, ahead: 0, nextJump: 0, nextLayout, offset: 0, people: new Map(), layouts }) as unknown as CafeState;

    it("offers no set until the café can lay one out again, and says when (slice 17 part 2's review, finding 2)", () => {
      const { els, bar } = build();
      const sets = [{ id: "lap_time", name: "Lap time" }];
      bar.update(state(sets, 10_000), false, 4_000);
      expect(els.sets.querySelector("button")!.disabled).toBe(true);
      expect(els.setsWait.hidden).toBe(false);
      expect(els.setsWait.textContent).toBe("Next set in 6 s");
      bar.update(state(sets, 10_000), false, 10_000);
      expect(els.sets.querySelector("button")!.disabled).toBe(false);
      expect(els.setsWait.hidden).toBe(true);
    });

    it("offers one button per set, in the welcome's order, each laying it out", () => {
      const { els, sent, bar } = build();
      const sets = [
        { id: "opening_day", name: "Opening day" },
        { id: "lap_time", name: "Lap time" },
        { id: "play_room", name: "Play room" },
      ];
      bar.update(state(sets), false);
      const buttons = [...els.sets.querySelectorAll("button")];
      // The wait stays after the buttons.
      expect(els.sets.lastElementChild).toBe(els.setsWait);
      expect(buttons.map((b) => b.textContent)).toEqual(["Opening day", "Lap time", "Play room"]);
      expect(buttons.every((b) => b.type === "button")).toBe(true);
      buttons[1].click();
      expect(sent).toEqual([{ type: "layOut", set: "lap_time" }]);
      // The same sets again: the same buttons, so the keyboard's focus stays put.
      buttons[2].focus();
      bar.update(state(sets), false);
      expect([...els.sets.querySelectorAll("button")]).toEqual(buttons);
      expect(document.activeElement).toBe(buttons[2]);
    });

    it("closes its group once a set is chosen, and offers none while the café wakes", () => {
      const { els, bar } = build();
      bar.update(state([{ id: "lap_time", name: "Lap time" }]), false);
      const toggle = els.toggles[1];
      toggle.click();
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      els.sets.querySelector("button")!.click();
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      bar.update(state([{ id: "lap_time", name: "Lap time" }]), true);
      expect(els.sets.querySelector("button")!.disabled).toBe(true);
      bar.update(state([{ id: "lap_time", name: "Lap time" }]), false);
      expect(els.sets.querySelector("button")!.disabled).toBe(false);
    });
  });
});
