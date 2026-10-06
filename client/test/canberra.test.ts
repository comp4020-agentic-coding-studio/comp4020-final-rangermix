import { describe, expect, it } from "vitest";
import { canberraHour, nightTint } from "../src/canberra";

describe("the Canberra clock", () => {
  it("reads the hour across daylight saving", () => {
    expect(canberraHour(new Date("2026-10-06T13:48:15Z"))).toBe(0);
    expect(canberraHour(new Date("2026-07-01T00:00:00Z"))).toBe(10);
  });
  it("leaves the morning clear and darkens the evening, then the night", () => {
    expect(nightTint(9)).toBeNull();
    const afternoon = nightTint(13)!.alpha;
    const evening = nightTint(18)!.alpha;
    const night = nightTint(23)!.alpha;
    expect(afternoon).toBeLessThan(evening);
    expect(evening).toBeLessThan(night);
    expect(nightTint(3)).toEqual(nightTint(23));
  });
});
