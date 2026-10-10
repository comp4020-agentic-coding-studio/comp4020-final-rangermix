import { nightTint } from "./canberra";
import { type Spot, positionAt } from "./motion";
import type { FurnitureView } from "./protocol/FurnitureView";
import type { Look } from "./protocol/Look";
import type { Reaction } from "./protocol/Reaction";
import type { RoomView } from "./protocol/RoomView";
import { TILE } from "./scale";
import type { AvatarFrame, CatFrame, EmoteName, Sprites, TileName } from "./sprites";
import { type CafeState, type Cat, lapOf, serverNow } from "./state";

// Draws the whole café at 1:1 into the canvas; CSS scales it by a whole number.

export interface Pointer {
  tile: { x: number; y: number } | null;
  visible: boolean;
  /** The tile under the mouse, if it's over the room. */
  hover: { x: number; y: number } | null;
  /** What you carry, shown where it would go, and whether that looks allowed. */
  ghost: { piece: FurnitureView; at: { x: number; y: number }; ok: boolean } | null;
}

const GROUND: Record<string, TileName> = { ".": "floor", W: "wall", G: "window", D: "door", C: "board" };
/** How long an emote shows over its person. */
const EMOTE_MS = 2500;
/** Pieces that lie flat, drawn before anything that stands. */
const FLAT = new Set(["rug", "cushion"]);
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

  for (const f of room.furniture) if (FLAT.has(f.kind)) drawPiece(ctx, sprites, f);

  // Treats on the floor, and something in the bowls while there's any left.
  for (const at of state.treats.values()) blit(ctx, sprites.emote("treat"), at.x * TILE + 4, at.y * TILE + 6);

  // Everything that stands, back to front by the row it stands on.
  const items: { y: number; paint: () => void }[] = [];
  for (const f of room.furniture) {
    if (FLAT.has(f.kind)) continue;
    items.push({
      y: f.y + f.h - 1,
      paint: () => {
        drawPiece(ctx, sprites, f);
        if (f.kind === "bowls" && state.bowls > 0) {
          for (let k = 0; k < Math.min(state.bowls, f.w); k++) blit(ctx, sprites.emote("food"), (f.x + k) * TILE + 4, f.y * TILE + 4);
        }
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
    const onLap = lapOf(state, cat) !== null;
    items.push({ y: spot.y + (onLap ? 0.3 : 0.1), paint: () => drawCat(ctx, sprites, cat, spot, now) });
  }
  for (const person of state.people.values()) {
    if (person.place !== "inside") continue;
    const spot = positionAt(person.walk, person.at, now);
    const emote = state.emotes.get(person.id);
    const showing = emote && now - emote.at < EMOTE_MS ? emote.emote : null;
    const carried = state.held.get(person.id) ?? null;
    const held = inArms.get(person.id) ?? null;
    // Sitting, they sink a little into the seat.
    const seat = person.sitting && !spot.moving ? { ...spot, y: spot.y + 0.2 } : spot;
    items.push({
      y: spot.y + 0.2,
      paint: () => {
        drawPerson(ctx, sprites, person.look, seat, now, person.id === state.you, showing);
        if (carried) drawCarried(ctx, sprites, carried, seat);
        if (held) drawCat(ctx, sprites, held, { ...seat, y: seat.y - 0.35, moving: false }, now);
      },
    });
  }
  items.sort((a, b) => a.y - b.y).forEach((item) => item.paint());

  const tint = nightTint(hour);
  if (tint) {
    ctx.globalAlpha = tint.alpha;
    ctx.fillStyle = tint.colour;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  if (pointer.ghost) {
    const { piece, at, ok } = pointer.ghost;
    ctx.globalAlpha = 0.6;
    blit(ctx, sprites.furniture(piece.kind), at.x * TILE, at.y * TILE);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = ok ? "#3c9a5f" : "#d9534f";
    ctx.strokeRect(at.x * TILE + 0.5, at.y * TILE + 0.5, piece.w * TILE - 1, piece.h * TILE - 1);
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
  // Playing, a cat bats about on the spot; eating, grooming and held, it sits.
  const busy = spot.moving || cat.pose === "play";
  const frame: CatFrame = cat.pose === "nap" ? "nap" : busy ? (Math.floor(now / 160) % 2 ? "walk_a" : "walk_b") : "sit";
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

/** A piece where it stands; knocked over, it lies on its side. */
function drawPiece(ctx: CanvasRenderingContext2D, sprites: Sprites, f: FurnitureView): void {
  const img = sprites.furniture(f.kind);
  if (!img) return;
  if (!f.toppled) {
    ctx.drawImage(img, f.x * TILE, f.y * TILE);
    return;
  }
  ctx.save();
  ctx.translate(f.x * TILE + (f.w * TILE) / 2, f.y * TILE + (f.h * TILE) / 2 + 3);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -(f.w * TILE) / 2, -(f.h * TILE) / 2);
  ctx.restore();
}

/** A carried piece, held up over its carrier's head. */
function drawCarried(ctx: CanvasRenderingContext2D, sprites: Sprites, piece: FurnitureView, spot: Spot): void {
  const x = Math.round(spot.x * TILE - ((piece.w - 1) * TILE) / 2);
  const y = Math.round(spot.y * TILE - piece.h * TILE + 4);
  blit(ctx, sprites.furniture(piece.kind), x, y);
}

function drawPerson(ctx: CanvasRenderingContext2D, sprites: Sprites, look: Look, spot: Spot, now: number, isYou: boolean, emote: EmoteName | null): void {
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
  if (emote) blit(ctx, sprites.emote(emote), x + 4, y - 13);
}
