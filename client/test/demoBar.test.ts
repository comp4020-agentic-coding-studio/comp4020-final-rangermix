import { describe, expect, it } from "vitest";
import { PRESETS, aheadText, botsText, clockText, hourOn, minuteOf, waitText } from "../src/demoBar";

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

  it("counts the bots", () => {
    expect(botsText(0)).toBe("No bots");
    expect(botsText(1)).toBe("1 bot");
    expect(botsText(4)).toBe("4 bots");
  });
});
