import { PHONE, type PanelSpot, type PanelsSaved, panelAt, savePanels, savedPanels, spotFor } from "./layout";

// The panels over the room on a desktop (slice 14, ADR 0018): the
// chalkboard, your cats and who's here float in the room's empty corners,
// kept inside the stage. Each moves by dragging its title or its grip with
// a mouse or a finger, or by its grip and the arrows; where each is stays
// on this device. Below 960 px they stand as the phone's layouts have them,
// and none of this applies.

/** Where each panel starts: in the corners the room's diamond leaves. */
export const START: Record<string, PanelSpot> = {
  chalkboard: { h: "left", x: 8, v: "top", y: 8 },
  "cats-panel": { h: "left", x: 8, v: "bottom", y: 8 },
  "here-panel": { h: "right", x: 8, v: "top", y: 8 },
};

/** How far an arrow moves a panel, in CSS pixels; with Shift, four times as far. */
const STEP = 16;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export class Floating {
  private readonly saved: PanelsSaved;
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
    }
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
        panel.style.removeProperty("--x");
        panel.style.removeProperty("--y");
        continue;
      }
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
        const move = (m: PointerEvent) => {
          if (m.pointerId !== e.pointerId) return;
          this.moveTo(panel, { left: from.left + m.clientX - grabbed.x, top: from.top + m.clientY - grabbed.y });
        };
        const up = (u: PointerEvent) => {
          if (u.pointerId !== e.pointerId) return;
          panel.classList.remove("moving");
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
      };
      handle.addEventListener("pointerdown", down);
      this.undo.push(() => handle.removeEventListener("pointerdown", down));
    }
    const grip = panel.querySelector<HTMLElement>(".grip");
    if (!grip) return;
    const key = (e: KeyboardEvent) => {
      const arrow = ARROWS[e.key];
      if (!arrow || this.phone.matches || this.saved[panel.id].pinned) return;
      e.preventDefault();
      const by = e.shiftKey ? STEP * 4 : STEP;
      const at = this.where(panel);
      this.moveTo(panel, { left: at.left + arrow[0] * by, top: at.top + arrow[1] * by });
    };
    grip.addEventListener("keydown", key);
    this.undo.push(() => grip.removeEventListener("keydown", key));
  }

  dispose(): void {
    this.observer.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.phone.removeEventListener("change", this.onResize);
    for (const u of this.undo.splice(0)) u();
  }
}
