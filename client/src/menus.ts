import type { Target } from "./input";
import type { ClientMsg } from "./protocol/ClientMsg";
import { type CafeState, type Cat, pieceName } from "./state";

// What you can do with everything on a tile, in one menu: a cat first, since
// it's the point, then people, then the piece of furniture underneath (so a
// cat asleep on the cushion doesn't hide the cushion).

export interface MenuAction {
  label: string;
  /** Sent to the café when chosen. */
  msg?: ClientMsg;
  /** Chosen to talk to someone: addresses the talk box. */
  talkTo?: { id: number; name: string };
}

export interface Menu {
  title: string;
  note: string | null;
  actions: MenuAction[];
}

/** The cat you're holding, if any. */
export function catInArms(state: CafeState): Cat | null {
  return [...state.cats.values()].find((c) => c.heldBy === state.you) ?? null;
}

/** Arms full: a piece of furniture, or a cat, already. */
export function armsFull(state: CafeState): boolean {
  return state.held.has(state.you) || catInArms(state) !== null;
}

export function menuFor(state: CafeState, targets: Target[]): Menu | null {
  let title: string | null = null;
  let note: string | null = null;
  const actions: MenuAction[] = [];
  const me = state.you;
  const holdingCat = catInArms(state);
  const full = armsFull(state);
  for (const target of targets) {
    if (target.kind === "cat") {
      const cat = state.cats.get(target.id);
      // In someone else's arms: nothing to do with it but ask them.
      if (!cat || (cat.heldBy !== null && cat.heldBy !== me)) continue;
      title ??= cat.name;
      const trust = state.trust.get(cat.id);
      if (trust) note ??= `${cat.name}'s trust in you: ${trust.value} of 100`;
      actions.push({ label: `Pet ${cat.name}`, msg: { type: "pet", cat: cat.id } });
      if (cat.heldBy === me) {
        actions.push({ label: `Put ${cat.name} down`, msg: { type: "putDown" } });
        continue;
      }
      actions.push({ label: `Call ${cat.name}`, msg: { type: "call", cat: cat.id } });
      if (state.yourTreats > 0) actions.push({ label: `Offer ${cat.name} a treat`, msg: { type: "offerTreat", cat: cat.id } });
      actions.push({ label: `Play with ${cat.name}`, msg: { type: "play", cat: cat.id } });
      if (!full) actions.push({ label: `Pick ${cat.name} up`, msg: { type: "pickUp", cat: cat.id } });
    } else if (target.kind === "person") {
      const person = state.people.get(target.id);
      if (!person) continue;
      title ??= person.name;
      actions.push({ label: `Talk to ${person.name}`, talkTo: { id: person.id, name: person.name } });
      if (state.yourTreats > 0) actions.push({ label: `Give ${person.name} a treat`, msg: { type: "giveTreat", to: person.id } });
      if (holdingCat) actions.push({ label: `Pass ${holdingCat.name} to ${person.name}`, msg: { type: "passCat", to: person.id } });
    } else {
      const piece = state.room.furniture.find((f) => f.id === target.id);
      if (!piece) continue;
      const what = pieceName(piece.kind);
      title ??= what[0].toUpperCase() + what.slice(1);
      if (piece.toppled) {
        actions.push({ label: `Stand the ${what} up`, msg: { type: "tidy", id: piece.id } });
        continue;
      }
      // With your arms full you can neither carry it nor sit on it.
      if (full) continue;
      if (piece.movable) actions.push({ label: `Move the ${what}`, msg: { type: "grab", id: piece.id } });
      if (piece.seats) actions.push({ label: `Sit on the ${what}`, msg: { type: "sit", id: piece.id } });
    }
  }
  return title === null || actions.length === 0 ? null : { title, note, actions };
}
