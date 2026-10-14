import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CI pipes the app's own output through scripts/check-logs.ts after the spec
// has run (plan-phase-3.md, Task 8): the log line rules hold for what real
// visitors did, and nothing anyone said is in any line. Pure, so it needs no
// running app.

const script = fileURLToPath(new URL("../scripts/check-logs.ts", import.meta.url));
const check = (lines: object[], ...said: string[]) =>
  spawnSync(process.execPath, [script, ...said], { input: lines.map((l) => JSON.stringify(l)).join("\n"), encoding: "utf8" });

const at = "2026-10-09T08:42:07.123Z";
const woke = { timestamp: at, level: "INFO", target: "cafe", what: "woke", first: true, gap_secs: 0, steps: 0, capped: false, took_ms: 0, refills: 0, walks: "" };
const listening = { timestamp: at, level: "INFO", target: "sys", port: 8080, message: "listening" };
const good = [
  woke,
  listening,
  { timestamp: at, level: "INFO", target: "action", uid: 3, who: "sam", what: "say", outcome: "ok", len: 11, to: "jo" },
  { timestamp: at, level: "INFO", target: "action", uid: 3, who: "sam", what: "pet", cat: "Mochi", outcome: "welcome" },
  { timestamp: at, level: "INFO", target: "action", what: "login", outcome: "refused", code: "badLogin" },
  { timestamp: at, level: "INFO", target: "cat", cat: "Mochi", what: "nap", on: "sofa" },
];

describe("checking the app's own log lines", () => {
  it("passes the café's lines", () => {
    const r = check(good, "hello there");
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });

  it("fails a line that holds something someone said", () => {
    const r = check([...good, { ...good[1], text: "hello there" }], "hello there");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("something said");
  });

  it("fails an action line that doesn't say who or what, and a say line without its length", () => {
    expect(check([{ timestamp: at, target: "action", what: "pet", outcome: "ok" }]).status).not.toBe(0);
    expect(check([{ timestamp: at, target: "action", uid: 3, who: "sam", outcome: "ok" }]).status).not.toBe(0);
    expect(check([{ timestamp: at, target: "action", uid: 3, who: "sam", what: "say", outcome: "ok" }]).status).not.toBe(0);
  });

  it("fails a start that didn't log its wake-up, and a wake-up without its numbers", () => {
    // Slice 01: every start replays the gap and says so before it listens.
    expect(check([woke, listening, { ...woke, first: false, gap_secs: 20, steps: 20, took_ms: 3 }, listening]).status).toBe(0);
    const r = check([woke, listening, listening]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("wake-up");
    expect(check([listening]).status).not.toBe(0);
    expect(check([{ ...woke, steps: "20" }, listening]).status).not.toBe(0);
    expect(check([{ ...woke, took_ms: undefined }, listening]).status).not.toBe(0);
  });

  it("fails what isn't one JSON line with a time and a target", () => {
    const r = spawnSync(process.execPath, [script], { input: "thread 'main' panicked at src/main.rs:1:1\n", encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(check([{ level: "INFO", target: "action" }]).status).not.toBe(0);
  });
});
