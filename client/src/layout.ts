// The phone's two layouts (design.md, "The client"): A shows the whole room on
// top with everything else below; B fills the screen with the room at 3x,
// pans to follow you, floats the controls, and opens actions as a ring.

export type Layout = "a" | "b";

const KEY = "cafe.layout";

/** The layout in use: B only on a phone, and only if this device chose it. */
export function chooseLayout(saved: string | null, phone: boolean): Layout {
  return phone && saved === "b" ? "b" : "a";
}

export function savedLayout(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(KEY, layout);
  } catch {
    // Without storage the choice lasts this visit only.
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** One axis of the pan: follow `you`, stop at the edges, centre a room smaller than the view. */
function axis(you: number, view: number, room: number): number {
  if (room <= view) return Math.round((room - view) / 2);
  return Math.round(clamp(you - view / 2, 0, room - view));
}

/**
 * How far to shift the room (in CSS pixels) so `you` sits in the middle of
 * the view, never showing past the room's edges; a room smaller than the
 * view sits in its middle (a negative shift).
 */
export function panOffset(you: { x: number; y: number }, view: { w: number; h: number }, room: { w: number; h: number }): { x: number; y: number } {
  return { x: axis(you.x, view.w, room.w), y: axis(you.y, view.h, room.h) };
}

/** A ring wide enough that `n` buttons `size` pixels across never touch. */
export function ringRadius(n: number, size: number): number {
  const gap = 8;
  return n < 2 ? 72 : Math.max(72, Math.ceil((size + gap) / (2 * Math.sin(Math.PI / n))));
}

type Free = { left: number; top: number; right: number; bottom: number };

/**
 * Where a ring of `radius`, with buttons `size` pixels across, can sit within
 * `free`, the part of the screen the floating bars leave clear: round
 * `centre` if it fits there, or the nearest spot where it does.
 */
export function ringCentre(centre: { x: number; y: number }, radius: number, free: Free, size: number): { x: number; y: number } {
  const margin = radius + size / 2;
  return { x: clamp(centre.x, free.left + margin, free.right - margin), y: clamp(centre.y, free.top + margin, free.bottom - margin) };
}

/**
 * Where a desktop menu `menu` big goes in a `stage` big, beside the tile whose
 * edges are `tile`: to its right, or its left if the right has no room, and
 * up from the tile's top as far as it must so none of it hangs below the
 * stage, where it would be cut off under the talk bar. One taller than the
 * stage starts at its top.
 */
export function menuSpot(
  tile: { left: number; right: number; top: number },
  menu: { w: number; h: number },
  stage: { w: number; h: number },
): { left: number; top: number } {
  const gap = 4;
  const right = tile.right + gap;
  const left = right + menu.w <= stage.w ? right : tile.left - gap - menu.w;
  return { left: clamp(left, 0, Math.max(0, stage.w - menu.w)), top: clamp(tile.top, 0, Math.max(0, stage.h - menu.h)) };
}

/**
 * Centres for `n` buttons of `size` pixels on a circle of `radius` round
 * `centre`, starting at the top; the whole ring moves to stay within `free`.
 */
export function ringPositions(n: number, centre: { x: number; y: number }, radius: number, free: Free, size: number): { x: number; y: number }[] {
  const { x: cx, y: cy } = ringCentre(centre, radius, free, size);
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}
