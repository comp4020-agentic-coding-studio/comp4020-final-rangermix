import { describe, expect, it } from "vitest";
import { makeBubble } from "../src/bubbles";

describe("speech bubbles", () => {
  it("show markup as text and never make elements from it", () => {
    const bubble = makeBubble('<img src=x onerror="alert(1)">', null);
    expect(bubble.querySelector("img")).toBeNull();
    expect(bubble.textContent).toContain("<img");
  });

  it("say who a bubble is addressed to", () => {
    expect(makeBubble("hi", "sam").textContent).toBe("to samhi");
  });
});
