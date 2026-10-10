import type { CafeState } from "./state";

// The panels beside (or under) the room: your cats, who's here, and what was
// said this visit. Built from DOM nodes: names and words are text, never markup.

const LEVEL_WORDS = { stranger: "doesn't know you yet", familiar: "knows you", friend: "is your friend", devoted: "adores you" } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string | null, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

const BOWL_WORDS = ["The bowls are empty.", "The bowls are nearly empty.", "The bowls are half full.", "The bowls are full."];

/**
 * Your cats, your treats and the bowls. Built once and then updated in place,
 * since it holds a button: rebuilding it on every message would throw away
 * the keyboard's focus each time a cat moved.
 */
export function renderYourCats(box: HTMLElement, state: CafeState, onPutTreat?: () => void): void {
  let rows = box.querySelector<HTMLElement>(".cat-rows");
  let count = box.querySelector<HTMLElement>(".treats-left");
  let put = box.querySelector<HTMLButtonElement>("button.put-treat");
  let bowls = box.querySelector<HTMLElement>(".bowls");
  if (!rows || !count || !put || !bowls) {
    rows = el("div", "cat-rows");
    count = el("span", "treats-left");
    put = el("button", "put-treat", "Put a treat down");
    put.type = "button";
    bowls = el("p", "hint bowls");
    box.replaceChildren(el("h2", null, "Your cats"), rows, el("p", "treats", count, put), bowls);
  }
  rows.replaceChildren(...catRows(state));
  count.textContent = state.yourTreats > 0 ? `Treats today: ${state.yourTreats} ` : "No treats left today.";
  put.hidden = state.yourTreats === 0;
  put.onclick = onPutTreat ?? null;
  bowls.textContent = BOWL_WORDS[Math.max(0, Math.min(3, state.bowls))];
}

function catRows(state: CafeState): HTMLElement[] {
  return [...state.cats.values()].map((cat) => {
    const trust = state.trust.get(cat.id);
    const value = trust?.value ?? 0;
    const fill = el("span", null);
    fill.style.width = `${Math.min(100, value)}%`;
    const bar = el("div", "trust-bar", fill);
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", `${cat.name}'s trust in you: ${value} of 100`);
    return el("div", "cat-row", el("strong", null, cat.name), el("span", "hint", `${cat.name} ${LEVEL_WORDS[trust?.level ?? "stranger"]}.`), bar);
  });
}

export function renderHere(box: HTMLElement, state: CafeState): void {
  const people = [...state.people.values()];
  const name = (p: { id: number; name: string }) => (p.id === state.you ? `${p.name} (you)` : p.name);
  const inside = people.filter((p) => p.place === "inside");
  const waiting = people.filter((p) => p.place === "window");
  const parts: Node[] = [el("h2", null, `Here (${inside.length}/${state.cap})`), el("p", null, inside.map(name).join(" · ") || "Nobody yet.")];
  if (waiting.length > 0) parts.push(el("h2", null, `At the window (${waiting.length})`), el("p", null, waiting.map(name).join(" · ")));
  box.replaceChildren(...parts);
}

export function renderSaid(list: HTMLElement, state: CafeState): void {
  list.replaceChildren(
    ...state.said.slice(-30).map((line) => el("li", null, el("span", "who", line.toName ? `${line.name} to ${line.toName}: ` : `${line.name}: `), line.text)),
  );
  const scroller = list.closest(".panel");
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}
