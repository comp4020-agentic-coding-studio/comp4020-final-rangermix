import { nightTint } from "./canberra";
import { type Spot, positionAt } from "./motion";
import type { Look } from "./protocol/Look";
import type { Reaction } from "./protocol/Reaction";
import type { RoomView } from "./protocol/RoomView";
import { TILE } from "./scale";
import type { AvatarFrame, CatFrame, EmoteName, Sprites, TileName } from "./sprites";
import { type CafeState, type Cat, serverNow } from "./state";

// Draws the whole café at 1:1 into the canvas; CSS scales it by a whole number.

export interface Pointer {
  tile: { x: number; y: number } | null;
  visible: boolean;
}

const GROUND: Record<string, TileName> = { ".": "floor", W: "wall", G: "window", D: "door", C: "board" };
/** Pieces that lie flat, drawn before anything that stands. */
const FLAT = new Set(["rug"]);
const EMOTE_FOR: Record<Reaction["kind"], EmoteName> = {
  lookUp: "question",
  sniff: "sniff",
  purr: "heart",
  tolerate: "dots",
  refuse: "dots",
  greet: "heart",
};

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

function blit(ctx: CanvasRenderingContext2D, img: CanvasImageSource | null, x: number, y: number): void {
  if (img) ctx.drawImage(img, x, y);
}

export function draw(ctx: CanvasRenderingContext2D, state: CafeState, sprites: Sprites, localNow: number, pointer: Pointer, hour: number): void {
  const now = serverNow(state, localNow);
  const { room } = state;
  const width = room.width * TILE;
  const height = room.height * TILE;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  room.tiles.forEach((row, y) => [...row].forEach((ch, x) => blit(ctx, sprites.tile(GROUND[ch] ?? "floor"), x * TILE, y * TILE)));

  // The line at the window: faces through the glass.
  const tiles = windowTiles(room);
  const line = [...state.people.values()].filter((p) => p.place === "window").slice(0, tiles.length);
  line.forEach((person, i) => {
    const img = sprites.avatar(person.look, "stand");
    if (img) ctx.drawImage(img, 0, 0, TILE, 9, tiles[i].x * TILE, 1, TILE, 9);
  });

  for (const f of room.furniture) if (FLAT.has(f.kind)) blit(ctx, sprites.furniture(f.kind), f.x * TILE, f.y * TILE);

  // Everything that stands, back to front by the row it stands on.
  const items: { y: number; paint: () => void }[] = [];
  for (const f of room.furniture) {
    if (!FLAT.has(f.kind)) items.push({ y: f.y + f.h - 1, paint: () => blit(ctx, sprites.furniture(f.kind), f.x * TILE, f.y * TILE) });
  }
  for (const cat of state.cats.values()) {
    const spot = positionAt(cat.walk, cat.at, now);
    items.push({ y: spot.y + 0.1, paint: () => drawCat(ctx, sprites, cat, spot, now) });
  }
  for (const person of state.people.values()) {
    if (person.place !== "inside") continue;
    const spot = positionAt(person.walk, person.at, now);
    items.push({ y: spot.y + 0.2, paint: () => drawPerson(ctx, sprites, person.look, spot, now, person.id === state.you) });
  }
  items.sort((a, b) => a.y - b.y).forEach((item) => item.paint());

  const tint = nightTint(hour);
  if (tint) {
    ctx.globalAlpha = tint.alpha;
    ctx.fillStyle = tint.colour;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  if (pointer.visible && pointer.tile) {
    const { x, y } = pointer.tile;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    ctx.strokeStyle = "#2f6fd1";
    ctx.strokeRect(x * TILE + 1.5, y * TILE + 1.5, TILE - 3, TILE - 3);
  }
}

function drawFlipped(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, facing: 1 | -1): void {
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

function drawCat(ctx: CanvasRenderingContext2D, sprites: Sprites, cat: Cat, spot: Spot, now: number): void {
  const frame: CatFrame = cat.pose === "nap" ? "nap" : spot.moving ? (Math.floor(now / 160) % 2 ? "walk_a" : "walk_b") : "sit";
  const img = sprites.cat(cat.coat, frame);
  const x = Math.round(spot.x * TILE);
  const y = Math.round(spot.y * TILE);
  if (img) {
    ctx.save();
    if (cat.pose === "hide") ctx.globalAlpha = 0.55;
    drawFlipped(ctx, img, x, y, spot.facing);
    ctx.restore();
  }
  const fresh = cat.reaction && now - cat.reaction.at < 2500 ? EMOTE_FOR[cat.reaction.reaction.kind] : null;
  const emote = fresh ?? (cat.pose === "nap" ? "zzz" : null);
  if (emote) blit(ctx, sprites.emote(emote), x + 4, y - 8);
}

function drawPerson(ctx: CanvasRenderingContext2D, sprites: Sprites, look: Look, spot: Spot, now: number, isYou: boolean): void {
  const frame: AvatarFrame = spot.moving ? (Math.floor(now / 180) % 2 ? "walk_a" : "walk_b") : "stand";
  const img = sprites.avatar(look, frame);
  const x = Math.round(spot.x * TILE);
  const y = Math.round(spot.y * TILE);
  if (img) drawFlipped(ctx, img, x, y, spot.facing);
  if (isYou) {
    // A small marker over your own head.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 6, y - 4, 4, 2);
    ctx.fillRect(x + 7, y - 2, 2, 1);
  }
}
