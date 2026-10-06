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
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
      ws.once("unexpected-response", (_req, res) => reject(new Error(`upgrade refused: ${res.statusCode}`)));
    });
    const visitor = new Visitor(ws);
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
