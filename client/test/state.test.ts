import { describe, expect, it } from "vitest";
import type { ServerMsg } from "../src/protocol/ServerMsg";
import { apply, fromWelcome, needsReload, pruneBubbles } from "../src/state";

type Welcome = Extract<ServerMsg, { type: "welcome" }>;

function welcome(): Welcome {
  return {
    type: "welcome",
    you: 1,
    build: "b1",
    now: 10_000,
    cap: 6,
    snapshot: {
      room: { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")], door: { x: 7, y: 0 }, furniture: [] },
      people: [{ id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 7, y: 1 }, walk: null }],
      cats: [{ id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 1, y: 5 }, pose: "nap", walk: null }],
      yourTrust: [{ cat: "mochi", value: 1.5, level: "stranger" }],
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
    const sam = { id: 2, name: "sam", look: { avatar: 1, colour: 1 }, place: "window" as const, at: { x: 7, y: 0 }, walk: null };
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
});
