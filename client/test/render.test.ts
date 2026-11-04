import { describe, expect, it } from "vitest";
import type { ServerMsg } from "../src/protocol/ServerMsg";
import palettes from "../../content/sprites/palettes.json";
import { toCanvas } from "../src/iso";
import { draw, drawOrder, hitAt, personLift } from "../src/render";
import type { Light } from "../src/canberra";
import { Sprites } from "../src/sprites";
import { apply, fromWelcome } from "../src/state";

// What's drawn, in order, in the room at an angle (slice 09): what lies flat
// first, then everything standing, nothing nearer the viewer painted over.

type Welcome = Extract<ServerMsg, { type: "welcome" }>;
const piece = (id: number, kind: string, x: number, y: number, w: number, h: number, under = false) => ({ id, kind, x, y, w, h, movable: true, blocks: !under, under, seats: false, toppled: false });

function welcome(): Welcome {
  return {
    type: "welcome",
    you: 1,
    build: "b1",
    now: 10_000,
    cap: 6,
    chalkHours: 24,
    chalkShown: 8,
    snapshot: {
      room: {
        width: 12,
        height: 10,
        tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")],
        door: { x: 7, y: 0 },
        walkway: [],
        furniture: [piece(1, "sofa", 0, 5, 3, 1), piece(2, "rug", 4, 4, 4, 3, true)],
        catalogue: [],
      },
      people: [
        { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 1, y: 6 }, walk: null, sitting: false },
        { id: 2, name: "sam", look: { avatar: 1, colour: 2 }, place: "inside", at: { x: 9, y: 8 }, walk: null, sitting: false },
      ],
      cats: [
        { id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 2, y: 4 }, pose: "sit", walk: null, heldBy: null },
        { id: "tora", name: "Tora", coat: "orange_tabby", at: { x: 5, y: 5 }, pose: "sit", walk: null, heldBy: null },
        { id: "burakku", name: "Burakku", coat: "black", at: { x: 9, y: 8 }, pose: "sit", walk: null, heldBy: 2 },
      ],
      yourTrust: [],
      held: [],
      treats: [],
      yourTreats: 3,
      bowls: 2,
      chalkboard: [],
    },
  };
}

describe("the room's draw order", () => {
  const order = drawOrder(fromWelcome(welcome(), 10_000), 10_000).map((d) => d.label);

  it("lays the rug before anything standing", () => {
    expect(order[0]).toBe("piece rug");
  });

  it("draws a cat on the rug after the rug", () => {
    expect(order.indexOf("cat tora")).toBeGreaterThan(order.indexOf("piece rug"));
  });

  it("draws a cat behind the sofa's far end before the sofa, and someone in front of it after", () => {
    expect(order.indexOf("cat mochi")).toBeLessThan(order.indexOf("piece sofa"));
    expect(order.indexOf("person 1")).toBeGreaterThan(order.indexOf("piece sofa"));
  });

  it("draws a cat napping on a piece after the piece, up on top of it", () => {
    const w = welcome();
    w.snapshot.room.furniture.push(piece(3, "window_seat", 2, 1, 2, 1));
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 2, y: 1 }, pose: "nap" };
    const drawn = drawOrder(fromWelcome(w, 10_000), 10_000);
    const labels = drawn.map((d) => d.label);
    expect(labels.indexOf("cat mochi")).toBeGreaterThan(labels.indexOf("piece window_seat"));
    expect(drawn.find((d) => d.label === "cat mochi")?.lift).toBe(12);
  });

  it("draws a cat on the floor at floor level", () => {
    const drawn = drawOrder(fromWelcome(welcome(), 10_000), 10_000);
    expect(drawn.find((d) => d.label === "cat tora")?.lift).toBe(0);
  });

  // Slice 09's review, findings 2, 3 and 7.

  it("draws a cat asleep on someone's lap over them, on the sofa and on a chair", () => {
    for (const seat of [piece(3, "chair", 9, 4, 1, 1), null]) {
      const w = welcome();
      const at = seat ? { x: seat.x, y: seat.y } : { x: 1, y: 5 };
      if (seat) w.snapshot.room.furniture.push(seat);
      w.snapshot.people[0] = { ...w.snapshot.people[0], at, sitting: true };
      w.snapshot.cats[0] = { ...w.snapshot.cats[0], at, pose: "nap" };
      const order = drawOrder(fromWelcome(w, 10_000), 10_000).map((d) => d.label);
      expect(order.indexOf("cat mochi"), `on ${seat ? "the chair" : "the sofa"}`).toBeGreaterThan(order.indexOf("person 1"));
    }
  });

  it("draws someone just behind the sofa's far end before the sofa", () => {
    const w = welcome();
    w.snapshot.people[0] = { ...w.snapshot.people[0], at: { x: 2, y: 4 } };
    const order = drawOrder(fromWelcome(w, 10_000), 10_000).map((d) => d.label);
    expect(order.indexOf("person 1")).toBeLessThan(order.indexOf("piece sofa"));
  });

  it("draws the toys, a cushion and a treat put on the rug after the rug", () => {
    const w = welcome();
    w.snapshot.room.furniture.push(piece(4, "toys", 4, 4, 1, 1), { ...piece(5, "cushion", 6, 5, 1, 1), blocks: false });
    w.snapshot.treats = [{ id: 1, at: { x: 5, y: 6 } }];
    const order = drawOrder(fromWelcome(w, 10_000), 10_000).map((d) => d.label);
    for (const what of ["piece toys", "piece cushion", "treat 1"]) expect(order.indexOf(what), what).toBeGreaterThan(order.indexOf("piece rug"));
  });

  it("draws a cat walking over a piece up on top of it", () => {
    const w = welcome();
    w.snapshot.room.furniture.push(piece(3, "cat_tower", 0, 1, 2, 2));
    // Half-way across the tower, walking.
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 0, y: 1 }, pose: "walk", walk: { path: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }], start: 10_000, speed: 1 } };
    const drawn = drawOrder(fromWelcome(w, 10_500), 10_500);
    expect(drawn.find((d) => d.label === "cat mochi")?.lift).toBe(44);
  });

  // Slice 09's review, finding 1: a click lands on what's drawn there.

  it("finds a cat napping on the window seat where it's drawn, not the wall behind it", () => {
    const w = welcome();
    w.snapshot.room.furniture.push(piece(3, "window_seat", 2, 1, 2, 1));
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 3, y: 1 }, pose: "nap" };
    const s = fromWelcome(w, 10_000);
    // The middle of the cat's sprite: feet 2 px below the tile's centre, raised by the seat's 12 px, 16 px tall.
    const c = toCanvas(3.5, 1.5);
    expect(hitAt(s, c.x, c.y + 2 - 12 - 8, 10_000)).toEqual({ x: 3, y: 1 });
  });

  it("finds a cat on the floor by its head, over the tile behind it", () => {
    const s = fromWelcome(welcome(), 10_000);
    // Tora at (5,5): the top of its sprite is over (4,4)'s diamond.
    const c = toCanvas(5.5, 5.5);
    expect(hitAt(s, c.x, c.y + 2 - 14, 10_000)).toEqual({ x: 5, y: 5 });
  });

  it("finds a piece by the top of its block, and a cat in front of a piece before the piece", () => {
    const s = fromWelcome(welcome(), 10_000);
    // The sofa's top face over (1,5), 16 px up.
    const top = toCanvas(1.5, 5.5);
    expect(hitAt(s, top.x, top.y - 16, 10_000)).toEqual({ x: 1, y: 5 });
    // Someone at (1,6), in front of the sofa: their body covers the sofa's front face.
    const me = toCanvas(1.5, 6.5);
    expect(hitAt(s, me.x, me.y - 8, 10_000)).toEqual({ x: 1, y: 6 });
  });

  it("finds nothing drawn over bare floor, so the floor's tile is picked", () => {
    const s = fromWelcome(welcome(), 10_000);
    const c = toCanvas(10.5, 2.5);
    expect(hitAt(s, c.x, c.y, 10_000)).toBeNull();
  });

  it("says how high someone is drawn, for their bubble: up on a seat, or on the floor", () => {
    const w = welcome();
    w.snapshot.people[0] = { ...w.snapshot.people[0], at: { x: 1, y: 5 }, sitting: true };
    const s = fromWelcome(w, 10_000);
    // The sofa is 16 px tall; someone on it sinks 4 px in.
    expect(personLift(s, s.people.get(1)!, 10_000)).toBe(12);
    expect(personLift(s, s.people.get(2)!, 10_000)).toBe(0);
  });

  // Slice 10: the room in the hour's colours, with no grey wash over it.

  it("paints the floor in the day's colours by day and the night's at night, with no wash laid over", () => {
    const fills = (light: Light) => {
      const seen: string[] = [];
      let alpha = 1;
      const ctx = new Proxy(
        {},
        {
          get: (_t, k) => (k === "globalAlpha" ? alpha : k === "fillRect" ? () => seen.push(`rect ${alpha}`) : () => {}),
          set: (_t, k, v) => {
            if (k === "fillStyle") seen.push(String(v));
            if (k === "globalAlpha") alpha = v;
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      // A fresh Sprites, at light 0: draw itself must colour them in its light.
      const sprites = new Sprites();
      draw(ctx, fromWelcome(welcome(), 10_000), sprites, 10_000, { tile: null, visible: false, hover: null, ghost: null }, light);
      expect(sprites.light, "draw sets the sprites' light").toBe(light);
      return seen;
    };
    const day = fills(0);
    const night = fills(1);
    expect(day).toContain(palettes.day.room[0]);
    expect(day).not.toContain(palettes.night.room[0]);
    expect(night).toContain(palettes.night.room[0]);
    expect(night).not.toContain(palettes.day.room[0]);
    // Nothing is laid over the whole canvas at less than full strength.
    for (const seen of [day, night]) expect(seen.filter((s) => s.startsWith("rect ") && s !== "rect 1")).toEqual([]);
  });

  it("draws the scattered toys in the light's colours, not fixed ones (slice 10's review, finding 3)", () => {
    const fillsWith = (light: Light) => {
      const seen = new Set<string>();
      const ctx = new Proxy(
        {},
        {
          get: () => () => {},
          set: (_t, k, v) => {
            if (k === "fillStyle") seen.add(String(v));
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      const w = welcome();
      w.snapshot.room.furniture = [{ ...piece(4, "toys", 7, 8, 1, 1), toppled: true }];
      draw(ctx, fromWelcome(w, 10_000), new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, light);
      return seen;
    };
    // The old palette's red, blue and brown, written into the code before.
    for (const light of [0, 1] as Light[]) for (const old of ["#c96f6f", "#7a9cc6", "#4a3426"]) expect(fillsWith(light).has(old), `${old} at light ${light}`).toBe(false);
    // The balls of yarn are the furniture palette's red and lavender, in each light.
    expect(fillsWith(0).has(palettes.day.furniture[9])).toBe(true);
    expect(fillsWith(1).has(palettes.night.furniture[9])).toBe(true);
  });

  it("draws a held cat with its holder, not on its own", () => {
    expect(order).not.toContain("cat burakku");
    expect(order).toContain("person 2");
  });
});

// Slice 12: walkers show the side they're walking toward, and keep it when
// they stop. The camera looks from the front-right corner, so toward the
// street wall (-y) is away from the viewer.

describe("the side a walker shows", () => {
  /** Which frames `draw` asks the sprites for, by who. */
  function framesAsked(state: ReturnType<typeof fromWelcome>, localNow: number) {
    const asked: string[] = [];
    const sprites = new Sprites();
    sprites.cat = (coat, frame) => (asked.push(`cat ${coat} ${frame}`), null);
    sprites.avatar = (look, frame) => (asked.push(`person ${look.avatar} ${frame}`), null);
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true }) as unknown as CanvasRenderingContext2D;
    draw(ctx, state, sprites, localNow, { tile: null, visible: false, hover: null, ghost: null }, 0);
    return asked;
  }
  const walking = (dy: number) => {
    const w = welcome();
    w.snapshot.people[1] = { ...w.snapshot.people[1], at: { x: 9, y: 5 }, walk: { path: [{ x: 9, y: 5 }, { x: 9, y: 5 + dy }, { x: 9, y: 5 + 2 * dy }], start: 10_000, speed: 1 } };
    return fromWelcome(w, 10_000);
  };

  it("shows someone's back while they walk toward the street wall, and their front walking toward the viewer", () => {
    expect(framesAsked(walking(-1), 10_500).filter((f) => f.startsWith("person 1"))[0]).toMatch(/^person 1 back_walk_[ab]$/);
    expect(framesAsked(walking(1), 10_500).filter((f) => f.startsWith("person 1"))[0]).toMatch(/^person 1 walk_[ab]$/);
  });

  it("keeps someone's back to the viewer once they've arrived, after the walk is gone", () => {
    const s = walking(-1);
    // They arrive and sit: the server clears the walk.
    apply(s, { type: "personSat", id: 2, at: { x: 9, y: 3 } }, 13_000);
    expect(framesAsked(s, 13_100).filter((f) => f.startsWith("person 1"))).toEqual(["person 1 back"]);
  });

  it("keeps a cat's back to the viewer when it settles after walking away", () => {
    const w = welcome();
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 2, y: 6 }, pose: "walk", walk: { path: [{ x: 2, y: 6 }, { x: 2, y: 5 }, { x: 2, y: 4 }], start: 10_000, speed: 1 } };
    const s = fromWelcome(w, 10_000);
    expect(framesAsked(s, 10_500).filter((f) => f.startsWith("cat white_grey"))[0]).toMatch(/^cat white_grey back_walk_[ab]$/);
    apply(s, { type: "catPosed", cat: "mochi", pose: "sit", at: { x: 2, y: 4 } }, 12_500);
    expect(framesAsked(s, 12_600).filter((f) => f.startsWith("cat white_grey"))).toEqual(["cat white_grey back_sit"]);
  });

  it("faces the way the last walk went once it's over, not the way a walk it replaced went", () => {
    // Walking toward the viewer, then sent the other way before arriving:
    // the server never says a walk is over, so it stays, finished.
    const s = walking(1);
    apply(s, { type: "personMoved", id: 2, walk: { path: [{ x: 9, y: 6 }, { x: 9, y: 5 }], start: 10_600, speed: 1 } }, 10_600);
    expect(framesAsked(s, 13_000).filter((f) => f.startsWith("person 1"))).toEqual(["person 1 back"]);
  });

  it("mirrors a cat walking up the screen to the left, and not one walking up it to the right, so it goes head first both ways (slice 12's review, finding 1)", () => {
    /** Whether the cat's frame was drawn mirrored: a scale(-1, 1) in force when its image is drawn. */
    const mirrored = (path: { x: number; y: number }[]) => {
      const w = welcome();
      w.snapshot.cats = [{ ...w.snapshot.cats[0], at: path[0], pose: "walk", walk: { path, start: 10_000, speed: 1 } }];
      w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
      const s = fromWelcome(w, 10_000);
      const cat = document.createElement("canvas");
      const sprites = new Sprites();
      sprites.cat = () => cat;
      sprites.avatar = () => null;
      let flip = 1;
      const stack: number[] = [];
      let seen: boolean | null = null;
      const ctx = new Proxy(
        {},
        {
          get: (_t, key) => {
            if (key === "save") return () => stack.push(flip);
            if (key === "restore") return () => (flip = stack.pop() ?? 1);
            if (key === "scale") return (x: number) => (flip *= Math.sign(x));
            if (key === "drawImage") return (img: unknown) => img === cat && (seen = flip < 0);
            if (key === "getTransform") return () => ({ a: 1 });
            return () => {};
          },
          set: () => true,
        },
      ) as unknown as CanvasRenderingContext2D;
      draw(ctx, s, sprites, 10_500, { tile: null, visible: false, hover: null, ghost: null }, 0);
      return seen;
    };
    // Along +x: up and to the right on screen, the frames' own way.
    expect(mirrored([{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }]), "walking up-right").toBe(false);
    // Toward the street wall, -y: up and to the left, so mirrored.
    expect(mirrored([{ x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }]), "walking up-left").toBe(true);
    // Toward the viewer along +y: down and to the right, unmirrored; along -x, down-left, mirrored.
    expect(mirrored([{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }]), "walking down-right").toBe(false);
    expect(mirrored([{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }]), "walking down-left").toBe(true);
  });

  it("faces the viewer when nobody has walked yet", () => {
    const asked = framesAsked(fromWelcome(welcome(), 10_000), 10_000);
    expect(asked).toContain("person 0 stand");
    expect(asked).toContain("cat white_grey sit");
  });

  it("naps the same way round whichever way the cat last walked", () => {
    const w = welcome();
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 2, y: 6 }, pose: "walk", walk: { path: [{ x: 2, y: 6 }, { x: 2, y: 5 }], start: 10_000, speed: 1 } };
    const s = fromWelcome(w, 10_000);
    apply(s, { type: "catPosed", cat: "mochi", pose: "nap", at: { x: 2, y: 5 } }, 11_500);
    expect(framesAsked(s, 11_600).filter((f) => f.startsWith("cat white_grey"))).toEqual(["cat white_grey nap"]);
  });
});

// Slice 12: a walker moves by screen pixels. The canvas is the room at its
// on-screen scale, so a sprite placed at a fraction of a room pixel lands on
// a whole screen pixel: its own pixels stay `scale` wide, but it moves
// `scale` times more finely than the room's grid.

describe("placing a walker by screen pixels", () => {
  /** Where `draw` puts person 1's sprite, in canvas (screen) pixels, at each frame of a walk. */
  function placements(scale: number, path: { x: number; y: number }[], speed: number, frames: number) {
    const w = welcome();
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[1], id: 2, at: path[0], walk: { path, start: 10_000, speed } }];
    w.you = 2;
    const s = fromWelcome(w, 10_000);
    const out: { x: number; y: number }[] = [];
    for (let f = 0; f < frames; f++) {
      let t = [1, 0, 0, 1, 0, 0];
      let placed: { x: number; y: number } | null = null;
      const ctx = new Proxy(
        {},
        {
          get: (_t, k) => {
            if (k === "setTransform") return (...m: number[]) => (t = m);
            if (k === "getTransform") return () => ({ a: t[0], d: t[3], e: t[4], f: t[5] });
            if (k === "drawImage") return (_img: unknown, x: number, y: number) => (placed ??= { x: t[0] * x + t[4], y: t[3] * y + t[5] });
            return () => {};
          },
          set: () => true,
        },
      ) as unknown as CanvasRenderingContext2D;
      const sprites = new Sprites();
      sprites.avatar = () => ({}) as HTMLCanvasElement;
      draw(ctx, s, sprites, 10_000 + (f * 1000) / 60, { tile: null, visible: false, hover: null, ghost: null }, 0, scale);
      out.push(placed!);
    }
    return out;
  }
  const diagonal = [{ x: 6, y: 5 }, { x: 6, y: 6 }, { x: 6, y: 7 }];

  for (const scale of [1, 2, 3, 5]) {
    it(`places a walker on whole screen pixels at ${scale}×`, () => {
      for (const p of placements(scale, diagonal, 3, 30)) {
        expect(Number.isInteger(p.x) && Number.isInteger(p.y), `${p.x}, ${p.y}`).toBe(true);
      }
    });
  }

  it("moves a walker evenly at 3×: every frame, by steps that differ by at most a screen pixel", () => {
    const ps = placements(3, diagonal, 3, 36);
    const steps = ps.slice(1).map((p, i) => ({ dx: p.x - ps[i].x, dy: p.y - ps[i].y }));
    for (const s of steps) expect(Math.abs(s.dx) + Math.abs(s.dy), "a frame that doesn't move").toBeGreaterThan(0);
    const xs = steps.map((s) => s.dx);
    const ys = steps.map((s) => s.dy);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
  });
});
