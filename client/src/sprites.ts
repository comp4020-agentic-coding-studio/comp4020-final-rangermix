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

export const AVATARS = palettes.avatars.skins.length;
export const COLOURS = palettes.avatars.colours.length;
export const shirtColour = (i: number): string => palettes.avatars.colours[i % COLOURS];

/** An avatar's palette: outline and eyes, skin, hair, shirt, trousers, shoes, white. */
export function avatarPalette(look: Look): string[] {
  const a = palettes.avatars;
  return [a.base[0], a.skins[look.avatar % AVATARS], a.hair[look.avatar % AVATARS], shirtColour(look.colour), a.base[1], a.base[2], a.base[3]];
}

export class Sprites {
  private readonly sheets = {
    room: parseSheet(roomSheet),
    furniture: parseSheet(furnitureSheet),
    cat: parseSheet(catSheet),
    avatar: parseSheet(avatarSheet),
    emote: parseSheet(emoteSheet),
  };
  private readonly cache = new Map<string, HTMLCanvasElement | null>();

  tile(name: TileName): HTMLCanvasElement | null {
    return this.get(`room:${name}`, this.sheets.room.get(name), palettes.room);
  }

  furniture(kind: string): HTMLCanvasElement | null {
    return this.get(`furniture:${kind}`, this.sheets.furniture.get(kind), palettes.furniture);
  }

  cat(coat: string, frame: CatFrame): HTMLCanvasElement | null {
    const coats = palettes.coats as Record<string, string[]>;
    return this.get(`cat:${coat}:${frame}`, this.sheets.cat.get(frame), coats[coat] ?? coats.white_grey);
  }

  avatar(look: Look, frame: AvatarFrame): HTMLCanvasElement | null {
    return this.get(`avatar:${look.avatar}:${look.colour}:${frame}`, this.sheets.avatar.get(frame), avatarPalette(look));
  }

  emote(name: EmoteName): HTMLCanvasElement | null {
    return this.get(`emote:${name}`, this.sheets.emote.get(name), palettes.emotes);
  }

  private get(key: string, grid: Grid | undefined, palette: string[]): HTMLCanvasElement | null {
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
