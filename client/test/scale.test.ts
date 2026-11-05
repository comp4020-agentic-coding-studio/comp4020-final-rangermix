import { describe, expect, it } from "vitest";
import { fitScale } from "../src/scale";

// The room at an angle is (w + d) × 16 by (w + d) × 8 + 64 at 1×: 400 by
// 264 for the 13 by 12 floor (slice 16).
describe("whole-number scaling", () => {
  it("fits the room at 4× in the 1920×1080 viewport the course marks at, with the bars floating over it (slice 16)", () => {
    // The window less 8 px each side.
    expect(fitScale(1904, 1064)).toBe(4);
    // With the status and talk bars in rows, as before slice 16, it was 3×.
    expect(fitScale(1904, 966)).toBe(3);
  });
  it("is 1× across a 390-pixel phone at its narrowest, even with the room 10 px wider than it (the phone's layout A cuts its corners)", () => {
    expect(fitScale(390, Infinity)).toBe(1);
  });
  it("uses an exact fit and never drops below 1×", () => {
    expect(fitScale(800, 528)).toBe(2);
    expect(fitScale(799, 528)).toBe(1);
    expect(fitScale(100, 100)).toBe(1);
  });
});
