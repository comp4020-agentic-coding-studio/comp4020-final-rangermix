// The phone's two layouts (design.md, "The client"): A shows the whole room on
// top with everything else below; B fills the screen with the room at 3x,
// pans to follow you, floats the controls, and opens actions as a ring.

export type Layout = "a" | "b";

/**
 * Narrower than this, the page is laid out as on a phone. The desktop's
 * panels take about 624 px, and the room at an angle needs 336 more at 1x,
 * so below 960 it's a phone's layouts, with the switch (slice 09's review,
 * finding 10). Kept in step with style.css's media queries.
 */
export const PHONE = "(max-width: 959px)";

const KEY = "cafe.layout";

/**
 * The layout in use: B on a phone, unless this device chose the whole room;
 * A everywhere else. The room at an angle fits a phone's width only at 1x,
 * so B is where a phone starts (slice 09).
 */
export function chooseLayout(saved: string | null, phone: boolean): Layout {
  return phone && saved !== "a" ? "b" : "a";
}

/** This visit's choice, for a device that won't store it. */
let thisVisit: Layout | null = null;

export function savedLayout(): string | null {
  try {
    return localStorage.getItem(KEY) ?? thisVisit;
  } catch {
    return thisVisit;
  }
}

export function saveLayout(layout: Layout): void {
  thisVisit = layout;
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
  // The view's middle as a whole pixel, so at an odd width what's followed
  // holds one pixel rather than turning between two by its own fraction
  // (slice 12's review, finding 7).
  return Math.round(clamp(you - Math.floor(view / 2), 0, room - view));
}

/** How far inside the free band what's followed is kept, in CSS pixels. */
const CLEAR = 24;

/**
 * How far to shift the room (in CSS pixels) so `you` sits in the middle of
 * the view, never showing past the room's edges; a room smaller than the
 * view sits in its middle (a negative shift). Given `free`, the band of the
 * view the floating bars leave clear, a room shorter than the view moves up
 * or down just enough to keep `you` inside it (slice 09's review, finding 9).
 */
export function panOffset(
  you: { x: number; y: number },
  view: { w: number; h: number },
  room: { w: number; h: number },
  free?: { top: number; bottom: number },
): { x: number; y: number } {
  let y = axis(you.y, view.h, room.h);
  if (free && room.h <= view.h) {
    const on = you.y - y;
    if (on > free.bottom - CLEAR) y += on - (free.bottom - CLEAR);
    else if (on < free.top + CLEAR) y -= free.top + CLEAR - on;
  }
  return { x: axis(you.x, view.w, room.w), y: Math.round(y) };
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

/**
 * Where a floating panel is (slice 14): how far it stands from the stage's
 * nearer side on each axis, so one in the top-right corner stays there when
 * the window widens.
 */
export interface PanelSpot {
  h: "left" | "right";
  x: number;
  v: "top" | "bottom";
  y: number;
}

/**
 * A panel's top-left corner in the window, for a panel `size` big at `spot`
 * over `stage` (the stage's box in the window): always inside the stage,
 * and at its top-left if the panel is bigger than it, so no panel covers
 * the status bar or the talk box, or is lost off the window after a resize.
 */
export function panelAt(spot: PanelSpot, size: { w: number; h: number }, stage: { left: number; top: number; width: number; height: number }): { left: number; top: number } {
  const left = spot.h === "left" ? stage.left + spot.x : stage.left + stage.width - spot.x - size.w;
  const top = spot.v === "top" ? stage.top + spot.y : stage.top + stage.height - spot.y - size.h;
  return {
    left: Math.round(clamp(left, stage.left, Math.max(stage.left, stage.left + stage.width - size.w))),
    top: Math.round(clamp(top, stage.top, Math.max(stage.top, stage.top + stage.height - size.h))),
  };
}

/**
 * The spot for a panel dropped with its top-left at `at`: measured from the
 * stage's nearer side on each axis, by the panel's middle.
 */
export function spotFor(at: { left: number; top: number }, size: { w: number; h: number }, stage: { left: number; top: number; width: number; height: number }): PanelSpot {
  const fromLeft = at.left - stage.left;
  const fromRight = stage.left + stage.width - at.left - size.w;
  const fromTop = at.top - stage.top;
  const fromBottom = stage.top + stage.height - at.top - size.h;
  const right = fromLeft + size.w / 2 > stage.width / 2;
  const bottom = fromTop + size.h / 2 > stage.height / 2;
  return { h: right ? "right" : "left", x: Math.round(right ? fromRight : fromLeft), v: bottom ? "bottom" : "top", y: Math.round(bottom ? fromBottom : fromTop) };
}

/** Where each panel is and whether it's pinned, by the panel's id. */
export type PanelsSaved = Record<string, { spot: PanelSpot; pinned: boolean }>;

const PANELS_KEY = "cafe.panels";
let panelsThisVisit: PanelsSaved | null = null;

const isSpot = (s: unknown): s is PanelSpot => {
  const o = s as Record<string, unknown> | null;
  return !!o && (o.h === "left" || o.h === "right") && (o.v === "top" || o.v === "bottom") && Number.isFinite(o.x) && Number.isFinite(o.y);
};

/** What this device remembers of the panels, or this visit's if it won't store it; what can't be read is left out. */
export function savedPanels(): PanelsSaved {
  let text: string | null = null;
  try {
    text = localStorage.getItem(PANELS_KEY);
  } catch {
    return panelsThisVisit ?? {};
  }
  if (text === null) return panelsThisVisit ?? {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  const out: PanelsSaved = {};
  if (!parsed || typeof parsed !== "object") return out;
  for (const [id, v] of Object.entries(parsed as Record<string, { spot?: unknown; pinned?: unknown }>)) {
    if (v && isSpot(v.spot) && typeof v.pinned === "boolean") out[id] = { spot: { h: v.spot.h, x: v.spot.x, v: v.spot.v, y: v.spot.y }, pinned: v.pinned };
  }
  return out;
}

export function savePanels(panels: PanelsSaved): void {
  panelsThisVisit = panels;
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(panels));
  } catch {
    // Without storage the panels stay put for this visit only.
  }
}

/** How far a panel keeps from a point it mustn't cover, in CSS pixels. */
const CLEAR_BY = 16;

/**
 * The tallest a panel `width` wide at `spot` in `stage` may grow, from
 * `most`, so it covers none of `points` in its column (slice 16's review,
 * finding 7): standing from the top, its foot stays above each; from the
 * bottom, its top stays below. A point outside its column, or on the side
 * it grows away from, doesn't cap it.
 */
export function clearOf(most: number, spot: PanelSpot, width: number, stage: { left: number; top: number; width: number; height: number }, points: { x: number; y: number }[]): number {
  const left = spot.h === "left" ? stage.left + spot.x : stage.left + stage.width - spot.x - width;
  let out = most;
  for (const p of points) {
    if (p.x < left || p.x > left + width) continue;
    if (spot.v === "top") {
      const top = stage.top + spot.y;
      if (p.y > top) out = Math.min(out, p.y - CLEAR_BY - top);
    } else {
      const foot = stage.top + stage.height - spot.y;
      if (p.y < foot) out = Math.min(out, foot - p.y - CLEAR_BY);
    }
  }
  return out;
}
