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

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const GAP = 4;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where a bubble goes, as its top-left in overlay pixels: centred over the
 * speaker's head, `stack` pixels above the newer bubbles already there, or
 * under the speaker when there's no room above; always wholly inside the room.
 */
export function placeBubble(
  speaker: { x: number; head: number; feet: number },
  stack: number,
  size: { width: number; height: number },
  room: Box,
): { left: number; top: number } {
  let top = speaker.head - GAP - stack - size.height;
  if (top < room.top) top = speaker.feet + GAP + stack;
  return {
    left: clamp(speaker.x - size.width / 2, room.left, room.right - size.width),
    top: clamp(top, room.top, room.bottom - size.height),
  };
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
    const corner = this.stage.tileToCss(0, 0);
    const far = this.stage.tileToCss(state.room.width, state.room.height);
    const room = { left: corner.left, top: corner.top, right: far.left, bottom: far.top };
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
      const head = this.stage.tileToCss(spot.x + 0.5, spot.y);
      const feet = this.stage.tileToCss(spot.x + 0.5, spot.y + 1);
      const stack = lift.get(b.from) ?? 0;
      const size = { width: el.offsetWidth, height: el.offsetHeight };
      const { left, top } = placeBubble({ x: head.left, head: head.top, feet: feet.top }, stack, size, room);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      lift.set(b.from, stack + size.height + GAP);
    }
    for (const [id, el] of this.shown) {
      if (!live.has(id)) {
        el.remove();
        this.shown.delete(id);
      }
    }
  }
}
