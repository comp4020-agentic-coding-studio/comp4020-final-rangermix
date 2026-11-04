import { PHONE, type PanelSpot, panelAt } from "./layout";

// The panels over the room on a desktop (slice 14, ADR 0018): the
// chalkboard, your cats and who's here float in the room's empty corners,
// kept inside the stage. Below 960 px they stand as the phone's layouts
// have them, and none of this applies.

/** Where each panel starts: in the corners the room's diamond leaves. */
export const START: Record<string, PanelSpot> = {
  chalkboard: { h: "left", x: 8, v: "top", y: 8 },
  "cats-panel": { h: "left", x: 8, v: "bottom", y: 8 },
  "here-panel": { h: "right", x: 8, v: "top", y: 8 },
};

export class Floating {
  private readonly spots = new Map<string, PanelSpot>();
  private readonly observer = new ResizeObserver(() => this.place());
  private readonly phone = matchMedia(PHONE);
  private readonly onResize = () => this.place();

  constructor(
    private readonly stage: HTMLElement,
    private readonly panels: HTMLElement[],
  ) {
    for (const panel of panels) {
      this.spots.set(panel.id, START[panel.id]);
      // A panel that grows or shrinks moves, if it stands from the bottom or right.
      this.observer.observe(panel);
    }
    this.observer.observe(stage);
    window.addEventListener("resize", this.onResize);
    this.phone.addEventListener("change", this.onResize);
    this.place();
  }

  /** Puts every panel at its spot, inside the stage; on a phone, back where the page has it. */
  place(): void {
    const phone = this.phone.matches;
    const box = this.stage.getBoundingClientRect();
    const stage = { left: box.left, top: box.top, width: box.width, height: box.height };
    for (const panel of this.panels) {
      if (phone) {
        panel.style.removeProperty("--x");
        panel.style.removeProperty("--y");
        continue;
      }
      const at = panelAt(this.spots.get(panel.id) ?? START[panel.id], { w: panel.offsetWidth, h: panel.offsetHeight }, stage);
      panel.style.setProperty("--x", `${at.left}px`);
      panel.style.setProperty("--y", `${at.top}px`);
    }
  }

  dispose(): void {
    this.observer.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.phone.removeEventListener("change", this.onResize);
  }
}
