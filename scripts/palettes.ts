#!/usr/bin/env node
// Writes content/sprites/palettes.json: the café's colours by day and by
// night, led by Catppuccin (slice 10, ADR 0017). Run it after changing the
// mix here: `node scripts/palettes.ts`. The sprites are grids of palette
// slots, so these lists keep the slots the sheets already use; only the
// colours change.
//
// Catppuccin's colours below are from @catppuccin/palette 1.7.1
// (css/catppuccin.css), MIT licence, copyright (c) 2021 Catppuccin
// (https://catppuccin.com/). See content/sprites/CREDITS.md.
//
// Day: the "Catppuccin-led" mix judged in docs/notes/visual-direction.md.
// Mocha's darks for outlines, its pastels for cloth, cats, plants and
// shirts, and wood mixed from its peach and rosewater toward its surfaces,
// since Catppuccin has no brown.
//
// Night: each day colour pulled toward Mocha's base and a little lavender,
// keeping some of its own hue; the room furthest, cats and people less so
// they still read. The window's glass is lit with Mocha's yellow: lamplight
// from the street.
import { writeFileSync } from "node:fs";
import coatsFile from "../content/sprites/coats.json" with { type: "json" };

// A cat's coat is data, as AGENTS.md asks ("cats change through content/,
// not code"): its day colours are in content/sprites/coats.json, and only
// its night colours are worked out here. A new coat is a key there, then a
// run of this script (slice 10's review, finding 6).
const coats: Record<string, string[]> = coatsFile;

const m = {
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",
  surface2: "#585b70",
  surface1: "#45475a",
  surface0: "#313244",
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
};

const rgb = (h: string): number[] => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]): string => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** `a` blended toward `b` by `t` (0 to 1). */
export const mix = (a: string, b: string, t: number): string => hex(rgb(a).map((v, i) => v * (1 - t) + rgb(b)[i] * t));

const woodLight = mix(m.peach, m.rosewater, 0.35);
const wood = mix(m.peach, m.surface2, 0.38);
const woodDark = mix(m.peach, m.surface1, 0.6);
const woodDeep = mix(m.peach, m.base, 0.72);
const outline = mix(m.base, m.mauve, 0.12);

// The slots each sheet uses (content/sprites/*.txt); the comments say what
// the room's are drawn as in render.ts.
export const day = {
  room: [
    mix(m.peach, m.surface2, 0.3), // 0 floor, light boards
    mix(m.peach, m.surface2, 0.42), // 1 floor, dark boards
    mix(m.peach, m.surface2, 0.55), // 2 the boards' seams
    m.rosewater, // 3 the walls
    mix(m.maroon, m.surface1, 0.5), // 4 the wainscot
    mix(m.maroon, m.base, 0.7), // 5 frames: window, door, board
    m.flamingo, // 6
    m.crust, // 7
    m.sky, // 8 the window's glass
    wood, // 9 the door
    m.yellow, // 10 the door's knob
    mix(m.green, m.base, 0.75), // 11 the chalkboard
    m.text, // 12 chalk
  ],
  furniture: [
    outline,
    m.red,
    mix(m.red, m.base, 0.3),
    woodLight,
    woodDark,
    mix(m.rosewater, m.yellow, 0.4),
    m.green,
    mix(m.green, m.base, 0.4),
    mix(m.peach, m.maroon, 0.4),
    m.lavender,
    mix(m.lavender, m.text, 0.5),
    wood,
    woodDeep,
    m.subtext1,
    mix(m.peach, m.base, 0.45),
    m.sapphire,
  ],
  coats,
  avatars: {
    skins: [m.rosewater, mix(m.peach, m.rosewater, 0.4), mix(m.peach, m.surface2, 0.4), mix(m.peach, m.base, 0.62)],
    hair: [mix(m.base, m.mauve, 0.25), m.yellow, mix(m.maroon, m.base, 0.45), m.surface0],
    colours: [m.red, m.peach, m.green, m.sky, m.mauve, m.pink],
    base: [outline, m.surface1, mix(m.peach, m.base, 0.6), "#ffffff"],
  },
  emotes: [outline, m.red, "#ffffff", m.yellow, m.blue],
  // The street behind the café (slice 13), in the slots the client draws:
  // sky at the top, sky at the skyline, a tower, a tower's other side, a
  // window lit, a window dark, a star, the kerb, the pavement; then, for
  // more colour by day (the user, 2026-11-05), a cloud, its warm underside,
  // and the sky warming low by the skyline.
  street: [
    m.blue,
    m.lavender,
    mix(m.lavender, m.overlay1, 0.45),
    mix(m.lavender, m.overlay1, 0.7),
    m.rosewater,
    mix(m.lavender, m.text, 0.4),
    m.lavender,
    m.overlay1,
    mix(m.subtext0, m.overlay2, 0.5),
    mix(m.rosewater, "#ffffff", 0.55),
    mix(m.pink, m.lavender, 0.45),
    mix(m.peach, m.rosewater, 0.35),
  ],
  // The balcony under the terrace (slice 18): the deck's two stones, its
  // slab's edge, the glass's tint, the rail's metal, then the building's
  // window dark and lit, which by day is the dark one, so they light only
  // toward night. The building's wall is the room's.
  balcony: [
    mix(m.rosewater, m.subtext0, 0.35),
    mix(m.rosewater, m.subtext0, 0.5),
    mix(m.subtext0, m.overlay1, 0.5),
    mix(m.sky, m.text, 0.35),
    m.overlay0,
    mix(m.sky, m.overlay1, 0.45),
    mix(m.sky, m.overlay1, 0.45),
  ],
};

/** Night's pull on a colour: toward Mocha's base, with a touch of lavender. */
const dusk = mix(m.base, m.lavender, 0.18);
const toNight = (c: string, t: number): string => mix(c, dusk, t);
const all = <T extends string[]>(list: T, t: number): string[] => list.map((c) => toNight(c, t));

export const night = {
  // The room sinks furthest; the window's glass is lit instead.
  room: day.room.map((c, i) => (i === 8 ? m.yellow : toNight(c, 0.55))),
  furniture: all(day.furniture, 0.5),
  // Cats and people darken less, so they still read in the lamplight.
  coats: Object.fromEntries(Object.entries(day.coats).map(([k, v]) => [k, all(v, 0.3)])),
  avatars: Object.fromEntries(Object.entries(day.avatars).map(([k, v]) => [k, all(v, 0.3)])),
  // Emotes stay bright: they're what someone says.
  emotes: all(day.emotes, 0.1),
  // The street at night is its own: a dark sky with stars, the towers near
  // the base, and their windows lit with the street's lamplight.
  // Clouds faint against the dark; the warm band is the sky's own colour.
  street: [m.crust, m.base, mix(m.base, m.surface0, 0.5), m.surface0, m.yellow, m.surface1, m.text, m.surface0, m.mantle, mix(m.base, m.surface1, 0.55), mix(m.base, m.surface0, 0.6), m.base],
  // The balcony sinks with the room; the glass catches the dark, the rail
  // the room's lamplight, and the building's windows are lit as the room's.
  balcony: [
    toNight(day.balcony[0], 0.62),
    toNight(day.balcony[1], 0.62),
    toNight(day.balcony[2], 0.62),
    mix(m.surface1, m.lavender, 0.25),
    m.overlay1,
    m.surface0,
    m.yellow,
  ],
};

if (process.argv[1]?.endsWith("palettes.ts")) {
  const out = new URL("../content/sprites/palettes.json", import.meta.url);
  writeFileSync(out, `${JSON.stringify({ day, night }, null, 2)}\n`);
  console.log(`wrote ${out.pathname}`);
}
