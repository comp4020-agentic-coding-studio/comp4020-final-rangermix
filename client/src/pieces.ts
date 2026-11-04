// The box a piece is drawn as, in tiles and room pixels (slice 13's review,
// finding 4): the drawing and the shadows both work from it, so a thin
// piece casts the shadow of what's drawn, not of its whole tile.

import type { FurnitureView } from "./protocol/FurnitureView";

/** How far in from its footprint's edges a small piece's block stands, in tiles. */
export const INSET: Record<string, number> = { plant: 0.28, toys: 0.32, bowls: 0.18, chair: 0.2, cat_bed: 0.12, box: 0.15, cushion: 0.15, scratching_post: 0.3, lamp: 0.3 };

/** A piece's block: where it stands on the floor (x, y, w, h, in tiles) and how tall it is (z, in room pixels). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

/**
 * The block a piece is drawn as: inset from its footprint, standing its
 * height; knocked over, lying across its footprint toward the viewer,
 * lower and longer.
 */
export function pieceBox(f: FurnitureView, heights: Record<string, number>): Box {
  const z = heights[f.kind] ?? 8;
  const i = INSET[f.kind] ?? 0.06;
  const [x, y, w, h] = [f.x + i, f.y + i, f.w - 2 * i, f.h - 2 * i];
  if (!f.toppled) return { x, y, w, h, z };
  const along = Math.min(f.w - 0.1, w * 1.8);
  return { x: f.x + (f.w - along) / 2, y: y + h * 0.25, w: along, h: h * 0.5, z: Math.max(2, Math.round(z / 3)) };
}
