import { afterEach, describe, expect, it } from "vitest";
import { signUp, Visitor, type Msg } from "./helpers";

// Rearranging (design.md, "People"): anyone inside carries furniture, the
// first grab wins, and the door's walkway is never blocked (AGENTS.md).
const open: Visitor[] = [];

async function visitor(): Promise<Visitor> {
  const v = await Visitor.connect((await signUp()).cookie);
  open.push(v);
  return v;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((v) => v.leave()));
});

const settle = (ms = 600) => new Promise((r) => setTimeout(r, ms));

/** Where this visitor stands once their walk in is over. */
function standing(v: Visitor): { x: number; y: number } {
  const me = v.welcome.snapshot.people.find((p: Msg) => p.id === v.welcome.you);
  return me.walk ? me.walk.path[me.walk.path.length - 1] : me.at;
}

/** Where everyone this visitor knows of stands, or is walking to. */
function people(v: Visitor): { x: number; y: number }[] {
  const everyone = [...v.welcome.snapshot.people, ...v.messages.filter((m) => m.type === "personJoined").map((m) => m.person)];
  return everyone.map((p: Msg) => (p.walk ? p.walk.path[p.walk.path.length - 1] : p.at));
}

/** A free floor tile beside this visitor, off the door's walkway and away from everyone. */
function besideMe(v: Visitor): { x: number; y: number } {
  const room = v.welcome.snapshot.room;
  const me = standing(v);
  const taken = (x: number, y: number) =>
    room.furniture.some((f: Msg) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) ||
    room.walkway.some((w: Msg) => w.x === x && w.y === y) ||
    v.messages.some((m) => (m.type === "furniturePlaced" || m.type === "furnitureHeld") && m.piece.x === x && m.piece.y === y) ||
    people(v).some((p) => p.x === x && p.y === y);
  // Nearest first: beside me if anything is free there, else a step or two away.
  for (let reach = 1; reach <= 3; reach++) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== reach) continue;
        const x = me.x + dx;
        const y = me.y + dy;
        if (y >= 1 && room.tiles[y]?.[x] === "." && !taken(x, y)) return { x, y };
      }
    }
  }
  throw new Error("nowhere free near me");
}

describe("rearranging the café", () => {
  it("one person takes a lamp and another sees it in their hands within a second", async () => {
    const a = await visitor();
    const b = await visitor();
    const from = b.messages.length;
    const sent = Date.now();
    a.send({ type: "take", kind: "lamp" });
    const held = await b.next((m) => m.type === "furnitureHeld", 1000, from);
    expect(held).toMatchObject({ by: a.welcome.you, piece: { kind: "lamp" } });
    expect(Date.now() - sent).toBeLessThan(1000);
    a.send({ type: "putBack" });
  });

  it("puts a piece down where everyone sees it, within a second", async () => {
    const a = await visitor();
    const b = await visitor();
    await settle();
    a.send({ type: "take", kind: "lamp" });
    await a.next((m) => m.type === "furnitureHeld");
    const to = besideMe(a);
    const from = b.messages.length;
    a.send({ type: "place", to });
    // Placing may mean a step or two first; what's timed is the other page
    // seeing it once it's down.
    const mine = await a.next((m) => m.type === "furniturePlaced", 3000, a.messages.length);
    const down = Date.now();
    const placed = await b.next((m) => m.type === "furniturePlaced", 1000, from);
    expect(placed).toMatchObject({ by: a.welcome.you, piece: { kind: "lamp", x: to.x, y: to.y } });
    expect(placed.piece.id).toBe(mine.piece.id);
    expect(Date.now() - down).toBeLessThan(1000);
    // Tidy up: carry it off again.
    a.send({ type: "grab", id: placed.piece.id });
    await a.next((m) => m.type === "furnitureHeld" && m.piece.id === placed.piece.id);
    a.send({ type: "putBack" });
  });

  it("never lets anything onto the door's walkway", async () => {
    const a = await visitor();
    const b = await visitor();
    a.send({ type: "take", kind: "cushion" });
    await a.next((m) => m.type === "furnitureHeld");
    const door = a.welcome.snapshot.room.door;
    const from = b.messages.length;
    a.send({ type: "place", to: { x: door.x, y: door.y + 1 } });
    expect((await a.next((m) => m.type === "error")).code).toBe("cantPlace");
    await settle(300);
    expect(b.messages.slice(from).some((m) => m.type === "furniturePlaced")).toBe(false);
    a.send({ type: "putBack" });
  });

  it("gives a piece to the first of two who reach for it at once", async () => {
    const a = await visitor();
    const b = await visitor();
    const plant = a.welcome.snapshot.room.furniture.find((f: Msg) => f.kind === "plant");
    a.send({ type: "grab", id: plant.id });
    b.send({ type: "grab", id: plant.id });
    const refusal = await Promise.race([
      a.next((m) => m.type === "error" && m.code === "taken").then(() => "a"),
      b.next((m) => m.type === "error" && m.code === "taken").then(() => "b"),
    ]);
    const loser = refusal === "a" ? a : b;
    await settle(300);
    expect(loser.messages.filter((m) => m.type === "error" && m.code === "taken")).toHaveLength(1);
    expect([a, b].filter((v) => v.messages.some((m) => m.type === "error" && m.code === "taken"))).toHaveLength(1);
  });

  it("lets a person make three furniture changes at once, then slows them down", async () => {
    const a = await visitor();
    a.send({ type: "take", kind: "lamp" });
    a.send({ type: "putAway" });
    a.send({ type: "take", kind: "lamp" });
    a.send({ type: "putAway" });
    expect((await a.next((m) => m.type === "error" && m.code === "rateLimited")).detail).toMatch(/slow down/i);
    const mine = a.messages.filter((m) => m.type === "furnitureHeld" || m.type === "furnitureRemoved");
    expect(mine).toHaveLength(3);
    a.send({ type: "putBack" });
  });
});
