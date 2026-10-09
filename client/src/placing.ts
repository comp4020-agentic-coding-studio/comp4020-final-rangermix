import type { FurnitureView } from "./protocol/FurnitureView";
import type { RoomView } from "./protocol/RoomView";

type Tile = { x: number; y: number };

const covers = (f: FurnitureView, t: Tile) => t.x >= f.x && t.x < f.x + f.w && t.y >= f.y && t.y < f.y + f.h;

/**
 * A guess at whether `piece` could go with its top-left at `to`, to tint the
 * preview while placing. The server decides (it also keeps the café from being
 * cut off, which this doesn't try): on the floor, off the door's walkway, not
 * over another piece unless one is a rug, and a blocking piece not on anyone.
 */
export function guessPlace(room: RoomView, piece: FurnitureView, to: Tile, people: Tile[]): boolean {
  if (to.x < 0 || to.y < 0 || to.x + piece.w > room.width || to.y + piece.h > room.height) return false;
  for (let y = to.y; y < to.y + piece.h; y++) {
    for (let x = to.x; x < to.x + piece.w; x++) {
      const t = { x, y };
      if (room.tiles[y]?.[x] !== ".") return false;
      if (room.walkway.some((w) => w.x === x && w.y === y)) return false;
      if (room.furniture.some((f) => f.id !== piece.id && covers(f, t) && f.under === piece.under)) return false;
      if (piece.blocks && people.some((p) => p.x === x && p.y === y)) return false;
    }
  }
  return true;
}
