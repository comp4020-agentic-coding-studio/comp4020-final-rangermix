// Shadows and occlusion on the floor (slice 13, ADR 0019). The street wall's
// windows light the room, so each standing piece casts a shadow away from
// that wall, toward the viewer, and the wall itself shades the floor at its
// foot except where a pane lets the light through. The floor also darkens
// where it meets a wall or a piece. Worked out over the room's pixels at 1×,
// and kept while the furniture is the same: furniture moves seldom, frames
// come sixty times a second.

import { ISO, fromCanvas } from "./iso";
import type { FurnitureView } from "./protocol/FurnitureView";

/** What the floor shows at a pixel: lit, in a cast shadow, or darkened where it meets something. */
export const SHADE = { lit: 0, shadow: 1, occluded: 2 } as const;
export type Shade = (typeof SHADE)[keyof typeof SHADE];

export interface ShadowMask {
  /** The floor's shade at canvas pixel (x, y) at 1×. */
  at(x: number, y: number): Shade;
}

/**
 * Toward the light, in tiles: per tile risen, how far along x and y. From
 * the street wall (-y), a little from +x, up at a steep angle, as in the
 * study the look was chosen from (notes/art-style.md, 1b).
 */
const TOWARD = { x: 0.2 / 0.78, y: -0.6 / 0.78 };
/** How many room pixels a tile's height stands at 1×: a 32-px diamond's true rise. */
const TILE_HEIGHT = ISO.halfW * 2 * 0.6124;
/** How far a piece's foot, and a wall's, darkens the floor round it, in tiles. */
const FOOT = 0.08;
/** The street wall's height in tiles, and its window panes' bottom and top. */
const WALL = ISO.wall / TILE_HEIGHT;
const PANE = { from: 22 / TILE_HEIGHT, to: 48 / TILE_HEIGHT, inset: 0.1 };

interface Room {
  width: number;
  height: number;
  tiles: string[];
}

/** A standing piece as a box, in tiles: a toppled one lies lower and longer, as it's drawn. */
function boxOf(f: FurnitureView, heights: Record<string, number>): { x0: number; y0: number; x1: number; y1: number; z: number } | null {
  if (f.under) return null;
  const z = (heights[f.kind] ?? 8) / TILE_HEIGHT;
  if (z <= 0.1) return null;
  if (f.toppled) return { x0: f.x + 0.05, y0: f.y + f.h * 0.25, x1: f.x + f.w - 0.05, y1: f.y + f.h * 0.75, z: Math.max(2, z * TILE_HEIGHT / 3) / TILE_HEIGHT };
  return { x0: f.x + 0.06, y0: f.y + 0.06, x1: f.x + f.w - 0.06, y1: f.y + f.h - 0.06, z };
}

/** Whether the ray from floor point (x, y) toward the light meets the box before rising over it. */
function blocks(b: { x0: number; y0: number; x1: number; y1: number; z: number }, x: number, y: number): boolean {
  let lo = 0;
  let hi = b.z;
  for (const [p, d, a0, a1] of [
    [x, TOWARD.x, b.x0, b.x1],
    [y, TOWARD.y, b.y0, b.y1],
  ] as const) {
    if (d === 0) {
      if (p < a0 || p > a1) return false;
      continue;
    }
    const t0 = (a0 - p) / d;
    const t1 = (a1 - p) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
  }
  return hi > lo;
}

/** Whether the ray from (x, y) toward the light passes the street wall below its top, and not through a pane. */
function wallShades(room: Room, x: number, y: number): boolean {
  // The wall stands along y = 1; the ray reaches it after rising (y - 1) / -TOWARD.y tiles.
  const z = (y - 1) / -TOWARD.y;
  if (z < 0 || z >= WALL) return false;
  const along = x + z * TOWARD.x;
  const col = Math.floor(along);
  const f = along - col;
  const isPane = room.tiles[0]?.[col] === "G" && f > PANE.inset && f < 1 - PANE.inset && z > PANE.from && z < PANE.to;
  return !isPane;
}

let last: { key: string; mask: ShadowMask } | null = null;

/**
 * The floor's shades for this room and furniture: a new mask when a piece
 * has moved, fallen or been added or taken away, the same one otherwise.
 */
export function shadowMask(room: Room, furniture: FurnitureView[], heights: Record<string, number>): ShadowMask {
  const key = `${room.width}x${room.height}:${room.tiles[0]}:${furniture.map((f) => `${f.kind}@${f.x},${f.y},${f.w},${f.h}${f.toppled ? "t" : ""}`).join(";")}`;
  if (last?.key === key) return last.mask;
  const boxes = furniture.map((f) => boxOf(f, heights)).filter((b) => b !== null);
  const grid = new Uint8Array(ISO.width * ISO.height);
  for (let py = 0; py < ISO.height; py++) {
    for (let px = 0; px < ISO.width; px++) {
      const { gx, gy } = fromCanvas(px + 0.5, py + 0.5);
      if (gx < 0 || gx > room.width || gy < 1 || gy > room.height) continue;
      let shade: Shade = SHADE.lit;
      if (wallShades(room, gx, gy) || boxes.some((b) => blocks(b, gx, gy))) shade = SHADE.shadow;
      else if (gy - 1 < FOOT || room.width - gx < FOOT || boxes.some((b) => Math.max(b.x0 - gx, gx - b.x1, b.y0 - gy, gy - b.y1) < FOOT)) shade = SHADE.occluded;
      grid[py * ISO.width + px] = shade;
    }
  }
  const mask: ShadowMask = { at: (x, y) => (x < 0 || y < 0 || x >= ISO.width || y >= ISO.height ? SHADE.lit : (grid[y * ISO.width + x] as Shade)) };
  last = { key, mask };
  return mask;
}
