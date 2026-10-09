import { describe, expect, it } from "vitest";
import { menuFor } from "../src/menus";
import { fromWelcome } from "../src/state";

function state() {
  const s = fromWelcome(
    {
      type: "welcome",
      you: 1,
      build: "b",
      now: 0,
      cap: 6,
      snapshot: {
        room: {
          width: 12,
          height: 10,
          tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")],
          door: { x: 7, y: 0 },
          walkway: [],
          furniture: [
            { id: 14, kind: "cushion", x: 6, y: 5, w: 1, h: 1, movable: true, blocks: false, under: false, seats: true },
            { id: 15, kind: "plant", x: 2, y: 2, w: 1, h: 1, movable: true, blocks: true, under: false, seats: false },
          ],
          catalogue: [],
        },
        people: [
          { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 5, y: 5 }, walk: null, sitting: false },
          { id: 2, name: "sam", look: { avatar: 0, colour: 1 }, place: "inside", at: { x: 9, y: 5 }, walk: null, sitting: false },
        ],
        cats: [{ id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 6, y: 5 }, pose: "nap", walk: null }],
        yourTrust: [{ cat: "mochi", value: 4, level: "stranger" }],
        held: [],
      },
    },
    0,
  );
  return s;
}

const labels = (m: ReturnType<typeof menuFor>) => m?.actions.map((a) => a.label);

describe("the menu for what's on a tile", () => {
  it("lists a cat first, then what you can do with the piece it lies on", () => {
    const m = menuFor(state(), [
      { kind: "cat", id: "mochi", tile: { x: 6, y: 5 } },
      { kind: "piece", id: 14, tile: { x: 6, y: 5 } },
    ]);
    expect(m?.title).toBe("Mochi");
    expect(m?.note).toBe("Mochi's trust in you: 4 of 100");
    expect(labels(m)).toEqual(["Pet Mochi", "Call Mochi", "Move the cushion", "Sit on the cushion"]);
    expect(m?.actions[2].msg).toEqual({ type: "grab", id: 14 });
    expect(m?.actions[3].msg).toEqual({ type: "sit", id: 14 });
  });

  it("offers only moving for a piece you can't sit on", () => {
    expect(labels(menuFor(state(), [{ kind: "piece", id: 15, tile: { x: 2, y: 2 } }]))).toEqual(["Move the plant"]);
  });

  it("offers to talk to a person", () => {
    const m = menuFor(state(), [{ kind: "person", id: 2, tile: { x: 9, y: 5 } }]);
    expect(labels(m)).toEqual(["Talk to sam"]);
    expect(m?.actions[0].talkTo).toEqual({ id: 2, name: "sam" });
  });

  it("is empty when nothing is left there", () => {
    expect(menuFor(state(), [{ kind: "piece", id: 99, tile: { x: 0, y: 0 } }])).toBeNull();
  });
});
