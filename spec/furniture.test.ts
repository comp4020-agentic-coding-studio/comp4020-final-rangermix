import { afterEach, describe, expect, it } from "vitest";
import { signUp, Visitor, type Msg } from "./helpers";

// Moving furniture (design.md, "People": rearranging), cut down to one movable
// piece for now; and the door's walkway, which is never blocked (AGENTS.md).
const open: Visitor[] = [];

async function visitor(): Promise<Visitor> {
  const v = await Visitor.connect((await signUp()).cookie);
  open.push(v);
  return v;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((v) => v.leave()));
});

/** The movable piece, where it stands now by this visitor's messages. */
function cushion(v: Visitor): { id: number; x: number; y: number } {
  const piece = v.welcome.snapshot.room.furniture.find((f: Msg) => f.movable);
  if (!piece) throw new Error("nothing in the room moves");
  let at = { x: piece.x, y: piece.y };
  for (const m of v.messages) if (m.type === "furnitureMoved" && m.id === piece.id) at = m.at;
  return { id: piece.id, ...at };
}

/** Free floor away from the door's column, other than where the cushion is. */
function freeTiles(v: Visitor): { x: number; y: number }[] {
  const room = v.welcome.snapshot.room;
  const c = cushion(v);
  const covered = (x: number, y: number) =>
    room.furniture.some((f: Msg) => f.id !== c.id && x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
  const tiles: { x: number; y: number }[] = [];
  for (let y = room.height - 1; y >= 1; y--) {
    for (let x = 0; x < room.width; x++) {
      if (room.tiles[y][x] === "." && x !== room.door.x && !covered(x, y) && !(x === c.x && y === c.y)) tiles.push({ x, y });
    }
  }
  return tiles;
}

describe("moving furniture", () => {
  it("one person moves the cushion and another sees it within a second", async () => {
    const a = await visitor();
    const b = await visitor();
    const { id } = cushion(a);
    const to = freeTiles(a)[0];
    const from = b.messages.length;
    const sent = Date.now();
    a.send({ type: "moveFurniture", id, to });
    const moved = await b.next((m) => m.type === "furnitureMoved", 1000, from);
    expect(moved).toMatchObject({ id, at: to, by: a.welcome.you });
    expect(Date.now() - sent).toBeLessThan(1000);
  });

  it("never lets anything block the door's walkway", async () => {
    const a = await visitor();
    const b = await visitor();
    const { id } = cushion(a);
    const door = a.welcome.snapshot.room.door;
    const from = b.messages.length;
    a.send({ type: "moveFurniture", id, to: { x: door.x, y: door.y + 1 } });
    expect((await a.next((m) => m.type === "error")).code).toBe("cantPlace");
    await new Promise((r) => setTimeout(r, 300));
    expect(b.messages.slice(from).some((m) => m.type === "furnitureMoved")).toBe(false);
  });

  it("lets a person move furniture three times at once, then slows them down", async () => {
    const a = await visitor();
    const { id } = cushion(a);
    const spots = freeTiles(a).slice(0, 4);
    for (const to of spots) a.send({ type: "moveFurniture", id, to });
    expect((await a.next((m) => m.type === "error" && m.code === "rateLimited")).code).toBe("rateLimited");
    // The refusal comes straight back; the moves go round through the world.
    const mine = () => a.messages.filter((m) => m.type === "furnitureMoved" && m.by === a.welcome.you);
    for (let waited = 0; mine().length < 3 && waited < 1000; waited += 20) await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, 200));
    expect(mine()).toHaveLength(3);
  });
});
