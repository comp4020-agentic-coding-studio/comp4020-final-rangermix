import { describe, expect, it } from "vitest";
import avatarSheet from "../../content/sprites/avatar.txt?raw";
import catSheet from "../../content/sprites/cat.txt?raw";
import emoteSheet from "../../content/sprites/emotes.txt?raw";
import furnitureSheet from "../../content/sprites/furniture.txt?raw";
import palettes from "../../content/sprites/palettes.json";
import roomSheet from "../../content/sprites/room.txt?raw";
import { AVATARS, COLOURS, avatarPalette, paletteAt, parseSheet, toRgba } from "../src/sprites";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

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

  it("offers four avatars in six colours", () => {
    expect([AVATARS, COLOURS]).toEqual([4, 6]);
    expect(avatarPalette({ avatar: 1, colour: 2 }, 0)).toHaveLength(7);
  });
});

// Slice 10: the colours by day and by night, Catppuccin-led.
describe("the café's colours in each light", () => {
  it("is the day palette by day and the night palette at night", () => {
    expect(paletteAt(0)).toEqual(palettes.day);
    expect(paletteAt(1)).toEqual(palettes.night);
  });

  it("is halfway between them in the evening, slot by slot", () => {
    const evening = paletteAt(0.5);
    const between = (a: string, b: string, c: string) =>
      [1, 3, 5].every((i) => {
        const [x, y, z] = [a, b, c].map((h) => Number.parseInt(h.slice(i, i + 2), 16));
        return z >= Math.min(x, y) - 1 && z <= Math.max(x, y) + 1;
      });
    palettes.day.room.forEach((c, i) => expect(between(c, palettes.night.room[i], evening.room[i]), `room ${i}`).toBe(true));
    expect(evening.room[0]).not.toBe(palettes.day.room[0]);
    expect(evening.room[0]).not.toBe(palettes.night.room[0]);
  });

  it("colours every sprite in every light, with no missing slot", () => {
    for (const light of [0, 0.5, 1]) {
      const p = paletteAt(light);
      for (const grid of parseSheet(roomSheet).values()) expect(() => toRgba(grid, p.room)).not.toThrow();
      for (const grid of parseSheet(furnitureSheet).values()) expect(() => toRgba(grid, p.furniture)).not.toThrow();
      for (const grid of parseSheet(emoteSheet).values()) expect(() => toRgba(grid, p.emotes)).not.toThrow();
      for (const grid of parseSheet(catSheet).values()) for (const coat of Object.values(p.coats)) expect(() => toRgba(grid, coat)).not.toThrow();
      for (const grid of parseSheet(avatarSheet).values()) {
        for (let avatar = 0; avatar < AVATARS; avatar++) for (let colour = 0; colour < COLOURS; colour++) expect(() => toRgba(grid, avatarPalette({ avatar, colour }, light))).not.toThrow();
      }
    }
  });

  it("lights the window at night, brighter than by day, while the room sinks", () => {
    // Room slot 8 is the window's glass, slot 0 the floor (render.ts).
    expect(luminance(palettes.night.room[8])).toBeGreaterThan(luminance(palettes.day.room[8]));
    expect(luminance(palettes.night.room[0])).toBeLessThan(luminance(palettes.day.room[0]));
  });

  it("draws every cat frame at 16 pixels", () => {
    const sheet = parseSheet(catSheet);
    expect([...sheet.keys()].sort()).toEqual(["nap", "sit", "walk_a", "walk_b"]);
    for (const grid of sheet.values()) expect([grid[0].length, grid.length]).toEqual([16, 16]);
  });
});
