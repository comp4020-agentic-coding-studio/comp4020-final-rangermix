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

  it("bots fill the café, so the next visitor waits at the window until one goes", async () => {
    const demo = await Visitor.connect(await logIn("demo2", password!));
    const people = demo.welcome.snapshot.people as Msg[];
    const free = demo.welcome.cap - people.filter((p) => p.place === "inside").length;
    // Bots left by an earlier run of this check, if its demo2 is back within its grace period.
    const already = people.filter((p) => p.bot).length;
    let from = demo.messages.length;
    for (let n = 0; n < free; n++) demo.send({ type: "addBot" });
    for (let n = 0; n < free; n++) {
      const joined = await demo.next((m) => m.type === "personJoined" && m.person.id !== demo.welcome.you, 3000, from);
      expect(joined.person.bot).toBe(true);
      from = demo.messages.indexOf(joined) + 1;
    }
    const newcomer = await Visitor.connect((await signUp()).cookie);
    const me = (newcomer.welcome.snapshot.people as Msg[]).find((p) => p.id === newcomer.welcome.you);
    expect(me?.place).toBe("window");
    const fromNewcomer = newcomer.messages.length;
    demo.send({ type: "removeBot" });
    const placed = await newcomer.next(
      (m) => m.type === "personPlaced" && m.id === newcomer.welcome.you && m.place === "inside",
      3000,
      fromNewcomer,
    );
    expect(placed.place).toBe("inside");
    await newcomer.leave();
    // Leaving takes the demo account's bots with it.
    const watcher = await Visitor.connect((await signUp()).cookie);
    const fromWatcher = watcher.messages.length;
    await demo.leave();
    await watcher.next((m) => m.type === "personLeft" && m.id === demo.welcome.you, 3000, fromWatcher);
    await new Promise((r) => setTimeout(r, 200));
    const left = watcher.messages.slice(fromWatcher).filter((m) => m.type === "personLeft").length;
    expect(left).toBe(1 + already + free - 1);
    await watcher.leave();
  });
});
