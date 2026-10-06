import type { Tile } from "./protocol/Tile";
import type { Walk } from "./protocol/Walk";

// Walks are sent once, as paths (design.md, "Real-time"); every client
// animates them from the same start time and speed.

export interface Spot {
  x: number;
  y: number;
  moving: boolean;
  facing: 1 | -1;
}

/** Where a walker is at `serverNow`, in tiles: fractional while moving. */
export function positionAt(walk: Walk | null, at: Tile, serverNow: number): Spot {
  if (!walk || walk.path.length === 0) return { x: at.x, y: at.y, moving: false, facing: 1 };
  const steps = Math.max(0, ((serverNow - walk.start) * walk.speed) / 1000);
  const last = walk.path.length - 1;
  if (steps >= last) {
    const end = walk.path[last];
    const before = walk.path[Math.max(0, last - 1)];
    return { x: end.x, y: end.y, moving: false, facing: end.x < before.x ? -1 : 1 };
  }
  const i = Math.floor(steps);
  const f = steps - i;
  const a = walk.path[i];
  const b = walk.path[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, moving: true, facing: b.x < a.x ? -1 : 1 };
}
