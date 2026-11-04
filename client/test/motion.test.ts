import { describe, expect, it } from "vitest";
import { positionAt } from "../src/motion";

const walk = { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], start: 1000, speed: 2 };

describe("walks between tiles", () => {
  it("is halfway along the first step a quarter of a second in", () => {
    expect(positionAt(walk, { x: 9, y: 9 }, 1250)).toMatchObject({ x: 0.5, y: 0, moving: true });
  });
  it("arrives, and stops, when the path runs out", () => {
    expect(positionAt(walk, { x: 9, y: 9 }, 2000)).toMatchObject({ x: 1, y: 1, moving: false });
  });
  it("stands where it is without a walk, facing the viewer", () => {
    expect(positionAt(null, { x: 4, y: 5 }, 0)).toEqual({ x: 4, y: 5, moving: false, view: "front", mirror: false });
  });
});

// Slice 12: a walker faces the way they go on screen. From the camera's
// front-right corner (iso.ts), +x goes up and right, -x down and left, +y
// down and right, -y up and left. Up the screen is away from the viewer, so
// it shows the back; the sprites face right, so going left mirrors them.

describe("facing the way you go on screen", () => {
  const step = (dx: number, dy: number) => ({ path: [{ x: 5, y: 5 }, { x: 5 + dx, y: 5 + dy }], start: 0, speed: 1 });
  const cases: [string, number, number, "front" | "back", boolean][] = [
    ["along x, up and right", 1, 0, "back", false],
    ["back along x, down and left", -1, 0, "front", true],
    ["along y, down and right", 0, 1, "front", false],
    ["toward the street wall, up and left", 0, -1, "back", true],
  ];
  for (const [name, dx, dy, view, mirror] of cases) {
    it(`walking ${name} shows the ${view}${mirror ? ", mirrored" : ""}`, () => {
      expect(positionAt(step(dx, dy), { x: 5, y: 5 }, 500)).toMatchObject({ moving: true, view, mirror });
    });
    it(`stopping after a step ${name} keeps that view`, () => {
      expect(positionAt(step(dx, dy), { x: 5, y: 5 }, 5000)).toMatchObject({ moving: false, view, mirror });
    });
  }
});
