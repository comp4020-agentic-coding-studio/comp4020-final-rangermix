import type { Tile } from "./protocol/Tile";
import type { Walk } from "./protocol/Walk";

// Walks are sent once, as paths (design.md, "Real-time"); every client
// animates them from the same start time and speed.

/** Which side of a figure shows: its front, toward the viewer, or its back. */
export type View = "front" | "back";

export interface Spot {
  x: number;
  y: number;
  moving: boolean;
  /** The side that shows: a walker going up the screen, away from the viewer, shows its back (slice 12). */
  view: View;
  /** Whether the sprite, drawn facing right, is flipped to face left. */
  mirror: boolean;
}

/**
 * How a step from `a` to `b` looks from the camera's front-right corner
 * (iso.ts): +x goes up and right, -x down and left, +y down and right, -y up
 * and left. Up the screen is away from the viewer; leftward mirrors.
 */
export function stepView(a: Tile, b: Tile): { view: View; mirror: boolean } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // On screen: x grows with dx + dy, y with dy - dx.
  return { view: dy - dx < 0 ? "back" : "front", mirror: dx + dy < 0 };
}

/** Where a walker is at `serverNow`, in tiles: fractional while moving, facing the way the walk last went. */
export function positionAt(walk: Walk | null, at: Tile, serverNow: number): Spot {
  if (!walk || walk.path.length < 2) {
    const here = walk?.path[0] ?? at;
    return { x: here.x, y: here.y, moving: false, view: "front", mirror: false };
  }
  const steps = Math.max(0, ((serverNow - walk.start) * walk.speed) / 1000);
  const last = walk.path.length - 1;
  if (steps >= last) {
    const end = walk.path[last];
    return { x: end.x, y: end.y, moving: false, ...stepView(walk.path[last - 1], end) };
  }
  const i = Math.floor(steps);
  const f = steps - i;
  const a = walk.path[i];
  const b = walk.path[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, moving: true, ...stepView(a, b) };
}
