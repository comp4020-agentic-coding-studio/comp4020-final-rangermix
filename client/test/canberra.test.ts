import { describe, expect, it } from "vitest";
import { cafeHour, canberraHour, jumpText, lightAt } from "../src/canberra";

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

  // Slice 17: the café's clock is the server's, which a demo account can
  // move on; the device's clock only says how much time has passed.
  it("takes the café's hour from the server, not the device", () => {
    const device = Date.parse("2026-11-06T03:00:00Z"); // 14:00 in Canberra
    expect(cafeHour(null, device)).toBe(14);
    expect(cafeHour({ offset: 0 }, device)).toBe(14);
    expect(cafeHour({ offset: 9.5 * 3_600_000 }, device)).toBe(23);
    expect(cafeHour({ offset: -15 * 3_600_000 }, device)).toBe(23);
  });

  it("says who moved the café on, and to when", () => {
    expect(jumpText("demo1", Date.parse("2026-11-06T12:30:00Z"))).toBe("demo1 moved the café on to 23:30. Time passes…");
    expect(jumpText("demo2", Date.parse("2026-11-06T20:00:00Z"))).toBe("demo2 moved the café on to 07:00. Time passes…");
  });
});
