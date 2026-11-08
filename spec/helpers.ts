import type { Page } from "playwright";
import { inject } from "vitest";
import WebSocket from "ws";

// Helpers for checks that run against the running app (spec/global-setup.ts
// finds it). Every account they make has a fresh name.
export const baseUrl = inject("baseUrl");

/** A fresh name for each call, within the 20-character limit. */
export function uniqueName(prefix = "t"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 20);
}

export interface Account {
  name: string;
  password: string;
  cookie: string;
  id: number;
  recoveryCode: string;
}

export function sessionCookie(res: Response): string {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session="));
  if (!cookie) throw new Error(`no session cookie (status ${res.status})`);
  return cookie.split(";")[0];
}

export function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

export async function signUp(name = uniqueName(), password = "correct horse"): Promise<Account> {
  const res = await post("/api/signup", { name, password, look: { avatar: 1, colour: 2 } });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const me = (await res.json()) as { id: number; recoveryCode: string };
  return { name, password, cookie: sessionCookie(res), id: me.id, recoveryCode: me.recoveryCode };
}

/**
 * Signs up through the page's one way in (slice 20): a name and a password,
 * I'm new, the first look, Walk in, then past the recovery code. By keyboard
 * if asked, else by clicks; the page is left in the café.
 */
export async function signUpThroughPage(page: Page, name: string, opts: { keyboard?: boolean; password?: string } = {}): Promise<void> {
  const password = opts.password ?? "correct horse";
  if (opts.keyboard) {
    await page.locator("#way-in-name").focus();
    await page.keyboard.type(name);
    await page.keyboard.press("Tab");
    await page.keyboard.type(password);
    // Past Walk in to I'm new.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    // The look step opens on the avatars. An arrow key in each group, then
    // Tab past the colours to Walk in (slice 20's review, finding 13).
    await page.locator("#look-step:not([hidden])").waitFor();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Tab");
    const at = await page.evaluate(() => document.activeElement?.id);
    if (at !== "sign-up") throw new Error(`Tab from the colours reached ${at}, not Walk in`);
    await page.keyboard.press("Enter");
    await page.locator("#code-done:focus").waitFor();
    await page.keyboard.press("Enter");
    return;
  }
  await page.locator("#way-in-name").fill(name);
  await page.locator("#way-in-password").fill(password);
  await page.locator("#im-new").click();
  await page.locator("#sign-up").click();
  await page.locator("#code-done").click();
}

/** Logs in through the page's one way in (slice 20), by clicks. */
export async function logInThroughPage(page: Page, name: string, password: string): Promise<void> {
  await page.locator("#way-in-name").fill(name);
  await page.locator("#way-in-password").fill(password);
  await page.locator("#log-in").click();
}

/** Past the door (slice 20): waits for it, and presses Walk in or Come back in. */
export async function walkIn(page: Page): Promise<void> {
  await page.locator("#door-in").click();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Msg = { type: string; [key: string]: any };

/** One visitor's WebSocket, keeping every message the café sends. */
export class Visitor {
  readonly messages: Msg[] = [];
  private waiters: { test: (m: Msg) => boolean; from: number; resolve: (m: Msg) => void }[] = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data)) as Msg;
      this.messages.push(msg);
      const index = this.messages.length - 1;
      this.waiters = this.waiters.filter((w) => {
        if (index >= w.from && w.test(msg)) {
          w.resolve(msg);
          return false;
        }
        return true;
      });
    });
  }

  static async connect(cookie: string): Promise<Visitor> {
    const ws = new WebSocket(new URL("/ws", baseUrl.replace(/^http/, "ws")), { headers: { cookie } });
    // Listening before the socket opens: a welcome that arrives right behind
    // the upgrade could otherwise be emitted before anyone is listening.
    const visitor = new Visitor(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
      ws.once("unexpected-response", (_req, res) => reject(new Error(`upgrade refused: ${res.statusCode}`)));
    });
    await visitor.next((m) => m.type === "welcome");
    return visitor;
  }

  get welcome(): Msg {
    const welcome = this.messages.find((m) => m.type === "welcome");
    if (!welcome) throw new Error("no welcome yet");
    return welcome;
  }

  /** The first message at or after index `from` that passes `test`, waiting up to `timeoutMs`. */
  next(test: (m: Msg) => boolean, timeoutMs = 3000, from = 0): Promise<Msg> {
    const seen = this.messages.slice(from).find(test);
    if (seen) return Promise.resolve(seen);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`nothing matched within ${timeoutMs} ms`)), timeoutMs);
      this.waiters.push({ test, from, resolve: (m) => (clearTimeout(timer), resolve(m)) });
    });
  }

  send(msg: object): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Leaves through the door, freeing the seat at once, then closes. */
  async leave(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: "leave" });
      await new Promise((r) => setTimeout(r, 50));
    }
    this.ws.close();
  }

  /** Drops the connection without leaving: the seat is kept for the grace period. */
  close(): void {
    this.ws.close();
  }
}

/** Each cat's latest pose, from the welcome and what has happened since. */
export function catPoses(v: Visitor): { id: string; pose: string }[] {
  const poses = new Map<string, string>(v.welcome.snapshot.cats.map((c: Msg) => [c.id, c.pose]));
  for (const m of v.messages) {
    if (m.type === "catPosed") poses.set(m.cat, m.pose);
    if (m.type === "catMoved") poses.set(m.cat, "walk");
  }
  return [...poses].map(([id, pose]) => ({ id, pose }));
}

/**
 * Pets the cats in turn until one sniffs your hand: a first meeting, which
 * leaves trust and a chalkboard line (slice 02). Returns the cat, your trust
 * in it, and when the sniff arrived.
 */
export async function meetACat(v: Visitor): Promise<{ cat: string; trust: { cat: string; value: number; level: string }; sniffedAt: number }> {
  const you = v.welcome.you as number;
  for (let round = 0; round < 3; round++) {
    for (const cat of v.welcome.snapshot.cats as Msg[]) {
      const from = v.messages.length;
      v.send({ type: "pet", cat: cat.id });
      try {
        const m = await v.next(
          (m) => (m.type === "catReacted" && m.cat === cat.id && m.reaction.kind === "sniff" && m.reaction.by === you) || m.type === "error",
          10_000,
          from,
        );
        if (m.type === "error") continue;
        const sniffedAt = Date.now();
        const trust = (await v.next((m) => m.type === "yourTrust" && m.trust.cat === cat.id, 3_000, from)).trust;
        return { cat: cat.id, trust, sniffedAt };
      } catch {
        // Hiding, or it walked off: try the next one.
      }
    }
  }
  throw new Error("no cat let itself be met");
}
