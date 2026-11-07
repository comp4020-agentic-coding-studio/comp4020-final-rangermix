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

  // Slice 18: the balcony's colours, a list of their own by day and by
  // night: two stones, the slab's edge, the glass, the rail's metal, a
  // window dark and a window lit, which by day is the dark one's colour,
  // so the building's windows light only toward night, as the room's do.
  it("give the balcony seven colours, its windows lit only at night", () => {
    const balcony = (light: "day" | "night") => (palettes[light] as unknown as { balcony: string[] }).balcony;
    expect(balcony("day")).toHaveLength(7);
    expect(balcony("night")).toHaveLength(7);
    expect(balcony("day")[6], "a lit window by day is a dark one").toBe(balcony("day")[5]);
    expect(balcony("night")[6], "a lit window at night").not.toBe(balcony("night")[5]);
    // The two stones differ, so the deck reads as tiles.
    expect(balcony("day")[0]).not.toBe(balcony("day")[1]);
    expect(balcony("night")[0]).not.toBe(balcony("night")[1]);
  });

  it("take every coat's day colours from coats.json, and only derive the night's", () => {
    expect(palettes.day.coats).toEqual(coats);
    expect(Object.keys(palettes.night.coats).sort()).toEqual(Object.keys(coats).sort());
  });
});
