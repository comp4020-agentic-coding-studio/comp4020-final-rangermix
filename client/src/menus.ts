import type { Target } from "./input";
import type { ClientMsg } from "./protocol/ClientMsg";
import { type CafeState, pieceName } from "./state";

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

export function menuFor(state: CafeState, targets: Target[]): Menu | null {
  let title: string | null = null;
  let note: string | null = null;
  const actions: MenuAction[] = [];
  for (const target of targets) {
    if (target.kind === "cat") {
      const cat = state.cats.get(target.id);
      if (!cat) continue;
      title ??= cat.name;
      const trust = state.trust.get(cat.id);
      if (trust) note ??= `${cat.name}'s trust in you: ${trust.value} of 100`;
      actions.push({ label: `Pet ${cat.name}`, msg: { type: "pet", cat: cat.id } }, { label: `Call ${cat.name}`, msg: { type: "call", cat: cat.id } });
    } else if (target.kind === "person") {
      const person = state.people.get(target.id);
      if (!person) continue;
      title ??= person.name;
      actions.push({ label: `Talk to ${person.name}`, talkTo: { id: person.id, name: person.name } });
    } else {
      const piece = state.room.furniture.find((f) => f.id === target.id);
      if (!piece) continue;
      const what = pieceName(piece.kind);
      title ??= what[0].toUpperCase() + what.slice(1);
      if (piece.movable) actions.push({ label: `Move the ${what}`, msg: { type: "grab", id: piece.id } });
      if (piece.seats) actions.push({ label: `Sit on the ${what}`, msg: { type: "sit", id: piece.id } });
    }
  }
  return title === null || actions.length === 0 ? null : { title, note, actions };
}
