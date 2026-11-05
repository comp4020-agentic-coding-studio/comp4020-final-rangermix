import playlistFile from "../../content/music/playlist.toml?raw";
import { canberraHour } from "./canberra";

// The café's music (slice 15, ADR 0020): a day set and a night set by the
// Canberra clock, each visitor from their own player, and nothing sent to
// the server. This module makes the player's choices, with no sound in
// them: which set the hour picks, which track Next and Previous go to, and
// what follows a song that ends after the clock has crossed 17:00 or 6:00.
// musicPanel.ts plays what it chooses.

export type SetName = "day" | "night";

export interface Track {
  title: string;
  artist: string;
  file: string;
  source: string;
  licence: string;
}

export type Playlist = Record<SetName, Track[]>;

/**
 * What the player has loaded: a set's track by its place in the set. It
 * can be a set the clock has since left, while that song finishes.
 */
export interface Loaded {
  set: SetName;
  index: number;
}

/** The hour the night set starts, and the hour the day set does (design.md, "Numbers to tune"). */
export const NIGHT_FROM = 17;
export const DAY_FROM = 6;

/**
 * Reads playlist.toml: `[[day]]` and `[[night]]` tables of
 * `key = "quoted string"` lines, with comments. Enough TOML for this one
 * file; a line it can't read is an error, so a track is never dropped.
 */
export function parsePlaylist(text: string): Playlist {
  const out: Playlist = { day: [], night: [] };
  let into: Record<string, string> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*#.*/, "").trim();
    if (!line) continue;
    const table = /^\[\[(day|night)\]\]$/.exec(line);
    const kv = /^(title|artist|file|source|licence)\s*=\s*"([^"]*)"$/.exec(line);
    if (table) {
      into = {};
      out[table[1] as SetName].push(into as unknown as Track);
    } else if (kv && into) {
      into[kv[1]] = kv[2];
    } else {
      throw new Error(`playlist.toml: can't read ${JSON.stringify(raw)}`);
    }
  }
  return out;
}

export const playlist = parsePlaylist(playlistFile);

/** The set the Canberra hour picks: night from 17:00 until 6:00, day otherwise. */
export function setAt(hour: number): SetName {
  return hour >= DAY_FROM && hour < NIGHT_FROM ? "day" : "night";
}

/** The set the café's clock picks now. */
export function setNow(date = new Date()): SetName {
  return setAt(canberraHour(date));
}

/** Where each visit starts: the start of the clock's set's first track. */
export function start(hour: number): Loaded {
  return { set: setAt(hour), index: 0 };
}

export function trackOf(l: Loaded, list: Playlist = playlist): Track {
  return list[l.set][l.index];
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/**
 * The track after this one, round the clock's set. From a song the clock
 * has left, the new set's first track.
 */
export function next(l: Loaded, hour: number, list: Playlist = playlist): Loaded {
  const set = setAt(hour);
  if (set !== l.set) return { set, index: 0 };
  return { set, index: wrap(l.index + 1, list[set].length) };
}

/**
 * The track before this one, round the clock's set. From a song the clock
 * has left, the new set's last track.
 */
export function previous(l: Loaded, hour: number, list: Playlist = playlist): Loaded {
  const set = setAt(hour);
  if (set !== l.set) return { set, index: list[set].length - 1 };
  return { set, index: wrap(l.index - 1, list[set].length) };
}

/**
 * What follows a song that ended by itself: the next in its set, looping,
 * or, if the clock has crossed 17:00 or 6:00 while it played, the new
 * set's first track.
 */
export const ended = next;

/**
 * The track to keep loaded as the clock moves: a song begun (`played`
 * seconds in, playing or paused) finishes first; one not yet begun follows
 * the clock to the start of its set, so the panel names what Play will
 * play.
 */
export function settle(l: Loaded, hour: number, played: number): Loaded {
  if (played > 0 || setAt(hour) === l.set) return l;
  return start(hour);
}

/** What this device remembers of the music: whether it was on, and the volume in percent. Never sent to the server. */
export interface MusicSaved {
  on: boolean;
  volume: number;
}

/** The volume a first visit starts at, in percent (design.md, "Numbers to tune"). */
export const START_VOLUME = 40;

const MUSIC_KEY = "cafe.music";
let musicThisVisit: MusicSaved | null = null;

/**
 * What this device remembers of the music, or this visit's if it won't
 * store it: off at 40% to begin with, and what can't be read is left at that.
 */
export function rememberedMusic(): MusicSaved {
  const out: MusicSaved = { on: false, volume: START_VOLUME };
  let text: string | null;
  try {
    text = localStorage.getItem(MUSIC_KEY);
  } catch {
    return musicThisVisit ?? out;
  }
  if (text === null) return musicThisVisit ?? out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return out;
  }
  const o = parsed as Record<string, unknown> | null;
  if (o?.on === true) out.on = true;
  if (typeof o?.volume === "number" && o.volume >= 0 && o.volume <= 100) out.volume = o.volume;
  return out;
}

export function rememberMusic(saved: MusicSaved): void {
  musicThisVisit = { ...saved };
  try {
    localStorage.setItem(MUSIC_KEY, JSON.stringify({ on: saved.on, volume: saved.volume }));
  } catch {
    // Without storage it lasts this visit only.
  }
}
