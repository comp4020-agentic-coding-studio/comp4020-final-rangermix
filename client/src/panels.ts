import { boardLines, chalkTime, chalkWords } from "./chalk";
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
 * Your cats, your treats left and the bowls. Built once and then updated in
 * place, so a screen reader's place in it holds while cats move. Putting a
 * treat down is the talk bar's (slice 14): a pinned panel lets every click
 * through, so it holds nothing to press.
 */
export function renderYourCats(box: HTMLElement, state: CafeState): void {
  let rows = box.querySelector<HTMLElement>(".cat-rows");
  let count = box.querySelector<HTMLElement>(".treats-left");
  let bowls = box.querySelector<HTMLElement>(".bowls");
  if (!rows || !count || !bowls) {
    rows = el("div", "cat-rows");
    count = el("span", "treats-left");
    bowls = el("p", "hint bowls");
    box.replaceChildren(el("h2", null, "Your cats"), rows, el("p", "treats", count), bowls);
  }
  rows.replaceChildren(...catRows(state));
  count.textContent = state.yourTreats > 0 ? `Treats today: ${state.yourTreats}` : "No treats left today.";
  bowls.textContent = BOWL_WORDS[Math.max(0, Math.min(3, state.bowls))];
}

/**
 * The talk bar's "Put a treat down", beside the emotes (slice 14): shown
 * while you have treats left, and like the emotes, not pressable while the
 * café wakes. The same button throughout, so it keeps the keyboard's focus.
 */
export function showTreatButton(button: HTMLButtonElement, state: CafeState, waking: boolean, onPut: () => void): void {
  button.hidden = state.yourTreats === 0;
  button.disabled = waking;
  button.onclick = onPut;
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

/** The chalkboard's lines into a list: the panel's, or the board dialog's. */
export function renderChalkboard(list: HTMLElement, state: CafeState, localNow = Date.now()): void {
  const lines = boardLines(state, localNow);
  // Rebuilt only when a line comes or goes, so a screen reader's place in the
  // list holds while the café goes on around it (slice 02's review, finding 9).
  const key = JSON.stringify(lines);
  if (list.dataset.lines === key) return;
  list.dataset.lines = key;
  if (lines.length === 0) {
    list.replaceChildren(el("li", "empty", "Nothing on the board yet."));
    return;
  }
  list.replaceChildren(
    ...lines.map((line) => {
      const time = el("time", null, chalkTime(line.at));
      time.setAttribute("datetime", new Date(line.at).toISOString());
      return el("li", null, time, `, ${chalkWords(line)}`);
    }),
  );
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
