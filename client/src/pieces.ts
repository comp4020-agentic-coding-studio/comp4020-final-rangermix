// The box a piece is drawn as, in tiles and room pixels (slice 13's review,
// finding 4): the drawing and the shadows both work from it, so a thin
// piece casts the shadow of what's drawn, not of its whole tile.

import models from "../../content/sprites/furniture-models.json";
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

/** A part of a piece, as drawn: a box from `z0` to `z` room pixels up, in a furniture palette slot (or the kind's own colour). */
export interface Part extends Box {
  z0: number;
  slot: number | null;
}

type Model = { x: number; y: number; w: number; h: number; z0: number; z1: number; slot: number }[];
const MODELS = models as Record<string, Model>;

/**
 * The parts a piece is drawn as (slice 11): its kind's model
 * (content/sprites/furniture-models.json), boxes placed within its
 * footprint, in the order the model lists them; or, with no model or knocked over,
 * the one block `pieceBox` gives, in the kind's own colour.
 */
export function pieceParts(f: FurnitureView, heights: Record<string, number>): Part[] {
  const model = MODELS[f.kind];
  if (!model) return [{ ...pieceBox(f, heights), z0: 0, slot: null }];
  if (f.toppled) return lyingDown(f, model, heights);
  // In the model's own order: whoever draws a kind knows what's in front of
  // what (a post through two platforms isn't one sort), so the parts are
  // listed back to front and bottom to top, and drawn so.
  return model.map((m) => ({ x: f.x + m.x * f.w, y: f.y + m.y * f.h, w: m.w * f.w, h: m.h * f.h, z0: m.z0, z: m.z1, slot: m.slot }));
}

/** How many room pixels a tile is along the floor, for turning heights into lengths: a 32-px tile's true rise (shadows.ts). */
const TILE_PX = 16 * 2 * 0.6124;

/**
 * A knocked-over piece, its parts laid on their side toward the viewer
 * (slice 11's review, finding 9): what stood up from the floor now lies
 * along +y from the back of its footprint, its base at the back and its
 * top nearest the viewer, and what was its depth stands up as its height.
 * A tall plant lies as a long low pot and leaves; it stays on its tile.
 */
function lyingDown(f: FurnitureView, model: Model, heights: Record<string, number>): Part[] {
  const tall = Math.max(...model.map((m) => m.z1), heights[f.kind] ?? 8);
  // Its height laid along the tile, squeezed to fit inside the footprint.
  const along = Math.min(f.h * 0.9, tall / TILE_PX);
  const k = along / tall;
  const parts = model.map((m) => ({
    x: f.x + m.x * f.w,
    y: f.y + f.h * 0.05 + m.z0 * k,
    w: m.w * f.w,
    h: Math.max(0.04, (m.z1 - m.z0) * k),
    z0: m.y * f.h * TILE_PX * 0.5,
    z: (m.y + m.h) * f.h * TILE_PX * 0.5,
    slot: m.slot,
  }));
  // Back to front again, now along y: what was low (the base) is at the back.
  return parts.sort((a, b) => a.y - b.y || a.z0 - b.z0);
}

/**
 * How high the piece is under the middle of tile (x, y), in room pixels:
 * the top of the highest of its parts there (slice 11's review, finding 3),
 * so a cat on the tower's base sits on the base, not up at its cubby, and
 * someone on the sofa sits on its seat, not its back.
 */
export function topAt(f: FurnitureView, heights: Record<string, number>, x: number, y: number): number {
  const [cx, cy] = [x + 0.5, y + 0.5];
  const tops = pieceParts(f, heights)
    .filter((p) => cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h)
    .map((p) => p.z);
  return tops.length ? Math.max(...tops) : 0;
}
