import type { Cafe } from "./cafe";

/** The talk box: says what you type to the room, or to the person you picked. */
export class Talk {
  private to: { id: number; name: string } | null = null;

  constructor(
    private readonly cafe: Cafe,
    form: HTMLFormElement,
    private readonly input: HTMLInputElement,
    private readonly chip: HTMLButtonElement,
  ) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.send();
    });
    chip.addEventListener("click", () => this.address(null));
  }

  address(person: { id: number; name: string } | null): void {
    this.to = person;
    this.chip.hidden = person === null;
    this.chip.textContent = person ? `To ${person.name} ✕` : "";
    this.chip.setAttribute("aria-label", person ? `Talking to ${person.name}; press to talk to the room` : "");
    this.input.placeholder = person ? `Say something to ${person.name}…` : "Say something…";
  }

  focus(): void {
    this.input.focus();
  }

  private send(): void {
    const text = this.input.value.trim();
    if (!text) return;
    this.cafe.send({ type: "say", text, to: this.to?.id ?? null });
    this.input.value = "";
  }
}
