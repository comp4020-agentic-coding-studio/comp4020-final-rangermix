import { describe, expect, it } from "vitest";
import coats from "../../content/sprites/coats.json";
import palettes from "../../content/sprites/palettes.json";
import { day, night } from "../../scripts/palettes";

// Slice 10's review, finding 6: palettes.json is written by
// scripts/palettes.ts, so a hand edit or a forgotten run shows here; and a
// coat is data (content/sprites/coats.json), not code, as AGENTS.md asks.

describe("the café's palettes", () => {
  it("are exactly what scripts/palettes.ts writes", () => {
    expect(palettes).toEqual({ day, night });
  });

  it("take every coat's day colours from coats.json, and only derive the night's", () => {
    expect(palettes.day.coats).toEqual(coats);
    expect(Object.keys(palettes.night.coats).sort()).toEqual(Object.keys(coats).sort());
  });
});
