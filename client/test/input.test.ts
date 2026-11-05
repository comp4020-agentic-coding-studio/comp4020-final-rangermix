import { describe, expect, it } from "vitest";
import { clickOn, cycleOrder, nameOf, stepPointer, targetsAt, tileOf } from "../src/input";
import { fromWelcome } from "../src/state";

function state() {
  return fromWelcome(
    {
      type: "welcome",
      you: 1,
      build: "b",
      now: 0,
      cap: 6,
      chalkHours: 24,
      chalkShown: 8, demo: false, ahead: 0, nextJump: 0,
      snapshot: {
        room: { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")], door: { x: 7, y: 0 }, walkway: [], furniture: [], catalogue: [] },
        people: [
          { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 5, y: 5 }, walk: null, sitting: false, bot: false },
          { id: 2, name: "sam", look: { avatar: 0, colour: 1 }, place: "inside", at: { x: 9, y: 5 }, walk: null, sitting: false, bot: false },
          { id: 3, name: "jo", look: { avatar: 0, colour: 2 }, place: "window", at: { x: 7, y: 0 }, walk: null, sitting: false, bot: false },
        ],
        cats: [
          { id: "mochi", name: "Mochi", coat: "white_grey", build: "round", at: { x: 6, y: 5 }, pose: "sit", walk: null, heldBy: null },
          { id: "tora", name: "Tora", coat: "orange_tabby", build: "striped", at: { x: 1, y: 8 }, pose: "idle", walk: null, heldBy: null },
        ],
        yourTrust: [],
        held: [],
        treats: [],
        yourTreats: 3,
        bowls: 3,
        chalkboard: [],
      },
    },
    0,
  );
}

describe("pointing at things", () => {
  it("lets the arrows onto the chalkboard, and nowhere else on the street wall", () => {
    // Slice 02's review, finding 5: point, then act, for the board too.
    const s = state();
    expect(stepPointer(s, { x: 8, y: 1 }, [0, -1])).toEqual({ x: 8, y: 0 });
    expect(stepPointer(s, { x: 7, y: 1 }, [0, -1])).toEqual({ x: 7, y: 1 });
    expect(stepPointer(s, { x: 8, y: 0 }, [-1, 0])).toEqual({ x: 7, y: 1 });
    expect(stepPointer(s, { x: 8, y: 0 }, [0, 1])).toEqual({ x: 8, y: 1 });
    expect(stepPointer(s, { x: 11, y: 9 }, [1, 1])).toEqual({ x: 11, y: 9 });
    expect(stepPointer(s, { x: 0, y: 1 }, [-1, 0])).toEqual({ x: 0, y: 1 });
  });

  it("knows the chalkboard by its tile on the street wall, and Tab names it", () => {
    const s = state();
    const board = { kind: "board" as const, id: "board" as const, tile: { x: 8, y: 0 } };
    expect(targetsAt(s, { x: 8, y: 0 }, 0)).toEqual([board]);
    expect(targetsAt(s, { x: 7, y: 0 }, 0)).toEqual([]);
    // Last in the cycle however near: the first Tab is still a cat, a person or
    // a piece to act on, and Shift+Tab reaches the board at once.
    expect(cycleOrder(s, { x: 8, y: 1 }, 0).at(-1)).toEqual(board);
    expect(cycleOrder(s, { x: 8, y: 1 }, 0)[0].kind).not.toBe("board");
    expect(tileOf(s, board, 0)).toEqual({ x: 8, y: 0 });
    expect(nameOf(s, board)).toBe("the chalkboard");
  });

  it("finds the cat on a tile, and never you", () => {
    const s = state();
    expect(targetsAt(s, { x: 6, y: 5 }, 0)).toEqual([{ kind: "cat", id: "mochi", tile: { x: 6, y: 5 } }]);
    expect(targetsAt(s, { x: 5, y: 5 }, 0)).toEqual([]);
  });

  it("steps through cats and people inside, nearest first", () => {
    const order = cycleOrder(state(), { x: 5, y: 5 }, 0).map((t) => t.id);
    expect(order).toEqual(["mochi", 2, "tora", "board"]);
  });

  it("finds a piece that moves, after any cat on it, and steps to it too", () => {
    const s = state();
    s.room.furniture = [
      { id: 14, kind: "cushion", x: 6, y: 5, w: 1, h: 1, movable: true, blocks: false, under: false, seats: true, perch: false, toppled: false },
      { id: 3, kind: "bowls", x: 0, y: 5, w: 3, h: 1, movable: false, blocks: true, under: false, seats: false, perch: false, toppled: false },
    ];
    expect(targetsAt(s, { x: 6, y: 5 }, 0)).toEqual([
      { kind: "cat", id: "mochi", tile: { x: 6, y: 5 } },
      { kind: "piece", id: 14, tile: { x: 6, y: 5 } },
    ]);
    expect(targetsAt(s, { x: 1, y: 5 }, 0)).toEqual([]);
    expect(cycleOrder(s, { x: 5, y: 5 }, 0).map((t) => t.id)).toEqual(["mochi", 14, 2, "tora", "board"]);
  });

  it("walks onto a rug or a cushion clicked, and opens its menu from where you stand", () => {
    // The user's ask after slice 14: clicking the rug opened its menu, which
    // only moves it, so nobody could walk onto it. A piece people walk over
    // (one that doesn't block) is somewhere to go; its menu opens from the
    // tile you're on or already walking to.
    const s = state();
    const rug = { id: 7, kind: "rug", x: 2, y: 2, w: 4, h: 3, movable: true, blocks: false, under: true, seats: false, perch: false, toppled: false };
    const cushion = { id: 14, kind: "cushion", x: 7, y: 7, w: 1, h: 1, movable: true, blocks: false, under: false, seats: true, perch: false, toppled: false };
    const chair = { id: 9, kind: "chair", x: 8, y: 2, w: 1, h: 1, movable: true, blocks: true, under: false, seats: true, perch: false, toppled: false };
    s.room.furniture = [rug, cushion, chair];
    const piece = (id: number, tile: { x: number; y: number }) => [{ kind: "piece" as const, id, tile }];
    // You stand at (5,5), off the rug: a click on it walks there.
    expect(clickOn(s, piece(7, { x: 2, y: 2 }), { x: 3, y: 3 })).toEqual({ walk: { x: 3, y: 3 } });
    expect(clickOn(s, piece(14, { x: 7, y: 7 }), { x: 7, y: 7 })).toEqual({ walk: { x: 7, y: 7 } });
    // Standing on it, a click on that tile opens its menu.
    s.people.set(1, { ...s.people.get(1)!, at: { x: 3, y: 3 } });
    expect(clickOn(s, piece(7, { x: 2, y: 2 }), { x: 3, y: 3 })).toEqual({ act: piece(7, { x: 2, y: 2 }) });
    // Another of its tiles is still somewhere to go.
    expect(clickOn(s, piece(7, { x: 2, y: 2 }), { x: 4, y: 3 })).toEqual({ walk: { x: 4, y: 3 } });
    // On the way to it already, a second click there opens the menu too.
    s.people.set(1, { ...s.people.get(1)!, at: { x: 5, y: 5 }, walk: { path: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 7, y: 6 }, { x: 7, y: 7 }], start: 0, speed: 2 } });
    expect(clickOn(s, piece(14, { x: 7, y: 7 }), { x: 7, y: 7 })).toEqual({ act: piece(14, { x: 7, y: 7 }) });
    // A piece that blocks opens its menu wherever you are, as before.
    expect(clickOn(s, piece(9, { x: 8, y: 2 }), { x: 8, y: 2 })).toEqual({ act: piece(9, { x: 8, y: 2 }) });
    // Something alive on the rug is what the click is for.
    const withCat = [{ kind: "cat" as const, id: "mochi", tile: { x: 4, y: 4 } }, ...piece(7, { x: 2, y: 2 })];
    expect(clickOn(s, withCat, { x: 4, y: 4 })).toEqual({ act: withCat });
    // Knocked over, it's in the way until it's tidied, so its menu opens,
    // even from across the room.
    s.people.set(1, { ...s.people.get(1)!, at: { x: 5, y: 5 }, walk: null });
    s.room.furniture = [{ ...cushion, toppled: true }];
    expect(clickOn(s, piece(14, { x: 7, y: 7 }), { x: 7, y: 7 })).toEqual({ act: piece(14, { x: 7, y: 7 }) });
    // And nothing there at all: a walk.
    expect(clickOn(s, [], { x: 1, y: 1 })).toEqual({ walk: { x: 1, y: 1 } });
  });

  it("counts a held cat as in its holder's arms, not a target of its own", () => {
    // Phase 3's review, finding 2: not at the tile where it was picked up.
    const s = state();
    s.cats.set("mochi", { ...s.cats.get("mochi")!, heldBy: 2, pose: "held" });
    expect(targetsAt(s, { x: 6, y: 5 }, 0)).toEqual([]);
    expect(targetsAt(s, { x: 9, y: 5 }, 0)).toEqual([{ kind: "person", id: 2, tile: { x: 9, y: 5 } }]);
    expect(cycleOrder(s, { x: 5, y: 5 }, 0).map((t) => t.id)).toEqual([2, "tora", "board"]);
  });

  it("finds where a target is now, for a Tab cycle made a moment ago", () => {
    // A cat that walked off since the cycle was made: Tab points where it is
    // now, not where it was, and a cat picked up since isn't there at all.
    const s = state();
    const [mochi] = cycleOrder(s, { x: 5, y: 5 }, 0);
    s.cats.set("mochi", { ...s.cats.get("mochi")!, at: { x: 2, y: 3 } });
    expect(tileOf(s, mochi, 0)).toEqual({ x: 2, y: 3 });
    s.cats.set("mochi", { ...s.cats.get("mochi")!, heldBy: 2, pose: "held" });
    expect(tileOf(s, mochi, 0)).toBeNull();
    expect(tileOf(s, { kind: "person", id: 2, tile: { x: 0, y: 0 } }, 0)).toEqual({ x: 9, y: 5 });
  });
});
