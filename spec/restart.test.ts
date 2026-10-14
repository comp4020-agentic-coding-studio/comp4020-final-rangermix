import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { baseUrl, meetACat, type Msg, signUp, Visitor } from "./helpers";

// A stop and a start of the running image (slice 01, ADR 0006): the café
// replays the gap on waking, and the furniture, your trust and the chalkboard
// come back as they were (slice 02). It needs a way to stop and start the
// app and to read its output, which CI gives as APP_RESTART (docker stop, a
// pause, docker start) and APP_LOGS (docker logs); without them it's skipped.
// That the replay moves the cats in character is held by `cargo test`: since
// a cat now wakes doing what it was doing (slice 01's review, finding 1), a
// café whose cats were all napping rightly looks the same after 30 seconds.
const restart = process.env.APP_RESTART;
const logs = process.env.APP_LOGS;

/** Every piece by kind and place: ids are handed out afresh on each start. */
const places = (welcome: Msg): string[] => welcome.snapshot.room.furniture.map((f: Msg) => `${f.kind}@${f.x},${f.y}`).sort();
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

/** Floor tiles nothing stands on, off the walkway and clear of the cats, from the back of the room. */
function freeTiles(welcome: Msg): { x: number; y: number }[] {
  const room = welcome.snapshot.room;
  const covered = (x: number, y: number) =>
    room.furniture.some((f: Msg) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) ||
    room.walkway.some((w: Msg) => w.x === x && w.y === y) ||
    welcome.snapshot.cats.some((c: Msg) => c.at.x === x && c.at.y === y);
  const out: { x: number; y: number }[] = [];
  for (let y = room.height - 2; y >= 2; y--) {
    for (let x = 1; x < room.width - 1; x++) if (room.tiles[y][x] === "." && !covered(x, y)) out.push({ x, y });
  }
  return out;
}

/** Takes a cushion from the catalogue and puts it down: a layout only the store could keep. */
async function placeACushion(v: Visitor): Promise<string> {
  for (const to of freeTiles(v.welcome).slice(0, 5)) {
    const from = v.messages.length;
    v.send({ type: "take", kind: "cushion" });
    await v.next((m) => m.type === "furnitureHeld" && m.by === v.welcome.you, 3_000, from);
    v.send({ type: "place", to });
    const m = await v.next((m) => (m.type === "furniturePlaced" && m.by === v.welcome.you) || m.type === "error", 10_000, from);
    if (m.type === "furniturePlaced") return `cushion@${m.piece.x},${m.piece.y}`;
    v.send({ type: "putAway" });
  }
  throw new Error("nowhere to put a cushion down");
}

/**
 * The café as it is, once a cat has left a trace (slice 02's review, finding
 * 8): with nothing down, "what was down stays down" would hold of anything.
 * Cats knock things over and scatter the toys only with nobody inside, so it
 * looks in briefly every few seconds, for a minute at most. If none comes,
 * the run says so, and `cargo test` holds traces through a restart anyway.
 */
async function withATrace(cookie: string): Promise<Msg> {
  let welcome: Msg = { type: "welcome" };
  for (let look = 0; look < 12; look++) {
    const v = await Visitor.connect(cookie);
    welcome = v.welcome;
    await v.leave();
    if (toppled(welcome).length > 0) return welcome;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  console.warn("no trace within a minute: this run's restart check holds lines and furniture, not traces");
  return welcome;
}

/** The latest wake-up line the app wrote. */
function lastWake(): Msg {
  const out = execSync(logs as string, { shell: "/bin/bash", encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  const woke = out
    .split("\n")
    .filter((l) => l.includes('"woke"'))
    .map((l) => JSON.parse(l.slice(l.indexOf("{"))) as Msg);
  if (woke.length === 0) throw new Error("no wake-up line in the app's output");
  return woke[woke.length - 1];
}

describe.skipIf(!restart || !logs)("a stop and a start of the app", () => {
  it("replay the gap, and bring back the furniture, trust and the board as they were", async () => {
    const account = await signUp();
    const v = await Visitor.connect(account.cookie);
    const { trust } = await meetACat(v);
    const cushion = await placeACushion(v);
    await v.leave();
    const welcome = await withATrace(account.cookie);
    expect(places(welcome)).toContain(cushion);

    execSync(restart as string, { stdio: "inherit", shell: "/bin/bash" });
    await answering();

    const after = await Visitor.connect(account.cookie);
    try {
      // The restart's own word that it replayed the time it was stopped.
      const woke = lastWake();
      expect(woke.first, "a café with a history").toBe(false);
      expect(woke.failed ?? false).toBe(false);
      expect(woke.gap_secs).toBeGreaterThanOrEqual(25);
      expect(Math.abs(woke.steps - woke.gap_secs)).toBeLessThanOrEqual(2);
      expect(places(after.welcome), "the furniture where it was, the new cushion too").toEqual(places(welcome));
      // Nobody was inside to stand anything up: what was down stays down.
      expect(toppled(after.welcome)).toEqual(expect.arrayContaining(toppled(welcome)));
      expect(after.welcome.snapshot.yourTrust.find((t: Msg) => t.cat === trust.cat)).toEqual(trust);
      // The first meeting's line is still on the board, unless eight newer ones pushed it off.
      const board: Msg[] = after.welcome.snapshot.chalkboard;
      const ours = welcome.snapshot.chalkboard.find((l: Msg) => l.what.kind === "met" && l.what.with === account.name);
      expect(ours, "the meeting made a line").toBeDefined();
      if (board.filter((l) => l.at > ours.at).length < 8) expect(board).toContainEqual(ours);
      // Leave the room as it was found.
      const [x, y] = cushion.slice("cushion@".length).split(",").map(Number);
      const piece = after.welcome.snapshot.room.furniture.find((f: Msg) => f.kind === "cushion" && f.x === x && f.y === y);
      after.send({ type: "grab", id: piece.id });
      await after.next((m) => m.type === "furnitureHeld" && m.piece.id === piece.id, 10_000);
      after.send({ type: "putAway" });
      await after.next((m) => m.type === "furnitureRemoved" && m.id === piece.id, 3_000);
    } finally {
      await after.leave();
    }
  }, 180_000);
});
