import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catSheet, decodePng } from "../../scripts/sprites";
import { parseSheet } from "../src/sprites";

// Slice 11: the cats' sprites are drawn as PNGs in content/sprites/png/,
// and scripts/sprites.ts turns them into the text sheet the client and
// cargo test read, as palettes.json is written by scripts/palettes.ts. A
// hand edit of the sheet, or a PNG changed and the script not run, shows
// here.

const repo = join(process.cwd(), "..");

describe("the cats' sheet", () => {
  it("is exactly what scripts/sprites.ts writes from the PNGs", () => {
    expect(readFileSync(join(repo, "content/sprites/cat.txt"), "utf8")).toBe(catSheet());
  });

  it("holds every frame of every build at 24 by 24, front and back", () => {
    const sheet = parseSheet(readFileSync(join(repo, "content/sprites/cat.txt"), "utf8"));
    const frames = ["sit", "walk_a", "walk_b", "back_sit", "back_walk_a", "back_walk_b", "nap", "eat", "play_a", "play_b", "perch", "held", "lap", "scratch", "knock", "greet"];
    for (const build of ["round"]) {
      for (const f of frames) {
        const grid = sheet.get(`${build}:${f}`);
        expect(grid, `${build}:${f}`).toBeDefined();
        expect([grid![0].length, grid!.length], `${build}:${f}`).toEqual([24, 24]);
      }
    }
  });

  it("refuses a PNG with a colour that isn't one of the coat's slots", () => {
    // A 1x1 PNG of pure red, which no coat has.
    const red = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");
    expect(decodePng(red).pixels[0]).toEqual([255, 0, 0, 255]);
    expect(() => catSheet({ round: { sit: red } })).toThrow(/round:sit.*#ff0000.*not one of the coat's/);
  });
});
