import { describe, expect, it } from "vitest";
import { fitScale } from "../src/scale";

// The room at an angle is a 336 by 232 canvas at 1x (slice 09).
describe("whole-number scaling", () => {
  it("fits the room at 1× across a 390-pixel phone, which is why a phone opens in layout B", () => {
    expect(fitScale(390, Infinity)).toBe(1);
  });
  it("fits it at 3× in the middle of a 1920×1080 desktop", () => {
    expect(fitScale(1296, 947)).toBe(3);
  });
  it("uses an exact fit and never drops below 1×", () => {
    expect(fitScale(672, 464)).toBe(2);
    expect(fitScale(100, 100)).toBe(1);
  });
});
