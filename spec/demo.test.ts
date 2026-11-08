import { describe, expect, it } from "vitest";
import { post, sessionCookie, signUp, Visitor, type Msg } from "./helpers";

// Demo accounts (slice 17, ADR 0022): markers log in as demo1 or demo2 from
// the README, and move the café's clock on for everyone in it. The café the
// spec runs against must be seeded first (`cafe demo seed`), as CI does; its
// password is APP_DEMO_PASSWORD, and without it these checks are skipped.
const password = process.env.APP_DEMO_PASSWORD;

async function logIn(name: string, pw: string): Promise<string> {
  const res = await post("/api/login", { name, password: pw });
  if (res.status !== 200) throw new Error(`log-in failed: ${res.status} ${await res.text()}`);
  return sessionCookie(res);
}

const CLOCK = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/** Minutes past midnight in Canberra at `ms`. */
function minuteOf(ms: number): number {
  const parts = Object.fromEntries(CLOCK.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** When `v` next gets a message passing `test`, by this machine's clock. */
async function arrival(v: Visitor, test: (m: Msg) => boolean, from: number, timeoutMs = 3000): Promise<[Msg, number]> {
  const m = await v.next(test, timeoutMs, from);
  return [m, Date.now()];
}

describe.skipIf(!password)("demo accounts", () => {
  it("only a demo account moves the clock on, and everyone goes with it", async () => {
    const visitor = await Visitor.connect((await signUp()).cookie);
    expect(visitor.welcome.demo).toBe(false);
    let from = visitor.messages.length;
    visitor.send({ type: "setClock", minute: 60 });
    expect((await visitor.next((m) => m.type === "error", 3000, from)).code).toBe("notDemo");

    const demo = await Visitor.connect(await logIn("demo1", password!));
    expect(demo.welcome.demo).toBe(true);
    // The clock moves at most once a minute: another check may just have.
    const wait = Math.max(0, demo.welcome.nextJump - demo.welcome.now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait + 500));
    // Two minutes on by the café's clock: a short jump, so the café the
    // rest of the spec uses keeps nearly its own hour.
    const minute = (minuteOf(demo.welcome.now + wait) + 2) % (24 * 60);
    from = visitor.messages.length;
    const fromDemo = demo.messages.length;
    demo.send({ type: "setClock", minute });
    const [[told], [toldDemo]] = await Promise.all([
      arrival(visitor, (m) => m.type === "jumping", from),
      arrival(demo, (m) => m.type === "jumping", fromDemo),
    ]);
    expect(told.by).toBe("demo1");
    expect(told.to).toBe(toldDemo.to);
    const [[welcome, at], [welcomeDemo, atDemo]] = await Promise.all([
      arrival(visitor, (m) => m.type === "welcome", from, 10_000),
      arrival(demo, (m) => m.type === "welcome", fromDemo, 10_000),
    ]);
    expect(Math.abs(at - atDemo)).toBeLessThan(1000);
    expect(welcome.now).toBeGreaterThanOrEqual(told.to);
    expect(welcomeDemo.ahead).toBe(welcome.ahead);
    expect(minuteOf(welcome.now)).toBe(minute);

    // At once again: too soon.
    const again = demo.messages.length;
    demo.send({ type: "setClock", minute });
    expect((await demo.next((m) => m.type === "error", 3000, again)).code).toBe("tooSoon");
    await visitor.leave();
    await demo.leave();
  }, 90_000);

  it("follows the README: bots until six are inside and one more, so a newcomer who leaves comes back to the window (slice 17's review, finding 2)", async () => {
    const account = await signUp();
    let newcomer = await Visitor.connect(account.cookie);
    const demo = await Visitor.connect(await logIn("demo2", password!));
    const people = demo.welcome.snapshot.people as Msg[];
    // Bots left by an earlier run of this check, if its demo2 is back within its grace period.
    const already = people.filter((p) => p.bot).length;
    const inside = people.filter((p) => p.place === "inside").length;
    // Bots until six are inside, then one more, who waits at the window.
    const adding = demo.welcome.cap - inside + 1;
    let from = demo.messages.length;
    let last: Msg | undefined;
    for (let n = 0; n < adding; n++) demo.send({ type: "addBot" });
    for (let n = 0; n < adding; n++) {
      last = await demo.next((m) => m.type === "personJoined" && m.person.bot, 3000, from);
      from = demo.messages.indexOf(last) + 1;
    }
    expect(last?.person.place).toBe("window");
    // The newcomer leaves, and the bot at the window takes the seat: back
    // again, the newcomer waits at the window and can only talk.
    await newcomer.leave();
    newcomer = await Visitor.connect(account.cookie);
    const me = (newcomer.welcome.snapshot.people as Msg[]).find((p) => p.id === newcomer.welcome.you);
    expect(me?.place).toBe("window");
    // A bot removed, and the newcomer walks in.
    const fromNewcomer = newcomer.messages.length;
    demo.send({ type: "removeBot" });
    await newcomer.next((m) => m.type === "personPlaced" && m.id === newcomer.welcome.you && m.place === "inside", 3000, fromNewcomer);
    await newcomer.leave();
    // Leaving takes the demo account's bots with it.
    const watcher = await Visitor.connect((await signUp()).cookie);
    const fromWatcher = watcher.messages.length;
    await demo.leave();
    await watcher.next((m) => m.type === "personLeft" && m.id === demo.welcome.you, 3000, fromWatcher);
    await new Promise((r) => setTimeout(r, 200));
    const left = watcher.messages.slice(fromWatcher).filter((m) => m.type === "personLeft").length;
    expect(left).toBe(1 + already + adding - 1);
    await watcher.leave();
  });

  it("lays out a furniture set at once for everyone, and only for a demo account (slice 17, part 2)", async () => {
    const visitor = await Visitor.connect((await signUp()).cookie);
    expect((visitor.welcome.layouts as Msg[]).map((l) => l.name)).toEqual(["Opening day", "Lap time", "Play room"]);
    let from = visitor.messages.length;
    visitor.send({ type: "layOut", set: "lap_time" });
    expect((await visitor.next((m) => m.type === "error", 3000, from)).code).toBe("notDemo");

    const demo = await Visitor.connect(await logIn("demo1", password!));
    from = visitor.messages.length;
    const sentAt = Date.now();
    demo.send({ type: "layOut", set: "lap_time" });
    const [laid, at] = await arrival(visitor, (m) => m.type === "laidOut", from);
    expect(at - sentAt).toBeLessThan(1000);
    expect(laid.by).toBe(demo.welcome.you);
    expect(laid.name).toBe("Lap time");
    const kinds = (laid.furniture as Msg[]).map((f) => f.kind).sort();
    expect(kinds).toContain("bowls");
    expect(kinds.filter((k) => k === "sofa")).toHaveLength(2);
    // Again at once, and again: no rate limit on sets.
    for (const set of ["play_room", "opening_day"]) {
      const before = visitor.messages.length;
      demo.send({ type: "layOut", set });
      await visitor.next((m) => m.type === "laidOut", 3000, before);
    }
    // A page that opens now sees the starting room.
    const late = await Visitor.connect((await signUp()).cookie);
    const opening = (late.welcome.snapshot.room.furniture as Msg[]).map((f) => `${f.kind}@${f.x},${f.y}`).sort();
    const told = (visitor.messages.filter((m) => m.type === "laidOut").at(-1)!.furniture as Msg[]).map((f) => `${f.kind}@${f.x},${f.y}`).sort();
    expect(opening).toEqual(told);
    await late.leave();
    await visitor.leave();
    await demo.leave();
  });
});
