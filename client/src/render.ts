import heights from "../../content/sprites/heights.json";
import type { Light } from "./canberra";
import { SLAB, block, diamond, outline, poly, shade, silhouette, up } from "./shapes";
import { pieceBox, pieceParts, topAt } from "./pieces";
import { Raster, SHADOW, darken, drawLayer, shadeLayer, toCanvas as layerCanvas } from "./layer";
import { shadowMask } from "./shadows";
import { backdrop } from "./backdrop";
import { ISO, fromCanvas as fromCanvasAt, inDrawOrder, toCanvas } from "./iso";
import { type Spot, positionAt } from "./motion";
import type { FurnitureView } from "./protocol/FurnitureView";
import type { Look } from "./protocol/Look";
import type { Reaction } from "./protocol/Reaction";
import type { RoomView } from "./protocol/RoomView";
import type { Walk } from "./protocol/Walk";
import { TILE } from "./scale";
import { type AvatarFrame, type CatFrame, type EmoteName, type Grid, type Sprites, avatarPalette, frameGrid, paletteAt } from "./sprites";
import { type CafeState, type Cat, lapOf, serverNow } from "./state";

// Draws the whole café at 1:1 into the canvas, in a 2:1 isometric camera
// (slice 09, ADR 0017); CSS scales it by a whole number. Furniture is shaded
// blocks at its footprint, as tall as content/sprites/heights.json says,
// until slice 11 draws it; cats and people are today's sprites, stood on
// their tile.

export interface Pointer {
  tile: { x: number; y: number } | null;
  visible: boolean;
  /** The tile under the mouse, if it's over the room. */
  hover: { x: number; y: number } | null;
  /** What you carry, shown where it would go, and whether that looks allowed. */
  ghost: { piece: FurnitureView; at: { x: number; y: number }; ok: boolean } | null;
}

/** How long an emote shows over its person. */
const EMOTE_MS = 2500;
const EMOTE_FOR: Record<Reaction["kind"], EmoteName> = {
  lookUp: "question",
  sniff: "sniff",
  purr: "heart",
  tolerate: "dots",
  refuse: "dots",
  greet: "heart",
  annoyed: "dots",
  scratch: "scratch",
  eat: "heart",
  play: "heart",
  knock: "dots",
};

/** This frame's colours, in the hour's light (slice 10); `draw` sets them. */
let ROOM = paletteAt(0).room;
let FURNITURE = paletteAt(0).furniture;
/** This frame's light, for colours drawn outside the sprites (a holder's arms). */
let LIGHT: Light = 0;
/** Each kind's block colour, as a slot in the furniture palette. */
const SLOT: Record<string, number> = {
  cat_tower: 3,
  window_seat: 11,
  sofa: 1,
  rug: 9,
  table: 11,
  chair: 4,
  cat_bed: 1,
  box: 3,
  plant: 6,
  toys: 1,
  bowls: 13,
  cushion: 9,
  scratching_post: 11,
  lamp: 5,
};
const colourOf = (kind: string): string => FURNITURE[SLOT[kind] ?? 3];
const HEIGHT = heights as Record<string, number>;
/** The window's tiles, left to right. */
export function windowTiles(room: RoomView): { x: number; y: number }[] {
  return [...(room.tiles[0] ?? "")].flatMap((ch, x) => (ch === "G" ? [{ x, y: 0 }] : []));
}

/** Where someone waiting shows: the window's tiles, in line order. */
export function windowSpot(state: CafeState, id: number): { x: number; y: number } {
  const tiles = windowTiles(state.room);
  const line = [...state.people.values()].filter((p) => p.place === "window").map((p) => p.id);
  const i = Math.max(0, line.indexOf(id));
  return tiles.length > 0 ? tiles[i % tiles.length] : { x: 0, y: 0 };
}

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

/**
 * `v`, in room pixels, rounded to the nearest whole pixel of the canvas: the
 * canvas is the room at its on-screen scale (slice 12), so a sprite placed
 * there keeps its own pixels whole and square, but moves by screen pixels.
 */
function onScreen(ctx: Ctx, v: number): number {
  const k = ctx.getTransform?.()?.a || 1;
  return Math.round(v * k) / k;
}

function blit(ctx: Ctx, img: CanvasImageSource | null, x: number, y: number): void {
  if (img) ctx.drawImage(img, onScreen(ctx, x), onScreen(ctx, y));
}

/** Where a sprite `size` wide stands with its feet on the tile at `spot`: its top-left. */
function feetAt(spot: { x: number; y: number }, size = TILE): Pt {
  const c = toCanvas(spot.x + 0.5, spot.y + 0.5);
  return { x: c.x - size / 2, y: c.y - size + 2 };
}

/** One thing to draw, by its footprint on the floor, and how far up something it stands on lifts it. */
export interface Drawn {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
  lift: number;
  paint: (ctx: Ctx, sprites: Sprites) => void;
  /** The tile a canvas point on this thing as drawn stands for, or null if the point isn't on it. */
  hit?: (px: number, py: number) => { x: number; y: number } | null;
  /** Drawn with the floor, in its layer, not on its own (the rug). */
  inLayer?: boolean;
}

/** Whether (px, py) is inside the convex polygon `pts`. */
function inside(pts: Pt[], px: number, py: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/**
 * The tile of a piece's footprint that a point on its block stands for: the
 * point taken down to the block's top, or to the floor for its faces, and
 * kept within the footprint.
 */
function blockTile(f: FurnitureView, z: number, px: number, py: number): { x: number; y: number } {
  const onTop = fromCanvasAt(px, py + z);
  const g = onTop.gx >= f.x && onTop.gx < f.x + f.w && onTop.gy >= f.y && onTop.gy < f.y + f.h ? onTop : fromCanvasAt(px, py);
  const clamp = (v: number, lo: number, n: number) => Math.min(lo + n - 1, Math.max(lo, Math.floor(v)));
  return { x: clamp(g.gx, f.x, f.w), y: clamp(g.gy, f.y, f.h) };
}

/**
 * Whether canvas point (px, py) is on a piece as drawn: inside its block,
 * or on the outline traced a room pixel wide round it, which can fall a
 * pixel outside the polygon, across a corner too (slice 13's review,
 * finding 9).
 */
function onBlock(f: FurnitureView, px: number, py: number): boolean {
  // On any of its parts as drawn (slice 11's review, finding 1): a cat
  // between the tower's platforms, the floor between a table's legs, isn't
  // on the piece.
  for (const part of pieceParts(f, HEIGHT)) {
    const pts = silhouette(part.x, part.y, part.w, part.h, part.z, part.z0);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(pts, px + dx, py + dy)) return true;
  }
  return false;
}

/**
 * Whether canvas point (px, py) is on a figure as drawn: its frame `grid`,
 * placed with its feet on `spot` and `lift` up, mirrored if it faces left,
 * has a pixel there (slice 11's review, finding 2), or within a pixel of
 * one, so its outline and a near miss on a small cat still count.
 */
function onSprite(grid: Grid | null, spot: Spot, lift: number, px: number, py: number): boolean {
  if (!grid) return false;
  const size = grid[0].length;
  const at = feetAt(spot, size);
  const gx = Math.floor(px - at.x);
  const gy = Math.floor(py - (at.y - lift));
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = gx + dx;
      const y = gy + dy;
      if (x < 0 || y < 0 || x >= size || y >= grid.length) continue;
      if ((grid[y][spot.mirror ? size - 1 - x : x] ?? -1) >= 0) return true;
    }
  }
  return false;
}

/** How big a cat and a person are drawn, in room pixels (slice 11). */
export const CAT = 24;
export const PERSON = 32;

/**
 * The tile of whatever is drawn at canvas point (px, py), the nearest the
 * viewer first: a cat or person by their sprite, a piece by its block, a
 * treat. Null over bare floor, the rug or the walls, where the floor's own
 * diamond (or the street wall) is what's under the pointer.
 */
export function hitAt(state: CafeState, px: number, py: number, localNow: number): { x: number; y: number } | null {
  const order = drawOrder(state, localNow);
  for (let i = order.length - 1; i >= 0; i--) {
    const tile = order[i].hit?.(px, py);
    if (tile) return tile;
  }
  return null;
}

/**
 * The standing piece under a tile, if any: a cat napping on the window seat,
 * someone on the sofa, is drawn up on top of it, not inside its block.
 */
function standingOn(state: CafeState, spot: { x: number; y: number }): FurnitureView | null {
  const x = Math.round(spot.x);
  const y = Math.round(spot.y);
  return state.room.furniture.find((f) => !f.toppled && !f.under && HEIGHT[f.kind] > 4 && x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) ?? null;
}

/**
 * A walker's spot, facing the way they last went (slice 12). A walk the
 * client holds, under way or finished, says which way it went: the server
 * never says a walk is over, so a finished one stays. With no walk, the side
 * kept when one was cleared, or the front.
 */
function facingOf(state: CafeState, key: string, walk: Walk | null, spot: Spot): Spot {
  // Someone who's just come in, their walk from the door over, faces into
  // the room, as the spec settled (slice 12's review, finding 4).
  const door = state.room.door;
  if (walk && walk.path.length > 1 && !spot.moving && walk.path[0].x === door.x && walk.path[0].y === door.y) return { ...spot, view: "front", mirror: false };
  if (walk && walk.path.length > 1) return spot;
  const kept = state.facing.get(key);
  return kept ? { ...spot, ...kept } : spot;
}

/** What's drawn later on the same spot: a piece, a treat on it, a cat, a person, a cat on their lap. */
const LAYER = { piece: 0, treat: 1, cat: 2, person: 3, lap: 4 } as const;

/**
 * Everything in the room, in the order it's drawn: what things stand on (the
 * rug) first, then everything else, nothing nearer the viewer first. Each
 * thing keeps its true footprint; things on the same spot go by their layer.
 * Something up on a standing piece takes the piece's footprint, one layer
 * up, so it's drawn just after the piece and before what's in front of it.
 */
export function drawOrder(state: CafeState, localNow: number): Drawn[] {
  const now = serverNow(state, localNow);
  const under: Drawn[] = [];
  const rest: Drawn[] = [];
  for (const f of state.room.furniture) {
    const item: Drawn = {
      label: `piece ${f.kind}`,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      layer: LAYER.piece,
      lift: 0,
      // What others stand on is the floor, as far as a click goes, and is
      // drawn with it, under the shadows (slice 13's review, finding 2).
      hit: f.under ? undefined : (px, py) => (onBlock(f, px, py) ? blockTile(f, pieceBox(f, HEIGHT).z, px, py) : null),
      inLayer: f.under,
      paint: (ctx, sprites) => {
        drawPiece(ctx, f);
        if (f.kind === "bowls" && state.bowls > 0) {
          for (let k = 0; k < Math.min(state.bowls, f.w); k++) {
            const top = up(f.x + k + 0.5, f.y + 0.5, HEIGHT.bowls ?? 4);
            blit(ctx, sprites.emote("food"), top.x - 4, top.y - 6);
          }
        }
      },
    };
    (f.under ? under : rest).push(item);
  }
  // Treats on the floor, or on the rug or the cushion they were put on.
  for (const [id, at] of state.treats) {
    rest.push({
      label: `treat ${id}`,
      x: at.x,
      y: at.y,
      w: 1,
      h: 1,
      layer: LAYER.treat,
      lift: 0,
      hit: (px, py) => {
        const p = toCanvas(at.x + 0.5, at.y + 0.5);
        return px >= p.x - 4 && px < p.x + 4 && py >= p.y - 6 && py < p.y + 2 ? { x: at.x, y: at.y } : null;
      },
      paint: (ctx, sprites) => {
        const p = toCanvas(at.x + 0.5, at.y + 0.5);
        blit(ctx, sprites.emote("treat"), p.x - 4, p.y - 6);
      },
    });
  }
  // A held cat is drawn in its holder's arms, not on the floor.
  const inArms = new Map<number, Cat>();
  for (const cat of state.cats.values()) {
    if (cat.heldBy !== null && state.people.has(cat.heldBy)) {
      inArms.set(cat.heldBy, cat);
      continue;
    }
    const spot = facingOf(state, `c${cat.id}`, cat.walk, positionAt(cat.walk, cat.at, now));
    // A cat asleep on someone's lap is drawn over them, as a held cat is.
    const layer = lapOf(state, cat) !== null ? LAYER.lap : LAYER.cat;
    const on = standingOn(state, spot);
    const lift = on ? topAt(on, HEIGHT, Math.round(spot.x), Math.round(spot.y)) : 0;
    const tile = { x: Math.round(spot.x), y: Math.round(spot.y) };
    rest.push({
      label: `cat ${cat.id}`,
      ...footprint(spot, on),
      layer,
      lift,
      hit: (px, py) => (onSprite(frameGrid("cat", catFrame(state, cat, spot, now)), spot, lift, px, py) ? tile : null),
      paint: (ctx, sprites) => drawCat(ctx, sprites, state, cat, spot, now, lift),
    });
  }
  for (const person of state.people.values()) {
    if (person.place !== "inside") continue;
    const spot = facingOf(state, `p${person.id}`, person.walk, positionAt(person.walk, person.at, now));
    const emote = state.emotes.get(person.id);
    const showing = emote && now - emote.at < EMOTE_MS ? emote.emote : null;
    const carried = state.held.get(person.id) ?? null;
    const held = inArms.get(person.id) ?? null;
    const on = spot.moving ? null : standingOn(state, spot);
    const lift = personLift(state, person, localNow);
    const tile = { x: Math.round(spot.x), y: Math.round(spot.y) };
    rest.push({
      label: `person ${person.id}`,
      ...footprint(spot, on),
      layer: LAYER.person,
      lift,
      hit: (px, py) => (onSprite(frameGrid("avatar", personFrame(spot, now)), spot, lift, px, py) ? tile : null),
      paint: (ctx, sprites) => {
        drawPerson(ctx, sprites, person.look, spot, now, person.id === state.you, showing, lift);
        if (carried) drawCarried(ctx, carried, spot, lift);
        // A held cat in a princess hug (the user, 2026-11-05): curled in
        // their arms at the chest, below their face, their forearms round it.
        if (held) {
          drawCat(ctx, sprites, state, held, { ...spot, moving: false }, now, lift + 4);
          drawHug(ctx, person.look, spot, lift + 4);
        }
      },
    });
  }
  return [...inDrawOrder(under), ...inDrawOrder(rest)];
}

/**
 * How far up someone inside is drawn, in canvas pixels: up on the seat
 * they're on, sinking a little into it; on the floor, or walking, nothing.
 */
export function personLift(state: CafeState, person: { walk: Walk | null; at: { x: number; y: number } }, localNow: number): number {
  const spot = positionAt(person.walk, person.at, serverNow(state, localNow));
  const on = spot.moving ? null : standingOn(state, spot);
  return on ? Math.max(0, topAt(on, HEIGHT, Math.round(spot.x), Math.round(spot.y)) - 4) : 0;
}

/** The footprint something at `spot` sorts by: its own tile, or the piece it's up on. */
function footprint(spot: { x: number; y: number }, on: FurnitureView | null): { x: number; y: number; w: number; h: number } {
  return on ? { x: on.x, y: on.y, w: on.w, h: on.h } : { x: spot.x, y: spot.y, w: 1, h: 1 };
}

/**
 * Draws the café in a light, how far toward night it is (0 to 1, from
 * `lightAt`): the room, furniture and sprites in that light's colours, the
 * window lit at night, and no wash laid over it (slice 10).
 */
export function draw(ctx: Ctx, state: CafeState, sprites: Sprites, localNow: number, pointer: Pointer, light: Light, scale = 1): void {
  const { room } = state;
  // The canvas is the room at `scale`: everything below is drawn in room
  // pixels, and figures are placed to the canvas's own pixels (slice 12).
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const palette = paletteAt(light);
  ROOM = palette.room;
  FURNITURE = palette.furniture;
  LIGHT = light;
  sprites.light = light;
  ctx.imageSmoothingEnabled = false;
  // The street, the floor and the rug, with their shadows, as one layer
  // worked out when the light or the furniture changes (slice 13's review,
  // findings 2, 3 and 6).
  const layer = floorLayer(room, light);
  drawLayer(ctx, layer, () => layerImage(layer));
  drawWalls(ctx, state, sprites);
  drawFigureShadows(ctx, state, localNow, layer);

  for (const item of drawOrder(state, localNow)) if (!item.inLayer) item.paint(ctx, sprites);

  if (pointer.ghost) {
    const { piece, at, ok } = pointer.ghost;
    ctx.globalAlpha = 0.55;
    drawPiece(ctx, { ...piece, x: at.x, y: at.y, toppled: false });
    ctx.globalAlpha = 1;
    outline(ctx, diamond(at.x, at.y, piece.w, piece.h), ok ? "#3c9a5f" : "#d9534f");
  }

  if (pointer.visible && pointer.tile) {
    const { x, y } = pointer.tile;
    if (y === 0) {
      // Up the street wall: round the tile's panel.
      const pts = [up(x + 0.05, 1, 8), up(x + 0.95, 1, 8), up(x + 0.95, 1, ISO.wall - 6), up(x + 0.05, 1, ISO.wall - 6)];
      outline(ctx, pts, "#ffffff", 2);
      outline(ctx, pts, "#2f6fd1");
    } else {
      outline(ctx, diamond(x, y), "#ffffff", 2);
      outline(ctx, diamond(x + 0.1, y + 0.1, 0.8, 0.8), "#2f6fd1");
    }
  }
}

/** The floor: rows 1 and below, boards in two shades with a seam. */
/** How deep the seam along each tile's far edge is, in tiles. */
const SEAM = 0.06;


function drawFloor(ctx: Ctx, room: RoomView): void {
  // The slab the floor stands on, seen under its two front edges: lit on
  // the left, toward the windows, darker on the right, as the pieces are.
  const W = room.width;
  const H = room.height;
  const wood = ROOM[2];
  poly(ctx, [up(0, 1), up(0, H), up(0, H, -SLAB), up(0, 1, -SLAB)], shade(wood, 0.25));
  poly(ctx, [up(0, H), up(W, H), up(W, H, -SLAB), up(0, H, -SLAB)], shade(wood, 0.45));
  outline(ctx, [up(0, 1, -SLAB), up(0, H, -SLAB), up(W, H, -SLAB)], shade(wood, 0.65), 1, false);
  for (let y = 1; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) poly(ctx, diamond(x, y), (x + y) % 2 ? ROOM[0] : ROOM[1]);
  }
  // The seams over the boards, after them all, so the next row's boards
  // don't cover them (slice 13's review, finding 3).
  for (let y = 1; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) poly(ctx, [up(x, y + 1), up(x + 1, y + 1), up(x + 1, y + 1 + SEAM), up(x, y + 1 + SEAM)], ROOM[2]);
  }
}

let layerCache: { key: string; base: Raster; layer: Raster; image?: CanvasImageSource | null } | null = null;

/**
 * The floor layer in a light (slice 13's review, findings 2, 3 and 6): the
 * street, the slab, the boards and seams, and the pieces others stand on,
 * at 1×, darkened where the windows' shadows and the floor's occlusion fall
 * (unless `shaded` is false). Made again only when the light or the
 * furniture changes.
 */
export function floorLayer(room: RoomView, light: Light, shaded = true): Raster {
  const key = `${light}:${shaded}:${room.width}x${room.height}:${room.tiles[0]}:${room.furniture.map((f) => `${f.kind}@${f.x},${f.y},${f.w},${f.h}${f.toppled ? "t" : ""}${f.under ? "u" : ""}`).join(";")}`;
  // What's outside the room, the street and the terrace (slice 18): the
  // backdrop the street's canvas also draws, so the two agree to the pixel.
  const base = backdrop({ x0: 0, y0: 0, x1: ISO.width, y1: ISO.height }, light);
  if (layerCache?.key === key && layerCache.base === base) return layerCache.layer;
  const palette = paletteAt(light);
  const [room0, furn0] = [ROOM, FURNITURE];
  ROOM = palette.room;
  FURNITURE = palette.furniture;
  const layer = base.copy();
  const ctx = layer.context();
  drawFloor(ctx, room);
  for (const f of inDrawOrder(room.furniture.filter((f) => f.under))) drawPiece(ctx, f);
  if (shaded) shadeLayer(layer, shadowMask(room, room.furniture, HEIGHT));
  [ROOM, FURNITURE] = [room0, furn0];
  layerCache = { key, base, layer };
  return layer;
}

/**
 * How a figure's shadow lies, in tiles from the middle of its feet: a small
 * oval a little away from the windows (toward +y), as the light falls
 * (shadows.ts), the study's sprite shadow (slice 13's review, finding 5).
 */
const FIGURE_SHADOW = { dx: -0.04, dy: 0.16, rx: 0.2, ry: 0.3 };

/**
 * A small shadow under each cat and person standing on the floor (slice
 * 13's review, finding 5): the floor under it darkened, pixel by pixel, as
 * the floor's own shadows are. Worked out every frame, since figures move;
 * nobody up on a piece or in someone's arms casts one on the floor.
 */
function drawFigureShadows(ctx: Ctx, state: CafeState, localNow: number, layer: Raster): void {
  const now = serverNow(state, localNow);
  const spots: Pt[] = [];
  for (const cat of state.cats.values()) {
    if (cat.heldBy !== null) continue;
    const spot = positionAt(cat.walk, cat.at, now);
    if (!standingOn(state, spot) && lapOf(state, cat) === null) spots.push(spot);
  }
  for (const person of state.people.values()) {
    if (person.place !== "inside") continue;
    const spot = positionAt(person.walk, person.at, now);
    if (spot.moving || !standingOn(state, spot)) spots.push(spot);
  }
  const { dx, dy, rx, ry } = FIGURE_SHADOW;
  for (const s of spots) {
    const [cx, cy] = [s.x + 0.5 + dx, s.y + 0.5 + dy];
    const corners = [toCanvas(cx - rx, cy - ry), toCanvas(cx + rx, cy - ry), toCanvas(cx + rx, cy + ry), toCanvas(cx - rx, cy + ry)];
    const [x0, x1] = [Math.floor(Math.min(...corners.map((c) => c.x))), Math.ceil(Math.max(...corners.map((c) => c.x)))];
    const [y0, y1] = [Math.floor(Math.min(...corners.map((c) => c.y))), Math.ceil(Math.max(...corners.map((c) => c.y)))];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const { gx, gy } = fromCanvasAt(x + 0.5, y + 0.5);
        if (((gx - cx) / rx) ** 2 + ((gy - cy) / ry) ** 2 > 1 || gy < 1) continue;
        const under = layer.at(x, y);
        if (!under) continue;
        ctx.fillStyle = darken(under, SHADOW);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/** The layer as an image to lay on in one go, made once per layer. */
function layerImage(layer: Raster): CanvasImageSource | null {
  if (layerCache?.layer !== layer) return layerCanvas(layer);
  if (layerCache.image === undefined) layerCache.image = layerCanvas(layer);
  return layerCache.image;
}

/**
 * The two back walls: the street wall on the left with row 0's window, door
 * and chalkboard on it, and the line's faces in the window; the plain one on
 * the right.
 */
function drawWalls(ctx: Ctx, state: CafeState, sprites: Sprites): void {
  const { room } = state;
  const H = ISO.wall;
  const wall = ROOM[3];
  const wainscot = ROOM[4];
  // The plain wall, up the back right.
  const W = room.width;
  poly(ctx, [up(W, 1), up(W, room.height), up(W, room.height, H), up(W, 1, H)], shade(wall, 0.22));
  poly(ctx, [up(W, 1), up(W, room.height), up(W, room.height, 14), up(W, 1, 14)], shade(wainscot, 0.2));
  // The street wall, up the back left.
  poly(ctx, [up(0, 1), up(W, 1), up(W, 1, H), up(0, 1, H)], shade(wall, 0.08));
  poly(ctx, [up(0, 1), up(W, 1), up(W, 1, 14), up(0, 1, 14)], wainscot);
  // The walls' tops (slice 13): a light edge along each, two room pixels
  // deep, so the walls read as cut away, the room as a diorama.
  poly(ctx, [up(0, 1, H), up(W, 1, H), up(W, 1, H - 2), up(0, 1, H - 2)], shade(wall, -0.35));
  poly(ctx, [up(W, 1, H), up(W, room.height, H), up(W, room.height, H - 2), up(W, 1, H - 2)], shade(wall, -0.2));
  const panel = (x0: number, x1: number, z0: number, z1: number, colour: string) => poly(ctx, [up(x0, 1, z0), up(x1, 1, z0), up(x1, 1, z1), up(x0, 1, z1)], colour);
  const tiles = room.tiles[0] ?? "";
  const line = [...state.people.values()].filter((p) => p.place === "window");
  const windows = windowTiles(room);
  [...tiles].forEach((ch, x) => {
    if (ch === "G") {
      panel(x + 0.04, x + 0.96, 20, 50, ROOM[5]);
      panel(x + 0.1, x + 0.9, 22, 48, ROOM[8]);
      // A face peeking in, whoever is this pane's place in the line.
      const who = line[windows.findIndex((w) => w.x === x)];
      if (who) {
        const img = sprites.avatar(who.look, "stand");
        const face = up(x + 0.5, 1, 30);
        // The head of a 32-px sprite (slice 11), its columns 8 to 23, rows 0
        // to 11, centred in the pane (slice 11's review, finding 6).
        if (img) ctx.drawImage(img, 8, 0, 16, 12, Math.round(face.x - 8), Math.round(face.y - 10), 16, 12);
      }
    } else if (ch === "D") {
      panel(x + 0.08, x + 0.92, 0, 42, ROOM[5]);
      panel(x + 0.16, x + 0.84, 0, 39, ROOM[9]);
      const knob = up(x + 0.75, 1, 20);
      poly(ctx, [knob, { x: knob.x + 2, y: knob.y + 1 }, { x: knob.x + 2, y: knob.y + 3 }, { x: knob.x, y: knob.y + 2 }], ROOM[10]);
    } else if (ch === "C") {
      panel(x + 0.12, x + 0.9, 20, 40, ROOM[5]);
      panel(x + 0.18, x + 0.84, 22, 38, ROOM[11]);
      // A few chalk marks.
      for (const [a, z] of [
        [0.3, 34],
        [0.5, 30],
        [0.35, 26],
      ]) {
        panel(x + a, x + a + 0.25, z, z + 1, ROOM[12]);
      }
    }
  });
}

/** A piece where it stands, as a shaded block; knocked over, lying on its side. */
function drawPiece(ctx: Ctx, f: FurnitureView): void {
  // Its parts as its kind's model has them (slice 11), standing, or one
  // block fallen toward the viewer; the same boxes its shadow is cast from
  // (pieces.ts).
  for (const part of pieceParts(f, HEIGHT)) block(ctx, part.x, part.y, part.w, part.h, part.z, part.slot === null ? colourOf(f.kind) : FURNITURE[part.slot], part.z0);
  if (!f.toppled) return;
  // Scattered toys (slice 02): a couple more balls of yarn strewn beside it,
  // where a cat batted them, until someone gathers them up.
  if (f.kind === "toys") {
    for (const [dx, dy, slot] of SCATTERED) {
      const p = toCanvas(f.x + dx, f.y + dy);
      ctx.fillStyle = FURNITURE[slot];
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
      ctx.fillStyle = FURNITURE[0];
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }
}

/**
 * Where scattered toys lie, in tiles from the toys' own tile, and their
 * colours as furniture palette slots (red and lavender yarn, an outline
 * between), so they're in the hour's light like the rest (slice 10's
 * review, finding 3).
 */
const SCATTERED: [number, number, number][] = [
  [-0.3, 0.7, 1],
  [1.2, 0.3, 9],
  [0.8, 1.1, 1],
];

function drawFlipped(ctx: Ctx, img: CanvasImageSource, at: Pt, mirror: boolean, size = TILE): void {
  const x = onScreen(ctx, at.x);
  const y = onScreen(ctx, at.y);
  if (!mirror) {
    ctx.drawImage(img, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x + size, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** How long a cat shows a reaction's own pose (scratching, greeting, playing with someone), in milliseconds. */
const REACTION_POSE_MS = 1200;

/**
 * The frame a cat shows (slice 11): its build's, for what it's doing.
 * Walking, its two steps, its back if going away; a moment after the café
 * says it scratched, greeted or played with someone, that pose; then by
 * its pose: asleep (on a lap if someone sits there), eating, playing in
 * two frames, held, perched up on the window seat, else sitting.
 */
export function catFrame(state: CafeState, cat: Cat, spot: Spot, now: number): CatFrame {
  const b = cat.build;
  const back = spot.view === "back";
  const step = Math.floor(now / 160) % 2 ? "a" : "b";
  if (spot.moving) return `${b}:${back ? "back_" : ""}walk_${step}`;
  const reaction = cat.reaction && now - cat.reaction.at < REACTION_POSE_MS ? cat.reaction.reaction.kind : null;
  if (reaction === "scratch") return `${b}:scratch`;
  if (reaction === "greet") return `${b}:greet`;
  // Knocking a piece over, and a treat taken from a hand (slice 11's review, finding 7).
  if (reaction === "knock") return `${b}:knock`;
  if (reaction === "eat") return `${b}:eat`;
  if (reaction === "play" || cat.pose === "play") return `${b}:play_${step}`;
  if (cat.pose === "nap") return lapOf(state, cat) !== null ? `${b}:lap` : `${b}:nap`;
  if (cat.pose === "eat") return `${b}:eat`;
  if (cat.pose === "held") return `${b}:held`;
  // Up on a piece the content marks for perching (slice 11's review, finding 20).
  if (standingOn(state, spot)?.perch) return `${b}:perch`;
  return `${b}:${back ? "back_" : ""}sit`;
}

function drawCat(ctx: Ctx, sprites: Sprites, state: CafeState, cat: Cat, spot: Spot, now: number, lift = 0): void {
  const img = sprites.cat(cat.coat, catFrame(state, cat, spot, now));
  // A sprite as big as its image (24 px for a cat since slice 11), its feet on the tile.
  const size = img ? img.width : TILE;
  const feet = feetAt(spot, size);
  const at = { x: feet.x, y: feet.y - lift };
  if (img) {
    ctx.save();
    if (cat.pose === "hide") ctx.globalAlpha = 0.55;
    drawFlipped(ctx, img, at, spot.mirror, size);
    ctx.restore();
  }
  const fresh = cat.reaction && now - cat.reaction.at < 2500 ? EMOTE_FOR[cat.reaction.reaction.kind] : null;
  const emote = fresh ?? (cat.pose === "nap" ? "zzz" : null);
  if (emote) blit(ctx, sprites.emote(emote), at.x + size / 2 - 4, at.y - 8);
}

/** A carried piece, held up over its carrier's head: a small block. */
function drawCarried(ctx: Ctx, piece: FurnitureView, spot: Spot, standing = 0): void {
  // Clear above the carrier's head, 32 px tall since slice 11, never on it
  // (slice 11's review, finding 4; a test holds its lowest pixel above the
  // head's top).
  const lift = PERSON + standing;
  const colour = colourOf(piece.kind);
  const z = Math.min(HEIGHT[piece.kind] ?? 8, 14);
  const s = 0.6;
  // Drawn over the carrier's head as if they stood on a whole tile, then
  // moved with the sprite, by the screen pixels it was placed at, so the
  // piece stays put on their head as they walk (slice 12's review, finding 6).
  const tile = { x: Math.round(spot.x), y: Math.round(spot.y) };
  const placed = feetAt(spot);
  const whole = feetAt(tile);
  ctx.save();
  ctx.translate(onScreen(ctx, placed.x) - whole.x, onScreen(ctx, placed.y) - whole.y - lift);
  block(ctx, tile.x + 0.5 - s / 2, tile.y + 0.5 - s / 2, s, s, z, colour);
  ctx.restore();
}

/**
 * The holder's arms round a cat they hold, in their own skin (the user,
 * 2026-11-05: princess hugs): a forearm under the cat, cradling it, and a
 * hand over its side, each a bar of skin with an outline, placed where the
 * held cat is drawn (its 24-px box, `lift` up), so a curled cat reads as
 * one in someone's arms.
 */
function drawHug(ctx: Ctx, look: Look, spot: Spot, lift: number): void {
  const [, skin] = avatarPalette(look, LIGHT);
  const edge = shade(skin, 0.3);
  const at = feetAt(spot, CAT);
  const x = onScreen(ctx, at.x);
  const y = onScreen(ctx, at.y - lift);
  /** A slim arm as runs of pixels: for each column from x0 to x1, a band 2 px tall at a height easing from y0 to y1, its lower edge a shade darker. */
  const arm = (x0: number, x1: number, y0: number, y1: number) => {
    for (let c = x0; c <= x1; c++) {
      const r = Math.round(y0 + ((y1 - y0) * (c - x0)) / Math.max(1, x1 - x0));
      ctx.fillStyle = skin;
      ctx.fillRect(x + c, y + r, 1, 2);
      ctx.fillStyle = edge;
      ctx.fillRect(x + c, y + r + 2, 1, 1);
    }
  };
  // The lower arm under its belly, from the holder's near side, rising toward its head.
  arm(3, 19, 19, 16);
  // The upper arm over its back, a hand resting on its shoulder.
  arm(7, 14, 12, 11);
}

/** The frame someone shows: walking (two steps), or standing; their back going away (slice 12). */
function personFrame(spot: Spot, now: number): AvatarFrame {
  const back = spot.view === "back";
  const step = Math.floor(now / 180) % 2 ? "walk_a" : "walk_b";
  return spot.moving ? (back ? `back_${step}` : step) : back ? "back" : "stand";
}

function drawPerson(ctx: Ctx, sprites: Sprites, look: Look, spot: Spot, now: number, isYou: boolean, emote: EmoteName | null, lift = 0): void {
  const img = sprites.avatar(look, personFrame(spot, now));
  // As big as its image (32 px since slice 11), its feet on the tile.
  const size = img ? img.width : PERSON;
  const feet = feetAt(spot, size);
  const at = { x: feet.x, y: feet.y - lift };
  if (img) drawFlipped(ctx, img, at, spot.mirror, size);
  // The marker and emote move with the sprite, by the same screen pixels,
  // over the middle of its head.
  const x = onScreen(ctx, at.x + size / 2);
  const y = onScreen(ctx, at.y);
  if (isYou) {
    // A small marker over your own head.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 2, y - 4, 4, 2);
    ctx.fillRect(x - 1, y - 2, 2, 1);
  }
  if (emote) blit(ctx, sprites.emote(emote), x - 4, y - 13);
}
