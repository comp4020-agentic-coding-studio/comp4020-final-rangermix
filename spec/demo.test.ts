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
    // Two minutes on by the café's clock: a short jump, so the café the
    // rest of the spec uses keeps nearly its own hour.
    const minute = (minuteOf(demo.welcome.now) + 2) % (24 * 60);
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
  });
});
