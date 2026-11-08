// The guide (slice 21): a short page on how the café works, over the café
// as it's entered, until "Got it, no pop-up next time" is ticked in this
// browser, and whenever its ⓘ is pressed. Closing it shrinks it into the
// ⓘ, so a newcomer sees where it went; opened from the ⓘ, it grows out of
// it. It's modal, as the chalkboard's dialog is: the café behind is inert.

const KEY = "cafe.guide";
/** Noted for this tab while it's open, so the café's own reload brings it back (slice 21's review, finding 3). */
const OPEN_KEY = "cafe.guideOpen";

/**
 * The box, for this page's life, where the browser won't store it, as the
 * layout's `thisVisit` is (slice 21's review, finding 6).
 */
let thisVisit: boolean | null = null;

/** Whether the guide pops up on the way in: yes, unless ticked off in this browser; where nothing can be stored, yes unless ticked this visit. */
export function guideWanted(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return thisVisit ?? true;
  }
}

/** Remembers the box as it changes, in this browser only; nothing reaches the server. */
export function saveGuideWanted(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
  } catch {
    // Nowhere to keep it: the box holds until the page is reloaded.
    thisVisit = on;
  }
}

/** Whether the guide was open as the café reloaded itself; read once (slice 21's review, finding 3). */
export function takeGuideOpen(): boolean {
  try {
    const was = sessionStorage.getItem(OPEN_KEY) === "1";
    sessionStorage.removeItem(OPEN_KEY);
    return was;
  } catch {
    return false;
  }
}

function noteOpen(open: boolean): void {
  try {
    if (open) sessionStorage.setItem(OPEN_KEY, "1");
    else sessionStorage.removeItem(OPEN_KEY);
  } catch {
    // Nowhere to note it: the reload brings no guide, which is safe.
  }
}

/**
 * Whether the last press was a key's, not a pointer's: the guide opened by
 * a key rings its words, so the focus can be seen; opened by a mouse or a
 * finger, it doesn't (slice 21's review, finding 7). Watched from the
 * start, so the press on Walk in counts.
 */
let byKey = false;
if (typeof document !== "undefined") {
  document.addEventListener("keydown", () => (byKey = true), true);
  document.addEventListener("pointerdown", () => (byKey = false), true);
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

export interface GuideHooks {
  /** As it opens, before it takes the focus: a menu left open closes (slice 21's review, finding 11). */
  opening?(): void;
}

/** How long the shrink and the grow take, in ms; a fade alone is quicker. */
const SHRINK_MS = 350;
const FADE_MS = 200;

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export class Guide {
  /** How it was opened, while it's open: the focus goes back to where it came from. */
  private from: "entry" | "button" | null = null;
  private pressedBeside = false;
  /** Where the page was scrolled as it opened, held while it's open. */
  private heldY = 0;
  private running: Animation[] = [];
  private readonly undo: (() => void)[] = [];

  constructor(
    private readonly els: GuideEls,
    private readonly hooks: GuideHooks = {},
  ) {
    const on = (target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts);
      this.undo.push(() => target.removeEventListener(type, fn, opts));
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
    // A resize mid-shrink would leave it flying to where the ⓘ was: it
    // lands at once (slice 21's review, finding 12).
    on(window, "resize", () => {
      if (!this.isOpen && !els.root.hidden) this.hide();
    });
    // The page holds still under it, so the ⓘ is where it was when it
    // closes: a swipe or a wheel that scrolls it anyway is put back (slice
    // 21's review, finding 4). Not by hiding the page's overflow, which
    // lays layout A out afresh in a phone's browser.
    on(window, "scroll", () => {
      if (this.isOpen && window.scrollY !== this.heldY) window.scrollTo(window.scrollX, this.heldY);
    });
    // And a wheel or a swipe anywhere in it but its words, which scroll
    // themselves and pass nothing on (`overscroll-behavior`), scrolls nothing.
    const still = (e: Event) => {
      if (this.isOpen && !els.words.contains(e.target as Node)) e.preventDefault();
    };
    for (const layer of [els.backdrop, els.root]) {
      on(layer, "wheel", still, { passive: false });
      on(layer, "touchmove", still, { passive: false });
    }
  }

  get isOpen(): boolean {
    return this.from !== null;
  }

  open(from: "entry" | "button"): void {
    if (this.isOpen) return;
    this.hooks.opening?.();
    // Opened again while it shrinks: it stops and stands open.
    this.stop();
    const { els } = this;
    els.off.checked = !guideWanted();
    els.cafe.inert = true;
    this.heldY = window.scrollY;
    for (const el of [els.backdrop, els.root]) {
      el.hidden = false;
      el.classList.remove("closing");
    }
    els.words.scrollTop = 0;
    els.words.classList.toggle("tabbed", byKey);
    this.from = from;
    noteOpen(true);
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
    noteOpen(false);
    // Closed mid-grow, it shrinks from where the grow had got to (slice
    // 21's review, finding 13): read before the grow is stopped.
    const seen = typeof getComputedStyle === "function" ? getComputedStyle(els.card) : null;
    const start = { transform: seen?.transform && seen.transform !== "" ? seen.transform : "none", opacity: seen?.opacity ? Number(seen.opacity) : 1 };
    this.stop();
    els.cafe.inert = false;
    // Where the ⓘ is, measured before the focus moves, and the focus moved
    // without scrolling the page (slice 21's review, finding 4).
    const into = opts.now || !this.canAnimate() || reducedMotion() ? null : this.intoButton();
    (from === "button" ? els.button : els.room).focus({ preventScroll: true });
    if (opts.now || !this.canAnimate()) {
      this.hide();
      return;
    }
    // Shut to the café at once; shown, taking no presses, until it lands
    // (slice 21's review, finding 5).
    for (const el of [els.backdrop, els.root]) el.classList.add("closing");
    const card = into ? [start, { transform: transformFor(into), opacity: 0 }] : [{ opacity: start.opacity }, { opacity: 0 }];
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
    // The words take a ring when a key brings the focus to them: the
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
    for (const el of [els.backdrop, els.root]) el.classList.remove("closing");
    this.stop();
  }
}

const transformFor = (s: { x: number; y: number; scale: number }) => `translate(${s.x}px, ${s.y}px) scale(${s.scale})`;
