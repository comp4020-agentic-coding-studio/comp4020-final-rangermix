// The guide (slice 21): a short page on how the café works, over the café
// as it's entered, until "Got it, no pop-up next time" is ticked in this
// browser, and whenever its ⓘ is pressed. Closing it shrinks it into the
// ⓘ, so a newcomer sees where it went; opened from the ⓘ, it grows out of
// it. It's modal, as the chalkboard's dialog is: the café behind is inert.

const KEY = "cafe.guide";

/** Whether the guide pops up on the way in: yes, unless ticked off in this browser, and yes where nothing can be stored. */
export function guideWanted(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** Remembers the box as it changes, in this browser only; nothing reaches the server. */
export function saveGuideWanted(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
  } catch {
    // Nowhere to keep it: the box holds for this visit.
  }
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * How the card moves into the button: its middle onto the button's, at the
 * one scale that fits it inside, whichever of width and height is tighter.
 * About its own middle (`transform-origin: center`).
 */
export function shrinkInto(card: Box, button: Box): { x: number; y: number; scale: number } {
  return {
    x: button.left + button.width / 2 - (card.left + card.width / 2),
    y: button.top + button.height / 2 - (card.top + card.height / 2),
    scale: Math.min(button.width / card.width, button.height / card.height),
  };
}

export interface GuideEls {
  backdrop: HTMLElement;
  /** The layer the card is centred in; it takes no clicks of its own. */
  root: HTMLElement;
  card: HTMLElement;
  /** The words, which scroll, and take the focus as it opens. */
  words: HTMLElement;
  off: HTMLInputElement;
  close: HTMLButtonElement;
  /** The ⓘ in the status bar. */
  button: HTMLButtonElement;
  cafe: HTMLElement;
  room: HTMLElement;
}

/** How long the shrink and the grow take, in ms; a fade alone is quicker. */
const SHRINK_MS = 350;
const FADE_MS = 200;

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export class Guide {
  /** How it was opened, while it's open: the focus goes back to where it came from. */
  private from: "entry" | "button" | null = null;
  private pressedBeside = false;
  private running: Animation[] = [];
  private readonly undo: (() => void)[] = [];

  constructor(private readonly els: GuideEls) {
    const on = (target: EventTarget, type: string, fn: EventListener) => {
      target.addEventListener(type, fn);
      this.undo.push(() => target.removeEventListener(type, fn));
    };
    on(els.button, "click", () => this.open("button"));
    on(els.close, "click", () => this.close());
    on(els.off, "change", () => saveGuideWanted(!els.off.checked));
    // Only a press that began beside the card closes it: the click a phone
    // sends after the tap that opened it isn't one (the chalkboard's rule).
    on(els.backdrop, "pointerdown", () => (this.pressedBeside = true));
    on(els.backdrop, "click", () => {
      if (this.pressedBeside) this.close();
      this.pressedBeside = false;
    });
    on(document, "keydown", this.onKey as EventListener);
  }

  get isOpen(): boolean {
    return this.from !== null;
  }

  open(from: "entry" | "button"): void {
    if (this.isOpen) return;
    // Opened again while it shrinks: it stops and stands open.
    this.stop();
    const { els } = this;
    els.off.checked = !guideWanted();
    els.cafe.inert = true;
    for (const el of [els.backdrop, els.root]) {
      el.hidden = false;
      el.style.pointerEvents = "";
    }
    els.words.scrollTop = 0;
    els.words.classList.remove("tabbed");
    this.from = from;
    els.words.focus();
    if (!this.canAnimate()) return;
    const into = from === "button" && !reducedMotion() ? this.intoButton() : null;
    const card = into
      ? [{ transform: transformFor(into), opacity: 0 }, { transform: "none", opacity: 1 }]
      : reducedMotion()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ transform: "scale(0.96)", opacity: 0 }, { transform: "none", opacity: 1 }];
    const ms = into ? SHRINK_MS : FADE_MS;
    this.running = [els.card.animate(card, { duration: ms, easing: "ease-out" }), els.backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms })];
  }

  /** Closes it, into the ⓘ; `now`, at once, as on Leave. */
  close(opts: { now?: boolean } = {}): void {
    const { els } = this;
    if (!this.isOpen) {
      if (opts.now) this.hide();
      return;
    }
    const from = this.from;
    this.from = null;
    this.stop();
    els.cafe.inert = false;
    (from === "button" ? els.button : els.room).focus();
    if (opts.now || !this.canAnimate()) {
      this.hide();
      return;
    }
    // Shut to the café at once; shown, taking no clicks, until it lands.
    for (const el of [els.backdrop, els.root]) el.style.pointerEvents = "none";
    const into = reducedMotion() ? null : this.intoButton();
    const card = into
      ? [{ transform: "none", opacity: 1 }, { transform: transformFor(into), opacity: 0 }]
      : [{ opacity: 1 }, { opacity: 0 }];
    const ms = into ? SHRINK_MS : FADE_MS;
    const shrink = els.card.animate(card, { duration: ms, easing: "ease-in", fill: "forwards" });
    this.running = [shrink, els.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: "forwards" })];
    shrink.finished
      .then(() => {
        if (this.isOpen) return;
        this.hide();
        // It lands in the ⓘ, which gives a little pop.
        if (into) els.button.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], { duration: 260, easing: "ease-out" });
      })
      .catch(() => {
        // Cancelled: opened again, or closed at once.
      });
  }

  dispose(): void {
    this.close({ now: true });
    for (const off of this.undo.splice(0)) off();
  }

  /** Round its words, the box and Close, never out to the café; Escape closes it. */
  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== "Tab") return;
    e.preventDefault();
    const stops = [this.els.words, this.els.off, this.els.close];
    const at = stops.indexOf(document.activeElement as HTMLElement);
    const next = at < 0 ? (e.shiftKey ? stops.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length;
    // The words take a ring only when Tab brings the focus to them: the
    // browser counts the focus they take as the guide opens as a
    // keyboard's, and would ring them for a mouse too.
    this.els.words.classList.toggle("tabbed", stops[next] === this.els.words);
    stops[next].focus();
  };

  /** The way into the ⓘ from where the card stands now, or none if either has no size. */
  private intoButton(): { x: number; y: number; scale: number } | null {
    const card = this.els.card.getBoundingClientRect();
    const button = this.els.button.getBoundingClientRect();
    if (card.width <= 0 || card.height <= 0 || button.width <= 0 || button.height <= 0) return null;
    return shrinkInto(card, button);
  }

  private canAnimate(): boolean {
    return typeof this.els.card.animate === "function";
  }

  private stop(): void {
    for (const a of this.running.splice(0)) a.cancel();
  }

  private hide(): void {
    const { els } = this;
    els.root.hidden = true;
    els.backdrop.hidden = true;
    for (const el of [els.backdrop, els.root]) el.style.pointerEvents = "";
    this.stop();
  }
}

const transformFor = (s: { x: number; y: number; scale: number }) => `translate(${s.x}px, ${s.y}px) scale(${s.scale})`;
