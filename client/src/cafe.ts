import { announce } from "./announce";
import * as api from "./api";
import { Connection } from "./net";
import type { ApiMe } from "./protocol/ApiMe";
import type { ClientMsg } from "./protocol/ClientMsg";
import type { ServerMsg } from "./protocol/ServerMsg";
import { type CafeState, type Effect, apply, fromWelcome, needsReload } from "./state";

export interface CafeHooks {
  onSignedOut(): void;
  onError?(effect: Extract<Effect, { kind: "error" }>): void;
}

/** The live café: one connection, the state it keeps up to date, and who's listening. */
export class Cafe {
  state: CafeState | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly connection: Connection;
  private replaced = false;

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
      if (needsReload(msg.build, __BUILD_ID__)) {
        location.reload();
        return;
      }
      this.state = fromWelcome(msg);
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
