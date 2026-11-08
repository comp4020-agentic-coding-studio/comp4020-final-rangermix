import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// `pnpm check` and CI are one script, scripts/check.sh: CI's two jobs each run
// one half of it, and `pnpm check` runs both, so a check can't be in one and
// missing from the other.
const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const steps = read(".github/workflows/checks.yml")
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");
const script = read("scripts/check.sh");
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

describe("pnpm check and CI", () => {
  it("are the same script", () => {
    expect(pkg.scripts.check).toBe("bash scripts/check.sh");
    expect(steps).toMatch(/run: pnpm check web$/m);
    expect(steps).toMatch(/run: bash scripts\/check\.sh rust$/m);
  });

  it("leave CI nothing of its own but the secret scans and the deploy", () => {
    for (const own of ["docker ", "check-logs.ts", "check:evidence", "cargo ", "git diff", "playwright"]) {
      expect(steps, own).not.toContain(own);
    }
  });

  it("run every check CI ran", () => {
    for (const step of [
      "pnpm typecheck",
      "pnpm -C client check",
      "playwright install",
      "check-app.sh build",
      "check-app.sh seed",
      "check-app.sh start",
      "pnpm test",
      "check-logs.ts --wall",
      "pnpm check:evidence",
      "cargo fmt --check",
      "cargo clippy --all-targets -- -D warnings",
      "cargo test\n",
      "check-protocol.sh",
    ]) {
      expect(script, step).toContain(step);
    }
  });
});
