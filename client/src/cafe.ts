import { announce } from "./announce";
import * as api from "./api";
import { Connection } from "./net";
import type { ApiMe } from "./protocol/ApiMe";
import type { ClientMsg } from "./protocol/ClientMsg";
import type { ServerMsg } from "./protocol/ServerMsg";
import { type CafeState, type Effect, afterWelcome, apply, fromWelcome, shouldPing } from "./state";

// Which server build this tab last reloaded for. Storage can be missing or
// refuse (a private window); then the tab simply doesn't reload.
const RELOADED_FOR = "cafe.reloadedFor";

function reloadedFor(): string | null {
  try {
    return sessionStorage.getItem(RELOADED_FOR);
  } catch {
    return null;
  }
}

/** Whether this tab has somewhere to note a reload. */
function canNote(): boolean {
  try {
    sessionStorage.setItem("cafe.probe", "1");
    sessionStorage.removeItem("cafe.probe");
    return true;
  } catch {
    return false;
  }
}

/** Notes the reload; false when it can't, since a second reload then looks like a first. */
function rememberReload(build: string): boolean {
  try {
    sessionStorage.setItem(RELOADED_FOR, build);
    return sessionStorage.getItem(RELOADED_FOR) === build;
  } catch {
    return false;
  }
}

export interface CafeHooks {
  onSignedOut(): void;
  onError?(effect: Extract<Effect, { kind: "error" }>): void;
  /** The server runs a different build from this tab, and a reload didn't fix it. */
  onOutdated?(): void;
  /** "Still there?": someone waits for a seat and you've gone quiet (ADR 0009). */
  onStillThere?(secs: number): void;
  onNudgeOver?(): void;
  /** You didn't answer, and walked out so someone waiting could come in. */
  onWalkedOut?(): void;
}

/** The live café: one connection, the state it keeps up to date, and who's listening. */
export class Cafe {
  state: CafeState | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly connection: Connection;
  private replaced = false;
  private outdated = false;
  private lastPing: number | null = null;

  constructor(
    readonly me: ApiMe,
    private readonly hooks: CafeHooks,
  ) {
    this.connection = new Connection(
      (msg) => this.receive(msg),
      (status) => {
        if (status === "closed" && !this.replaced) void this.checkSignedIn();
        this.notify();
      },
    );
  }

  start(): void {
    this.connection.start();
  }

  send(msg: ClientMsg): void {
    this.connection.send(msg);
  }

  /** Walks out at once, freeing the seat (design.md, "People"). */
  leave(): void {
    this.send({ type: "leave" });
    window.setTimeout(() => this.connection.stop(), 100);
  }

  /** Someone touched the page: tells the café, at most every 30 seconds. */
  touched(localNow = Date.now()): void {
    if (!shouldPing(this.lastPing, localNow) || !this.connection.isOpen()) return;
    this.lastPing = localNow;
    this.send({ type: "here" });
  }

  /** Answers "still there?" at once. */
  here(): void {
    this.lastPing = Date.now();
    this.send({ type: "here" });
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  statusLine(): string {
    if (this.replaced) return "You opened the café in another tab.";
    const s = this.state;
    if (!s || !this.connection.isOpen()) return "Reconnecting to the café…";
    const people = [...s.people.values()];
    const inside = people.filter((p) => p.place === "inside").length;
    const waiting = people.length - inside;
    const where = s.people.get(s.you)?.place === "window" ? "You're waiting at the window. " : "";
    return `${where}${inside}/${s.cap} inside${waiting > 0 ? ` · ${waiting} at the window` : ""}`;
  }

  private receive(msg: ServerMsg): void {
    if (msg.type === "welcome") {
      const next = afterWelcome(msg.build, __BUILD_ID__, reloadedFor(), canNote());
      if (next === "reload" && rememberReload(msg.build)) {
        location.reload();
        return;
      }
      if (next !== "carryOn" && !this.outdated) {
        this.outdated = true;
        this.hooks.onOutdated?.();
      }
      this.state = fromWelcome(msg);
      if (document.hidden) this.send({ type: "presence", hidden: true });
    } else if (this.state) {
      for (const effect of apply(this.state, msg)) this.handle(effect);
    }
    this.notify();
  }

  private handle(effect: Effect): void {
    switch (effect.kind) {
      case "announce":
        announce(effect.text);
        break;
      case "replaced":
        this.replaced = true;
        this.connection.stop();
        break;
      case "error":
        announce(effect.detail);
        this.hooks.onError?.(effect);
        break;
      case "stillThere":
        this.hooks.onStillThere?.(effect.secs);
        break;
      case "nudgeOver":
        this.hooks.onNudgeOver?.();
        break;
      case "youLeft":
        this.connection.stop();
        this.hooks.onWalkedOut?.();
        break;
    }
  }

  /** A closed connection might mean the session ended: then show the way in. */
  private async checkSignedIn(): Promise<void> {
    const me = await api.me();
    if (!me.ok && me.error.error === "signedOut") {
      this.connection.stop();
      this.hooks.onSignedOut();
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
