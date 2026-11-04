import streetFile from "../../content/street.toml?raw";

// The street behind the café (slice 13, ADR 0018): sky, the towers across
// the road, the kerb and the pavement, round the room's diamond. Its shape
// is content/street.toml, its colours the palette's "street" slots, so it
// changes with the hour as the room does.

export interface Street {
  horizon: number;
  windows: { every: number; size: number; lit: number };
  towers: { width: number; height: number }[];
}

/** The street's slots in the palette's "street" list. */
export const STREET = { skyTop: 0, sky: 1, tower: 2, towerSide: 3, lit: 4, dark: 5, star: 6, kerb: 7, pavement: 8 } as const;

/**
 * Reads street.toml: top-level `key = number` lines, one `[windows]` table
 * and `[[towers]]` tables of numbers. Enough TOML for this one file, which
 * the server's tests also read with a real parser.
 */
export function parseStreet(text: string): Street {
  const top: Record<string, number> = {};
  const windows: Record<string, number> = {};
  const towers: Record<string, number>[] = [];
  let into: Record<string, number> = top;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    if (line === "[[towers]]") {
      into = {};
      towers.push(into);
    } else if (line === "[windows]") {
      into = windows;
    } else {
      const m = /^(\w+)\s*=\s*(-?[\d.]+)$/.exec(line);
      if (!m) throw new Error(`street.toml: can't read ${JSON.stringify(raw)}`);
      into[m[1]] = Number(m[2]);
    }
  }
  return {
    horizon: top.horizon,
    windows: { every: windows.every, size: windows.size, lit: windows.lit },
    towers: towers.map((t) => ({ width: t.width, height: t.height })),
  };
}

export const street = parseStreet(streetFile);

/** A 4×4 ordered dither, so bands of sky step in a pattern, not a soft blend. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A fixed pattern of lit windows: the same windows lit every frame, about `lit` in 10. */
function isLit(tower: number, col: number, row: number, lit: number): boolean {
  return (((tower * 7 + col * 13 + row * 29) * 2654435761) >>> 0) % 10 < lit;
}

/** A fixed scatter of stars: about one pixel in 140 of the upper sky. */
function isStar(x: number, y: number): boolean {
  return (((x * 7919) ^ (y * 104729)) >>> 0) % 140 === 0;
}

/**
 * Which of the street's slots is at backdrop pixel (x, y) at 1×, on a
 * backdrop `w` by `h`. `night` is whether stars show: only once the light
 * has turned.
 */
export function streetSlot(x: number, y: number, w: number, h: number, night: boolean): number {
  const horizon = Math.round(h * street.horizon);
  if (y >= horizon) {
    // The kerb, then the pavement, darkening down into the street's shade
    // below the room, in dithered steps, so the room stands on it.
    const d = y - horizon;
    if (d < 1) return STREET.kerb;
    const depth = d / (h - horizon);
    return depth * 3 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5 < 1 ? STREET.pavement : STREET.kerb;
  }
  // The towers, repeated across the backdrop.
  const total = street.towers.reduce((n, t) => n + t.width, 0);
  let at = ((x % total) + total) % total;
  let i = 0;
  while (at >= street.towers[i].width) {
    at -= street.towers[i].width;
    i++;
  }
  const tower = street.towers[i];
  const top = horizon - Math.round(horizon * tower.height);
  if (y >= top) {
    const { every, size, lit } = street.windows;
    const col = Math.floor(at / every);
    const row = Math.floor((horizon - 1 - y) / every);
    const inWindow = at % every < size && (horizon - 1 - y) % every < size && at >= 2 && at < tower.width - 2 && y > top + 1;
    if (inWindow) return isLit(i, col, row, lit) ? STREET.lit : STREET.dark;
    // Each tower lit on its left, in shade on its right, as the room is.
    return at >= tower.width - 3 ? STREET.towerSide : STREET.tower;
  }
  if (night && isStar(x, y) && y < horizon * 0.7) return STREET.star;
  // Sky, darker at the top, in dithered bands down to the skyline.
  const t = y / horizon;
  return t * 4 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5 < 2 ? STREET.skyTop : STREET.sky;
}
