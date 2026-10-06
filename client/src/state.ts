import type { CatView } from "./protocol/CatView";
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
}

export type Effect =
  | { kind: "replaced" }
  | { kind: "error"; code: ErrorCode; detail: string }
  | { kind: "announce"; text: string };

type Welcome = Extract<ServerMsg, { type: "welcome" }>;

const SAID_KEPT = 50;
let nextBubble = 1;

export function serverNow(state: CafeState, localNow = Date.now()): number {
  return localNow + state.offset;
}

export function fromWelcome(msg: Welcome, localNow = Date.now()): CafeState {
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
    said: [],
  };
}

/** The client and server come from one build; a tab left open across a deploy reloads. */
export function needsReload(serverBuild: string, clientBuild: string): boolean {
  return serverBuild !== clientBuild && serverBuild !== "dev" && clientBuild !== "dev";
}

const REACTION_WORDS: Record<Reaction["kind"], (cat: string) => string> = {
  lookUp: (cat) => `${cat} looks up at you.`,
  sniff: (cat) => `${cat} sniffs your hand.`,
  purr: (cat) => `${cat} purrs.`,
  tolerate: (cat) => `${cat} puts up with it.`,
  refuse: (cat) => `${cat} pulls away.`,
  greet: (cat) => `${cat} comes to greet you.`,
};

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
      const who = name(msg.id);
      state.people.delete(msg.id);
      return [{ kind: "announce", text: `${who} left.` }];
    }
    case "personPlaced": {
      const p = state.people.get(msg.id);
      if (p) state.people.set(msg.id, { ...p, place: msg.place, at: msg.at, walk: msg.walk });
      return msg.id === state.you ? [{ kind: "announce", text: "A seat came free. You're coming in." }] : [];
    }
    case "personMoved": {
      const p = state.people.get(msg.id);
      if (p) state.people.set(msg.id, { ...p, walk: msg.walk });
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
    case "error":
      return [{ kind: "error", code: msg.code, detail: msg.detail }];
  }
}

/** Drops bubbles whose time is up; "said this visit" keeps them. */
export function pruneBubbles(state: CafeState, localNow = Date.now()): void {
  const now = serverNow(state, localNow);
  state.bubbles = state.bubbles.filter((b) => b.until > now);
}
