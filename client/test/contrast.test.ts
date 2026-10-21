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
