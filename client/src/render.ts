import heights from "../../content/sprites/heights.json";
import palettes from "../../content/sprites/palettes.json";
import { nightTint } from "./canberra";
import { ISO, fromCanvas as fromCanvasAt, inDrawOrder, toCanvas } from "./iso";
import { type Spot, positionAt } from "./motion";
import type { FurnitureView } from "./protocol/FurnitureView";
import type { Look } from "./protocol/Look";
import type { Reaction } from "./protocol/Reaction";
import type { RoomView } from "./protocol/RoomView";
import type { Walk } from "./protocol/Walk";
import { TILE } from "./scale";
import type { AvatarFrame, CatFrame, EmoteName, Sprites } from "./sprites";
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
};

const ROOM = palettes.room;
const FURNITURE = palettes.furniture;
/** Each kind's block colour, from the furniture palette. */
const COLOUR: Record<string, string> = {
  cat_tower: FURNITURE[3],
  window_seat: FURNITURE[11],
  sofa: FURNITURE[1],
  rug: FURNITURE[9],
  table: FURNITURE[11],
  chair: FURNITURE[4],
  cat_bed: FURNITURE[1],
  box: FURNITURE[3],
  plant: FURNITURE[6],
  toys: FURNITURE[1],
  bowls: FURNITURE[13],
  cushion: FURNITURE[9],
  scratching_post: FURNITURE[11],
  lamp: FURNITURE[5],
};
/** How far in from its footprint's edges a small piece's block stands, in tiles. */
const INSET: Record<string, number> = { plant: 0.28, toys: 0.32, bowls: 0.18, chair: 0.2, cat_bed: 0.12, box: 0.15, cushion: 0.15, scratching_post: 0.3, lamp: 0.3 };
const HEIGHT = heights as Record<string, number>;
/** Around the room, beyond its walls. */
const BACKDROP = "#1e1e2e";

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

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `hex` darkened by `k` (0 to 1), or lightened by a negative `k`. */
function shade(hex: string, k: number): string {
  const [r, g, b] = rgb(hex).map((v) => Math.round(Math.max(0, Math.min(255, k >= 0 ? v * (1 - k) : v + (255 - v) * -k))));
  return `rgb(${r} ${g} ${b})`;
}

function poly(ctx: Ctx, pts: Pt[], colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(Math.round(pts[0].x), Math.round(pts[0].y));
  for (const p of pts.slice(1)) ctx.lineTo(Math.round(p.x), Math.round(p.y));
  ctx.closePath();
  ctx.fill();
}

/** A floor point raised by `z` pixels. */
function up(gx: number, gy: number, z = 0): Pt {
  const p = toCanvas(gx, gy);
  return { x: p.x, y: p.y - z };
}

/** A block standing on the floor over (x, y, w, h), `z` pixels tall: its right face, left face and top. */
function block(ctx: Ctx, x: number, y: number, w: number, h: number, z: number, colour: string): void {
  poly(ctx, [up(x + w, y), up(x + w, y + h), up(x + w, y + h, z), up(x + w, y, z)], shade(colour, 0.3));
  poly(ctx, [up(x, y + h), up(x + w, y + h), up(x + w, y + h, z), up(x, y + h, z)], shade(colour, 0.14));
  poly(ctx, [up(x, y, z), up(x + w, y, z), up(x + w, y + h, z), up(x, y + h, z)], colour);
}

function diamond(x: number, y: number, w = 1, h = 1): Pt[] {
  return [up(x, y), up(x + w, y), up(x + w, y + h), up(x, y + h)];
}

function outline(ctx: Ctx, pts: Pt[], colour: string, width = 1): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0].x + 0.5, pts[0].y + 0.5);
  for (const p of pts.slice(1)) ctx.lineTo(p.x + 0.5, p.y + 0.5);
  ctx.closePath();
  ctx.stroke();
}

function blit(ctx: Ctx, img: CanvasImageSource | null, x: number, y: number): void {
  if (img) ctx.drawImage(img, Math.round(x), Math.round(y));
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

/** Where a piece's block is drawn: its outline, top and two faces together. */
function blockOutline(f: FurnitureView): Pt[] {
  const z = HEIGHT[f.kind] ?? 8;
  const i = INSET[f.kind] ?? 0.06;
  const [x, y, w, h] = [f.x + i, f.y + i, f.w - 2 * i, f.h - 2 * i];
  if (f.toppled) {
    const along = Math.min(f.w - 0.1, w * 1.8);
    const lz = Math.max(2, Math.round(z / 3));
    const [bx, by, bw, bh] = [f.x + (f.w - along) / 2, y + h * 0.25, along, h * 0.5];
    return [up(bx, by, lz), up(bx + bw, by, lz), up(bx + bw, by), up(bx + bw, by + bh), up(bx, by + bh), up(bx, by + bh, lz)];
  }
  return [up(x, y, z), up(x + w, y, z), up(x + w, y), up(x + w, y + h), up(x, y + h), up(x, y + h, z)];
}

/** A figure's sprite box, `lift` pixels up, as a polygon. */
function spriteBox(spot: { x: number; y: number }, lift: number): Pt[] {
  const at = feetAt(spot);
  const top = at.y - lift;
  return [
    { x: at.x, y: top },
    { x: at.x + TILE, y: top },
    { x: at.x + TILE, y: top + TILE },
    { x: at.x, y: top + TILE },
  ];
}

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
      // What others stand on is the floor, as far as a click goes.
      hit: f.under ? undefined : (px, py) => (inside(blockOutline(f), px, py) ? blockTile(f, HEIGHT[f.kind] ?? 8, px, py) : null),
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
    const spot = positionAt(cat.walk, cat.at, now);
    // A cat asleep on someone's lap is drawn over them, as a held cat is.
    const layer = lapOf(state, cat) !== null ? LAYER.lap : LAYER.cat;
    const on = standingOn(state, spot);
    const lift = on ? HEIGHT[on.kind] : 0;
    const tile = { x: Math.round(spot.x), y: Math.round(spot.y) };
    rest.push({
      label: `cat ${cat.id}`,
      ...footprint(spot, on),
      layer,
      lift,
      hit: (px, py) => (inside(spriteBox(spot, lift), px, py) ? tile : null),
      paint: (ctx, sprites) => drawCat(ctx, sprites, cat, spot, now, lift),
    });
  }
  for (const person of state.people.values()) {
    if (person.place !== "inside") continue;
    const spot = positionAt(person.walk, person.at, now);
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
      hit: (px, py) => (inside(spriteBox(spot, lift), px, py) ? tile : null),
      paint: (ctx, sprites) => {
        drawPerson(ctx, sprites, person.look, spot, now, person.id === state.you, showing, lift);
        if (carried) drawCarried(ctx, carried, spot, lift);
        if (held) drawCat(ctx, sprites, held, { ...spot, moving: false }, now, lift + 6);
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
  return on ? Math.max(0, HEIGHT[on.kind] - 4) : 0;
}

/** The footprint something at `spot` sorts by: its own tile, or the piece it's up on. */
function footprint(spot: { x: number; y: number }, on: FurnitureView | null): { x: number; y: number; w: number; h: number } {
  return on ? { x: on.x, y: on.y, w: on.w, h: on.h } : { x: spot.x, y: spot.y, w: 1, h: 1 };
}

export function draw(ctx: Ctx, state: CafeState, sprites: Sprites, localNow: number, pointer: Pointer, hour: number): void {
  const { room } = state;
  ctx.imageSmoothingEnabled = false;
  // Night outside the room's walls, as in the study the look was chosen from.
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, ISO.width, ISO.height);

  drawFloor(ctx, room);
  drawWalls(ctx, state, sprites);

  for (const item of drawOrder(state, localNow)) item.paint(ctx, sprites);

  const tint = nightTint(hour);
  if (tint) {
    ctx.globalAlpha = tint.alpha;
    ctx.fillStyle = tint.colour;
    ctx.fillRect(0, 0, ISO.width, ISO.height);
    ctx.globalAlpha = 1;
  }

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
function drawFloor(ctx: Ctx, room: RoomView): void {
  for (let y = 1; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      poly(ctx, diamond(x, y), (x + y) % 2 ? ROOM[0] : ROOM[1]);
      poly(ctx, [up(x, y + 1), up(x + 1, y + 1), up(x + 1, y + 1.06), up(x, y + 1.06)], ROOM[2]);
    }
  }
}

/**
 * The two back walls: the plain one on the left, and the street wall on the
 * right with row 0's window, door and chalkboard on it, and the line's faces
 * in the window.
 */
function drawWalls(ctx: Ctx, state: CafeState, sprites: Sprites): void {
  const { room } = state;
  const H = ISO.wall;
  const wall = ROOM[3];
  const wainscot = ROOM[4];
  // Back-left wall.
  poly(ctx, [up(0, 1), up(0, room.height), up(0, room.height, H), up(0, 1, H)], shade(wall, 0.22));
  poly(ctx, [up(0, 1), up(0, room.height), up(0, room.height, 14), up(0, 1, 14)], shade(wainscot, 0.2));
  // The street wall.
  poly(ctx, [up(0, 1), up(room.width, 1), up(room.width, 1, H), up(0, 1, H)], shade(wall, 0.08));
  poly(ctx, [up(0, 1), up(room.width, 1), up(room.width, 1, 14), up(0, 1, 14)], wainscot);
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
        if (img) ctx.drawImage(img, 0, 0, TILE, 9, Math.round(face.x - TILE / 2), Math.round(face.y - 9), TILE, 9);
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
  const colour = COLOUR[f.kind] ?? FURNITURE[3];
  const z = HEIGHT[f.kind] ?? 8;
  const i = INSET[f.kind] ?? 0.06;
  const x = f.x + i;
  const y = f.y + i;
  const w = f.w - 2 * i;
  const h = f.h - 2 * i;
  if (f.kind !== "rug" && f.kind !== "cushion") poly(ctx, diamond(x - 0.06, y + 0.06, w + 0.12, h), shade(ROOM[0], 0.25));
  if (!f.toppled) {
    block(ctx, x, y, w, h, z, colour);
    return;
  }
  // Fallen toward the viewer: lower, and longer across its footprint.
  const along = Math.min(f.w - 0.1, w * 1.8);
  block(ctx, f.x + (f.w - along) / 2, y + h * 0.25, along, h * 0.5, Math.max(2, Math.round(z / 3)), colour);
  // Scattered toys (slice 02): a couple more balls of yarn strewn beside it,
  // where a cat batted them, until someone gathers them up.
  if (f.kind === "toys") {
    for (const [dx, dy, c] of SCATTERED) {
      const p = toCanvas(f.x + dx, f.y + dy);
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
      ctx.fillStyle = "#4a3426";
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }
}

/** Where scattered toys lie, in tiles from the toys' own tile, and their colours. */
const SCATTERED: [number, number, string][] = [
  [-0.3, 0.7, "#c96f6f"],
  [1.2, 0.3, "#7a9cc6"],
  [0.8, 1.1, "#c96f6f"],
];

function drawFlipped(ctx: Ctx, img: CanvasImageSource, at: Pt, facing: 1 | -1): void {
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  if (facing > 0) {
    ctx.drawImage(img, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x + TILE, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function drawCat(ctx: Ctx, sprites: Sprites, cat: Cat, spot: Spot, now: number, lift = 0): void {
  // Playing, a cat bats about on the spot; eating, grooming and held, it sits.
  const busy = spot.moving || cat.pose === "play";
  const frame: CatFrame = cat.pose === "nap" ? "nap" : busy ? (Math.floor(now / 160) % 2 ? "walk_a" : "walk_b") : "sit";
  const img = sprites.cat(cat.coat, frame);
  const feet = feetAt(spot);
  const at = { x: feet.x, y: feet.y - lift };
  if (img) {
    ctx.save();
    if (cat.pose === "hide") ctx.globalAlpha = 0.55;
    drawFlipped(ctx, img, at, spot.facing);
    ctx.restore();
  }
  const fresh = cat.reaction && now - cat.reaction.at < 2500 ? EMOTE_FOR[cat.reaction.reaction.kind] : null;
  const emote = fresh ?? (cat.pose === "nap" ? "zzz" : null);
  if (emote) blit(ctx, sprites.emote(emote), at.x + 4, at.y - 8);
}

/** A carried piece, held up over its carrier's head: a small block. */
function drawCarried(ctx: Ctx, piece: FurnitureView, spot: Spot, standing = 0): void {
  const lift = TILE + 6 + standing;
  const colour = COLOUR[piece.kind] ?? FURNITURE[3];
  const z = Math.min(HEIGHT[piece.kind] ?? 8, 14);
  const s = 0.6;
  const cx = spot.x + 0.5 - s / 2;
  const cy = spot.y + 0.5 - s / 2;
  ctx.save();
  ctx.translate(0, -lift);
  block(ctx, cx, cy, s, s, z, colour);
  ctx.restore();
}

function drawPerson(ctx: Ctx, sprites: Sprites, look: Look, spot: Spot, now: number, isYou: boolean, emote: EmoteName | null, lift = 0): void {
  const frame: AvatarFrame = spot.moving ? (Math.floor(now / 180) % 2 ? "walk_a" : "walk_b") : "stand";
  const img = sprites.avatar(look, frame);
  const feet = feetAt(spot);
  const at = { x: feet.x, y: feet.y - lift };
  if (img) drawFlipped(ctx, img, at, spot.facing);
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  if (isYou) {
    // A small marker over your own head.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 6, y - 4, 4, 2);
    ctx.fillRect(x + 7, y - 2, 2, 1);
  }
  if (emote) blit(ctx, sprites.emote(emote), x + 4, y - 13);
}
