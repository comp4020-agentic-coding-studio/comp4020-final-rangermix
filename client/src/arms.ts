import { armsFull, catInArms } from "./menus";
import { type CafeState, pieceName } from "./state";

// The bar over the room for what's in your arms: a piece to put back or put
// away, or a cat to put down. Arms full, nothing more comes from the
// catalogue until they're free.

export interface ArmsBar {
  carrying: HTMLElement;
  text: HTMLElement;
  putBack: HTMLElement;
  putAway: HTMLElement;
  putDown: HTMLElement;
  add: HTMLButtonElement;
}

export function showArms(bar: ArmsBar, state: CafeState): void {
  const piece = state.held.get(state.you) ?? null;
  const cat = catInArms(state);
  bar.carrying.hidden = !piece && !cat;
  bar.putBack.hidden = !piece;
  bar.putAway.hidden = !piece;
  bar.putDown.hidden = !cat;
  bar.add.disabled = armsFull(state);
  bar.add.title = bar.add.disabled ? "Your arms are full." : "";
  if (piece) {
    bar.text.textContent = `Carrying the ${pieceName(piece.kind)}. Choose where it goes.`;
  } else if (cat) {
    bar.text.textContent = `Holding ${cat.name}.`;
    bar.putDown.textContent = `Put ${cat.name} down`;
  }
}
