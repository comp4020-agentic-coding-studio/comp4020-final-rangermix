import { describe, expect, it } from "vitest";
import catSheet from "../../content/sprites/cat.txt?raw";
import palettes from "../../content/sprites/palettes.json";
import { AVATARS, COLOURS, avatarPalette, parseSheet, toRgba } from "../src/sprites";

describe("sprites", () => {
  it("splits a sheet into named rectangles", () => {
    const sheet = parseSheet("== a\n0.\n.1\n\n== b\n22\n");
    expect([...sheet.keys()]).toEqual(["a", "b"]);
    expect(sheet.get("a")).toEqual([
      [0, -1],
      [-1, 1],
    ]);
  });

  it("refuses ragged rows and unknown pixels", () => {
    expect(() => parseSheet("== a\n00\n0\n")).toThrow(/rectangle/);
    expect(() => parseSheet("== a\n0x\n")).toThrow(/unknown pixel/);
  });

  it("colours pixels from the palette and leaves dots clear", () => {
    expect([...toRgba([[0, -1]], ["#ff8000"])]).toEqual([255, 128, 0, 255, 0, 0, 0, 0]);
  });

  it("draws every cat frame at 16 pixels, in every coat", () => {
    const sheet = parseSheet(catSheet);
    expect([...sheet.keys()].sort()).toEqual(["nap", "sit", "walk_a", "walk_b"]);
    for (const grid of sheet.values()) {
      expect([grid[0].length, grid.length]).toEqual([16, 16]);
      for (const coat of Object.values(palettes.coats)) expect(() => toRgba(grid, coat)).not.toThrow();
    }
  });

  it("offers four avatars in six colours", () => {
    expect([AVATARS, COLOURS]).toEqual([4, 6]);
    expect(avatarPalette({ avatar: 1, colour: 2 })).toHaveLength(7);
  });
});
