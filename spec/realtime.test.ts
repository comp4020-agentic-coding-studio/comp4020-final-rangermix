import { afterEach, describe, expect, it } from "vitest";
import { catPoses, signUp, Visitor, type Msg } from "./helpers";

// Real time (brief: within about a second), the cap and the line (ADR 0008),
// fleeting bubbles (ADR 0010), and the cats remembering people (ADR 0002).
const open: Visitor[] = [];

async function visitor(cookie?: string): Promise<Visitor> {
  const v = await Visitor.connect(cookie ?? (await signUp()).cookie);
  open.push(v);
  return v;
}

function forget(v: Visitor): void {
  open.splice(open.indexOf(v), 1);
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((v) => v.leave()));
});

describe("real time", () => {
  it("one person's bubble reaches another within a second", async () => {
    const a = await visitor();
    const b = await visitor();
    const from = b.messages.length;
    const sent = Date.now();
    a.send({ type: "say", text: "hello there", to: null });
    const said = await b.next((m) => m.type === "said" && m.text === "hello there", 1000, from);
    expect(said.from).toBe(a.welcome.you);
    expect(Date.now() - sent).toBeLessThan(1000);
  });

  it("one person's wave reaches another within a second", async () => {
    const a = await visitor();
    const b = await visitor();
    const from = b.messages.length;
    const sent = Date.now();
    a.send({ type: "emote", emote: "wave" });
    const waved = await b.next((m) => m.type === "emoted" && m.from === a.welcome.you, 1000, from);
    expect(waved.emote).toBe("wave");
    expect(Date.now() - sent).toBeLessThan(1000);
  });

  it("refuses a bubble over 100 characters, and nobody else sees it", async () => {
    const a = await visitor();
    const b = await visitor();
    const from = b.messages.length;
    a.send({ type: "say", text: "x".repeat(101), to: null });
    expect((await a.next((m) => m.type === "error")).code).toBe("tooLong");
    await new Promise((r) => setTimeout(r, 300));
    expect(b.messages.slice(from).some((m) => m.type === "said")).toBe(false);
  });

  it("never replays a bubble to someone who reconnects", async () => {
    const account = await signUp();
    const a = await visitor();
    const first = await visitor(account.cookie);
    a.send({ type: "say", text: "remember me?", to: null });
    await first.next((m) => m.type === "said" && m.text === "remember me?");
    first.close();
    forget(first);
    const again = await visitor(account.cookie);
    expect(JSON.stringify(again.welcome)).not.toContain("remember me?");
    await new Promise((r) => setTimeout(r, 300));
    expect(again.messages.some((m) => m.type === "said")).toBe(false);
  });

  it("keeps one avatar when the same account opens a second tab, and tells the first", async () => {
    const account = await signUp();
    const first = await visitor(account.cookie);
    const second = await visitor(account.cookie);
    await first.next((m) => m.type === "replaced", 2000);
    const mine = second.welcome.snapshot.people.filter((p: Msg) => p.id === second.welcome.you);
    expect(mine).toHaveLength(1);
  });

  it("seats six inside; the next waits at the window, can only talk, and comes in when a seat frees", async () => {
    const watcher = await visitor();
    const inside = watcher.welcome.snapshot.people.filter((p: Msg) => p.place === "inside").length;
    const fillers: Visitor[] = [];
    for (let n = inside; n < 6; n++) fillers.push(await visitor());
    const late = await visitor();
    const me = late.welcome.snapshot.people.find((p: Msg) => p.id === late.welcome.you);
    expect(me.place).toBe("window");
    late.send({ type: "walkTo", tile: { x: 5, y: 5 } });
    expect((await late.next((m) => m.type === "error")).code).toBe("notFromWindow");
    const from = watcher.messages.length;
    late.send({ type: "say", text: "can I come in?", to: null });
    await watcher.next((m) => m.type === "said" && m.text === "can I come in?", 1000, from);
    const leaving = fillers[0] ?? watcher;
    await leaving.leave();
    forget(leaving);
    const placed = await late.next((m) => m.type === "personPlaced" && m.id === late.welcome.you, 1000);
    expect(placed.place).toBe("inside");
  }, 20_000);

  it("a new destination mid-step carries the walk on from where it is, not from the tile last reached", async () => {
    // The user's ask, 2026-11-07: changing where you're going snapped you
    // back to the last tile you'd reached. A walk is drawn from its path,
    // start and speed (design.md, "Real-time"), so the new walk must put you
    // where the old one had you when it began, and finish the step first.
    const v = await visitor();
    const me = v.welcome.you as number;
    const room = v.welcome.snapshot.room as Msg;
    const blocked = (x: number, y: number) =>
      room.tiles[y][x] !== "." ||
      room.furniture.some((f: Msg) => f.blocks && x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) ||
      v.welcome.snapshot.people.some((p: Msg) => p.id !== me && p.at.x === x && p.at.y === y);
    // A clear run of six tiles, off the door's walkway, to walk along.
    let run: { x: number; y: number } | null = null;
    for (let y = room.height - 1; y > 3 && !run; y--)
      for (let x = 0; x + 5 < room.width && !run; x++)
        if ([0, 1, 2, 3, 4, 5].every((d) => !blocked(x + d, y))) run = { x, y };
    expect(run, "a clear run of floor").not.toBeNull();
    const walkTo = async (x: number, y: number) => {
      const from = v.messages.length;
      v.send({ type: "walkTo", tile: { x, y } });
      const m = await v.next((m) => (m.type === "personMoved" && m.id === me) || m.type === "error", 3000, from);
      expect(m.type, JSON.stringify(m)).toBe("personMoved");
      return m.walk as { path: { x: number; y: number }[]; start: number; speed: number };
    };
    // To the run's start, and let the walk end.
    const there = await walkTo(run!.x, run!.y);
    await new Promise((r) => setTimeout(r, ((there.path.length - 1) / there.speed) * 1000 + 300));
    // Along it, then mid-way through its second step, turn back.
    const along = await walkTo(run!.x + 5, run!.y);
    await new Promise((r) => setTimeout(r, 1.5 * (1000 / along.speed)));
    const back = await walkTo(run!.x, run!.y);
    const at = (w: typeof along, t: number) => {
      const steps = Math.max(0, ((t - w.start) * w.speed) / 1000);
      const i = Math.min(Math.floor(steps), w.path.length - 1);
      const b = w.path[Math.min(i + 1, w.path.length - 1)];
      const f = steps - i;
      return { x: w.path[i].x + (b.x - w.path[i].x) * f, y: w.path[i].y + (b.y - w.path[i].y) * f };
    };
    // It finishes the step under way, then comes back along the run.
    expect(back.path.slice(0, 2)).toEqual(along.path.slice(1, 3));
    expect(back.path.at(-1)).toEqual({ x: run!.x, y: run!.y });
    // Over that step, the old walk and the new one put you in the same
    // place at every moment: the walk carries on, with no jump back. (Before
    // the fix, the new walk started on the step's first tile when it came.)
    const step = 1000 / back.speed;
    for (const part of [0.1, 0.5, 0.9]) {
      const t = back.start + step * part;
      const old = at(along, t);
      const now = at(back, t);
      expect(Math.abs(now.x - old.x) + Math.abs(now.y - old.y), `${part}: ${JSON.stringify(now)} vs ${JSON.stringify(old)}`).toBeLessThan(0.01);
    }
    // And it was sent mid-step: it starts when that step did, to the
    // millisecond its start is rounded to.
    expect(Math.abs(back.start - (along.start + step))).toBeLessThanOrEqual(1);
  }, 20_000);

  it("the cats remember you when you come back", async () => {
    const account = await signUp();
    const v = await visitor(account.cookie);
    let trust: Msg | null = null;
    const deadline = Date.now() + 25_000;
    for (let round = 0; !trust && Date.now() < deadline; round++) {
      // A stranger's first pet is a sniff, even from a cat half asleep. A
      // napping cat stays put; one on the move may be gone when you get there.
      const cats = catPoses(v);
      const tiers = [cats.filter((c) => c.pose === "nap"), cats.filter((c) => c.pose === "sit" || c.pose === "idle"), cats];
      const pool = tiers.find((t) => t.length > 0)!;
      const from = v.messages.length;
      v.send({ type: "pet", cat: pool[round % pool.length].id });
      trust = await v.next((m) => m.type === "yourTrust" && m.trust.value > 0, 6000, from).catch(() => null);
    }
    expect(trust, "no cat warmed to the visitor within 25 seconds").not.toBeNull();
    await v.leave();
    forget(v);
    const back = await visitor(account.cookie);
    const remembered = back.welcome.snapshot.yourTrust.find((t: Msg) => t.cat === trust!.trust.cat);
    expect(remembered.value).toBe(trust!.trust.value);
  }, 40_000);
});
