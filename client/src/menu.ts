import { menuSpot, ringCentre, ringPositions, ringRadius } from "./layout";

// A small menu of what you can do: beside the thing on a desktop, a sheet from
// the bottom on a phone, a ring round it in phone layout B. Real buttons, so
// the keyboard reaches every action.

export interface Action {
  label: string;
  run: () => void;
}

let open: HTMLElement | null = null;

export function isMenuOpen(): boolean {
  return open !== null;
}

export function closeMenu(): void {
  open?.remove();
  open = null;
}

/** The part of `overlay` a ring may use: on screen, clear of the bars floating over the room. */
function freeArea(overlay: HTMLElement): { left: number; top: number; right: number; bottom: number } {
  const box = overlay.getBoundingClientRect();
  const top = document.querySelector(".status")?.getBoundingClientRect().bottom ?? box.top;
  const bottom = document.querySelector(".talk")?.getBoundingClientRect().top ?? box.bottom;
  return { left: 0, top: top - box.top + 4, right: box.width, bottom: bottom - box.top - 4 };
}

/** Lays a ring's buttons out round `anchor`, clear of the bars floating over the room. */
function placeRing(menu: HTMLElement, overlay: HTMLElement, anchor: { left: number; top: number }): void {
  const buttons = [...menu.querySelectorAll<HTMLButtonElement>("button")];
  const spots = ringPositions(buttons.length, { x: anchor.left, y: anchor.top }, ringRadius(buttons.length, 88), freeArea(overlay), 88);
  buttons.forEach((b, i) => {
    b.style.left = `${spots[i].x}px`;
    b.style.top = `${spots[i].y}px`;
  });
}

/** The room moved under an open ring: it follows its tile to `anchor`. */
export function moveRing(anchor: { left: number; top: number }): void {
  if (open?.classList.contains("ring") && open.parentElement) placeRing(open, open.parentElement, anchor);
}

/**
 * How far the open ring had to move off `anchor` to stay on screen and clear
 * of the bars, as it does by the room's edges: nothing if it fits round it.
 */
export function ringSlide(anchor: { left: number; top: number }): { x: number; y: number } {
  if (!open?.classList.contains("ring") || !open.parentElement) return { x: 0, y: 0 };
  const n = open.querySelectorAll("button").length;
  const at = ringCentre({ x: anchor.left, y: anchor.top }, ringRadius(n, 88), freeArea(open.parentElement), 88);
  return { x: at.x - anchor.left, y: at.y - anchor.top };
}

/**
 * Where a menu opens, in CSS pixels within the stage: a ring round the
 * middle of its tile, or a desktop menu beside the tile's `left` and `right`
 * edges, from its `top`.
 */
export interface Anchor {
  left: number;
  top: number;
  right?: number;
}

export function openMenu(
  overlay: HTMLElement,
  anchor: Anchor,
  title: string,
  note: string | null,
  actions: Action[],
  returnFocus: HTMLElement,
  ring = false,
): void {
  closeMenu();
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", title);
  const heading = document.createElement("h2");
  heading.textContent = title;
  menu.append(heading);
  if (note) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = note;
    menu.append(p);
  }
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = action.label;
    button.addEventListener("click", () => {
      closeMenu();
      returnFocus.focus();
      action.run();
    });
    menu.append(button);
  }
  menu.addEventListener("keydown", (e) => {
    const items = [...menu.querySelectorAll<HTMLButtonElement>("button")];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      returnFocus.focus();
    } else if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) {
      e.preventDefault();
      const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    }
  });
  if (ring) {
    // Layout B: the actions in a ring round what you tapped, the title read out only.
    menu.classList.add("ring");
    heading.className = "sr-only";
    menu.querySelector(".note")?.classList.add("sr-only");
    placeRing(menu, overlay, anchor);
  } else if (matchMedia("(max-width: 700px)").matches) {
    menu.classList.add("sheet");
  }
  overlay.append(menu);
  if (!menu.classList.contains("ring") && !menu.classList.contains("sheet")) {
    // Measured once it's on the page, then kept whole within the stage,
    // which cuts off anything past its edges. One taller than the stage
    // scrolls.
    menu.style.maxHeight = `${overlay.clientHeight}px`;
    menu.style.overflowY = "auto";
    const at = menuSpot(
      { left: anchor.left, right: anchor.right ?? anchor.left, top: anchor.top },
      { w: menu.offsetWidth, h: menu.offsetHeight },
      { w: overlay.clientWidth, h: overlay.clientHeight },
    );
    menu.style.left = `${at.left}px`;
    menu.style.top = `${at.top}px`;
  }
  open = menu;
  menu.querySelector("button")?.focus();
}
