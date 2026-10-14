import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { baseUrl, meetACat, type Msg, signUp, Visitor } from "./helpers";

// A stop and a start of the running image (slice 01, ADR 0006): the cats
// come back moved by the gap, and the furniture, your trust and the
// chalkboard as they were (slice 02).
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

describe.skipIf(!restart)("a stop and a start of the app", () => {
  it("bring the cats back moved by the gap, with furniture, trust and the board as they were", async () => {
    const account = await signUp();
    const v = await Visitor.connect(account.cookie);
    const { trust } = await meetACat(v);
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
      // The first meeting's line is still on the board, unless eight newer ones pushed it off.
      const board: Msg[] = after.welcome.snapshot.chalkboard;
      const ours = welcome.snapshot.chalkboard.find((l: Msg) => l.what.kind === "met" && l.what.with === account.name);
      expect(ours, "the meeting made a line").toBeDefined();
      const newer = board.filter((l) => l.at > ours.at).length;
      if (newer < 8) expect(board).toContainEqual(ours);
    } finally {
      await after.leave();
    }
  }, 180_000);
});
