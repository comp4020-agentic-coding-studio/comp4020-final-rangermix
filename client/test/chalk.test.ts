import { describe, expect, it } from "vitest";
import { boardLines, chalkTime, chalkWords } from "../src/chalk";
import type { ChalkLine } from "../src/protocol/ChalkLine";
import type { ServerMsg } from "../src/protocol/ServerMsg";
import { fromWelcome } from "../src/state";

// The chalkboard (slice 02): the server sends what the cats did as fixed
// fields; the client puts it into words, in Canberra time.

/** 16:12 UTC on 14 October is 3:12am on the 15th in Canberra (AEDT, UTC+11). */
const at = Date.UTC(2026, 9, 14, 16, 12);
const line = (what: ChalkLine["what"], cat = "Burakku", when = at): ChalkLine => ({ at: when, cat, what });

describe("the chalkboard's words", () => {
  it("tell each thing a cat did, with whom and with what", () => {
    expect(chalkWords(line({ kind: "knockedOver", piece: "plant" }))).toBe("Burakku knocked over the plant");
    expect(chalkWords(line({ kind: "knockedOver", piece: "toys" }, "Tora"))).toBe("Tora scattered the toys");
    expect(chalkWords(line({ kind: "knockedOver", piece: "cat_bed" }))).toBe("Burakku knocked over the cat bed");
    expect(chalkWords(line({ kind: "met", with: "sam" }, "Mochi"))).toBe("Mochi met sam for the first time");
    expect(chalkWords(line({ kind: "greeted", with: "sam" }, "Mochi"))).toBe("Mochi greeted sam at the door");
    expect(chalkWords(line({ kind: "lap", with: "sam", minutes: 20 }, "Mochi"))).toBe("Mochi slept on sam's lap for 20 minutes");
    expect(chalkWords(line({ kind: "lap", with: "sam", minutes: 1 }, "Mochi"))).toBe("Mochi slept on sam's lap for 1 minute");
    expect(chalkWords(line({ kind: "playedWith", with: "jo" }, "Tora"))).toBe("Tora played with jo");
    expect(chalkWords(line({ kind: "played" }, "Tora"))).toBe("Tora played with the toys");
    expect(chalkWords(line({ kind: "investigated", piece: "scratching_post" }, "Tora"))).toBe("Tora looked over the new scratching post");
    expect(chalkWords(line({ kind: "perched" }, "Tora"))).toBe("Tora watched the street from the window seat");
  });

  it("tell the time by Canberra's clock, either side of daylight saving", () => {
    expect(chalkTime(at)).toBe("3:12am");
    expect(chalkTime(Date.UTC(2026, 6, 1, 2, 5))).toBe("12:05pm"); // AEST, UTC+10
    expect(chalkTime(Date.UTC(2026, 9, 14, 13, 0))).toBe("12:00am"); // midnight, AEDT
    expect(chalkTime(Date.UTC(2026, 9, 14, 10, 30))).toBe("9:30pm");
  });
});

type Welcome = Extract<ServerMsg, { type: "welcome" }>;

function welcomeAt(now: number, chalkboard: ChalkLine[]): Welcome {
  return {
    type: "welcome",
    you: 1,
    build: "b",
    now,
    cap: 6,
    snapshot: {
      room: { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")], door: { x: 7, y: 0 }, walkway: [], furniture: [], catalogue: [] },
      people: [],
      cats: [],
      yourTrust: [],
      held: [],
      treats: [],
      yourTreats: 3,
      bowls: 3,
      chalkboard,
    },
  };
}

const DAY = 24 * 3_600_000;

describe("the board's lines", () => {
  it("keep a day by the server's clock, whatever this one says", () => {
    const now = at + DAY;
    const lines = [line({ kind: "played" }, "Tora", now - DAY), line({ kind: "played" }, "Mochi", now - DAY + 1)];
    // This device's clock runs an hour fast.
    const localNow = now + 3_600_000;
    const s = fromWelcome(welcomeAt(now, lines), localNow);
    expect(boardLines(s, localNow).map((l) => l.cat)).toEqual(["Mochi"]);
    expect(boardLines(s, localNow + DAY).map((l) => l.cat)).toEqual([]);
  });

  it("show the latest eight, oldest first", () => {
    const lines = Array.from({ length: 10 }, (_, n) => line({ kind: "met", with: `p${n}` }, "Mochi", at + n));
    const s = fromWelcome(welcomeAt(at + 10, lines), at + 10);
    expect(boardLines(s, at + 10).map((l) => (l.what.kind === "met" ? l.what.with : ""))).toEqual(["p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"]);
  });
});
