import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { baseUrl, type Msg, signUp, Visitor } from "./helpers";

// A stop and a start of the running image (slice 01, ADR 0006): the cats
// come back moved by the gap, and the furniture and your trust as they were.
// It needs a way to stop and start the app, which CI gives as APP_RESTART
// (docker stop, a pause, docker start); without one it's skipped.
const restart = process.env.APP_RESTART;

/** Every piece by kind and place: ids are handed out afresh on each start. */
const places = (welcome: Msg): string[] => welcome.snapshot.room.furniture.map((f: Msg) => `${f.kind}@${f.x},${f.y}`).sort();
const catTiles = (welcome: Msg): string[] => welcome.snapshot.cats.map((c: Msg) => `${c.id}@${c.at.x},${c.at.y}`).sort();
const toppled = (welcome: Msg): string[] =>
  welcome.snapshot.room.furniture
    .filter((f: Msg) => f.toppled)
    .map((f: Msg) => `${f.kind}@${f.x},${f.y}`)
    .sort();

async function answering(): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt++) {
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`the app didn't come back at ${baseUrl}`);
}

/** Pets the cats in turn until one sniffs your hand: a first meeting leaves trust. */
async function makeAFriend(v: Visitor): Promise<{ cat: string; value: number; level: string }> {
  for (let round = 0; round < 3; round++) {
    for (const cat of v.welcome.snapshot.cats as Msg[]) {
      const from = v.messages.length;
      v.send({ type: "pet", cat: cat.id });
      try {
        const m = await v.next((m) => (m.type === "yourTrust" && m.trust.value > 0) || m.type === "error", 10_000, from);
        if (m.type === "yourTrust") return m.trust;
      } catch {
        // Hiding, or it walked off: try the next one.
      }
    }
  }
  throw new Error("no cat let itself be petted");
}

describe.skipIf(!restart)("a stop and a start of the app", () => {
  it("bring the cats back moved by the gap, with furniture and trust as they were", async () => {
    const account = await signUp();
    const v = await Visitor.connect(account.cookie);
    const trust = await makeAFriend(v);
    await v.leave();
    const before = await Visitor.connect(account.cookie);
    const welcome = before.welcome;
    await before.leave();

    execSync(restart as string, { stdio: "inherit", shell: "/bin/bash" });
    await answering();

    const after = await Visitor.connect(account.cookie);
    try {
      expect(places(after.welcome), "the furniture where it was").toEqual(places(welcome));
      // Nobody was inside to stand anything up: what was down stays down.
      expect(toppled(after.welcome)).toEqual(expect.arrayContaining(toppled(welcome)));
      expect(after.welcome.snapshot.yourTrust.find((t: Msg) => t.cat === trust.cat)).toEqual(trust);
      expect(catTiles(after.welcome), "the cats lived through the gap").not.toEqual(catTiles(welcome));
    } finally {
      await after.leave();
    }
  }, 180_000);
});
