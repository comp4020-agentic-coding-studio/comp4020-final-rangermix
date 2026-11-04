import { describe, expect, it } from "vitest";
import { renderChalkboard, renderHere, renderYourCats, showTreatButton } from "../src/panels";
import { fromWelcome } from "../src/state";

const s = fromWelcome(
  {
    type: "welcome",
    you: 1,
    build: "b",
    now: 0,
    cap: 6,
    chalkHours: 24,
    chalkShown: 8,
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
      chalkboard: [],
    },
  },
  0,
);

describe("panels", () => {
  it("show the chalkboard's lines as text, oldest first, and say when it's empty", () => {
    const list = document.createElement("ol");
    renderChalkboard(list, { ...s, chalkboard: [] }, 0);
    expect(list.textContent).toBe("Nothing on the board yet.");
    renderChalkboard(
      list,
      {
        ...s,
        chalkboard: [
          { at: 0, cat: "Mochi", what: { kind: "met", with: "<b>jo</b>" } },
          { at: 1, cat: "Tora", what: { kind: "played" } },
        ],
      },
      1,
    );
    const items = [...list.querySelectorAll("li")];
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toMatch(/, Mochi met <b>jo<\/b> for the first time$/);
    expect(items[1].textContent).toMatch(/, Tora played with the toys$/);
    expect(list.querySelector("b"), "a name is text, never markup").toBeNull();
    expect(items[0].querySelector("time")?.getAttribute("datetime")).toBe(new Date(0).toISOString());
    // Unchanged, the list isn't rebuilt, so a screen reader's place in it holds (slice 02's review, finding 9).
    const again = { ...s, chalkboard: [{ at: 0, cat: "Mochi", what: { kind: "met" as const, with: "<b>jo</b>" } }, { at: 1, cat: "Tora", what: { kind: "played" as const } }] };
    renderChalkboard(list, again, 1);
    expect(list.querySelector("li")).toBe(items[0]);
  });

  it("show each cat's trust in you, in words and as a bar", () => {
    const box = document.createElement("div");
    renderYourCats(box, s);
    expect(box.textContent).toContain("Mochi knows you.");
    expect(box.querySelector(".trust-bar")?.getAttribute("aria-label")).toBe("Mochi's trust in you: 23.5 of 100");
  });

  it("show your treats and the bowls, and leave putting one down to the talk bar (slice 14)", () => {
    const box = document.createElement("div");
    renderYourCats(box, { ...s, yourTreats: 3, bowls: 3 });
    expect(box.textContent).toContain("Treats today: 3");
    expect(box.textContent).toContain("The bowls are full.");
    // A pinned Your cats lets clicks through, so it holds nothing to press.
    expect(box.querySelectorAll("button")).toHaveLength(0);
    renderYourCats(box, { ...s, yourTreats: 0, bowls: 0 });
    expect(box.textContent).toContain("No treats left today.");
    expect(box.textContent).toContain("The bowls are empty.");
  });

  it("show the talk bar's treat button while you have treats, and put one down when it's pressed (slice 14)", () => {
    const button = document.createElement("button");
    let put = 0;
    showTreatButton(button, { ...s, yourTreats: 3 }, false, () => put++);
    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(false);
    button.click();
    expect(put).toBe(1);
    showTreatButton(button, { ...s, yourTreats: 0 }, false, () => put++);
    expect(button.hidden).toBe(true);
    // Nothing to act on while the café wakes, as the emotes (slice 07's review, finding 5).
    showTreatButton(button, { ...s, yourTreats: 2 }, true, () => put++);
    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(true);
  });

  it("show who's inside and who's at the window", () => {
    const box = document.createElement("div");
    renderHere(box, s);
    expect(box.textContent).toContain("Inside (1/6)");
    expect(box.textContent).toContain("me (you)");
    expect(box.textContent).toContain("At the window (1)");
  });

  it("keeps Your cats' rows in place through every update", () => {
    // Phase 3's review, finding 3: a cat moving mustn't rebuild the panel.
    const box = document.createElement("div");
    const now = { ...s, yourTreats: 3, bowls: 3 };
    renderYourCats(box, now);
    const rows = box.querySelector(".cat-rows");
    const later = { ...now, cats: new Map(now.cats), yourTreats: 2 };
    later.cats.set("mochi", { ...now.cats.get("mochi")!, at: { x: 7, y: 5 } });
    renderYourCats(box, later);
    expect(box.querySelector(".cat-rows")).toBe(rows);
    expect(box.textContent).toContain("Treats today: 2");
  });
});
