import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { narrate } from "../scripts/narrate.ts";

// The live view for crit 10: `pnpm logs` turns each JSON line the server
// writes into a sentence. Pure, so it needs no running app.

const at = "2026-10-09T08:42:07.123Z"; // 19:42:07 in Canberra (AEDT)
const line = (fields: Record<string, unknown>) => JSON.stringify({ timestamp: at, level: "INFO", ...fields });

describe("narrating the logs", () => {
  it("tells who did what, in Canberra time", () => {
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "arrive", outcome: "ok", place: "inside" }))).toBe("19:42:07  sam came in");
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "arrive", outcome: "ok", place: "window" }))).toBe("19:42:07  sam is waiting at the window");
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "pet", outcome: "welcome", cat: "mochi" }))).toBe("19:42:07  sam petted mochi, who purred");
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "call", outcome: "ok", len: 5 }))).toBe("19:42:07  sam called a cat");
  });

  it("says that someone talked, and to whom, but never what", () => {
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "say", outcome: "ok", len: 12, to: "jo" }))).toBe("19:42:07  sam said something to jo (12 characters)");
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "say", outcome: "ok", len: 4 }))).toBe("19:42:07  sam said something (4 characters)");
  });

  it("tells refusals and walks over apart", () => {
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "walk", outcome: "refused", code: "notFromWindow" }))).toBe("19:42:07  sam tried to walk, refused: notFromWindow");
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "grab", outcome: "walking" }))).toBe("19:42:07  sam is walking over to grab");
  });

  it("tells the cats' story", () => {
    expect(narrate(line({ target: "cat", cat: "Burakku", what: "hide", on: "box" }))).toBe("19:42:07  Burakku hid in the box");
    expect(narrate(line({ target: "cat", cat: "Mochi", what: "come_to", on: "floor", with: "sam" }))).toBe("19:42:07  Mochi came over to sam");
  });

  it("reads the lines flyctl prints, and passes over what isn't a log line", () => {
    const fly = `2026-10-09T08:42:07Z app[e784] syd [info]${line({ target: "action", uid: 3, who: "sam", what: "leave", outcome: "ok", why: "left" })}`;
    expect(narrate(fly)).toBe("19:42:07  sam left");
    expect(narrate("Waiting for logs...")).toBeNull();
    expect(narrate("")).toBeNull();
  });

  it("still says something for a line it has no words for", () => {
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "juggle", outcome: "ok" }))).toBe("19:42:07  sam: juggle (ok)");
    expect(narrate(line({ level: "ERROR", target: "api", error: "disk full", message: "request failed" }))).toBe("19:42:07  ERROR api: request failed (disk full)");
  });

  // Phase 3's review, findings 10, 12 and 16: every line the server writes,
  // with the fields it writes them with.
  const handled = ["welcome", "tolerate", "refuse", "pushed", "scratch"];
  const serverLines: Record<string, unknown>[] = [
    ...["pet", "play", "offer", "pick_up"].flatMap((what) =>
      handled.map((outcome) => ({ target: "action", uid: 3, who: "sam", what, cat: "Tora", outcome })),
    ),
    { target: "action", uid: 3, who: "sam", what: "pet", cat: "Tora", outcome: "sniff" },
    { target: "action", uid: 3, who: "sam", what: "banned", cat: "Tora", action: "pick_up", hours: 4 },
    { target: "action", uid: 3, who: "sam", what: "banned", cat: "Burakku", action: "pet", hours: 48 },
    { target: "action", uid: 3, who: "sam", what: "put_down", cat: "Mochi", outcome: "ok" },
    { target: "action", uid: 3, who: "sam", what: "pass_cat", cat: "Mochi", to: "jo", outcome: "taken" },
    { target: "action", uid: 3, who: "sam", what: "pass_cat", cat: "Mochi", to: "jo", outcome: "jumped_down" },
    { target: "action", uid: 3, who: "sam", what: "put_treat", outcome: "ok", x: 3, y: 7 },
    { target: "action", uid: 3, who: "sam", what: "give_treat", outcome: "ok", to: "jo" },
    { target: "action", uid: 3, who: "sam", what: "tidy", outcome: "ok", piece: "lamp" },
    { target: "action", uid: 3, who: "sam", what: "tidy", outcome: "already_up", piece: "lamp" },
    { target: "action", uid: 3, who: "sam", what: "put_back", outcome: "ok", piece: "plant" },
    { target: "action", uid: 3, who: "sam", what: "put_back", outcome: "ok", piece: "plant", why: "dropped" },
    { target: "action", uid: 3, who: "sam", what: "put_back", outcome: "gone", piece: "lamp", why: "walked_out" },
    { target: "action", uid: 3, who: "sam", what: "put_back", outcome: "called_off", piece: "plant" },
    { target: "action", uid: 3, who: "sam", what: "pet", outcome: "refused", code: "movedAway", cat: "Tora" },
    { target: "action", uid: 3, who: "sam", what: "give_treat", outcome: "refused", code: "noTreats", to: "jo" },
    { target: "action", uid: 3, who: "sam", what: "sit", outcome: "walking", piece: "window_seat" },
    { target: "action", what: "login", outcome: "refused", code: "badLogin" },
    { target: "action", what: "recover", outcome: "refused" },
    { target: "action", uid: 3, who: "sam", what: "logout" },
    { target: "cat", cat: "Mochi", what: "eat", on: "bowls" },
    { target: "cat", cat: "Mochi", what: "eat", on: "treat" },
    { target: "cat", cat: "Tora", what: "play", on: "toys" },
    { target: "cat", cat: "Tora", what: "play", on: "floor", with: "sam" },
    { target: "cat", cat: "Tora", what: "perch", on: "window_seat" },
    { target: "cat", cat: "Tora", what: "investigate", on: "lamp" },
    { target: "cat", cat: "Burakku", what: "knock_over", on: "plant" },
    { target: "cat", cat: "Burakku", what: "lap", on: "sofa", with: "sam" },
    { target: "cafe", what: "bowls_filled", portions: 3 },
  ];
  const jumps = ["put_down", "wont_go", "holder_left", "had_enough", "door", "scratched", "refused", "got_up"];

  it("has words for every line the server writes, naming the cat, the person and the piece", () => {
    const all: Record<string, unknown>[] = [...serverLines, ...jumps.map((why) => ({ target: "cat", cat: "Mochi", what: "jump_down", why }))];
    for (const fields of all) {
      const said = narrate(line(fields)) ?? "";
      expect(said, JSON.stringify(fields)).not.toMatch(/undefined|null|NaN/);
      expect(said, JSON.stringify(fields)).not.toContain(`: ${String(fields.what).replaceAll("_", " ")}`);
      for (const key of ["cat", "to", "piece", "with"]) {
        if (typeof fields[key] === "string" && fields[key] !== "floor") {
          expect(said, JSON.stringify(fields)).toContain(String(fields[key]).replaceAll("_", " "));
        }
      }
    }
    const why = jumps.map((w) => narrate(line({ target: "cat", cat: "Mochi", what: "jump_down", why: w })));
    expect(new Set(why).size, "each reason for jumping down says itself").toBe(jumps.length);
  });

  it("tells phase 3's moments in so many words", () => {
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "play", cat: "Tora", outcome: "welcome" }))).toBe("19:42:07  sam played with Tora, who joined in");
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "pass_cat", cat: "Mochi", to: "jo", outcome: "taken" }))).toBe("19:42:07  sam passed Mochi to jo");
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "banned", cat: "Burakku", action: "pet", hours: 48 }))).toBe("19:42:07  Burakku won't be petted by sam for 2 days");
    expect(narrate(line({ target: "action", uid: 3, who: "sam", what: "pet", outcome: "refused", code: "movedAway", cat: "Tora" }))).toBe("19:42:07  sam tried to pet Tora, refused: movedAway");
    expect(narrate(line({ target: "action", what: "recover", outcome: "refused" }))).toBe("19:42:07  someone tried to recover an account, refused");
    expect(narrate(line({ target: "cat", cat: "Mochi", what: "jump_down", why: "door" }))).toBe("19:42:07  Mochi jumped down at the door");
    expect(narrate(line({ target: "cat", cat: "Burakku", what: "lap", on: "sofa", with: "sam" }))).toBe("19:42:07  Burakku curled up on sam's lap");
  });

  it("runs as a filter from a folder with a space in its name, through a symlink", () => {
    const dir = mkdtempSync(join(tmpdir(), "narrate test "));
    try {
      const link = join(dir, "narrate.ts");
      symlinkSync(fileURLToPath(new URL("../scripts/narrate.ts", import.meta.url)), link);
      const input = `${line({ target: "action", uid: 3, who: "sam", what: "leave", outcome: "ok", why: "left" })}\n`;
      const out = execFileSync(process.execPath, [link], { input, encoding: "utf8" });
      expect(out).toBe("19:42:07  sam left\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
