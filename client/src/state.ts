import type { CatView } from "./protocol/CatView";
import type { Emote } from "./protocol/Emote";
import type { FurnitureView } from "./protocol/FurnitureView";
import type { ErrorCode } from "./protocol/ErrorCode";
import type { PersonView } from "./protocol/PersonView";
import type { Reaction } from "./protocol/Reaction";
import type { RoomView } from "./protocol/RoomView";
import type { ServerMsg } from "./protocol/ServerMsg";
import type { TrustView } from "./protocol/TrustView";

// The client's copy of the café: built from the welcome, then kept up to date
// by applying each message in order. The server decides; this only mirrors.

export interface Bubble {
  id: number;
  from: number;
  text: string;
  to: number | null;
  until: number;
}

export interface SaidLine {
  from: number;
  name: string;
  text: string;
  toName: string | null;
}

export interface Cat extends CatView {
  reaction: { reaction: Reaction; at: number } | null;
}

export interface CafeState {
  you: number;
  build: string;
  cap: number;
  /** Server clock minus local clock, in milliseconds. */
  offset: number;
  room: RoomView;
  people: Map<number, PersonView>;
  cats: Map<string, Cat>;
  trust: Map<string, TrustView>;
  bubbles: Bubble[];
  said: SaidLine[];
  /** Each person's latest emote and when, in server time. */
  emotes: Map<number, { emote: Emote; at: number }>;
  /** What each person is carrying, by who carries it. */
  held: Map<number, FurnitureView>;
}

export type Effect =
  | { kind: "replaced" }
  | { kind: "stillThere"; secs: number }
  | { kind: "nudgeOver" }
  | { kind: "youLeft" }
  | { kind: "error"; code: ErrorCode; detail: string }
  | { kind: "announce"; text: string };

type Welcome = Extract<ServerMsg, { type: "welcome" }>;

const SAID_KEPT = 50;
let nextBubble = 1;

export function serverNow(state: CafeState, localNow = Date.now()): number {
  return localNow + state.offset;
}

/** A fresh copy from a welcome; on a reconnect, `previous` keeps "said this visit". */
export function fromWelcome(msg: Welcome, localNow = Date.now(), previous: CafeState | null = null): CafeState {
  const s = msg.snapshot;
  return {
    you: msg.you,
    build: msg.build,
    cap: msg.cap,
    offset: msg.now - localNow,
    room: s.room,
    people: new Map(s.people.map((p) => [p.id, p])),
    cats: new Map(s.cats.map((c) => [c.id, { ...c, reaction: null }])),
    trust: new Map(s.yourTrust.map((t) => [t.cat, t])),
    bubbles: [],
    said: previous?.said ?? [],
    emotes: new Map(),
    held: new Map(s.held.map((h) => [h.by, h.piece])),
  };
}

/**
 * The client and server come from one build; a tab left open across a deploy reloads.
 * Only once per server build (`reloadedFor`): if the reload still brings back a
 * different client, reloading again would loop forever, so the tab carries on.
 */
export function needsReload(serverBuild: string, clientBuild: string, reloadedFor: string | null = null): boolean {
  return serverBuild !== clientBuild && serverBuild !== "dev" && clientBuild !== "dev" && reloadedFor !== serverBuild;
}

/**
 * What a tab does on a welcome from `serverBuild`: carry on, reload once, or,
 * when it already reloaded for that build or has nowhere to note a reload, ask
 * the person to refresh, since the old client may misread the new protocol.
 */
export function afterWelcome(
  serverBuild: string,
  clientBuild: string,
  reloadedFor: string | null,
  canRemember: boolean,
): "carryOn" | "reload" | "tellToRefresh" {
  if (serverBuild === clientBuild || serverBuild === "dev" || clientBuild === "dev") return "carryOn";
  return needsReload(serverBuild, clientBuild, reloadedFor) && canRemember ? "reload" : "tellToRefresh";
}

const REACTION_WORDS: Record<Reaction["kind"], (cat: string) => string> = {
  lookUp: (cat) => `${cat} looks up at you.`,
  sniff: (cat) => `${cat} sniffs your hand.`,
  purr: (cat) => `${cat} purrs.`,
  tolerate: (cat) => `${cat} puts up with it.`,
  refuse: (cat) => `${cat} pulls away.`,
  greet: (cat) => `${cat} comes to greet you.`,
  annoyed: (cat) => `${cat} jumps off, annoyed.`,
};

const EMOTE_WORDS: Record<Emote, string> = { wave: "waves", laugh: "laughs", heart: "sends a heart", yawn: "yawns" };

function reactionTarget(r: Reaction): number {
  switch (r.kind) {
    case "lookUp":
      return r.at;
    case "greet":
      return r.to;
    default:
      return r.by;
  }
}

/** A piece's kind as words: "cat_bed" is "cat bed". */
export function pieceName(kind: string): string {
  return kind.replaceAll("_", " ");
}

/** Applies one message (other than the welcome), returning what the page should say or show. */
export function apply(state: CafeState, msg: ServerMsg, localNow = Date.now()): Effect[] {
  const now = serverNow(state, localNow);
  const name = (id: number) => state.people.get(id)?.name ?? "someone";
  switch (msg.type) {
    case "welcome":
      return [];
    case "replaced":
      return [{ kind: "replaced" }];
    case "personJoined": {
      const isNew = !state.people.has(msg.person.id);
      state.people.set(msg.person.id, msg.person);
      if (!isNew || msg.person.id === state.you) return [];
      const where = msg.person.place === "inside" ? "came in." : "is waiting at the window.";
      return [{ kind: "announce", text: `${msg.person.name} ${where}` }];
    }
    case "personLeft": {
      // Only a walk-out after an unanswered "still there?" tells you that you left.
      if (msg.id === state.you) return [{ kind: "youLeft" }];
      const who = name(msg.id);
      state.people.delete(msg.id);
      state.emotes.delete(msg.id);
      state.held.delete(msg.id);
      return [{ kind: "announce", text: `${who} left.` }];
    }
    case "personPlaced": {
      const p = state.people.get(msg.id);
      if (p) state.people.set(msg.id, { ...p, place: msg.place, at: msg.at, walk: msg.walk });
      return msg.id === state.you ? [{ kind: "announce", text: "A seat came free. You're coming in." }] : [];
    }
    case "personMoved": {
      const p = state.people.get(msg.id);
      if (p) state.people.set(msg.id, { ...p, walk: msg.walk, sitting: false });
      return [];
    }
    case "personSat": {
      const p = state.people.get(msg.id);
      if (p) state.people.set(msg.id, { ...p, at: msg.at, walk: null, sitting: true });
      return [];
    }
    case "catMoved": {
      const c = state.cats.get(msg.cat);
      if (c) state.cats.set(msg.cat, { ...c, walk: msg.walk, pose: "walk" });
      return [];
    }
    case "catPosed": {
      const c = state.cats.get(msg.cat);
      if (c) state.cats.set(msg.cat, { ...c, pose: msg.pose, at: msg.at, walk: null });
      return [];
    }
    case "catReacted": {
      const c = state.cats.get(msg.cat);
      if (c) state.cats.set(msg.cat, { ...c, reaction: { reaction: msg.reaction, at: now } });
      if (reactionTarget(msg.reaction) !== state.you) return [];
      return [{ kind: "announce", text: REACTION_WORDS[msg.reaction.kind](c?.name ?? "A cat") }];
    }
    case "said": {
      state.bubbles.push({ id: nextBubble++, from: msg.from, text: msg.text, to: msg.to, until: now + msg.ttlMs });
      state.said.push({ from: msg.from, name: name(msg.from), text: msg.text, toName: msg.to === null ? null : name(msg.to) });
      if (state.said.length > SAID_KEPT) state.said.splice(0, state.said.length - SAID_KEPT);
      const to = msg.to === null ? "" : ` to ${name(msg.to)}`;
      return [{ kind: "announce", text: `${name(msg.from)} says${to}: ${msg.text}` }];
    }
    case "yourTrust":
      state.trust.set(msg.trust.cat, msg.trust);
      return [];
    case "furnitureHeld": {
      state.room.furniture = state.room.furniture.filter((f) => f.id !== msg.piece.id);
      state.held.set(msg.by, msg.piece);
      if (msg.by === state.you) return [];
      return [{ kind: "announce", text: `${name(msg.by)} picked up the ${pieceName(msg.piece.kind)}.` }];
    }
    case "furniturePlaced": {
      for (const [by, piece] of state.held) if (piece.id === msg.piece.id) state.held.delete(by);
      state.room.furniture = [...state.room.furniture.filter((f) => f.id !== msg.piece.id), msg.piece];
      if (msg.by === state.you) return [];
      return [{ kind: "announce", text: `${name(msg.by)} put the ${pieceName(msg.piece.kind)} down.` }];
    }
    case "furnitureRemoved": {
      let kind = state.room.furniture.find((f) => f.id === msg.id)?.kind;
      for (const [by, piece] of state.held) {
        if (piece.id === msg.id) {
          kind = piece.kind;
          state.held.delete(by);
        }
      }
      state.room.furniture = state.room.furniture.filter((f) => f.id !== msg.id);
      if (msg.by === state.you || !kind) return [];
      return [{ kind: "announce", text: `${name(msg.by)} put the ${pieceName(kind)} away.` }];
    }
    case "emoted":
      state.emotes.set(msg.from, { emote: msg.emote, at: now });
      return msg.from === state.you ? [] : [{ kind: "announce", text: `${name(msg.from)} ${EMOTE_WORDS[msg.emote]}.` }];
    case "stillThere":
      return [{ kind: "stillThere", secs: msg.secs }];
    case "nudgeOver":
      return [{ kind: "nudgeOver" }];
    case "error":
      return [{ kind: "error", code: msg.code, detail: msg.detail }];
  }
}

const PING_EVERY_MS = 30_000;

/** Whether touching the page now should tell the café you're still here (ADR 0009). */
export function shouldPing(lastPing: number | null, now: number): boolean {
  return lastPing === null || now - lastPing >= PING_EVERY_MS;
}

/** Drops bubbles whose time is up; "said this visit" keeps them. */
export function pruneBubbles(state: CafeState, localNow = Date.now()): void {
  const now = serverNow(state, localNow);
  state.bubbles = state.bubbles.filter((b) => b.until > now);
}
