import { afterEach, describe, expect, it } from "vitest";
import { signUp, Visitor } from "./helpers";

// Treats (design.md, "People": treats): a few a day, put down or handed over,
// and everyone sees them. The cats' characters, grudges and carrying are held
// by `cargo test`, where a seeded world can be made to do what's tested.
const open: Visitor[] = [];

async function visitor(): Promise<Visitor> {
  const v = await Visitor.connect((await signUp()).cookie);
  open.push(v);
  return v;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((v) => v.leave()));
});

describe("treats", () => {
  it("come with the welcome, as do the bowls", async () => {
    const a = await visitor();
    expect(a.welcome.snapshot.yourTreats).toBe(3);
    expect(a.welcome.snapshot.bowls).toBeGreaterThanOrEqual(0);
    expect(a.welcome.snapshot.bowls).toBeLessThanOrEqual(3);
    expect(Array.isArray(a.welcome.snapshot.treats)).toBe(true);
  });

  it("put down show up for everyone within a second, three a day", async () => {
    const a = await visitor();
    const b = await visitor();
    const from = b.messages.length;
    const sent = Date.now();
    a.send({ type: "putTreat" });
    const placed = await b.next((m) => m.type === "treatPlaced", 1000, from);
    expect(placed.by).toBe(a.welcome.you);
    expect(Date.now() - sent).toBeLessThan(1000);
    a.send({ type: "putTreat" });
    a.send({ type: "putTreat" });
    await a.next((m) => m.type === "yourTreats" && m.left === 0);
    a.send({ type: "putTreat" });
    expect((await a.next((m) => m.type === "error")).code).toBe("noTreats");
  });

  it("handed over move from one visitor to another", async () => {
    const a = await visitor();
    const b = await visitor();
    a.send({ type: "giveTreat", to: b.welcome.you });
    expect((await a.next((m) => m.type === "yourTreats")).left).toBe(2);
    expect((await b.next((m) => m.type === "yourTreats")).left).toBe(4);
    expect(await b.next((m) => m.type === "treatGiven")).toMatchObject({ from: a.welcome.you, to: b.welcome.you });
  });
});
