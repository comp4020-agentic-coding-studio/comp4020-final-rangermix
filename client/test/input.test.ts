import { describe, expect, it } from "vitest";
import { cycleOrder, targetsAt } from "../src/input";
import { fromWelcome } from "../src/state";

function state() {
  return fromWelcome(
    {
      type: "welcome",
      you: 1,
      build: "b",
      now: 0,
      cap: 6,
      snapshot: {
        room: { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")], door: { x: 7, y: 0 }, furniture: [] },
        people: [
          { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 5, y: 5 }, walk: null },
          { id: 2, name: "sam", look: { avatar: 0, colour: 1 }, place: "inside", at: { x: 9, y: 5 }, walk: null },
          { id: 3, name: "jo", look: { avatar: 0, colour: 2 }, place: "window", at: { x: 7, y: 0 }, walk: null },
        ],
        cats: [
          { id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 6, y: 5 }, pose: "sit", walk: null },
          { id: "tora", name: "Tora", coat: "orange_tabby", at: { x: 1, y: 8 }, pose: "idle", walk: null },
        ],
        yourTrust: [],
      },
    },
    0,
  );
}

describe("pointing at things", () => {
  it("finds the cat on a tile, and never you", () => {
    const s = state();
    expect(targetsAt(s, { x: 6, y: 5 }, 0)).toEqual([{ kind: "cat", id: "mochi", tile: { x: 6, y: 5 } }]);
    expect(targetsAt(s, { x: 5, y: 5 }, 0)).toEqual([]);
  });

  it("steps through cats and people inside, nearest first", () => {
    const order = cycleOrder(state(), { x: 5, y: 5 }, 0).map((t) => t.id);
    expect(order).toEqual(["mochi", 2, "tora"]);
  });
});
