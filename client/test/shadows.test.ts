import { describe, expect, it } from "vitest";
import { toCanvas } from "../src/iso";
import type { FurnitureView } from "../src/protocol/FurnitureView";
import { SHADE, shadowMask } from "../src/shadows";

// Slice 13 (ADR 0019): the windows on the street wall light the room, so
// pieces cast shadows away from it, across the floor toward the viewer; the
// panes let the light through where the wall beside them doesn't; and the
// floor darkens where it meets a wall or a piece's foot. Worked out over the
// room's pixels when the furniture changes, not every frame.

const room = { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")] };
const heights = { cat_tower: 44, sofa: 16, box: 12, rug: 1 };
const piece = (kind: string, x: number, y: number, w = 1, h = 1, extra: Partial<FurnitureView> = {}): FurnitureView => ({
  id: x * 100 + y,
  kind,
  x,
  y,
  w,
  h,
  movable: true,
  blocks: kind !== "rug",
  under: kind === "rug",
  seats: false,
  toppled: false,
  ...extra,
});
/** The mask's value on the floor at grid point (gx, gy). */
const at = (mask: ReturnType<typeof shadowMask>, gx: number, gy: number) => {
  const p = toCanvas(gx, gy);
  return mask.at(Math.floor(p.x), Math.floor(p.y));
};

describe("shadows from the windows", () => {
  it("leaves the open floor lit", () => {
    const mask = shadowMask(room, [], heights);
    expect(at(mask, 6.5, 6.5)).toBe(SHADE.lit);
  });

  it("casts a tall piece's shadow away from the street wall, toward the viewer, not toward the wall", () => {
    const mask = shadowMask(room, [piece("cat_tower", 6, 4, 2, 2)], heights);
    // Behind it, toward the wall: lit. In front of it, away from the wall: shadow.
    expect(at(mask, 7, 3.6)).toBe(SHADE.lit);
    expect(at(mask, 7, 6.6)).toBe(SHADE.shadow);
  });

  it("moves a piece's shadow when the piece moves", () => {
    const here = shadowMask(room, [piece("cat_tower", 2, 4, 2, 2)], heights);
    const there = shadowMask(room, [piece("cat_tower", 8, 4, 2, 2)], heights);
    expect(at(here, 3, 6.6)).toBe(SHADE.shadow);
    expect(at(there, 3, 6.6)).not.toBe(SHADE.shadow);
    expect(at(there, 9, 6.6)).toBe(SHADE.shadow);
  });

  it("casts nothing from a rug, which lies flat", () => {
    const mask = shadowMask(room, [piece("rug", 4, 4, 4, 3)], heights);
    expect(at(mask, 6, 7.4)).toBe(SHADE.lit);
  });

  it("lets the light through a window pane onto the floor in front of it, where the plain wall beside it shades", () => {
    const mask = shadowMask(room, [], heights);
    // The light comes down steeply, so what comes through a pane, between
    // its sill and its top, lands a tile or two in front of the wall; the
    // wall below the sill shades the strip at its foot. Column 3 is a window
    // (G); columns 0 and 1 are plain wall (W). The light comes from a little
    // toward +x, so a floor point looks up at the wall a little to its right:
    // from (3.9, 2.4) at about x = 4.4, a pane; from (0.9, 2.4) at about
    // x = 1.4, plain wall.
    expect(at(mask, 3.9, 2.4)).toBe(SHADE.lit);
    expect(at(mask, 0.9, 2.4)).toBe(SHADE.shadow);
    // Right at the window's foot, below the sill: the wall shades it.
    expect(at(mask, 3.5, 1.3)).toBe(SHADE.shadow);
  });

  it("darkens the floor where it meets a wall or a piece's foot", () => {
    const mask = shadowMask(room, [piece("box", 6, 6)], heights);
    // Right at the plain wall's foot: darkened, by its foot or by its shade
    // (slice 13's review, finding 8, shades the strip beside it).
    expect([SHADE.occluded, SHADE.shadow]).toContain(at(mask, 11.97, 6.5));
    expect(at(mask, 8.5, 4.5), "the open floor, away from the walls and the box").toBe(SHADE.lit);
    // Right against the box's front face, before its shadow begins.
    expect([SHADE.occluded, SHADE.shadow]).toContain(at(mask, 6.5, 7.15));
  });
});

describe("worked out when the furniture changes, not every frame", () => {
  it("gives back the same mask while the furniture is unchanged, and a new one when a piece moves or falls", () => {
    const pieces = [piece("sofa", 0, 5, 3, 1)];
    const first = shadowMask(room, pieces, heights);
    expect(shadowMask(room, [piece("sofa", 0, 5, 3, 1)], heights)).toBe(first);
    expect(shadowMask(room, [piece("sofa", 4, 5, 3, 1)], heights)).not.toBe(first);
    expect(shadowMask(room, [piece("sofa", 0, 5, 3, 1, { toppled: true })], heights)).not.toBe(first);
  });
});

describe("shadows as the pieces are drawn (slice 13's review)", () => {
  it("casts a thin piece's shadow from its own narrow block, not its whole tile, and only away from the windows (finding 4)", () => {
    // A lamp is drawn 0.3 tiles in from its tile's edges (render.ts's insets): from 6.3 to 6.7.
    const mask = shadowMask(room, [piece("lamp", 6, 5)], { lamp: 28 });
    // Between its back face and the windows, and beside it: lit.
    expect(at(mask, 6.5, 5.12)).toBe(SHADE.lit);
    expect(at(mask, 6.12, 5.5)).toBe(SHADE.lit);
    // In front of it, away from the windows, and a little toward -x as
    // the light leans toward +x: its shadow, a strip as narrow as the lamp.
    expect(at(mask, 6.25, 6.2)).toBe(SHADE.shadow);
    expect(at(mask, 6.75, 6.2), "past the strip's edge").toBe(SHADE.lit);
  });

  it("darkens the floor at a thin piece's own foot, not a ring a tile wide round it (finding 4)", () => {
    const mask = shadowMask(room, [piece("plant", 3, 7)], { plant: 22 });
    // A plant's foot is its pot (slice 11's model: 0.3 to 0.7 of its tile).
    expect(at(mask, 3.26, 7.5), "just off the pot's left side").not.toBe(SHADE.lit);
    expect(at(mask, 3.1, 7.5), "a ring 0.2 out from it").toBe(SHADE.lit);
  });

  it("lies a toppled piece's shadow along it as it lies, longer and lower (finding 4)", () => {
    // A toppled plant lies across its tile, 0.25 to 0.75 of the way down it.
    const standing = shadowMask(room, [piece("plant", 3, 7)], { plant: 22 });
    const fallen = shadowMask(room, [piece("plant", 3, 7, 1, 1, { toppled: true })], { plant: 22 });
    expect(at(standing, 3.25, 8.4), "a standing plant's long shadow").toBe(SHADE.shadow);
    expect(at(fallen, 3.25, 8.4), "a lying plant casts a short one").toBe(SHADE.lit);
  });

  it("shades the floor beside the plain wall, where the light comes over it from the side (finding 8)", () => {
    const mask = shadowMask(room, [], heights);
    // The light leans toward +x, so near the plain wall at x = 12 the ray
    // leaves through that wall below its top.
    expect(at(mask, 11.5, 6)).toBe(SHADE.shadow);
    expect(at(mask, 11.3, 6)).toBe(SHADE.shadow);
    // Well away from it, the open floor is lit.
    expect(at(mask, 8, 6)).toBe(SHADE.lit);
  });
});
