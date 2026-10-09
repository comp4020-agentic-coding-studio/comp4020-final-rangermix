import { describe, expect, it } from "vitest";
import type { FurnitureView } from "../src/protocol/FurnitureView";
import type { RoomView } from "../src/protocol/RoomView";
import { guessPlace } from "../src/placing";

const piece = (over: Partial<FurnitureView>): FurnitureView => ({
  id: 1,
  kind: "lamp",
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  movable: true,
  blocks: true,
  under: false,
  seats: false,
  ...over,
});

const room: RoomView = {
  width: 6,
  height: 4,
  tiles: ["WWDWWW", "......", "......", "......"],
  door: { x: 2, y: 0 },
  walkway: [{ x: 2, y: 1 }],
  furniture: [piece({ id: 2, kind: "rug", x: 3, y: 2, w: 2, h: 2, blocks: false, under: true }), piece({ id: 3, kind: "plant", x: 0, y: 3 })],
  catalogue: [],
};

describe("guessing where a carried piece can go", () => {
  it("allows free floor", () => {
    expect(guessPlace(room, piece({}), { x: 4, y: 1 }, [])).toBe(true);
  });

  it("refuses the walls, the edge and the door's walkway", () => {
    expect(guessPlace(room, piece({}), { x: 1, y: 0 }, [])).toBe(false);
    expect(guessPlace(room, piece({ w: 2 }), { x: 5, y: 1 }, [])).toBe(false);
    expect(guessPlace(room, piece({}), { x: 2, y: 1 }, [])).toBe(false);
  });

  it("puts things on a rug but not on each other", () => {
    expect(guessPlace(room, piece({}), { x: 3, y: 2 }, [])).toBe(true);
    expect(guessPlace(room, piece({}), { x: 0, y: 3 }, [])).toBe(false);
  });

  it("keeps a blocking piece off people, but a cushion can go under them", () => {
    expect(guessPlace(room, piece({}), { x: 4, y: 1 }, [{ x: 4, y: 1 }])).toBe(false);
    expect(guessPlace(room, piece({ blocks: false }), { x: 4, y: 1 }, [{ x: 4, y: 1 }])).toBe(true);
  });

  it("ignores the piece's own old place", () => {
    expect(guessPlace(room, piece({ id: 3, kind: "plant", x: 0, y: 3 }), { x: 0, y: 3 }, [])).toBe(true);
  });
});
