import { describe, expect, it } from "vitest";
import { positionAt } from "../src/motion";

const walk = { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], start: 1000, speed: 2 };

describe("walks between tiles", () => {
  it("is halfway along the first step a quarter of a second in", () => {
    expect(positionAt(walk, { x: 9, y: 9 }, 1250)).toEqual({ x: 0.5, y: 0, moving: true, facing: 1 });
  });
  it("arrives, and stops, when the path runs out", () => {
    expect(positionAt(walk, { x: 9, y: 9 }, 2000)).toMatchObject({ x: 1, y: 1, moving: false });
  });
  it("faces left when walking left", () => {
    const left = { path: [{ x: 3, y: 0 }, { x: 2, y: 0 }], start: 0, speed: 1 };
    expect(positionAt(left, { x: 3, y: 0 }, 500).facing).toBe(-1);
  });
  it("stands where it is without a walk", () => {
    expect(positionAt(null, { x: 4, y: 5 }, 0)).toEqual({ x: 4, y: 5, moving: false, facing: 1 });
  });
});
