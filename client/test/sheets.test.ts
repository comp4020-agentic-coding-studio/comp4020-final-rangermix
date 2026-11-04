import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catSheet, decodePng, personSheet } from "../../scripts/sprites";
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

  it("is matched by the people's sheet: exactly what scripts/sprites.ts writes, every frame 32 by 32", () => {
    const text = readFileSync(join(repo, "content/sprites/avatar.txt"), "utf8");
    expect(text).toBe(personSheet());
    const sheet = parseSheet(text);
    for (const f of ["stand", "walk_a", "walk_b", "back", "back_walk_a", "back_walk_b"]) {
      expect([sheet.get(f)![0].length, sheet.get(f)!.length], f).toEqual([32, 32]);
    }
  });

  it("has no stray pixels: each frame drawn in one piece (slice 11's review, finding 15)", () => {
    for (const file of ["cat.txt", "avatar.txt"]) {
      for (const [name, grid] of parseSheet(readFileSync(join(repo, "content/sprites", file), "utf8"))) {
        // Flood from the first drawn pixel across its eight neighbours: every drawn pixel is reached.
        const drawn = grid.flatMap((row, y) => row.flatMap((v, x) => (v >= 0 ? [[x, y]] : [])));
        const seen = new Set<string>();
        const stack = [drawn[0]];
        while (stack.length) {
          const [x, y] = stack.pop()!;
          const key = `${x},${y}`;
          if (seen.has(key) || (grid[y]?.[x] ?? -1) < 0) continue;
          seen.add(key);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) stack.push([x + dx, y + dy]);
        }
        expect(seen.size, `${file} ${name}: pixels apart from the rest`).toBe(drawn.length);
      }
    }
  });

  it("shows no face on a cat's back view (slice 11's review, finding 19)", () => {
    for (const [name, grid] of parseSheet(readFileSync(join(repo, "content/sprites/cat.txt"), "utf8"))) {
      if (!name.split(":")[1].startsWith("back_")) continue;
      expect(grid.flat().includes(4), `${name} has eye pixels`).toBe(false);
    }
  });

  it("reads only the build folders, whatever else the folder holds (slice 11's review, finding 17)", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { readPngs } = await import("../../scripts/sprites");
    const dir = mkdtempSync(join(tmpdir(), "png-"));
    mkdirSync(join(dir, "round"));
    copyFileSync(join(repo, "content/sprites/png/cat/round/sit.png"), join(dir, "round/sit.png"));
    writeFileSync(join(dir, ".DS_Store"), "Finder's notes");
    writeFileSync(join(dir, "round/.DS_Store"), "and here");
    expect(Object.keys(readPngs(dir))).toEqual(["round"]);
    expect(Object.keys(readPngs(dir).round)).toEqual(["sit"]);
  });
});
