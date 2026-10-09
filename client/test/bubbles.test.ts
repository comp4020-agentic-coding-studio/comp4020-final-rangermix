import { describe, expect, it } from "vitest";
import { makeBubble, placeBubble } from "../src/bubbles";

// The room at 5x: 960 by 800 CSS pixels, drawn 100 pixels in from the overlay's left.
const room = { left: 100, top: 0, right: 1060, bottom: 800 };
const size = { width: 120, height: 40 };

describe("placing a bubble", () => {
  it("sits centred over the speaker's head", () => {
    expect(placeBubble({ x: 500, head: 400, feet: 480 }, 0, size, room)).toEqual({ left: 440, top: 356 });
  });

  it("stacks a later bubble above an earlier one", () => {
    expect(placeBubble({ x: 500, head: 400, feet: 480 }, 44, size, room)).toEqual({ left: 440, top: 312 });
  });

  it("stays inside the room at either side", () => {
    expect(placeBubble({ x: 110, head: 400, feet: 480 }, 0, size, room).left).toBe(100);
    expect(placeBubble({ x: 1055, head: 400, feet: 480 }, 0, size, room).left).toBe(940);
  });

  it("goes under the speaker when there's no room above", () => {
    expect(placeBubble({ x: 500, head: 20, feet: 100 }, 0, size, room)).toEqual({ left: 440, top: 104 });
    expect(placeBubble({ x: 500, head: 20, feet: 100 }, 44, size, room)).toEqual({ left: 440, top: 148 });
  });

  it("never leaves the bottom of the room either", () => {
    expect(placeBubble({ x: 500, head: 20, feet: 790 }, 0, size, room).top).toBe(760);
  });
});

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
