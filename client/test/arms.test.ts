import { describe, expect, it } from "vitest";
import { type ArmsBar, showArms } from "../src/arms";
import { fromWelcome } from "../src/state";

// The bar over the room for what's in your arms (phase 3's review, finding
// 2): a piece to put back or away, or a cat to put down.

function state() {
  return fromWelcome(
    {
      type: "welcome",
      you: 1,
      build: "b",
      now: 0,
      cap: 6,
      snapshot: {
        room: { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")], door: { x: 7, y: 0 }, walkway: [], furniture: [], catalogue: [] },
        people: [{ id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 5, y: 5 }, walk: null, sitting: false }],
        cats: [{ id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 6, y: 5 }, pose: "sit", walk: null, heldBy: null }],
        yourTrust: [],
        held: [],
        treats: [],
        yourTreats: 3,
        bowls: 3,
      },
    },
    0,
  );
}

function bar(): ArmsBar {
  const make = <T extends HTMLElement>(tag: string) => document.createElement(tag) as T;
  return { carrying: make("span"), text: make("span"), putBack: make("button"), putAway: make("button"), putDown: make("button"), add: make<HTMLButtonElement>("button") };
}

describe("the bar for what's in your arms", () => {
  it("offers to put down the cat you hold, and nothing from the catalogue meanwhile", () => {
    const s = state();
    s.cats.set("mochi", { ...s.cats.get("mochi")!, heldBy: 1, pose: "held" });
    const b = bar();
    showArms(b, s);
    expect(b.carrying.hidden).toBe(false);
    expect(b.text.textContent).toBe("Holding Mochi.");
    expect([b.putDown.hidden, b.putDown.textContent]).toEqual([false, "Put Mochi down"]);
    expect([b.putBack.hidden, b.putAway.hidden]).toEqual([true, true]);
    expect(b.add.disabled).toBe(true);
  });

  it("offers to put a piece back or away while you carry one", () => {
    const s = state();
    s.held.set(1, { id: 9, kind: "lamp", x: 3, y: 3, w: 1, h: 1, movable: true, blocks: true, under: false, seats: false, toppled: false });
    const b = bar();
    showArms(b, s);
    expect(b.text.textContent).toBe("Carrying the lamp. Choose where it goes.");
    expect([b.putBack.hidden, b.putAway.hidden, b.putDown.hidden]).toEqual([false, false, true]);
    expect(b.add.disabled).toBe(true);
  });

  it("goes away, and the catalogue comes back, when your arms are free", () => {
    const b = bar();
    b.add.disabled = true;
    showArms(b, state());
    expect(b.carrying.hidden).toBe(true);
    expect(b.add.disabled).toBe(false);
  });
});
