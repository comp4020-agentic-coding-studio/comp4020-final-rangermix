import { describe, expect, it } from "vitest";
import { renderHere, renderYourCats } from "../src/panels";
import { fromWelcome } from "../src/state";

const s = fromWelcome(
  {
    type: "welcome",
    you: 1,
    build: "b",
    now: 0,
    cap: 6,
    snapshot: {
      room: { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")], door: { x: 7, y: 0 }, walkway: [], furniture: [], catalogue: [] },
      people: [
        { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 5, y: 5 }, walk: null, sitting: false },
        { id: 2, name: "jo", look: { avatar: 0, colour: 2 }, place: "window", at: { x: 7, y: 0 }, walk: null, sitting: false },
      ],
      cats: [{ id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 6, y: 5 }, pose: "sit", walk: null, heldBy: null }],
      yourTrust: [{ cat: "mochi", value: 23.5, level: "familiar" }],
      held: [],
      treats: [],
      yourTreats: 3,
      bowls: 3,
    },
  },
  0,
);

describe("panels", () => {
  it("show each cat's trust in you, in words and as a bar", () => {
    const box = document.createElement("div");
    renderYourCats(box, s);
    expect(box.textContent).toContain("Mochi knows you.");
    expect(box.querySelector(".trust-bar")?.getAttribute("aria-label")).toBe("Mochi's trust in you: 23.5 of 100");
  });

  it("show your treats and the bowls, with a way to put a treat down", () => {
    const box = document.createElement("div");
    let put = 0;
    renderYourCats(box, s, () => put++);
    expect(box.textContent).toContain("Treats today: 3");
    expect(box.textContent).toContain("The bowls are full.");
    const button = [...box.querySelectorAll("button")].find((b) => b.textContent === "Put a treat down");
    button?.click();
    expect(put).toBe(1);
    s.yourTreats = 0;
    s.bowls = 0;
    renderYourCats(box, s, () => put++);
    expect(box.textContent).toContain("No treats left today.");
    expect(box.textContent).toContain("The bowls are empty.");
    expect([...box.querySelectorAll("button")].every((b) => b.hidden)).toBe(true);
  });

  it("show who's inside and who's at the window", () => {
    const box = document.createElement("div");
    renderHere(box, s);
    expect(box.textContent).toContain("Here (1/6)");
    expect(box.textContent).toContain("me (you)");
    expect(box.textContent).toContain("At the window (1)");
  });

  it("keeps the treat button, and its focus, through every update", () => {
    // Phase 3's review, finding 3: a cat moving mustn't take your focus away.
    const box = document.createElement("div");
    document.body.append(box);
    const now = { ...s, yourTreats: 3, bowls: 3 };
    renderYourCats(box, now, () => {});
    const button = box.querySelector("button")!;
    button.focus();
    const later = { ...now, cats: new Map(now.cats), yourTreats: 2 };
    later.cats.set("mochi", { ...now.cats.get("mochi")!, at: { x: 7, y: 5 } });
    renderYourCats(box, later, () => {});
    expect(box.querySelector("button")).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(box.textContent).toContain("Treats today: 2");
    box.remove();
  });
});
