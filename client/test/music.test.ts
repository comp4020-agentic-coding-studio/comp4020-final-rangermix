import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canberraHour } from "../src/canberra";
import { type Loaded, ended, next, parsePlaylist, playlist, previous, rememberMusic, rememberedMusic, setAt, settle, start, trackOf } from "../src/music";

// Slice 15: the player's choices, with no sound in them. Which set the
// Canberra hour picks (night from 17:00 until 6:00), which track Next and
// Previous go to (round the clock's set's three), and what follows when a
// song ends after the clock has crossed 17:00 or 6:00 (the song finishes
// first; then the new set's first track).

const DAY = ["Bubbles", "Ocean Breeze", "Tranquil Mindscape"];
const NIGHT = ["Moon Unit", "Ease into Night", "One Night in France"];
const title = (l: Loaded) => trackOf(l).title;

/** The hour in Canberra of a fake clock set to `hhmm` on 5 November 2026 (AEDT). */
const at = (hhmm: string) => canberraHour(new Date(`2026-11-05T${hhmm}:00+11:00`));

describe("the playlist, as the client reads it", () => {
  it("is content/music/playlist.toml's two sets, in its order, each track with its title, artist, file and source", () => {
    expect(playlist.day.map((t) => t.title)).toEqual(DAY);
    expect(playlist.night.map((t) => t.title)).toEqual(NIGHT);
    for (const t of [...playlist.day, ...playlist.night]) {
      expect(t.artist).toBe("HoliznaCC0");
      expect(t.file).toMatch(/^[a-z-]+\.mp3$/);
      expect(t.source).toMatch(/^https:\/\/freemusicarchive\.org\//);
    }
    const text = readFileSync(join(process.cwd(), "..", "content/music/playlist.toml"), "utf8");
    expect(parsePlaylist(text)).toEqual(playlist);
  });

  it("refuses a line it can't read, rather than dropping a track", () => {
    expect(() => parsePlaylist('[[day]]\ntitle = Bubbles\n')).toThrow(/can't read/);
    expect(() => parsePlaylist('[[evening]]\ntitle = "x"\n')).toThrow(/can't read/);
  });
});

describe("the set by the Canberra clock", () => {
  it("is the day set from 6:00 to 16:59 and the night set from 17:00 to 5:59, every hour of a day", () => {
    for (let h = 0; h < 24; h++) expect(setAt(h), `${h}:00`).toBe(h >= 6 && h < 17 ? "day" : "night");
  });

  it("starts each visit at the start of the clock's set's first track", () => {
    expect(title(start(at("10:00")))).toBe("Bubbles");
    expect(title(start(at("16:59")))).toBe("Bubbles");
    expect(title(start(at("17:00")))).toBe("Moon Unit");
    expect(title(start(at("05:59")))).toBe("Moon Unit");
    expect(title(start(at("06:00")))).toBe("Bubbles");
  });
});

describe("Next and Previous", () => {
  it("go round the clock's set's three tracks, wrapping, and never leave it", () => {
    const h = at("11:00");
    let l = start(h);
    const seen = [title(l)];
    for (let i = 0; i < 6; i++) seen.push(title((l = next(l, h))));
    expect(seen).toEqual([...DAY, ...DAY, "Bubbles"]);
    l = start(h);
    const back = [title(l)];
    for (let i = 0; i < 3; i++) back.push(title((l = previous(l, h))));
    expect(back).toEqual(["Bubbles", "Tranquil Mindscape", "Ocean Breeze", "Bubbles"]);
    const n = at("23:00");
    l = start(n);
    for (let i = 0; i < 7; i++) {
      l = i % 3 === 2 ? previous(l, n) : next(l, n);
      expect(NIGHT, `step ${i}`).toContain(title(l));
    }
  });

  it("from a song the clock has left, go to the new set: Next to its first track, Previous to its last", () => {
    const l = next(start(at("16:30")), at("16:30"));
    expect(title(l)).toBe("Ocean Breeze");
    expect(title(next(l, at("17:01")))).toBe("Moon Unit");
    expect(title(previous(l, at("17:01")))).toBe("One Night in France");
    const night = next(start(at("05:50")), at("05:50"));
    expect(title(next(night, at("06:00")))).toBe("Bubbles");
    expect(title(previous(night, at("06:00")))).toBe("Tranquil Mindscape");
  });
});

describe("crossing 17:00 or 6:00 mid-song", () => {
  it("keeps the song, playing or paused, until it ends; then the new set's first track follows", () => {
    const h = at("16:57");
    const l = next(next(start(h), h), h);
    expect(title(l)).toBe("Tranquil Mindscape");
    // Paused at 16:58 with a minute played, and pressed Play at 17:05:
    // settling it keeps the song where it stopped.
    expect(settle(l, at("17:05"), 61)).toEqual(l);
    // It ends by itself at 17:06.
    expect(title(ended(l, at("17:06")))).toBe("Moon Unit");
    // And the same at 6:00, the other way.
    const n = start(at("05:58"));
    expect(settle(n, at("06:01"), 30)).toEqual(n);
    expect(title(ended(n, at("06:02")))).toBe("Bubbles");
  });

  it("within a set, a song that ends is followed by the next, looping from the last to the first", () => {
    const h = at("20:00");
    let l = start(h);
    const heard = [title(l)];
    for (let i = 0; i < 4; i++) heard.push(title((l = ended(l, h))));
    expect(heard).toEqual([...NIGHT, "Moon Unit", "Ease into Night"]);
  });

  it("a track not yet begun follows the clock: the panel shows the set it's now, not the one it was", () => {
    const l = start(at("16:50"));
    expect(title(settle(l, at("17:00"), 0))).toBe("Moon Unit");
    expect(settle(l, at("16:59"), 0)).toEqual(l);
  });
});

describe("remembering the music on this device", () => {
  /** Runs `fn` with localStorage throwing, as a browser blocking storage does. */
  function blocked(fn: () => void): void {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    try {
      fn();
    } finally {
      Object.defineProperty(window, "localStorage", real);
    }
  }

  it("starts off, at 40%, on a device that remembers nothing", () => {
    localStorage.removeItem("cafe.music");
    expect(rememberedMusic()).toEqual({ on: false, volume: 40 });
  });

  it("remembers on or off and the volume under cafe.music, and nothing else", () => {
    rememberMusic({ on: true, volume: 65 });
    expect(localStorage.getItem("cafe.music")).toBe(JSON.stringify({ on: true, volume: 65 }));
    expect(rememberedMusic()).toEqual({ on: true, volume: 65 });
    rememberMusic({ on: false, volume: 65 });
    expect(rememberedMusic()).toEqual({ on: false, volume: 65 });
    localStorage.removeItem("cafe.music");
  });

  it("reads what it can of a damaged record, and the starting values for the rest", () => {
    for (const [text, want] of [
      ["not json", { on: false, volume: 40 }],
      [JSON.stringify({ on: "yes", volume: 70 }), { on: false, volume: 70 }],
      [JSON.stringify({ on: true, volume: 400 }), { on: true, volume: 40 }],
      [JSON.stringify({ on: true, volume: -5 }), { on: true, volume: 40 }],
      [JSON.stringify({ on: true, volume: "loud" }), { on: true, volume: 40 }],
      [JSON.stringify(null), { on: false, volume: 40 }],
    ] as const) {
      localStorage.setItem("cafe.music", text);
      expect(rememberedMusic(), text).toEqual(want);
    }
    localStorage.removeItem("cafe.music");
  });

  it("keeps it for the visit when the device won't store it", () => {
    blocked(() => {
      rememberMusic({ on: true, volume: 30 });
      expect(rememberedMusic()).toEqual({ on: true, volume: 30 });
    });
  });
});
