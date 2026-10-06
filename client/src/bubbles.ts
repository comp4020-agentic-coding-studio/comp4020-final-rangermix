import { positionAt } from "./motion";
import { windowSpot } from "./render";
import type { Stage } from "./stage";
import { type CafeState, pruneBubbles, serverNow } from "./state";

// Speech bubbles are HTML over the canvas, so any language renders crisply
// (design.md, "The client"). Their text is only ever text, never markup.

export function makeBubble(text: string, toName: string | null): HTMLElement {
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (toName) {
    const to = document.createElement("span");
    to.className = "to";
    to.textContent = `to ${toName}`;
    bubble.append(to);
  }
  bubble.append(document.createTextNode(text));
  return bubble;
}

export class Bubbles {
  private readonly shown = new Map<number, HTMLElement>();

  constructor(
    private readonly overlay: HTMLElement,
    private readonly stage: Stage,
  ) {}

  update(state: CafeState, localNow = Date.now()): void {
    pruneBubbles(state, localNow);
    const now = serverNow(state, localNow);
    const live = new Set<number>();
    const lift = new Map<number, number>();
    // Newest first, so it sits nearest the speaker's head.
    for (const b of [...state.bubbles].reverse()) {
      const speaker = state.people.get(b.from);
      if (!speaker) continue;
      live.add(b.id);
      let el = this.shown.get(b.id);
      if (!el) {
        el = makeBubble(b.text, b.to === null ? null : (state.people.get(b.to)?.name ?? null));
        this.overlay.append(el);
        this.shown.set(b.id, el);
      }
      const spot = speaker.place === "inside" ? positionAt(speaker.walk, speaker.at, now) : windowSpot(state, speaker.id);
      const { left, top } = this.stage.tileToCss(spot.x + 0.5, spot.y);
      const above = lift.get(b.from) ?? 0;
      el.style.left = `${left}px`;
      el.style.top = `${top - 4 - above}px`;
      lift.set(b.from, above + el.offsetHeight + 4);
    }
    for (const [id, el] of this.shown) {
      if (!live.has(id)) {
        el.remove();
        this.shown.delete(id);
      }
    }
  }
}
