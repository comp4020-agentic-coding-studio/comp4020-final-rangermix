import avatarSheet from "../../content/sprites/avatar.txt?raw";
import catSheet from "../../content/sprites/cat.txt?raw";
import emoteSheet from "../../content/sprites/emotes.txt?raw";
import furnitureSheet from "../../content/sprites/furniture.txt?raw";
import palettes from "../../content/sprites/palettes.json";
import roomSheet from "../../content/sprites/room.txt?raw";
import type { Look } from "./protocol/Look";

// Sprites are data (design.md, "The client"): grids of palette slots in
// content/sprites, coloured here and cached as canvases. Any of them can be
// redrawn without touching this code.

/** Palette slots; -1 is transparent. */
export type Grid = number[][];
export type TileName = "floor" | "wall" | "window" | "door" | "board";
export type CatFrame = "sit" | "walk_a" | "walk_b" | "nap";
export type AvatarFrame = "stand" | "walk_a" | "walk_b";
export type EmoteName = "heart" | "question" | "dots" | "zzz" | "sniff" | "wave" | "laugh" | "yawn" | "scratch" | "treat" | "food";

const SLOTS = "0123456789abcdef";

/** Splits a sheet into named grids; a line "== name" starts each one. */
export function parseSheet(text: string): Map<string, Grid> {
  const sheet = new Map<string, Grid>();
  let name: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith("== ")) {
      name = line.slice(3).trim();
      sheet.set(name, []);
    } else if (line !== "" && name !== null) {
      const sprite = name;
      sheet.get(sprite)!.push(
        [...line].map((ch) => {
          if (ch === ".") return -1;
          const slot = SLOTS.indexOf(ch);
          if (slot < 0) throw new Error(`sprite ${sprite}: unknown pixel ${JSON.stringify(ch)}`);
          return slot;
        }),
      );
    }
  }
  for (const [sprite, grid] of sheet) {
    if (grid.length === 0 || grid.some((row) => row.length !== grid[0].length)) {
      throw new Error(`sprite ${sprite} isn't a rectangle`);
    }
  }
  return sheet;
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The grid's pixels as RGBA bytes, ready for ImageData. */
export function toRgba(grid: Grid, palette: string[]): Uint8ClampedArray<ArrayBuffer> {
  const height = grid.length;
  const width = grid[0].length;
  const bytes = new Uint8ClampedArray(width * height * 4);
  grid.forEach((row, y) =>
    row.forEach((slot, x) => {
      if (slot < 0) return;
      const colour = palette[slot];
      if (!colour) throw new Error(`the palette has no slot ${slot}`);
      bytes.set([...rgb(colour), 255], (y * width + x) * 4);
    }),
  );
  return bytes;
}

/** One light's colours: the same lists as each set in palettes.json. */
export type Palette = typeof palettes.day;

const hexOf = (c: number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const blend = (a: string, b: string, t: number): string => hexOf(rgb(a).map((v, i) => v * (1 - t) + rgb(b)[i] * t));

/** Every list in `day` blended toward the same list in `night` by `t`. */
function blendAll<T>(day: T, night: T, t: number): T {
  if (Array.isArray(day)) return day.map((c, i) => blend(c, (night as string[])[i], t)) as T;
  return Object.fromEntries(Object.entries(day as Record<string, unknown>).map(([k, v]) => [k, blendAll(v, (night as Record<string, unknown>)[k], t)])) as T;
}

const blended = new Map<number, Palette>();

/**
 * The café's colours in a light (slice 10): the day set at 0, the night set
 * at 1, and between them slot by slot, as in the evening's 0.5.
 */
export function paletteAt(light: number): Palette {
  if (light <= 0) return palettes.day;
  if (light >= 1) return palettes.night as Palette;
  let p = blended.get(light);
  if (!p) blended.set(light, (p = blendAll(palettes.day, palettes.night as Palette, light)));
  return p;
}

export const AVATARS = palettes.day.avatars.skins.length;
export const COLOURS = palettes.day.avatars.colours.length;
/** A shirt's colour by day, as the look picker shows it. */
export const shirtColour = (i: number): string => palettes.day.avatars.colours[i % COLOURS];

/** An avatar's palette in a light: outline and eyes, skin, hair, shirt, trousers, shoes, white. */
export function avatarPalette(look: Look, light: number): string[] {
  const a = paletteAt(light).avatars;
  return [a.base[0], a.skins[look.avatar % AVATARS], a.hair[look.avatar % AVATARS], a.colours[look.colour % COLOURS], a.base[1], a.base[2], a.base[3]];
}

export class Sprites {
  /** How far toward night to colour them (slice 10); the stage sets it each frame. */
  light = 0;
  private readonly sheets = {
    room: parseSheet(roomSheet),
    furniture: parseSheet(furnitureSheet),
    cat: parseSheet(catSheet),
    avatar: parseSheet(avatarSheet),
    emote: parseSheet(emoteSheet),
  };
  private readonly cache = new Map<string, HTMLCanvasElement | null>();

  tile(name: TileName): HTMLCanvasElement | null {
    return this.get(`room:${name}`, this.sheets.room.get(name), paletteAt(this.light).room);
  }

  furniture(kind: string): HTMLCanvasElement | null {
    return this.get(`furniture:${kind}`, this.sheets.furniture.get(kind), paletteAt(this.light).furniture);
  }

  cat(coat: string, frame: CatFrame): HTMLCanvasElement | null {
    const coats = paletteAt(this.light).coats as Record<string, string[]>;
    return this.get(`cat:${coat}:${frame}`, this.sheets.cat.get(frame), coats[coat] ?? coats.white_grey);
  }

  avatar(look: Look, frame: AvatarFrame): HTMLCanvasElement | null {
    return this.get(`avatar:${look.avatar}:${look.colour}:${frame}`, this.sheets.avatar.get(frame), avatarPalette(look, this.light));
  }

  emote(name: EmoteName): HTMLCanvasElement | null {
    return this.get(`emote:${name}`, this.sheets.emote.get(name), paletteAt(this.light).emotes);
  }

  /** A sprite coloured in this light, made once and cached by name and light. */
  private get(name: string, grid: Grid | undefined, palette: string[]): HTMLCanvasElement | null {
    const key = `${name}@${this.light}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    let canvas: HTMLCanvasElement | null = null;
    if (grid) {
      canvas = document.createElement("canvas");
      canvas.width = grid[0].length;
      canvas.height = grid.length;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.putImageData(new ImageData(toRgba(grid, palette), canvas.width, canvas.height), 0, 0);
      else canvas = null;
    }
    this.cache.set(key, canvas);
    return canvas;
  }
}
