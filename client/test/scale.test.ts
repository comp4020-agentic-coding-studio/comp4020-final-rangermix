import { describe, expect, it } from "vitest";
import { fitScale } from "../src/scale";

describe("whole-number scaling", () => {
  it("fits the room at 2× across a 390-pixel phone", () => {
    expect(fitScale(390, Infinity, 12, 10)).toBe(2);
  });
  it("fits it at 5× in the middle of a 1920×1080 desktop", () => {
    expect(fitScale(1296, 947, 12, 10)).toBe(5);
  });
  it("uses an exact fit and never drops below 1×", () => {
    expect(fitScale(384, 320, 12, 10)).toBe(2);
    expect(fitScale(100, 100, 12, 10)).toBe(1);
  });
});
