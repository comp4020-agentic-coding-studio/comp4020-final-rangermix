import { describe, expect, it } from "vitest";
import type { ServerMsg } from "../src/protocol/ServerMsg";
import { afterWelcome, apply, fromWelcome, needsReload, pruneBubbles, shouldPing } from "../src/state";

type Welcome = Extract<ServerMsg, { type: "welcome" }>;

function welcome(): Welcome {
  return {
    type: "welcome",
    you: 1,
    build: "b1",
    now: 10_000,
    cap: 6,
    snapshot: {
      room: { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")], door: { x: 7, y: 0 }, walkway: [], furniture: [], catalogue: [] },
      people: [{ id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 7, y: 1 }, walk: null, sitting: false }],
      cats: [{ id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 1, y: 5 }, pose: "nap", walk: null }],
      yourTrust: [{ cat: "mochi", value: 1.5, level: "stranger" }],
      held: [],
    },
  };
}

describe("the client's copy of the café", () => {
  it("starts from the welcome, with the server's clock", () => {
    const s = fromWelcome(welcome(), 4_000);
    expect(s.offset).toBe(6_000);
    expect(s.cap).toBe(6);
    expect(s.people.get(1)?.name).toBe("me");
    expect(s.cats.get("mochi")?.pose).toBe("nap");
    expect(s.trust.get("mochi")?.value).toBe(1.5);
  });

  it("adds, places, moves and removes people", () => {
    const s = fromWelcome(welcome(), 10_000);
    const sam = { id: 2, name: "sam", look: { avatar: 1, colour: 1 }, place: "window" as const, at: { x: 7, y: 0 }, walk: null, sitting: false };
    expect(apply(s, { type: "personJoined", person: sam })).toEqual([{ kind: "announce", text: "sam is waiting at the window." }]);
    expect(apply(s, { type: "personJoined", person: sam })).toEqual([]);
    apply(s, { type: "personPlaced", id: 2, place: "inside", at: { x: 7, y: 0 }, walk: null });
    expect(s.people.get(2)?.place).toBe("inside");
    apply(s, { type: "personLeft", id: 2 });
    expect(s.people.has(2)).toBe(false);
  });

  it("keeps a bubble until its time is up, and remembers it for the visit", () => {
    const s = fromWelcome(welcome(), 10_000);
    apply(s, { type: "said", from: 1, text: "hello", to: null, ttlMs: 3000 }, 10_000);
    expect(s.said).toEqual([{ from: 1, name: "me", text: "hello", toName: null }]);
    pruneBubbles(s, 12_999);
    expect(s.bubbles).toHaveLength(1);
    pruneBubbles(s, 13_000);
    expect(s.bubbles).toHaveLength(0);
    expect(s.said).toHaveLength(1);
  });

  it("announces only the cat reactions that involve you", () => {
    const s = fromWelcome(welcome(), 10_000);
    expect(apply(s, { type: "catReacted", cat: "mochi", reaction: { kind: "purr", by: 1 } })).toEqual([{ kind: "announce", text: "Mochi purrs." }]);
    expect(apply(s, { type: "catReacted", cat: "mochi", reaction: { kind: "purr", by: 2 } })).toEqual([]);
    expect(s.cats.get("mochi")?.reaction?.reaction).toEqual({ kind: "purr", by: 2 });
  });

  it("updates your trust and the cats' poses", () => {
    const s = fromWelcome(welcome(), 10_000);
    apply(s, { type: "yourTrust", trust: { cat: "mochi", value: 3, level: "stranger" } });
    expect(s.trust.get("mochi")?.value).toBe(3);
    apply(s, { type: "catPosed", cat: "mochi", pose: "sit", at: { x: 2, y: 5 } });
    expect(s.cats.get("mochi")).toMatchObject({ pose: "sit", at: { x: 2, y: 5 }, walk: null });
  });

  it("reloads only when both builds are known and differ", () => {
    expect(needsReload("a", "b")).toBe(true);
    expect(needsReload("a", "a")).toBe(false);
    expect(needsReload("dev", "b")).toBe(false);
    expect(needsReload("a", "dev")).toBe(false);
  });

  it("follows a piece from the floor into someone's hands and down again", () => {
    const w = welcome();
    const cushion = { id: 14, kind: "cushion", x: 9, y: 7, w: 1, h: 1, movable: true, blocks: false, under: false, seats: true };
    w.snapshot.room.furniture = [cushion];
    const s = fromWelcome(w, 10_000);
    s.people.set(2, { id: 2, name: "sam", look: { avatar: 1, colour: 1 }, place: "inside", at: { x: 3, y: 3 }, walk: null, sitting: false });
    expect(apply(s, { type: "furnitureHeld", piece: cushion, by: 2 })).toEqual([{ kind: "announce", text: "sam picked up the cushion." }]);
    expect(s.room.furniture).toEqual([]);
    expect(s.held.get(2)?.id).toBe(14);
    expect(apply(s, { type: "furniturePlaced", piece: { ...cushion, x: 3, y: 8 }, by: 2 })).toEqual([{ kind: "announce", text: "sam put the cushion down." }]);
    expect(s.held.has(2)).toBe(false);
    expect(s.room.furniture).toEqual([{ ...cushion, x: 3, y: 8 }]);
    apply(s, { type: "furnitureHeld", piece: { ...cushion, x: 3, y: 8 }, by: 1 });
    expect(apply(s, { type: "furnitureRemoved", id: 14, by: 1 })).toEqual([]);
    expect(s.held.size).toBe(0);
    expect(s.room.furniture).toEqual([]);
  });

  it("seats someone and stands them up when they walk", () => {
    const s = fromWelcome(welcome(), 10_000);
    apply(s, { type: "personSat", id: 1, at: { x: 1, y: 5 } });
    expect(s.people.get(1)).toMatchObject({ at: { x: 1, y: 5 }, sitting: true, walk: null });
    apply(s, { type: "personMoved", id: 1, walk: { path: [{ x: 1, y: 5 }, { x: 1, y: 6 }], start: 10_000, speed: 3 } });
    expect(s.people.get(1)?.sitting).toBe(false);
  });

  it("reloads at most once for the same server build, so a mismatch can't loop", () => {
    expect(needsReload("a", "b", null)).toBe(true);
    expect(needsReload("a", "b", "a")).toBe(false);
    expect(needsReload("c", "b", "a")).toBe(true);
  });

  it("passes on 'still there?', its end, and your own walk-out", () => {
    const s = fromWelcome(welcome(), 10_000);
    expect(apply(s, { type: "stillThere", secs: 60 })).toEqual([{ kind: "stillThere", secs: 60 }]);
    expect(apply(s, { type: "nudgeOver" })).toEqual([{ kind: "nudgeOver" }]);
    expect(apply(s, { type: "personLeft", id: 1 })).toEqual([{ kind: "youLeft" }]);
  });

  it("shows an emote over its person and announces someone else's", () => {
    const s = fromWelcome(welcome(), 10_000);
    s.people.set(2, { id: 2, name: "sam", look: { avatar: 1, colour: 1 }, place: "inside", at: { x: 3, y: 3 }, walk: null, sitting: false });
    expect(apply(s, { type: "emoted", from: 2, emote: "wave" }, 10_000)).toEqual([{ kind: "announce", text: "sam waves." }]);
    expect(s.emotes.get(2)).toEqual({ emote: "wave", at: 10_000 });
    expect(apply(s, { type: "emoted", from: 1, emote: "laugh" }, 10_000)).toEqual([]);
    expect(s.emotes.get(1)?.emote).toBe("laugh");
  });

  it("forgets someone's emote and what they carried when they leave", () => {
    const s = fromWelcome(welcome(), 10_000);
    s.people.set(2, { id: 2, name: "sam", look: { avatar: 1, colour: 1 }, place: "inside", at: { x: 3, y: 3 }, walk: null, sitting: false });
    apply(s, { type: "emoted", from: 2, emote: "wave" }, 10_000);
    s.held.set(2, { id: 9, kind: "lamp", x: 0, y: 0, w: 1, h: 1, movable: true, blocks: true, under: false, seats: false });
    apply(s, { type: "personLeft", id: 2 });
    expect(s.emotes.has(2)).toBe(false);
    expect(s.held.has(2)).toBe(false);
  });

  it("keeps 'said this visit' across a reconnect's welcome", () => {
    const s = fromWelcome(welcome(), 10_000);
    apply(s, { type: "said", from: 1, text: "before the drop", to: null, ttlMs: 3000 }, 10_000);
    const again = fromWelcome(welcome(), 20_000, s);
    expect(again.said.map((l) => l.text)).toEqual(["before the drop"]);
  });

  it("says 'still here' at most every 30 seconds", () => {
    expect(shouldPing(null, 1_000)).toBe(true);
    expect(shouldPing(1_000, 30_999)).toBe(false);
    expect(shouldPing(1_000, 31_000)).toBe(true);
  });

  it("asks you to refresh when a reload didn't bring the new client, or can't be noted", () => {
    expect(afterWelcome("a", "a", null, true)).toBe("carryOn");
    expect(afterWelcome("dev", "b", null, true)).toBe("carryOn");
    expect(afterWelcome("a", "b", null, true)).toBe("reload");
    expect(afterWelcome("a", "b", "a", true)).toBe("tellToRefresh");
    expect(afterWelcome("a", "b", null, false)).toBe("tellToRefresh");
    expect(afterWelcome("c", "b", "a", true)).toBe("reload");
  });
});
