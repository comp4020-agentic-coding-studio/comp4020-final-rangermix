import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMsg } from "../src/protocol/ClientMsg";
import { Talk } from "../src/talk";

function fakeCafe(open = true) {
  const sent: ClientMsg[] = [];
  return { sent, send: (m: ClientMsg) => sent.push(m), isOpen: () => open };
}

let form: HTMLFormElement;
let input: HTMLInputElement;
let chip: HTMLButtonElement;

beforeEach(() => {
  document.body.innerHTML = `<form id="talk"><button type="button" id="chip" hidden></button><input id="in" /><button type="submit">Say</button></form>`;
  form = document.getElementById("talk") as HTMLFormElement;
  input = document.getElementById("in") as HTMLInputElement;
  chip = document.getElementById("chip") as HTMLButtonElement;
});

const submit = () => form.dispatchEvent(new Event("submit", { cancelable: true }));

describe("the talk box", () => {
  it("speaks for the visit it belongs to, not one that ended", () => {
    const first = fakeCafe();
    new Talk(first, form, input, chip, vi.fn()).dispose();
    const second = fakeCafe();
    new Talk(second, form, input, chip, vi.fn());
    input.value = "hello again";
    submit();
    expect(first.sent).toEqual([]);
    expect(second.sent).toEqual([{ type: "say", text: "hello again", to: null }]);
  });

  it("counts emoji as one character each, up to 100", () => {
    const cafe = fakeCafe();
    const refuse = vi.fn();
    new Talk(cafe, form, input, chip, refuse);
    input.value = "😺".repeat(100);
    submit();
    expect(cafe.sent).toHaveLength(1);
    input.value = "😺".repeat(101);
    submit();
    expect(cafe.sent).toHaveLength(1);
    expect(refuse).toHaveBeenCalledWith("A bubble holds 100 characters.");
    expect(input.value).toBe("😺".repeat(101));
  });

  it("keeps what you typed while the café is out of reach", () => {
    const cafe = fakeCafe(false);
    const refuse = vi.fn();
    new Talk(cafe, form, input, chip, refuse);
    input.value = "anyone there?";
    submit();
    expect(cafe.sent).toEqual([]);
    expect(input.value).toBe("anyone there?");
    expect(refuse).toHaveBeenCalledWith("Not connected. Your words are still here; try again in a moment.");
  });

  it("stops addressing someone who has left", () => {
    const cafe = fakeCafe();
    const talk = new Talk(cafe, form, input, chip, vi.fn());
    talk.address({ id: 2, name: "sam" });
    talk.peopleChanged(new Set([1]));
    expect(chip.hidden).toBe(true);
    input.value = "hi";
    submit();
    expect(cafe.sent).toEqual([{ type: "say", text: "hi", to: null }]);
  });
});
