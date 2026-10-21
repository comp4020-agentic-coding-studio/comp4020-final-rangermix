import { describe, expect, it } from "vitest";
import { canberraHour, lightAt } from "../src/canberra";

describe("the Canberra clock", () => {
  it("reads the hour across daylight saving", () => {
    expect(canberraHour(new Date("2026-10-06T13:48:15Z"))).toBe(0);
    expect(canberraHour(new Date("2026-07-01T00:00:00Z"))).toBe(10);
  });

  // Slice 10: how far toward night the light is, by "Numbers to tune":
  // morning from 6, afternoon from 12, evening from 17, night from 21. The
  // afternoon keeps the day's colours; the evening is halfway.
  it("is day in the morning and the afternoon, halfway in the evening, and night from 21 till 6", () => {
    for (const h of [6, 9, 12, 13, 16]) expect(lightAt(h), `${h}:00`).toBe(0);
    for (const h of [17, 18, 20]) expect(lightAt(h), `${h}:00`).toBe(0.5);
    for (const h of [21, 22, 23, 0, 3, 5]) expect(lightAt(h), `${h}:00`).toBe(1);
  });
});
