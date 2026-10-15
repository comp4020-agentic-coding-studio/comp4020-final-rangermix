import { afterEach, describe, expect, it } from "vitest";
import { type Msg, meetACat, signUp, Visitor } from "./helpers";

// The chalkboard (slice 02): what the cats did over a rolling day, written by
// the server. Which doings make a line, the hourly rule, the day's roll and
// that no line carries anything said are held by `cargo test`, where a seeded
// world can be made to do them.
const open: Visitor[] = [];

async function visitor(): Promise<{ v: Visitor; name: string }> {
  const account = await signUp();
  const v = await Visitor.connect(account.cookie);
  open.push(v);
  return { v, name: account.name };
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((v) => v.leave()));
});

describe("the chalkboard", () => {
  it("comes with the welcome: at most eight lines, each when, which cat and what", async () => {
    const { v } = await visitor();
    const board: Msg[] = v.welcome.snapshot.chalkboard;
    expect(Array.isArray(board)).toBe(true);
    expect(board.length).toBeLessThanOrEqual(8);
    for (const line of board) {
      expect(typeof line.at).toBe("number");
      expect(typeof line.cat).toBe("string");
      expect(typeof line.what.kind).toBe("string");
    }
    expect(board.map((l) => l.at)).toEqual([...board.map((l) => l.at)].sort((x, y) => x - y));
  });

  it("gets a new line to every open board within a second", async () => {
    const a = await visitor();
    const b = await visitor();
    const from = b.v.messages.length;
    // A first meeting is a line: "Mochi met <a> for the first time".
    const met = await meetACat(a.v);
    const line = await b.v.next((m) => m.type === "chalked" && m.line.what.kind === "met" && m.line.what.with === a.name, 2_000, from);
    expect(Date.now() - met.sniffedAt).toBeLessThan(1000);
    expect(line.line.cat.toLowerCase()).toBe(met.cat);
    // And the one who made it sees it too.
    await a.v.next((m) => m.type === "chalked" && m.line.what.with === a.name, 1_000);
    // Meeting a cat means walking over to it first: the second is timed from
    // the sniff, and the test has as long as the walk takes.
  }, 60_000);
});
