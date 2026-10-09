import type { ClientMsg } from "./protocol/ClientMsg";

/** What the talk box needs of the café. */
export interface Speaker {
  send(msg: ClientMsg): void;
  isOpen(): boolean;
}

/** The server's limit, counted as it counts: one per character, emoji included. */
const MAX_CHARS = 100;

/** The talk box: says what you type to the room, or to the person you picked. */
export class Talk {
  private to: { id: number; name: string } | null = null;
  private readonly onSubmit = (e: Event) => {
    e.preventDefault();
    this.send();
  };
  private readonly onChip = () => this.address(null);

  constructor(
    private readonly cafe: Speaker,
    private readonly form: HTMLFormElement,
    private readonly input: HTMLInputElement,
    private readonly chip: HTMLButtonElement,
    /** Says why nothing was sent; what you typed stays in the box. */
    private readonly refuse: (why: string) => void,
  ) {
    form.addEventListener("submit", this.onSubmit);
    chip.addEventListener("click", this.onChip);
  }

  /** Lets go of the form, which outlives a visit. */
  dispose(): void {
    this.form.removeEventListener("submit", this.onSubmit);
    this.chip.removeEventListener("click", this.onChip);
    this.address(null);
  }

  address(person: { id: number; name: string } | null): void {
    this.to = person;
    this.chip.hidden = person === null;
    this.chip.textContent = person ? `To ${person.name} ✕` : "";
    this.chip.setAttribute("aria-label", person ? `Talking to ${person.name}; press to talk to the room` : "");
    this.input.placeholder = person ? `Say something to ${person.name}…` : "Say something…";
  }

  /** Stops addressing someone who is no longer here. */
  peopleChanged(present: Set<number>): void {
    if (this.to && !present.has(this.to.id)) this.address(null);
  }

  focus(): void {
    this.input.focus();
  }

  private send(): void {
    const text = this.input.value.trim();
    if (!text) return;
    if ([...text].length > MAX_CHARS) return this.refuse(`A bubble holds ${MAX_CHARS} characters.`);
    if (!this.cafe.isOpen()) return this.refuse("Not connected. Your words are still here; try again in a moment.");
    this.cafe.send({ type: "say", text, to: this.to?.id ?? null });
    this.input.value = "";
  }
}
