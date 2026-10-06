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
