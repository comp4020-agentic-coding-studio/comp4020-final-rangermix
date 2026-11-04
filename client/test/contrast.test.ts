import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Read from disk: a CSS import is the bundler's to handle, not text. The
// client's tests run from client/.
const css = readFileSync(join(process.cwd(), "src/style.css"), "utf8");

// Slice 10: the page in Catppuccin, Latte for a light setting and Mocha for a
// dark one, with every text and control colour at 4.5:1 or better against
// what it sits on, read from the page's own stylesheet.

/** The tokens set on :root, in the light theme or under the dark media query. */
function tokens(theme: "light" | "dark"): Record<string, string> {
  const dark = css.indexOf("@media (prefers-color-scheme: dark)");
  const block = theme === "light" ? css.slice(0, dark) : css.slice(dark, css.indexOf("}\n}", dark));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("the page's colours", () => {
  it("takes Catppuccin Latte's base and text in a light setting, and Mocha's in a dark one", () => {
    expect(tokens("light").paper).toBe("#eff1f5");
    expect(tokens("light").ink).toBe("#4c4f69");
    expect(tokens("dark").paper).toBe("#1e1e2e");
    expect(tokens("dark").ink).toBe("#cdd6f4");
  });

  for (const theme of ["light", "dark"] as const) {
    it(`keeps every text and control at 4.5:1 or better in the ${theme} theme`, () => {
      const t = tokens(theme);
      const pairs: [string, string, string][] = [
        ["text on the page", t.ink, t.paper],
        ["text on a card", t.ink, t.card],
        ["muted text on the page", t.muted, t.paper],
        ["muted text on a card", t.muted, t.card],
        ["a button's label on the accent", t["accent-ink"], t.accent],
        ["a link on the page", t.accent, t.paper],
        ["a link on a card", t.accent, t.card],
        ["an error on the page", t.error, t.paper],
        ["an error on a card", t.error, t.card],
        // Slice 10's review, finding 2: the talk box's hint, which the
        // browser would otherwise draw in its own grey.
        ["a placeholder in a box on the page", t.placeholder, t.paper],
        ["a placeholder in a box on a card", t.placeholder, t.card],
      ];
      for (const [what, fg, bg] of pairs) {
        expect(fg && bg, `${what}: a token is missing`).toBeTruthy();
        expect(contrast(fg, bg), `${what} (${fg} on ${bg})`).toBeGreaterThanOrEqual(4.5);
      }
      // A graphic that means something, the trust bar, at 3:1 against its track.
      expect(t.track, "the trust bar's track: a token is missing").toBeTruthy();
      expect(contrast(t.accent, t.track), `the trust bar (${t.accent} on ${t.track})`).toBeGreaterThanOrEqual(3);
    });
  }

  it("draws a box's placeholder and the trust bar's track from the tokens, not the browser's own colours", () => {
    expect(css).toMatch(/::placeholder\s*\{[^}]*color:\s*var\(--placeholder\)/);
    expect(css).toMatch(/\.trust-bar\s*\{[^}]*background:\s*var\(--track\)/);
  });
});

// Slice 14: a panel floats over the room, half see-through, and its text
// must hold 4.5:1 whatever is behind it. A plain see-through colour can't:
// over the street's sky and the night the background swings too far. So
// the panel first squeezes what's behind it into a narrow band at its own
// end of the scale, with a backdrop filter, then lays its glass over that
// at 50% (20% dimmed). This computes what the browser draws, as Chrome was
// measured to (plan-slice-14-panels.md, decision 3), and checks every text
// colour on it over black, white and every colour the room and street use.

import palettes from "../../content/sprites/palettes.json";

/** The tokens for one theme, glass and filter included, as strings. */
function raw(theme: "light" | "dark"): Record<string, string> {
  const dark = css.indexOf("@media (prefers-color-scheme: dark)");
  const block = theme === "light" ? css.slice(0, dark) : css.slice(dark, css.indexOf("}\n}", dark));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** `contrast(c) brightness(b)`, as the filter's two numbers. */
function filterOf(value: string): { c: number; b: number } {
  const c = /contrast\(([\d.]+)\)/.exec(value);
  const b = /brightness\(([\d.]+)\)/.exec(value);
  expect(c && b, `the glass's filter is "${value}"`).toBeTruthy();
  return { c: Number(c![1]), b: Number(b![1]) };
}

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("")}`;

/** What shows through a panel over `behind`: the filter, then the glass at `alpha`. */
function through(behind: string, glass: string, alpha: number, f: { c: number; b: number }): string {
  const filtered = channels(behind).map((v) => Math.max(0, Math.min(1, Math.max(0, Math.min(1, (v - 0.5) * f.c + 0.5)) * f.b)));
  return toHex(channels(glass).map((g, i) => alpha * g + (1 - alpha) * filtered[i]));
}

/** Every colour the room and street are drawn in, by day and by night, and black and white. */
const behindColours = (): string[] => {
  const out = new Set(["#000000", "#ffffff"]);
  const walk = (v: unknown) => {
    if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) out.add(v.toLowerCase());
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(palettes);
  return [...out];
};

describe("the panels over the room (slice 14)", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`keeps a panel's text at 4.5:1 over anything behind it, normally and dimmed, in the ${theme} theme`, () => {
      const t = raw(theme);
      const colours = tokens(theme);
      for (const [state, alphaToken] of [
        ["normally", "glass-alpha"],
        ["dimmed", "glass-alpha-dim"],
      ] as const) {
        expect(t[alphaToken], `--${alphaToken}`).toBeTruthy();
        expect(t["glass-filter"], "--glass-filter").toBeTruthy();
        const alpha = Number(t[alphaToken]);
        const f = filterOf(t["glass-filter"]);
        for (const behind of behindColours()) {
          const bg = through(behind, colours.card, alpha, f);
          // A panel's words are text and muted text; its buttons have their
          // own opaque card behind them, and it holds no links.
          for (const [what, fg] of [
            ["text", colours.ink],
            ["muted text", colours.muted],
          ] as const) {
            expect(contrast(fg, bg), `${what} ${state} over ${behind} (${fg} on ${bg})`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    });
  }

  it("is half see-through normally and about a fifth dimmed, as the spec's numbers say", () => {
    for (const theme of ["light", "dark"] as const) {
      const t = raw(theme);
      expect(Number(t["glass-alpha"])).toBeCloseTo(0.5, 2);
      expect(Number(t["glass-alpha-dim"])).toBeCloseTo(0.2, 2);
    }
  });

  it("draws the panels' glass from the tokens, and is opaque where a browser can't filter what's behind", () => {
    const desktop = css.slice(css.indexOf("@media (min-width: 960px)"));
    expect(desktop).toMatch(/@supports \(backdrop-filter: blur\(0\)\) or \(-webkit-backdrop-filter: blur\(0\)\)/);
    const glass = desktop.slice(desktop.indexOf("@supports"));
    expect(glass).toMatch(/\.panel\s*\{[^}]*backdrop-filter:\s*var\(--glass-filter\)/);
    expect(glass).toMatch(/\.panel\s*\{[^}]*background:\s*rgb\(from var\(--card\) r g b \/ var\(--glass-alpha\)\)/);
    expect(glass).toMatch(/\.panel\.dim\s*\{[^}]*background:\s*rgb\(from var\(--card\) r g b \/ var\(--glass-alpha-dim\)\)/);
  });
});
