import { describe, expect, it } from "vitest";
import { armsFull, menuFor } from "../src/menus";
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
            { id: 14, kind: "cushion", x: 6, y: 5, w: 1, h: 1, movable: true, blocks: false, under: false, seats: true, toppled: false },
            { id: 15, kind: "plant", x: 2, y: 2, w: 1, h: 1, movable: true, blocks: true, under: false, seats: false, toppled: false },
          ],
          catalogue: [],
        },
        people: [
          { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 5, y: 5 }, walk: null, sitting: false },
          { id: 2, name: "sam", look: { avatar: 0, colour: 1 }, place: "inside", at: { x: 9, y: 5 }, walk: null, sitting: false },
        ],
        cats: [{ id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 6, y: 5 }, pose: "nap", walk: null, heldBy: null }],
        yourTrust: [{ cat: "mochi", value: 4, level: "stranger" }],
        held: [],
        treats: [],
        yourTreats: 3,
        bowls: 3,
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
    expect(labels(m)).toEqual([
      "Pet Mochi",
      "Call Mochi",
      "Offer Mochi a treat",
      "Play with Mochi",
      "Pick Mochi up",
      "Move the cushion",
      "Sit on the cushion",
    ]);
    expect(m?.actions[2].msg).toEqual({ type: "offerTreat", cat: "mochi" });
    expect(m?.actions[4].msg).toEqual({ type: "pickUp", cat: "mochi" });
    expect(m?.actions[5].msg).toEqual({ type: "grab", id: 14 });
    expect(m?.actions[6].msg).toEqual({ type: "sit", id: 14 });
  });

  it("offers no treat with none left, and no picking up with full arms", () => {
    const s = state();
    s.yourTreats = 0;
    s.held.set(1, { id: 15, kind: "plant", x: 2, y: 2, w: 1, h: 1, movable: true, blocks: true, under: false, seats: false, toppled: false });
    const m = menuFor(s, [{ kind: "cat", id: "mochi", tile: { x: 6, y: 5 } }]);
    expect(labels(m)).toEqual(["Pet Mochi", "Call Mochi", "Play with Mochi"]);
  });

  it("lets you put down the cat you hold, or pass it to someone", () => {
    const s = state();
    s.cats.set("mochi", { ...s.cats.get("mochi")!, heldBy: 1, pose: "held" });
    expect(labels(menuFor(s, [{ kind: "cat", id: "mochi", tile: { x: 5, y: 5 } }]))).toEqual(["Pet Mochi", "Put Mochi down"]);
    const m = menuFor(s, [{ kind: "person", id: 2, tile: { x: 9, y: 5 } }]);
    expect(labels(m)).toEqual(["Talk to sam", "Give sam a treat", "Pass Mochi to sam"]);
    expect(m?.actions[2].msg).toEqual({ type: "passCat", to: 2 });
  });

  it("stands a knocked-over piece back up rather than moving it", () => {
    const s = state();
    s.room.furniture[1].toppled = true;
    expect(labels(menuFor(s, [{ kind: "piece", id: 15, tile: { x: 2, y: 2 } }]))).toEqual(["Stand the plant up"]);
  });

  it("offers only moving for a piece you can't sit on", () => {
    expect(labels(menuFor(state(), [{ kind: "piece", id: 15, tile: { x: 2, y: 2 } }]))).toEqual(["Move the plant"]);
  });

  it("offers to talk to a person", () => {
    const m = menuFor(state(), [{ kind: "person", id: 2, tile: { x: 9, y: 5 } }]);
    expect(labels(m)).toEqual(["Talk to sam", "Give sam a treat"]);
    expect(m?.actions[0].talkTo).toEqual({ id: 2, name: "sam" });
    expect(m?.actions[1].msg).toEqual({ type: "giveTreat", to: 2 });
  });

  it("is empty when nothing is left there", () => {
    expect(menuFor(state(), [{ kind: "piece", id: 99, tile: { x: 0, y: 0 } }])).toBeNull();
  });

  it("offers no furniture to move or sit on with your arms full", () => {
    // Phase 3's review, finding 32.
    const s = state();
    s.cats.set("mochi", { ...s.cats.get("mochi")!, heldBy: 1, pose: "held" });
    expect(armsFull(s)).toBe(true);
    expect(menuFor(s, [{ kind: "piece", id: 15, tile: { x: 2, y: 2 } }])).toBeNull();
    expect(labels(menuFor(s, [{ kind: "piece", id: 14, tile: { x: 6, y: 5 } }]))).toBeUndefined();
    expect(armsFull(state())).toBe(false);
  });

  it("offers nothing for a cat in someone else's arms", () => {
    const s = state();
    s.cats.set("mochi", { ...s.cats.get("mochi")!, heldBy: 2, pose: "held" });
    expect(menuFor(s, [{ kind: "cat", id: "mochi", tile: { x: 6, y: 5 } }])).toBeNull();
  });
});
