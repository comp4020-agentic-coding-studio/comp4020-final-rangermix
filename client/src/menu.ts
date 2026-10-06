// A small menu of what you can do: beside the thing on a desktop, a sheet from
// the bottom on a phone. Real buttons, so the keyboard reaches every action.

export interface Action {
  label: string;
  run: () => void;
}

let open: HTMLElement | null = null;

export function closeMenu(): void {
  open?.remove();
  open = null;
}

export function openMenu(
  overlay: HTMLElement,
  anchor: { left: number; top: number },
  title: string,
  note: string | null,
  actions: Action[],
  returnFocus: HTMLElement,
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
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  });
  if (matchMedia("(max-width: 700px)").matches) {
    menu.classList.add("sheet");
  } else {
    menu.style.left = `${Math.min(anchor.left, Math.max(0, overlay.clientWidth - 200))}px`;
    menu.style.top = `${Math.max(0, anchor.top)}px`;
  }
  overlay.append(menu);
  open = menu;
  menu.querySelector("button")?.focus();
}
