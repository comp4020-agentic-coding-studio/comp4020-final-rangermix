import { describe, expect, it } from "vitest";
import type { ServerMsg } from "../src/protocol/ServerMsg";
import { toCanvas } from "../src/iso";
import { drawOrder, hitAt, personLift } from "../src/render";
import { fromWelcome } from "../src/state";

// What's drawn, in order, in the room at an angle (slice 09): what lies flat
// first, then everything standing, nothing nearer the viewer painted over.

type Welcome = Extract<ServerMsg, { type: "welcome" }>;
const piece = (id: number, kind: string, x: number, y: number, w: number, h: number, under = false) => ({ id, kind, x, y, w, h, movable: true, blocks: !under, under, seats: false, toppled: false });

function welcome(): Welcome {
  return {
    type: "welcome",
    you: 1,
    build: "b1",
    now: 10_000,
    cap: 6,
    chalkHours: 24,
    chalkShown: 8,
    snapshot: {
      room: {
        width: 12,
        height: 10,
        tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")],
        door: { x: 7, y: 0 },
        walkway: [],
        furniture: [piece(1, "sofa", 0, 5, 3, 1), piece(2, "rug", 4, 4, 4, 3, true)],
        catalogue: [],
      },
      people: [
        { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 1, y: 6 }, walk: null, sitting: false },
        { id: 2, name: "sam", look: { avatar: 1, colour: 2 }, place: "inside", at: { x: 9, y: 8 }, walk: null, sitting: false },
      ],
      cats: [
        { id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 2, y: 4 }, pose: "sit", walk: null, heldBy: null },
        { id: "tora", name: "Tora", coat: "orange_tabby", at: { x: 5, y: 5 }, pose: "sit", walk: null, heldBy: null },
        { id: "burakku", name: "Burakku", coat: "black", at: { x: 9, y: 8 }, pose: "sit", walk: null, heldBy: 2 },
      ],
      yourTrust: [],
      held: [],
      treats: [],
      yourTreats: 3,
      bowls: 2,
      chalkboard: [],
    },
  };
}

describe("the room's draw order", () => {
  const order = drawOrder(fromWelcome(welcome(), 10_000), 10_000).map((d) => d.label);

  it("lays the rug before anything standing", () => {
    expect(order[0]).toBe("piece rug");
  });

  it("draws a cat on the rug after the rug", () => {
    expect(order.indexOf("cat tora")).toBeGreaterThan(order.indexOf("piece rug"));
  });

  it("draws a cat behind the sofa's far end before the sofa, and someone in front of it after", () => {
    expect(order.indexOf("cat mochi")).toBeLessThan(order.indexOf("piece sofa"));
    expect(order.indexOf("person 1")).toBeGreaterThan(order.indexOf("piece sofa"));
  });

  it("draws a cat napping on a piece after the piece, up on top of it", () => {
    const w = welcome();
    w.snapshot.room.furniture.push(piece(3, "window_seat", 2, 1, 2, 1));
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 2, y: 1 }, pose: "nap" };
    const drawn = drawOrder(fromWelcome(w, 10_000), 10_000);
    const labels = drawn.map((d) => d.label);
    expect(labels.indexOf("cat mochi")).toBeGreaterThan(labels.indexOf("piece window_seat"));
    expect(drawn.find((d) => d.label === "cat mochi")?.lift).toBe(12);
  });

  it("draws a cat on the floor at floor level", () => {
    const drawn = drawOrder(fromWelcome(welcome(), 10_000), 10_000);
    expect(drawn.find((d) => d.label === "cat tora")?.lift).toBe(0);
  });

  // Slice 09's review, findings 2, 3 and 7.

  it("draws a cat asleep on someone's lap over them, on the sofa and on a chair", () => {
    for (const seat of [piece(3, "chair", 9, 4, 1, 1), null]) {
      const w = welcome();
      const at = seat ? { x: seat.x, y: seat.y } : { x: 1, y: 5 };
      if (seat) w.snapshot.room.furniture.push(seat);
      w.snapshot.people[0] = { ...w.snapshot.people[0], at, sitting: true };
      w.snapshot.cats[0] = { ...w.snapshot.cats[0], at, pose: "nap" };
      const order = drawOrder(fromWelcome(w, 10_000), 10_000).map((d) => d.label);
      expect(order.indexOf("cat mochi"), `on ${seat ? "the chair" : "the sofa"}`).toBeGreaterThan(order.indexOf("person 1"));
    }
  });

  it("draws someone just behind the sofa's far end before the sofa", () => {
    const w = welcome();
    w.snapshot.people[0] = { ...w.snapshot.people[0], at: { x: 2, y: 4 } };
    const order = drawOrder(fromWelcome(w, 10_000), 10_000).map((d) => d.label);
    expect(order.indexOf("person 1")).toBeLessThan(order.indexOf("piece sofa"));
  });

  it("draws the toys, a cushion and a treat put on the rug after the rug", () => {
    const w = welcome();
    w.snapshot.room.furniture.push(piece(4, "toys", 4, 4, 1, 1), { ...piece(5, "cushion", 6, 5, 1, 1), blocks: false });
    w.snapshot.treats = [{ id: 1, at: { x: 5, y: 6 } }];
    const order = drawOrder(fromWelcome(w, 10_000), 10_000).map((d) => d.label);
    for (const what of ["piece toys", "piece cushion", "treat 1"]) expect(order.indexOf(what), what).toBeGreaterThan(order.indexOf("piece rug"));
  });

  it("draws a cat walking over a piece up on top of it", () => {
    const w = welcome();
    w.snapshot.room.furniture.push(piece(3, "cat_tower", 0, 1, 2, 2));
    // Half-way across the tower, walking.
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 0, y: 1 }, pose: "walk", walk: { path: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }], start: 10_000, speed: 1 } };
    const drawn = drawOrder(fromWelcome(w, 10_500), 10_500);
    expect(drawn.find((d) => d.label === "cat mochi")?.lift).toBe(44);
  });

  // Slice 09's review, finding 1: a click lands on what's drawn there.

  it("finds a cat napping on the window seat where it's drawn, not the wall behind it", () => {
    const w = welcome();
    w.snapshot.room.furniture.push(piece(3, "window_seat", 2, 1, 2, 1));
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 3, y: 1 }, pose: "nap" };
    const s = fromWelcome(w, 10_000);
    // The middle of the cat's sprite: feet 2 px below the tile's centre, raised by the seat's 12 px, 16 px tall.
    const c = toCanvas(3.5, 1.5);
    expect(hitAt(s, c.x, c.y + 2 - 12 - 8, 10_000)).toEqual({ x: 3, y: 1 });
  });

  it("finds a cat on the floor by its head, over the tile behind it", () => {
    const s = fromWelcome(welcome(), 10_000);
    // Tora at (5,5): the top of its sprite is over (4,4)'s diamond.
    const c = toCanvas(5.5, 5.5);
    expect(hitAt(s, c.x, c.y + 2 - 14, 10_000)).toEqual({ x: 5, y: 5 });
  });

  it("finds a piece by the top of its block, and a cat in front of a piece before the piece", () => {
    const s = fromWelcome(welcome(), 10_000);
    // The sofa's top face over (1,5), 16 px up.
    const top = toCanvas(1.5, 5.5);
    expect(hitAt(s, top.x, top.y - 16, 10_000)).toEqual({ x: 1, y: 5 });
    // Someone at (1,6), in front of the sofa: their body covers the sofa's front face.
    const me = toCanvas(1.5, 6.5);
    expect(hitAt(s, me.x, me.y - 8, 10_000)).toEqual({ x: 1, y: 6 });
  });

  it("finds nothing drawn over bare floor, so the floor's tile is picked", () => {
    const s = fromWelcome(welcome(), 10_000);
    const c = toCanvas(10.5, 2.5);
    expect(hitAt(s, c.x, c.y, 10_000)).toBeNull();
  });

  it("says how high someone is drawn, for their bubble: up on a seat, or on the floor", () => {
    const w = welcome();
    w.snapshot.people[0] = { ...w.snapshot.people[0], at: { x: 1, y: 5 }, sitting: true };
    const s = fromWelcome(w, 10_000);
    // The sofa is 16 px tall; someone on it sinks 4 px in.
    expect(personLift(s, s.people.get(1)!, 10_000)).toBe(12);
    expect(personLift(s, s.people.get(2)!, 10_000)).toBe(0);
  });

  it("draws a held cat with its holder, not on its own", () => {
    expect(order).not.toContain("cat burakku");
    expect(order).toContain("person 2");
  });
});
