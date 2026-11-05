import { announce } from "./announce";
import { PHONE, type PanelSpot, type PanelsSaved, panelAt, savePanels, savedPanels, spotFor } from "./layout";

// The panels over the room on a desktop (slice 14, ADR 0018): the
// chalkboard, your cats, who's here and the music (slice 15) float in the
// room's empty corners, kept inside the stage. Each moves by dragging its
// title or its grip with a mouse or a finger, or by its grip and the
// arrows; where each is stays on this device. Below 960 px they stand as
// the phone's layouts have them, and none of this applies.

/** Where each panel starts: in the corners the room's diamond leaves. */
export const START: Record<string, PanelSpot> = {
  chalkboard: { h: "left", x: 8, v: "top", y: 8 },
  "cats-panel": { h: "left", x: 8, v: "bottom", y: 8 },
  "here-panel": { h: "right", x: 8, v: "top", y: 8 },
  // The music (slice 15), under who's here.
  "music-panel": { h: "right", x: 8, v: "bottom", y: 8 },
};

/** Where a spot is, in words: "top left", "bottom right", "middle left" (a third of the stage each way). */
function whereOn(spot: PanelSpot, stage: { width: number; height: number }, size: { w: number; h: number }): string {
  const third = (from: number, span: number, own: number) => (from + own / 2) / span;
  const across = third(spot.x, stage.width, size.w);
  const down = third(spot.y, stage.height, size.h);
  const v = down < 1 / 3 ? (spot.v === "top" ? "top" : "bottom") : down > 2 / 3 ? (spot.v === "top" ? "bottom" : "top") : "middle";
  const h = across < 1 / 3 ? spot.h : across > 2 / 3 ? (spot.h === "left" ? "right" : "left") : "middle";
  return v === "middle" && h === "middle" ? "middle" : `${v} ${h}`;
}

/** Each panel's share of the stage's height, and the room left between and round them, in CSS pixels. */
const SHARE: Record<string, number> = { chalkboard: 0.42, "cats-panel": 0.58, "here-panel": 0.7, "music-panel": 0.3 };
const GAP = 16;

/** How far an arrow moves a panel, in CSS pixels; with Shift, four times as far. */
const STEP = 16;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export class Floating {
  private readonly saved: PanelsSaved;
  private readonly dimmers: Dimmer[] = [];
  private readonly ticker: number;
  private readonly observer = new ResizeObserver(() => this.place());
  private readonly phone = matchMedia(PHONE);
  private readonly onResize = () => this.place();
  private readonly undo: (() => void)[] = [];

  constructor(
    private readonly stage: HTMLElement,
    private readonly panels: HTMLElement[],
  ) {
    this.saved = savedPanels();
    for (const panel of panels) {
      this.saved[panel.id] ??= { spot: START[panel.id], pinned: false };
      // A panel that grows or shrinks moves, if it stands from the bottom or right.
      this.observer.observe(panel);
      this.dragging(panel);
      this.pinning(panel);
      // Awake while pinned, and on a phone, where panels don't float.
      this.dimmers.push(new Dimmer(panel, () => this.saved[panel.id].pinned || this.phone.matches));
    }
    // Looked at once a second, and whenever the café changes (changed()).
    this.ticker = window.setInterval(() => this.changed(), 1000);
    this.observer.observe(stage);
    window.addEventListener("resize", this.onResize);
    this.phone.addEventListener("change", this.onResize);
    this.place();
  }

  private stageBox(): { left: number; top: number; width: number; height: number } {
    const box = this.stage.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }

  private sizeOf(panel: HTMLElement): { w: number; h: number } {
    return { w: panel.offsetWidth, h: panel.offsetHeight };
  }

  /** Puts every panel at its spot, inside the stage; on a phone, back where the page has it. */
  place(): void {
    const phone = this.phone.matches;
    const stage = this.stageBox();
    for (const panel of this.panels) {
      if (phone) {
        for (const v of ["--x", "--y", "--most"]) panel.style.removeProperty(v);
        continue;
      }
      // How tall it may grow, from the stage it floats in, not the window:
      // the left two share the stage's height, so they never overlap,
      // whatever wraps the status bar (slice 14's review, finding 9).
      panel.style.setProperty("--most", `${Math.floor(Math.max(80, stage.height * (SHARE[panel.id] ?? 1) - GAP))}px`);
      this.show(panel, panelAt(this.saved[panel.id].spot, this.sizeOf(panel), stage));
    }
  }

  private show(panel: HTMLElement, at: { left: number; top: number }): void {
    panel.style.setProperty("--x", `${at.left}px`);
    panel.style.setProperty("--y", `${at.top}px`);
  }

  /** Moves a panel's top-left to `at`, kept inside the stage, and remembers it. */
  private moveTo(panel: HTMLElement, at: { left: number; top: number }): void {
    const stage = this.stageBox();
    const size = this.sizeOf(panel);
    const spot = spotFor(at, size, stage);
    this.saved[panel.id] = { ...this.saved[panel.id], spot };
    this.show(panel, panelAt(spot, size, stage));
    savePanels(this.saved);
  }

  /** Where a panel's top-left is now, in the window. */
  private where(panel: HTMLElement): { left: number; top: number } {
    const box = panel.getBoundingClientRect();
    return { left: box.left, top: box.top };
  }

  /** Dragging by the title or the grip, with a mouse or a finger; the grip and the arrows by keyboard. */
  private dragging(panel: HTMLElement): void {
    const handles = [panel.querySelector<HTMLElement>(".panel-bar h2"), panel.querySelector<HTMLElement>(".grip")].filter((h): h is HTMLElement => h !== null);
    for (const handle of handles) {
      const down = (e: PointerEvent) => {
        if (this.phone.matches || this.saved[panel.id].pinned) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        const from = this.where(panel);
        const grabbed = { x: e.clientX, y: e.clientY };
        handle.setPointerCapture?.(e.pointerId);
        panel.classList.add("moving");
        const end = () => {
          panel.classList.remove("moving");
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
          handle.removeEventListener("lostpointercapture", up);
        };
        const move = (m: PointerEvent) => {
          if (m.pointerId !== e.pointerId) return;
          // The drag is over if the button went up out of sight (no
          // button-up came), the panel was pinned, or the page turned a
          // phone's (slice 14's review, finding 7).
          if ((m.pointerType === "mouse" && m.buttons === 0) || this.saved[panel.id].pinned || this.phone.matches) return end();
          this.moveTo(panel, { left: from.left + m.clientX - grabbed.x, top: from.top + m.clientY - grabbed.y });
        };
        const up = (u: PointerEvent) => {
          if (u.pointerId === e.pointerId) end();
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
        handle.addEventListener("lostpointercapture", up);
      };
      handle.addEventListener("pointerdown", down);
      this.undo.push(() => handle.removeEventListener("pointerdown", down));
    }
    const grip = panel.querySelector<HTMLElement>(".grip");
    if (!grip) return;
    // What the arrows do, for a screen reader, and where the panel ends up
    // once they stop (slice 14's review, finding 10).
    const hint = document.getElementById("grip-hint") ?? Object.assign(document.createElement("span"), { id: "grip-hint", hidden: true, textContent: "Arrow keys move it; with Shift, further." });
    if (!hint.isConnected) document.body.append(hint);
    grip.setAttribute("aria-describedby", hint.id);
    const name = panel.querySelector(".pin")?.getAttribute("data-name") ?? "the panel";
    let said = 0;
    const key = (e: KeyboardEvent) => {
      const arrow = ARROWS[e.key];
      if (!arrow || this.phone.matches || this.saved[panel.id].pinned) return;
      e.preventDefault();
      const by = e.shiftKey ? STEP * 4 : STEP;
      const at = this.where(panel);
      this.moveTo(panel, { left: at.left + arrow[0] * by, top: at.top + arrow[1] * by });
      window.clearTimeout(said);
      said = window.setTimeout(() => announce(`Moved ${name} to the ${whereOn(this.saved[panel.id].spot, this.stageBox(), this.sizeOf(panel))}.`), 400);
    };
    grip.addEventListener("keydown", key);
    this.undo.push(() => grip.removeEventListener("keydown", key));
  }

  /**
   * The Pin button. A pinned panel stays put and lets every click, tap and
   * hover through to the café under it (pointer-events in style.css), but
   * for its Unpin; its grip goes, so Tab reaches only Unpin.
   */
  private pinning(panel: HTMLElement): void {
    const pin = panel.querySelector<HTMLButtonElement>(".pin");
    const grip = panel.querySelector<HTMLButtonElement>(".grip");
    if (!pin) return;
    // The panel's name from the page, never from the label this rewrites:
    // a second Floating over the same page (leaving and coming back) would
    // read "Unpin your cats" (slice 14's review, finding 3).
    const name = pin.dataset.name ?? "";
    const show = () => {
      const pinned = this.saved[panel.id].pinned;
      panel.classList.toggle("pinned", pinned);
      pin.textContent = pinned ? "Unpin" : "Pin";
      pin.setAttribute("aria-label", `${pinned ? "Unpin" : "Pin"} ${name}`);
      pin.setAttribute("aria-pressed", String(pinned));
      if (grip) grip.hidden = pinned;
    };
    const click = () => {
      this.saved[panel.id] = { ...this.saved[panel.id], pinned: !this.saved[panel.id].pinned };
      savePanels(this.saved);
      show();
      this.changed();
    };
    pin.addEventListener("click", click);
    this.undo.push(() => pin.removeEventListener("click", click));
    show();
  }

  /** The panels' content may have changed: dim those left unchanged, and bring back the rest. */
  changed(): void {
    for (const d of this.dimmers) d.check();
  }

  dispose(): void {
    window.clearInterval(this.ticker);
    for (const d of this.dimmers.splice(0)) d.dispose();
    this.observer.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.phone.removeEventListener("change", this.onResize);
    for (const u of this.undo.splice(0)) u();
  }
}

/** How long a panel's content stays unchanged before it dims, in milliseconds (spec 14, tunable). */
export const DIM_AFTER = 4000;

/**
 * Dims a panel left unchanged (slice 14): after `DIM_AFTER` with the same
 * content, the pointer elsewhere and the focus outside it, it grows more
 * see-through; a change of content, the pointer or the focus brings it
 * back. What counts is the content's markup, not that it was rebuilt: who's
 * here is rebuilt on every message the same. A pinned panel never dims.
 */
export class Dimmer {
  private markup: string;
  private since = Date.now();
  private hovered = false;
  private readonly undo: (() => void)[] = [];

  constructor(
    private readonly panel: HTMLElement,
    private readonly pinned: () => boolean,
  ) {
    this.markup = this.content();
    const on = (type: string, fn: () => void) => {
      panel.addEventListener(type, fn);
      this.undo.push(() => panel.removeEventListener(type, fn));
    };
    on("pointerenter", () => {
      this.hovered = true;
      this.check();
    });
    on("pointerleave", () => {
      this.hovered = false;
      this.since = Date.now();
    });
    on("focusin", () => this.check());
    on("focusout", () => {
      this.since = Date.now();
      // The focus has gone by the time this runs, wherever it went.
      queueMicrotask(() => this.check());
    });
  }

  private content(): string {
    return this.panel.querySelector(".panel-body")?.innerHTML ?? "";
  }

  /** Dims the panel or brings it back, by what's changed since it was last looked at. */
  check(): void {
    const now = this.content();
    if (now !== this.markup) {
      this.markup = now;
      this.since = Date.now();
    }
    const awake = this.pinned() || this.hovered || this.panel.contains(document.activeElement);
    if (awake) this.since = Date.now();
    this.panel.classList.toggle("dim", !awake && Date.now() - this.since >= DIM_AFTER);
  }

  dispose(): void {
    for (const u of this.undo.splice(0)) u();
  }
}
