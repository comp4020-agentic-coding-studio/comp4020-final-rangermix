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
});
