import { describe, expect, it } from "vitest";
import type { ServerMsg } from "../src/protocol/ServerMsg";
import heights from "../../content/sprites/heights.json";
import palettes from "../../content/sprites/palettes.json";
import { toCanvas } from "../src/iso";
import { draw, drawOrder, hitAt, personLift } from "../src/render";
import type { Light } from "../src/canberra";
import { Sprites, frameGrid } from "../src/sprites";
import { apply, fromWelcome } from "../src/state";

// What's drawn, in order, in the room at an angle (slice 09): what lies flat
// first, then everything standing, nothing nearer the viewer painted over.

type Welcome = Extract<ServerMsg, { type: "welcome" }>;
const piece = (id: number, kind: string, x: number, y: number, w: number, h: number, under = false) => ({ id, kind, x, y, w, h, movable: true, blocks: !under, under, seats: false, perch: false, toppled: false });

function welcome(): Welcome {
  return {
    type: "welcome",
    you: 1,
    build: "b1",
    now: 10_000,
    cap: 6,
    chalkHours: 24,
    chalkShown: 8,
    demo: false,
    ahead: 0,
    nextJump: 0,
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
        { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside", at: { x: 1, y: 6 }, walk: null, sitting: false, bot: false },
        { id: 2, name: "sam", look: { avatar: 1, colour: 2 }, place: "inside", at: { x: 9, y: 8 }, walk: null, sitting: false, bot: false },
      ],
      cats: [
        { id: "mochi", name: "Mochi", coat: "white_grey", build: "round", at: { x: 2, y: 4 }, pose: "sit", walk: null, heldBy: null },
        { id: "tora", name: "Tora", coat: "orange_tabby", build: "striped", at: { x: 5, y: 5 }, pose: "sit", walk: null, heldBy: null },
        { id: "burakku", name: "Burakku", coat: "black", build: "slim", at: { x: 9, y: 8 }, pose: "sit", walk: null, heldBy: 2 },
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
      w.snapshot.people[0] = { ...w.snapshot.people[0], at, sitting: true, bot: false };
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
    // At (0,1), half-way, it's over the tower's base (4 px) and under its
    // low platform's front-left reach (22 px): up on the part under it
    // (slice 11's review, finding 3), not at the cubby's 44.
    const lift = drawn.find((d) => d.label === "cat mochi")?.lift ?? 0;
    expect(lift).toBeGreaterThan(0);
    expect(lift).toBeLessThan(44);
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
    // The sofa's top face over (2,5), 16 px up, clear of the person at
    // (1,6), who at 32 px tall (slice 11) stands in front of (1,5)'s top.
    const top = toCanvas(2.5, 5.5);
    expect(hitAt(s, top.x, top.y - 16, 10_000)).toEqual({ x: 2, y: 5 });
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
    w.snapshot.people[0] = { ...w.snapshot.people[0], at: { x: 1, y: 5 }, sitting: true, bot: false };
    const s = fromWelcome(w, 10_000);
    // The sofa's seat is 9 px (slice 11's model; its back is 16); someone on it sinks 4 px in.
    expect(personLift(s, s.people.get(1)!, 10_000)).toBe(5);
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
    expect(framesAsked(s, 10_500).filter((f) => f.startsWith("cat white_grey"))[0]).toMatch(/^cat white_grey round:back_walk_[ab]$/);
    apply(s, { type: "catPosed", cat: "mochi", pose: "sit", at: { x: 2, y: 4 } }, 12_500);
    expect(framesAsked(s, 12_600).filter((f) => f.startsWith("cat white_grey"))).toEqual(["cat white_grey round:back_sit"]);
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

  it("faces someone who's just come in into the room, whichever way their walk in turned at the end (slice 12's review, finding 4)", () => {
    for (const path of [
      [{ x: 7, y: 0 }, { x: 7, y: 1 }],
      [{ x: 7, y: 0 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
      [{ x: 7, y: 0 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 }],
      [{ x: 7, y: 0 }, { x: 7, y: 1 }, { x: 6, y: 1 }],
    ]) {
      const w = welcome();
      w.snapshot.people[1] = { ...w.snapshot.people[1], at: path[path.length - 1], walk: { path, start: 10_000, speed: 3 } };
      const asked = framesAsked(fromWelcome(w, 10_000), 15_000).filter((f) => f.startsWith("person 1"));
      expect(asked, `arrived by ${JSON.stringify(path)}`).toEqual(["person 1 stand"]);
    }
    // Walking in, they show the way they go.
    const w = welcome();
    const path = [{ x: 7, y: 0 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 }];
    w.snapshot.people[1] = { ...w.snapshot.people[1], at: path[3], walk: { path, start: 10_000, speed: 1 } };
    expect(framesAsked(fromWelcome(w, 10_000), 11_500).filter((f) => f.startsWith("person 1"))[0]).toMatch(/^person 1 back_walk_[ab]$/);
  });

  it("faces the viewer when nobody has walked yet", () => {
    const asked = framesAsked(fromWelcome(welcome(), 10_000), 10_000);
    expect(asked).toContain("person 0 stand");
    expect(asked).toContain("cat white_grey round:sit");
  });

  it("naps the same way round whichever way the cat last walked", () => {
    const w = welcome();
    w.snapshot.cats[0] = { ...w.snapshot.cats[0], at: { x: 2, y: 6 }, pose: "walk", walk: { path: [{ x: 2, y: 6 }, { x: 2, y: 5 }], start: 10_000, speed: 1 } };
    const s = fromWelcome(w, 10_000);
    apply(s, { type: "catPosed", cat: "mochi", pose: "nap", at: { x: 2, y: 5 } }, 11_500);
    expect(framesAsked(s, 11_600).filter((f) => f.startsWith("cat white_grey"))).toEqual(["cat white_grey round:nap"]);
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

  it("carries a piece over its carrier's head at one place against them, frame by frame, at 3× (slice 12's review, finding 6)", () => {
    const w = welcome();
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[1], id: 2, at: diagonal[0], walk: { path: diagonal, start: 10_000, speed: 3 } }];
    w.snapshot.held = [{ by: 2, piece: piece(9, "box", 0, 0, 1, 1) }];
    w.you = 2;
    const s = fromWelcome(w, 10_000);
    const offsets = new Set<string>();
    for (let f = 0; f < 30; f++) {
      let t = [1, 0, 0, 1, 0, 0];
      let sprite: { x: number; y: number } | null = null;
      let box: { x: number; y: number } | null = null;
      const boxColour = palettes.day.furniture[3].toLowerCase();
      let fill = "";
      const stack: number[][] = [];
      const ctx = new Proxy(
        {},
        {
          get: (_t, k) => {
            if (k === "setTransform") return (...m: number[]) => (t = m);
            if (k === "getTransform") return () => ({ a: t[0], d: t[3], e: t[4], f: t[5] });
            if (k === "save") return () => stack.push([...t]);
            if (k === "restore") return () => (t = stack.pop() ?? t);
            if (k === "translate") return (x: number, y: number) => (t = [t[0], t[1], t[2], t[3], t[4] + t[0] * x, t[5] + t[3] * y]);
            if (k === "drawImage") return (_img: unknown, x: number, y: number) => (sprite ??= { x: t[0] * x + t[4], y: t[3] * y + t[5] });
            // The box's top, in its own colour: the first of its points drawn,
            // as a path (slice 12) or by whole pixels (slice 13).
            if (k === "fillRect" || k === "moveTo") return (x: number, y: number) => fill === boxColour && sprite && (box ??= { x: t[0] * x + t[4], y: t[3] * y + t[5] });
            return () => {};
          },
          set: (_t, k, v) => {
            if (k === "fillStyle") {
              const m = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(String(v));
              fill = m ? `#${m.slice(1).map((c) => Number(c).toString(16).padStart(2, "0")).join("")}` : String(v).toLowerCase();
            }
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      const sprites = new Sprites();
      sprites.avatar = () => ({}) as HTMLCanvasElement;
      draw(ctx, s, sprites, 10_000 + (f * 1000) / 60, { tile: null, visible: false, hover: null, ghost: null }, 0, 3);
      expect(sprite && box, `frame ${f}`).toBeTruthy();
      offsets.add(`${box!.x - sprite!.x},${box!.y - sprite!.y}`);
    }
    expect([...offsets], "the box against its carrier, in screen pixels").toHaveLength(1);
  });

  for (const scale of [1, 2, 3, 5]) {
    it(`places a walker on whole screen pixels at ${scale}×`, () => {
      for (const p of placements(scale, diagonal, 3, 30)) {
        expect(Number.isInteger(p.x) && Number.isInteger(p.y), `${p.x}, ${p.y}`).toBe(true);
      }
    });
  }

  // At 2× and up; at 1× a person covers under a pixel some frames, so some
  // stand still: the limit of whole pixels there (slice 12's review, finding 8).
  for (const [scale, speed, who] of [
    [2, 3, "a person"],
    [3, 3, "a person"],
    [5, 3, "a person"],
    [3, 2, "a cat's pace"],
  ] as const) {
    it(`moves ${who} evenly at ${scale}×: every frame, by steps that differ by at most a screen pixel`, () => {
      const ps = placements(scale, diagonal, speed, 36);
      const steps = ps.slice(1).map((p, i) => ({ dx: p.x - ps[i].x, dy: p.y - ps[i].y }));
      for (const s of steps) expect(Math.abs(s.dx) + Math.abs(s.dy), "a frame that doesn't move").toBeGreaterThan(0);
      const xs = steps.map((s) => s.dx);
      const ys = steps.map((s) => s.dy);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
    });
  }
});

// Slice 13 (ADR 0019): the room is drawn crisp, every pixel one colour.

describe("the room drawn crisp", () => {
  const noPointer = { tile: null, visible: false, hover: null, ghost: null };
  for (const scale of [1, 3]) {
    it(`asks the canvas for no shape it would anti-alias, and fills only whole pixels, at ${scale}×`, async () => {
      const { pixels } = await import("./pixels");
      const p = pixels(336 * scale, 232 * scale);
      const w = welcome();
      w.snapshot.room.furniture = [piece(1, "sofa", 0, 5, 3, 1), piece(2, "rug", 4, 4, 4, 3, true), { ...piece(3, "plant", 6, 9, 1, 1), toppled: true }, piece(4, "toys", 7, 8, 1, 1)];
      // Someone partway along a walk, so sprites stand between whole room
      // pixels (slice 13's review, finding 12), carrying a box over their
      // head (slice 12's review, finding 6).
      w.snapshot.people[0] = { ...w.snapshot.people[0], walk: { path: [{ x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }], start: 10_000 - 137, speed: 3 } };
      w.snapshot.held = [{ by: w.snapshot.people[0].id, piece: piece(9, "box", 0, 0, 1, 1) }];
      const s = fromWelcome(w, 10_000);
      for (const light of [0, 0.5, 1] as Light[]) draw(p.ctx, s, new Sprites(), 10_000, { ...noPointer, visible: true, tile: { x: 3, y: 3 } }, light, scale);
      expect(p.blended).toEqual([]);
    });
  }

  it("fills exactly the pixels whose centres are inside a floor diamond", async () => {
    const { pixels } = await import("./pixels");
    const p = pixels(336, 232);
    const w = welcome();
    w.snapshot.room.furniture = [];
    w.snapshot.cats = [];
    w.snapshot.people = [w.snapshot.people[0]];
    w.snapshot.people[0] = { ...w.snapshot.people[0], place: "window" };
    draw(p.ctx, fromWelcome(w, 10_000), new Sprites(), 10_000, noPointer, 0, 1);
    // Tile (6,5)'s diamond: corners at toCanvas of its four grid corners.
    const c = [toCanvas(6, 5), toCanvas(7, 5), toCanvas(7, 6), toCanvas(6, 6)];
    const insideDiamond = (x: number, y: number) => {
      const cx = (c[0].x + c[2].x) / 2;
      const cy = (c[0].y + c[2].y) / 2;
      return Math.abs(x - cx) / 16 + Math.abs(y - cy) / 8 < 1;
    };
    const floor = new Set([palettes.day.room[0], palettes.day.room[1]].map((v) => v.toLowerCase()));
    let checked = 0;
    for (let y = Math.floor(c[1].y); y <= Math.ceil(c[3].y); y++) {
      for (let x = Math.floor(c[0].x); x <= Math.ceil(c[2].x); x++) {
        if (!insideDiamond(x + 0.5, y + 0.5)) continue;
        // Well inside: away from the seam the floor draws along each tile's far edge.
        const d = Math.abs(x + 0.5 - (c[0].x + c[2].x) / 2) / 16 + Math.abs(y + 0.5 - (c[0].y + c[2].y) / 2) / 8;
        if (d > 0.7) continue;
        expect(floor.has(p.at(x, y) ?? ""), `(${x},${y}) is ${p.at(x, y)}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});

// Slice 13 (ADR 0019): each piece is outlined in its own colour, darkened,
// one room pixel wide round its silhouette, where it meets what's behind.

describe("a piece's self outline", () => {
  it("rims a block's silhouette in its own colour darkened, and leaves its top's middle its own colour", async () => {
    const { pixels } = await import("./pixels");
    const p = pixels(336, 232);
    const w = welcome();
    w.snapshot.room.furniture = [piece(1, "box", 6, 6, 1, 1)];
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    draw(p.ctx, fromWelcome(w, 10_000), new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    // The box's top is its open top (slice 11's model: the last part, darker wood).
    const models = (await import("../../content/sprites/furniture-models.json")).default as Record<string, { slot: number }[]>;
    const box = palettes.day.furniture[models.box.at(-1)!.slot].toLowerCase();
    // The box's top: its footprint's diamond raised 12 px (heights.json), inset 0.15 tiles.
    const centre = toCanvas(6.5, 6.5);
    expect(p.at(Math.round(centre.x), Math.round(centre.y - 12))).toBe(box);
    // Scan up from the top's middle to the first pixel off the box: the one
    // before it is the rim, darker than the box and not the floor.
    let y = Math.round(centre.y - 12);
    while (y > 0 && p.at(Math.round(centre.x), y - 1) !== null && p.at(Math.round(centre.x), y - 1) !== p.at(Math.round(centre.x), y - 30)) {
      if (![box].includes(p.at(Math.round(centre.x), y - 1)!)) break;
      y--;
    }
    const rim = p.at(Math.round(centre.x), y - 1)!;
    const lum = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
    expect(rim, "the rim").not.toBe(box);
    expect(lum(rim), `the rim ${rim} is darker than the box ${box}`).toBeLessThan(lum(box));
    expect([palettes.day.room[0], palettes.day.room[1], palettes.day.room[2]].map((c) => c.toLowerCase())).not.toContain(rim);
  });
});

describe("picking a piece by its outline (slice 13's review, finding 9)", () => {
  it("finds the piece at every pixel drawn in its outline's colour, so a click on its rim isn't a click behind it", async () => {
    const { pixels } = await import("./pixels");
    const w = welcome();
    w.snapshot.room.furniture = [piece(1, "sofa", 4, 5, 3, 1), piece(2, "box", 8, 7, 1, 1), piece(3, "lamp", 2, 3, 1, 1)];
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    const s = fromWelcome(w, 10_000);
    const p = pixels(336, 232);
    draw(p.ctx, s, new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    const shadeOf = (hex: string, k: number) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
      return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v * (1 - k)))).toString(16).padStart(2, "0")).join("")}`;
    };
    for (const f of s.room.furniture) {
      const slot = { sofa: 1, box: 3, lamp: 5 }[f.kind as "sofa" | "box" | "lamp"];
      const rim = shadeOf(palettes.day.furniture[slot], 0.45);
      let rims = 0;
      for (let y = 0; y < 232; y++)
        for (let x = 0; x < 336; x++) {
          if (p.at(x, y) !== rim) continue;
          rims++;
          const hit = hitAt(s, x + 0.5, y + 0.5, 10_000);
          const on = hit && hit.x >= f.x && hit.x < f.x + f.w && hit.y >= f.y && hit.y < f.y + f.h;
          expect(on, `the ${f.kind}'s rim at (${x},${y}) picks ${JSON.stringify(hit)}`).toBe(true);
        }
      expect(rims, `the ${f.kind}'s rim`).toBeGreaterThan(10);
    }
  });
});

describe("a figure's shadow (slice 13's review, finding 5)", () => {
  /** The room at 1× with only `cats` and `people` in it, and the floor layer as it is under them. */
  async function scene(cats: Welcome["snapshot"]["cats"], people: Welcome["snapshot"]["people"]) {
    const { pixels } = await import("./pixels");
    const { floorLayer } = await import("../src/render");
    const w = welcome();
    w.snapshot.room.furniture = [];
    w.snapshot.cats = cats;
    w.snapshot.people = people;
    const s = fromWelcome(w, 10_000);
    const p = pixels(336, 232);
    draw(p.ctx, s, new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    return { p, floor: floorLayer(s.room, 0) };
  }
  const shadeOf = (hex: string, k: number) => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v * (1 - k)))).toString(16).padStart(2, "0")).join("")}`;
  };
  /** How many floor pixels near (gx, gy) are the floor under them darkened as a shadow, not the floor itself. */
  const darkened = (p: { at(x: number, y: number): string | null }, floor: { at(x: number, y: number): string | null }, gx: number, gy: number) => {
    const c = toCanvas(gx + 0.5, gy + 0.5);
    let n = 0;
    for (let y = Math.round(c.y) - 6; y <= Math.round(c.y) + 8; y++)
      for (let x = Math.round(c.x) - 12; x <= Math.round(c.x) + 12; x++) {
        const under = floor.at(x, y);
        if (under && p.at(x, y) === shadeOf(under, 0.2)) n++;
      }
    return n;
  };

  it("casts a small shadow from a cat and a person standing on the open floor, away from the windows", async () => {
    const cat = { id: "mochi", name: "Mochi", coat: "white_grey", build: "round", at: { x: 3, y: 6 }, pose: "sit" as const, walk: null, heldBy: null };
    const me = { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside" as const, at: { x: 8, y: 6 }, walk: null, sitting: false, bot: false };
    const { p, floor } = await scene([cat], [me]);
    expect(darkened(p, floor, 3, 6), "under the cat").toBeGreaterThan(6);
    expect(darkened(p, floor, 8, 6), "under the person").toBeGreaterThan(6);
    // Nobody stands at (5,6): no shadow there.
    expect(darkened(p, floor, 5.5, 6)).toBe(0);
  });
});

describe("a block lit from the windows (slice 13's review, finding 7)", () => {
  it("shades its front face, turned away from the windows, darker than its left face, which they light a little", async () => {
    const { pixels } = await import("./pixels");
    const p = pixels(336, 232);
    const w = welcome();
    w.snapshot.room.furniture = [piece(1, "cat_tower", 6, 5, 1, 1)];
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    draw(p.ctx, fromWelcome(w, 10_000), new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    // Halfway up the tower (44 px), a little in from each face's middle.
    const left = toCanvas(6.06, 5.5);
    const front = toCanvas(6.5, 5.94);
    const lum = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
    const l = p.at(Math.round(left.x) + 2, Math.round(left.y) - 22)!;
    const f = p.at(Math.round(front.x) + 1, Math.round(front.y) - 22)!;
    expect(lum(f), `the front face ${f} against the left ${l}`).toBeLessThan(lum(l));
  });
});

// Slice 13 (ADR 0019): the floor in the windows' shadows and at walls' feet
// is drawn darker, in the hour's colours.

describe("shadows on the floor", () => {
  it("draws the floor behind a tall piece, away from the windows, darker than the open floor of the same board", async () => {
    const { pixels } = await import("./pixels");
    const { shadowMask, SHADE } = await import("../src/shadows");
    const p = pixels(336, 232);
    const w = welcome();
    w.snapshot.room.furniture = [piece(1, "cat_tower", 6, 4, 2, 2)];
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    const s = fromWelcome(w, 10_000);
    draw(p.ctx, s, new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    const mask = shadowMask(s.room, s.room.furniture, heights);
    const floor = new Set([palettes.day.room[0], palettes.day.room[1]].map((c) => c.toLowerCase()));
    let shaded = 0;
    let lit = 0;
    for (let y = 0; y < 232; y++) {
      for (let x = 0; x < 336; x++) {
        const c = p.at(x, y);
        if (!c) continue;
        const m = mask.at(x, y);
        if (m === SHADE.shadow && floor.has(c)) throw new Error(`(${x},${y}) is in shadow but drawn as the open floor, ${c}`);
        if (m === SHADE.shadow) shaded++;
        if (m === SHADE.lit && floor.has(c)) lit++;
      }
    }
    expect(shaded, "pixels in shadow").toBeGreaterThan(100);
    expect(lit, "open floor still drawn in its own colours").toBeGreaterThan(1000);
  });

  /** The room drawn at 1× in the day's light, with `furniture` and nobody about. */
  async function room(furniture: ReturnType<typeof piece>[]) {
    const { pixels } = await import("./pixels");
    const w = welcome();
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    w.snapshot.room.furniture = furniture;
    const s = fromWelcome(w, 10_000);
    const p = pixels(336, 232);
    draw(p.ctx, s, new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    return { p, s };
  }
  const shadeOf = (hex: string, k: number) => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v * (1 - k)))).toString(16).padStart(2, "0")).join("")}`;
  };

  it("darkens what's drawn under a shadow, board, seam or rug, as it's drawn there with no shadow (slice 13's review, findings 2 and 3)", async () => {
    const { shadowMask, SHADE } = await import("../src/shadows");
    const { floorLayer } = await import("../src/render");
    const w = welcome();
    w.snapshot.room.furniture = [piece(1, "rug", 4, 4, 4, 3, true), piece(2, "chair", 5, 4, 1, 1), piece(3, "cat_tower", 9, 3, 2, 2), piece(4, "lamp", 2, 6, 1, 1)];
    const s = fromWelcome(w, 10_000);
    const shaded = floorLayer(s.room, 0);
    const bare = floorLayer(s.room, 0, false);
    const mask = shadowMask(s.room, s.room.furniture, heights);
    const seam = palettes.day.room[2].toLowerCase();
    const rug = palettes.day.furniture[9].toLowerCase();
    let checked = 0;
    const over = { seam: 0, rug: 0 };
    for (let y = 0; y < 232; y++) {
      for (let x = 0; x < 336; x++) {
        const m = mask.at(x, y);
        const under = bare.at(x, y);
        if (!under) continue;
        if (m === SHADE.lit) {
          expect(shaded.at(x, y), `(${x},${y}) is lit`).toBe(under);
          continue;
        }
        expect(shaded.at(x, y), `(${x},${y}) over ${under}`).toBe(shadeOf(under, m === SHADE.shadow ? 0.2 : 0.12));
        if (under === seam) over.seam++;
        if (under === rug) over.rug++;
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
    expect(over.seam, "seam pixels in shade").toBeGreaterThan(20);
    expect(over.rug, "rug pixels in the chair's shadow").toBeGreaterThan(20);
  });

  it("shows the board seams on the lit floor as well as in shade", async () => {
    const { p } = await room([]);
    const seam = palettes.day.room[2].toLowerCase();
    const { fromCanvas } = await import("../src/iso");
    let lit = 0;
    for (let y = 0; y < 232; y++)
      for (let x = 0; x < 336; x++) {
        const { gx, gy } = fromCanvas(x + 0.5, y + 0.5);
        if (gx > 0.5 && gx < 11.5 && gy > 4 && gy < 9.5 && p.at(x, y) === seam) lit++;
      }
    expect(lit, "seam pixels on the open floor, away from the windows' shade").toBeGreaterThan(100);
  });

  it("shades the rug where a piece on it casts its shadow, in the rug's own colour darkened (slice 13's review, finding 2)", async () => {
    const { shadowMask, SHADE } = await import("../src/shadows");
    const rug = piece(1, "rug", 4, 4, 4, 3, true);
    const chair = piece(2, "chair", 5, 4, 1, 1);
    const { p, s } = await room([rug, chair]);
    const mask = shadowMask(s.room, s.room.furniture, heights);
    const rugColour = palettes.day.furniture[9].toLowerCase();
    let shadedRug = 0;
    for (let y = 0; y < 232; y++)
      for (let x = 0; x < 336; x++) {
        if (mask.at(x, y) !== SHADE.shadow) continue;
        if (p.at(x, y) === rugColour) throw new Error(`(${x},${y}) is in the chair's shadow but drawn as the lit rug`);
        if (p.at(x, y) === shadeOf(rugColour, 0.2)) shadedRug++;
      }
    expect(shadedRug, "rug pixels in the chair's shadow").toBeGreaterThan(50);
  });
});

// Slice 13 (ADR 0018): the room stands on its street, the sky and towers
// behind it in the corners its diamond leaves, by day and by night.

describe("the street behind the café", () => {
  async function drawn(light: Light) {
    const { pixels } = await import("./pixels");
    const p = pixels(336, 232);
    const w = welcome();
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    draw(p.ctx, fromWelcome(w, 10_000), new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, light, 1);
    return p;
  }
  const street = (light: "day" | "night") => new Set((palettes[light] as unknown as { street: string[] }).street.map((c) => c.toLowerCase()));

  for (const [light, name] of [
    [0, "day"],
    [1, "night"],
  ] as const) {
    it(`fills the corners round the room with the street's ${name} colours, several of them, not one flat fill`, async () => {
      const p = await drawn(light);
      const colours = street(name);
      // The top-left and top-right corners are sky and towers; the bottom corners the street's foot.
      for (const [x, y] of [
        [4, 4],
        [330, 4],
        [4, 228],
        [330, 228],
      ]) {
        expect(colours.has(p.at(x, y) ?? ""), `(${x},${y}) is ${p.at(x, y)} at ${name}`).toBe(true);
      }
      // Not one flat fill, as the backdrop was: the corners hold several of the street's colours.
      const corners = new Set<string>();
      for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) corners.add(p.at(x, y) ?? "");
      expect([...corners].filter((c) => colours.has(c)).length, `colours in the top-left corner at ${name}`).toBeGreaterThanOrEqual(2);
    });
  }

  it("floats clouds in the day's sky, white with a warm underside, and warms the sky low by the skyline (the user, 2026-11-05)", async () => {
    const p = await drawn(0);
    const day = (palettes.day as unknown as { street: string[] }).street.map((c) => c.toLowerCase());
    const { STREET } = await import("../src/street");
    const seen = new Map<string, number>();
    // The sky above the room: the top band of the canvas, clear of the walls.
    for (let y = 0; y < 232; y++)
      for (let x = 0; x < 336; x++) {
        const c = p.at(x, y);
        if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
      }
    expect(seen.get(day[STREET.cloud]) ?? 0, "cloud pixels by day").toBeGreaterThan(40);
    expect(seen.get(day[STREET.cloudShade]) ?? 0, "a cloud's underside").toBeGreaterThan(10);
    expect(seen.get(day[STREET.glow]) ?? 0, "the warm sky by the skyline").toBeGreaterThan(40);
    // A cloud's colours differ from the sky's: not one more blue.
    expect(new Set([day[STREET.cloud], day[STREET.cloudShade], day[STREET.glow]]).size).toBe(3);
    expect([day[STREET.skyTop], day[STREET.sky]]).not.toContain(day[STREET.cloud]);
  });

  it("keeps the night's sky dark: faint clouds, no warm glow", async () => {
    const p = await drawn(1);
    const night = (palettes.night as unknown as { street: string[] }).street.map((c) => c.toLowerCase());
    const { STREET } = await import("../src/street");
    let glow = 0;
    for (let y = 0; y < 232; y++) for (let x = 0; x < 336; x++) if (p.at(x, y) === night[STREET.glow]) glow++;
    // At night the glow's slot is the sky's own colour, so nothing warm shows.
    expect(night[STREET.glow]).toBe(night[STREET.sky]);
    expect(glow).toBeGreaterThan(0);
  });

  it("draws the street in the evening between its day and its night", async () => {
    const day = street("day");
    const night = street("night");
    const p = await drawn(0.5);
    const c = p.at(4, 4)!;
    expect(day.has(c) || night.has(c), `the evening's sky ${c}`).toBe(false);
  });
});

describe("the room as a diorama", () => {
  it("stands the floor on a slab, seen under its front edges, and tops the walls with a light edge", async () => {
    const { pixels } = await import("./pixels");
    const p = pixels(336, 232);
    const w = welcome();
    w.snapshot.cats = [];
    w.snapshot.room.furniture = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    draw(p.ctx, fromWelcome(w, 10_000), new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    const street = new Set((palettes.day as unknown as { street: string[] }).street.map((c) => c.toLowerCase()));
    const room = new Set(palettes.day.room.map((c) => c.toLowerCase()));
    // Just under the floor's front corner, and under the middle of each front edge: the slab, not street.
    for (const [gx, gy] of [
      [0, 10],
      [6, 10],
      [0, 5.5],
    ]) {
      const c = toCanvas(gx, gy);
      const under = p.at(Math.round(c.x), Math.round(c.y) + 3);
      expect(street.has(under ?? ""), `under (${gx},${gy}) is ${under}, the street`).toBe(false);
      expect(under, `under (${gx},${gy})`).not.toBeNull();
    }
    // The top two rows of each wall are its top edge, lighter than the wall
    // below it; the row above is sky.
    const lum = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
    for (const [gx, gy] of [
      [12, 5.5],
      [6, 1],
    ]) {
      const c = toCanvas(gx, gy);
      const x = Math.round(c.x) - (gx === 12 ? 1 : 0);
      // Down from the sky to the first pixel that isn't street: the wall's top edge.
      let y = Math.round(c.y) - 70;
      while (y < c.y && street.has(p.at(x, y) ?? "")) y++;
      const edge = p.at(x, y)!;
      const wallBelow = p.at(x, y + 6)!;
      expect(room.has(edge), `the top of the wall at (${gx},${gy}) is ${edge}`).toBe(false);
      expect(lum(edge), `the wall's top ${edge} is lighter than the wall ${wallBelow}`).toBeGreaterThan(lum(wallBelow));
    }
  });
});

// Slice 11: each thing a cat does shows its own pose, in its build's frames.
describe("the frame for what a cat is doing (slice 11)", () => {
  type Cat = import("../src/state").Cat;
  /** The frame `catFrame` picks for Mochi in `pose`, standing still at `at`, with `extra` on the cat and `furniture` in the room. */
  async function frameFor(pose: Cat["pose"], opts: { at?: { x: number; y: number }; reaction?: Cat["reaction"]; furniture?: ReturnType<typeof piece>[]; sitter?: boolean; walk?: boolean; now?: number } = {}) {
    const { catFrame } = await import("../src/render");
    const w = welcome();
    const at = opts.at ?? { x: 6, y: 6 };
    w.snapshot.room.furniture = opts.furniture ?? [];
    w.snapshot.people = [{ ...w.snapshot.people[0], at: opts.sitter ? at : { x: 1, y: 6 }, sitting: !!opts.sitter, bot: false }];
    const walk = opts.walk ? { path: [at, { x: at.x + 1, y: at.y }, { x: at.x + 2, y: at.y }], start: 10_000, speed: 1 } : null;
    w.snapshot.cats = [{ id: "mochi", name: "Mochi", coat: "white_grey", build: "round", at, pose, walk, heldBy: null }];
    const s = fromWelcome(w, 10_000);
    const cat = { ...s.cats.get("mochi")!, reaction: opts.reaction ?? null };
    const now = opts.now ?? 10_500;
    const { positionAt } = await import("../src/motion");
    return catFrame(s, cat, positionAt(cat.walk, cat.at, now), now);
  }

  it("names the cat's build in its frame", async () => {
    expect(await frameFor("sit")).toBe("round:sit");
  });

  it("shows sitting for idle, sit and groom; asleep for a nap; eating at the bowls", async () => {
    for (const pose of ["idle", "sit", "groom"] as const) expect(await frameFor(pose), pose).toBe("round:sit");
    expect(await frameFor("nap")).toBe("round:nap");
    expect(await frameFor("eat")).toBe("round:eat");
  });

  it("walks in two steps, and plays in two frames", async () => {
    // Along +x the walk goes up the screen, so it shows the back (slice 12).
    expect(await frameFor("walk", { walk: true })).toMatch(/^round:back_walk_[ab]$/);
    const play = new Set([await frameFor("play", { now: 10_000 }), await frameFor("play", { now: 10_200 }), await frameFor("play", { now: 10_400 })]);
    expect([...play].sort()).toEqual(["round:play_a", "round:play_b"]);
  });

  it("shows held in someone's arms, on a lap where someone sits, and perched up on the window seat", async () => {
    expect(await frameFor("held")).toBe("round:held");
    expect(await frameFor("nap", { sitter: true })).toBe("round:lap");
    // The window seat, flagged for perching as content/furniture.toml has it.
    expect(await frameFor("sit", { at: { x: 3, y: 1 }, furniture: [{ ...piece(1, "window_seat", 2, 1, 4, 1), perch: true }] })).toBe("round:perch");
  });

  it("scratches and greets someone, and plays with someone, for a moment, when the café says so", async () => {
    expect(await frameFor("sit", { reaction: { reaction: { kind: "scratch", by: 2 }, at: 10_400 } })).toBe("round:scratch");
    expect(await frameFor("sit", { reaction: { reaction: { kind: "greet", to: 2 }, at: 10_400 } })).toBe("round:greet");
    expect(await frameFor("sit", { reaction: { reaction: { kind: "play", with: 2 }, at: 10_400 }, now: 10_000 + 400 })).toMatch(/^round:play_[ab]$/);
    // Knocking something over, and eating a treat from a hand (slice 11's review, finding 7).
    expect(await frameFor("idle", { reaction: { reaction: { kind: "knock", piece: 7 }, at: 10_400 } })).toBe("round:knock");
    expect(await frameFor("sit", { reaction: { reaction: { kind: "eat", from: 2 }, at: 10_400 } })).toBe("round:eat");
    // Long after, back to sitting.
    expect(await frameFor("sit", { reaction: { reaction: { kind: "scratch", by: 2 }, at: 1_000 } })).toBe("round:sit");
  });
});

// Slice 11: each piece reads as what it is. A kind's parts are data
// (content/sprites/furniture-models.json): boxes within its footprint, each
// its own colour, so a sofa has a seat, a back and arms, and the window seat
// is a cushion on legs, not a shelf (crit 8's note).
describe("furniture drawn as its parts (slice 11)", () => {
  async function drawnPiece(kind: string, w: number, h: number) {
    const { pixels } = await import("./pixels");
    const p = pixels(336, 232);
    const wl = welcome();
    wl.snapshot.room.furniture = [piece(1, kind, 4, 5, w, h)];
    wl.snapshot.cats = [];
    wl.snapshot.people = [{ ...wl.snapshot.people[0], place: "window" }];
    draw(p.ctx, fromWelcome(wl, 10_000), new Sprites(), 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    return p;
  }
  const shadeOf = (hex: string, k: number) => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v * (1 - k)))).toString(16).padStart(2, "0")).join("")}`;
  };
  /** How many pixels of each of a piece's model's colours (their tops) are drawn. */
  const tops = (p: { colours(): Map<string, number> }, slots: number[]) => slots.map((sl) => p.colours().get(palettes.day.furniture[sl].toLowerCase()) ?? 0);

  it("draws a sofa's seat and its back and arms in their own colours", async () => {
    const models = (await import("../../content/sprites/furniture-models.json")).default as Record<string, { slot: number }[]>;
    expect(models.sofa.length, "the sofa's parts").toBeGreaterThanOrEqual(4);
    const slots = [...new Set(models.sofa.map((m) => m.slot))];
    expect(slots.length, "the sofa in more than one colour").toBeGreaterThanOrEqual(2);
    const p = await drawnPiece("sofa", 3, 1);
    for (const [i, n] of tops(p, slots).entries()) expect(n, `slot ${slots[i]}'s top`).toBeGreaterThan(10);
  });

  it("stands the window seat on legs, so the floor shows under its cushion (crit 8: not a shelf)", async () => {
    const { shadowMask } = await import("../src/shadows");
    const models = (await import("../../content/sprites/furniture-models.json")).default as Record<string, { z0: number }[]>;
    expect(models.window_seat.some((m) => m.z0 > 0), "a part raised off the floor").toBe(true);
    const p = await drawnPiece("window_seat", 2, 1);
    // Under the cushion, between the legs, the floor shows: a pixel of the floor's own colours at the seat's middle, low down.
    const mid = toCanvas(5, 5.5);
    const floor = new Set([...palettes.day.room.slice(0, 3)].flatMap((c) => [c.toLowerCase(), shadeOf(c, 0.2), shadeOf(c, 0.12)]));
    let seen = 0;
    for (let dy = -2; dy <= 1; dy++) for (let dx = -4; dx <= 4; dx++) if (floor.has(p.at(Math.round(mid.x) + dx, Math.round(mid.y) + dy) ?? "")) seen++;
    expect(seen, "floor pixels under the seat").toBeGreaterThan(4);
    void shadowMask;
  });

  it("draws the cushion low and soft, not as a box: a top wider than its sides are tall", async () => {
    const models = (await import("../../content/sprites/furniture-models.json")).default as Record<string, { w: number; h: number; z1: number }[]>;
    const top = Math.max(...models.cushion.map((m) => m.z1));
    expect(top, "the cushion's height in room pixels").toBeLessThanOrEqual(5);
    expect(models.cushion.length, "a cushion and its plumped middle").toBeGreaterThanOrEqual(2);
  });

  it("keeps a piece with no model as one block, and every model inside its footprint", async () => {
    const models = (await import("../../content/sprites/furniture-models.json")).default as Record<string, { x: number; y: number; w: number; h: number; z0: number; z1: number; slot: number }[]>;
    for (const [kind, parts] of Object.entries(models)) {
      for (const m of parts) {
        expect(m.x >= 0 && m.y >= 0 && m.x + m.w <= 1.0001 && m.y + m.h <= 1.0001, `${kind}: a part inside its footprint`).toBe(true);
        expect(m.z1 > m.z0 && m.z0 >= 0, `${kind}: a part with height`).toBe(true);
        expect(palettes.day.furniture[m.slot], `${kind}: slot ${m.slot}`).toBeDefined();
      }
    }
    // The lamp keeps its one block.
    const p = await drawnPiece("lamp", 1, 1);
    expect(p.colours().get(palettes.day.furniture[5].toLowerCase()) ?? 0).toBeGreaterThan(10);
  });
});

describe("a face at the window, at 32 px (slice 11's review, finding 6)", () => {
  it("shows the whole head in the pane, both eyes, not half of it", () => {
    const w = welcome();
    w.snapshot.people = [{ ...w.snapshot.people[0], id: 2, place: "window", at: { x: 7, y: 0 } }];
    w.you = 99;
    w.snapshot.cats = [];
    const s = fromWelcome(w, 10_000);
    // Record which part of the avatar image is cut out for the pane.
    let crop: number[] | null = null;
    const img = document.createElement("canvas");
    img.width = 32;
    img.height = 32;
    const sprites = new Sprites();
    sprites.avatar = () => img;
    sprites.cat = () => null;
    const ctx = new Proxy({}, { get: (_t, k) => (k === "drawImage" ? (i: unknown, ...a: number[]) => i === img && a.length === 8 && (crop = a.slice(0, 4)) : k === "getTransform" ? () => ({ a: 1 }) : () => {}), set: () => true }) as unknown as CanvasRenderingContext2D;
    draw(ctx, s, sprites, 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0);
    expect(crop, "the face is cut from the avatar").not.toBeNull();
    const [sx, sy, sw, sh] = crop!;
    // The head runs across columns 10 to 21 and down rows 1 to 9 of the 32-px sprite.
    expect(sx, "from the head's left").toBeLessThanOrEqual(10);
    expect(sx + sw, "to the head's right").toBeGreaterThanOrEqual(22);
    expect(sy).toBe(0);
    expect(sh, "down past the eyes and chin").toBeGreaterThanOrEqual(10);
  });
});

// Slice 11's review, findings 1 and 2: a click or tap acts on what's drawn
// under it, so a figure is picked on its sprite's own pixels and a piece on
// its parts, not on a box round them.
describe("picking what's drawn, at the bigger sizes", () => {
  it("picks the tile behind someone, not them, where only floor shows past their sprite", () => {
    const w = welcome();
    w.snapshot.room.furniture = [];
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], id: 2, at: { x: 6, y: 5 } }];
    w.you = 99;
    const s = fromWelcome(w, 10_000);
    // Up-right of their head, on the tile (7,5): floor, outside the sprite's pixels.
    const c = toCanvas(7.5, 5.3);
    expect(hitAt(s, c.x, c.y, 10_000), "floor up-right of them").toBeNull();
    // On their shirt: them.
    const me = toCanvas(6.5, 5.5);
    expect(hitAt(s, me.x, me.y - 12, 10_000)).toEqual({ x: 6, y: 5 });
  });

  it("picks a cat perched on the window seat beside the tower, where it shows between the tower's parts", () => {
    const w = welcome();
    w.snapshot.room.furniture = [piece(1, "cat_tower", 0, 1, 2, 2), piece(2, "window_seat", 2, 1, 2, 1)];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    w.snapshot.cats = [{ ...w.snapshot.cats[0], at: { x: 2, y: 1 }, pose: "nap", walk: null, heldBy: null }];
    const s = fromWelcome(w, 10_000);
    // The cat's middle, up on the seat (12 px): the cat.
    const c = toCanvas(2.5, 1.5);
    expect(hitAt(s, c.x, c.y - 12 - 6, 10_000)).toEqual({ x: 2, y: 1 });
  });

  it("picks nothing on bare floor between a table's legs, under its top", () => {
    const w = welcome();
    w.snapshot.room.furniture = [piece(1, "table", 6, 5, 2, 1)];
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    const s = fromWelcome(w, 10_000);
    // The floor point at the table's middle, 2 px up: under the top, between the legs.
    const c = toCanvas(7, 5.5);
    expect(hitAt(s, c.x, c.y - 2, 10_000), "between the legs").toBeNull();
    // Its top, 15 px up: the table.
    const t = toCanvas(7, 5.5);
    expect(hitAt(s, t.x, t.y - 15, 10_000)).not.toBeNull();
  });
});

describe("standing on the part under you (slice 11's review, finding 3)", () => {
  it("lifts a cat by the part of the tower under its tile, not the tower's tallest point", async () => {
    const { pieceParts } = await import("../src/pieces");
    const tower = piece(1, "cat_tower", 8, 5, 2, 2);
    /** The highest part top over the tile's middle, as the test's own reckoning from the model. */
    const under = (x: number, y: number) =>
      Math.max(0, ...pieceParts(tower, heights).filter((p) => x + 0.5 >= p.x && x + 0.5 <= p.x + p.w && y + 0.5 >= p.y && y + 0.5 <= p.y + p.h).map((p) => p.z));
    for (const [x, y] of [[8, 5], [9, 5], [8, 6], [9, 6]]) {
      const w = welcome();
      w.snapshot.room.furniture = [tower];
      w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
      w.snapshot.cats = [{ ...w.snapshot.cats[0], at: { x, y }, pose: "nap", walk: null, heldBy: null }];
      const item = drawOrder(fromWelcome(w, 10_000), 10_000).find((d) => d.label.startsWith("cat"))!;
      expect(item.lift, `a cat on the tower at (${x},${y})`).toBe(under(x, y));
    }
    // And they differ: the tower isn't one height.
    expect(new Set([[8, 5], [9, 5], [8, 6], [9, 6]].map(([x, y]) => under(x, y))).size).toBeGreaterThan(1);
  });

  it("sits someone on the sofa's seat, not up on its back", () => {
    const w = welcome();
    w.snapshot.room.furniture = [piece(1, "sofa", 4, 5, 3, 1)];
    w.snapshot.cats = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], at: { x: 5, y: 5 }, sitting: true, bot: false }];
    const lift = personLift(fromWelcome(w, 10_000), { walk: null, at: { x: 5, y: 5 } }, 10_000);
    // The seat is 9 px; sinking 4 into it.
    expect(lift).toBe(5);
  });
});

describe("what's carried or held, at 32 px (slice 11's review, findings 4 and 11)", () => {
  /** Where the person's sprite and each drawn thing land, as device rectangles, from a recording context. */
  async function scene(extra: (w: Welcome) => void) {
    const { pixels } = await import("./pixels");
    const { frameGrid } = await import("../src/sprites");
    const w = welcome();
    w.snapshot.room.furniture = [];
    w.snapshot.cats = [w.snapshot.cats[0]];
    w.snapshot.people = [{ ...w.snapshot.people[0], id: 2, at: { x: 6, y: 5 } }];
    w.you = 99;
    extra(w);
    const p = pixels(336, 232);
    const images: { img: unknown; x: number; y: number }[] = [];
    const real = p.ctx.drawImage.bind(p.ctx);
    (p.ctx as unknown as { drawImage: (...a: unknown[]) => void }).drawImage = (img: unknown, ...a: unknown[]) => {
      images.push({ img, x: a[0] as number, y: a[1] as number });
      (real as (...b: unknown[]) => void)(img, ...a);
    };
    const avatar = document.createElement("canvas");
    avatar.width = avatar.height = 32;
    const cat = document.createElement("canvas");
    cat.width = cat.height = 24;
    const sprites = new Sprites();
    sprites.avatar = () => avatar;
    sprites.cat = () => cat;
    sprites.emote = () => null;
    draw(p.ctx, fromWelcome(w, 10_000), sprites, 10_000, { tile: null, visible: false, hover: null, ghost: null }, 0, 1);
    const person = images.find((i) => i.img === avatar)!;
    // The person's top drawn row, and their eyes' row, from their frame's grid.
    const grid = frameGrid("avatar", "stand")!;
    const top = person.y + grid.findIndex((row) => row.some((v) => v >= 0));
    const eyes = person.y + grid.findIndex((row, y) => y > 2 && row.some((v, x) => v === 0 && x > 10 && x < 22 && row[x - 1] === 1));
    return { p, person, top, eyes, cat: images.find((i) => i.img === cat) };
  }

  it("carries a piece above its carrier's head, not over it", async () => {
    const { p, top } = await scene((w) => {
      w.snapshot.held = [{ by: 2, piece: piece(9, "chair", 0, 0, 1, 1) }];
    });
    // The carried chair's colours (slot 4 and 12 in its model): its lowest pixel row.
    const chair = new Set([palettes.day.furniture[4], palettes.day.furniture[12]].map((c) => c.toLowerCase()));
    let bottom = -1;
    for (let y = 0; y < 232; y++) for (let x = 0; x < 336; x++) if (chair.has(p.at(x, y) ?? "")) bottom = Math.max(bottom, y);
    expect(bottom, "the chair is drawn").toBeGreaterThan(0);
    expect(bottom, `the chair's bottom (${bottom}) above the head's top (${top})`).toBeLessThan(top);
  });

  it("holds a cat at the chest, below its holder's eyes", async () => {
    const { cat, eyes } = await scene((w) => {
      w.snapshot.cats = [{ ...w.snapshot.cats[0], heldBy: 2, pose: "held" }];
    });
    expect(cat, "the held cat is drawn").toBeDefined();
    // The held frame's top drawn row.
    const { frameGrid } = await import("../src/sprites");
    const grid = frameGrid("cat", "round:held")!;
    const catTop = cat!.y + grid.findIndex((row) => row.some((v) => v >= 0));
    expect(catTop, `the cat's top (${catTop}) below the eyes (${eyes})`).toBeGreaterThan(eyes);
  });

  it("wraps the holder's arms round a held cat, in their own skin, a princess hug (the user, 2026-11-05)", async () => {
    const { p, cat } = await scene((w) => {
      w.snapshot.cats = [{ ...w.snapshot.cats[0], heldBy: 2, pose: "held" }];
    });
    // The holder (scene()'s person 2, with people[0]'s look: avatar 0) has skin palettes.day.avatars.skins[0].
    const skin = palettes.day.avatars.skins[0].toLowerCase();
    // Their forearms cross the cat's box: skin pixels drawn over where the cat is.
    let arms = 0;
    for (let y = Math.round(cat!.y); y < Math.round(cat!.y) + 24; y++) for (let x = Math.round(cat!.x); x < Math.round(cat!.x) + 24; x++) if (p.at(x, y) === skin) arms++;
    expect(arms, "the holder's arms across the cat").toBeGreaterThan(12);
  });
});

describe("a model's parts drawn back to front (slice 11's review, finding 12)", () => {
  it("never lists a part after one it lies wholly behind, among parts at the same heights", async () => {
    const models = (await import("../../content/sprites/furniture-models.json")).default as Record<string, { x: number; y: number; w: number; h: number; z0: number; z1: number }[]>;
    // iso.ts's `behind`: `a` lies wholly behind `b` further along x, or less far along y.
    const behind = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x >= b.x + b.w || a.y + a.h <= b.y;
    for (const [kind, parts] of Object.entries(models)) {
      parts.forEach((later, j) => {
        for (const earlier of parts.slice(0, j)) {
          const sameHeights = later.z0 < earlier.z1 && earlier.z0 < later.z1;
          if (sameHeights) expect(behind(later, earlier) && !behind(earlier, later), `${kind}: part ${j} is listed after a part it lies behind`).toBe(false);
        }
      });
    }
  });
});

describe("the sizes the café draws and picks at (slice 11's review, finding 13)", () => {
  /** Where a figure's image is drawn, in canvas pixels, and its width. */
  function placed(kind: "cat" | "person", mirror: boolean) {
    const w = welcome();
    w.snapshot.room.furniture = [];
    // Walking along -x (mirrored) or +x, half-way, so the facing is set.
    const path = mirror ? [{ x: 7, y: 6 }, { x: 6, y: 6 }, { x: 5, y: 6 }] : [{ x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }];
    if (kind === "cat") {
      w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
      w.snapshot.cats = [{ ...w.snapshot.cats[0], at: path[0], pose: "walk", walk: { path, start: 10_000, speed: 1 }, heldBy: null }];
    } else {
      w.snapshot.cats = [];
      w.snapshot.people = [{ ...w.snapshot.people[0], id: 2, at: path[0], walk: { path, start: 10_000, speed: 1 } }];
      w.you = 99;
    }
    const s = fromWelcome(w, 10_000);
    const img = document.createElement("canvas");
    img.width = img.height = kind === "cat" ? 24 : 32;
    const sprites = new Sprites();
    sprites.cat = () => (kind === "cat" ? img : null);
    sprites.avatar = () => (kind === "person" ? img : null);
    sprites.emote = () => null;
    let m = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    let left = NaN;
    const ctx = new Proxy({}, {
      get: (_t, k) => {
        if (k === "save") return () => stack.push([...m]);
        if (k === "restore") return () => (m = stack.pop() ?? m);
        if (k === "translate") return (x: number, y: number) => (m = [m[0], m[1], m[2], m[3], m[4] + m[0] * x, m[5] + m[3] * y]);
        if (k === "scale") return (x: number, y: number) => (m = [m[0] * x, m[1], m[2], m[3] * y, m[4], m[5]]);
        if (k === "getTransform") return () => ({ a: m[0] < 0 ? -m[0] : m[0] });
        if (k === "drawImage") return (i: unknown, x: number) => { if (i === img) left = Math.min(m[0] * x + m[4], m[0] * (x + img.width) + m[4]); };
        return () => {};
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    draw(ctx, s, sprites, 11_000, { tile: null, visible: false, hover: null, ghost: null }, 0);
    return { left, size: img.width, s };
  }

  it("draws a 24-px cat and a 32-px person centred on their spot, mirrored or not", () => {
    for (const kind of ["cat", "person"] as const) {
      const right = placed(kind, false);
      const left = placed(kind, true);
      // At (6,6) half-way along each walk: the same spot, so the same left edge whichever way it faces.
      const centre = toCanvas(6.5, 6.5).x;
      expect(right.left, `${kind} facing right`).toBeCloseTo(centre - right.size / 2, 0);
      expect(left.left, `${kind} facing left, mirrored, at the same place`).toBeCloseTo(centre - left.size / 2, 0);
    }
  });

  it("picks a 24-px cat out at its sides, beyond where a 16-px cat would have reached", () => {
    const w = welcome();
    w.snapshot.room.furniture = [];
    w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
    w.snapshot.cats = [{ ...w.snapshot.cats[0], at: { x: 6, y: 6 }, pose: "sit", walk: null, heldBy: null }];
    const s = fromWelcome(w, 10_000);
    const c = toCanvas(6.5, 6.5);
    // The sit frame's widest drawn row: a point on it, 10 px out from the middle, picks the cat (a 16-px cat stopped at 8).
    const grid = frameGrid("cat", "round:sit")!;
    let best = { y: 0, xs: [] as number[] };
    grid.forEach((row, y) => { const xs = row.flatMap((v, x) => (v >= 0 ? [x] : [])); if (xs.length > best.xs.length) best = { y, xs }; });
    const top = c.y - 24 + 2;
    const farX = Math.max(...best.xs);
    expect(hitAt(s, c.x - 12 + farX + 0.5, top + best.y + 0.5, 10_000), "the cat's far side").toEqual({ x: 6, y: 6 });
    // Well past it, the floor.
    expect(hitAt(s, c.x - 12 + farX + 3.5, top + best.y + 0.5, 10_000), "past the cat").toBeNull();
  });
});

describe("perched where the content says cats perch (slice 11's review, finding 20)", () => {
  it("draws a cat perched on any piece flagged perch, and sitting on one that isn't", async () => {
    const { catFrame } = await import("../src/render");
    const { positionAt } = await import("../src/motion");
    for (const [kind, flag, want] of [["box", true, "round:perch"], ["window_seat", false, "round:sit"]] as const) {
      const w = welcome();
      w.snapshot.room.furniture = [{ ...piece(1, kind, 4, 4, 1, 1), perch: flag }];
      w.snapshot.people = [{ ...w.snapshot.people[0], place: "window" }];
      w.snapshot.cats = [{ ...w.snapshot.cats[0], at: { x: 4, y: 4 }, pose: "sit", walk: null, heldBy: null }];
      const s = fromWelcome(w, 10_000);
      const cat = { ...s.cats.get("mochi")!, reaction: null };
      expect(catFrame(s, cat, positionAt(null, cat.at, 10_000), 10_000), `a cat on a ${kind} flagged ${flag}`).toBe(want);
    }
  });
});

describe("every kind as its parts, standing and lying down (slice 11's review, finding 9)", () => {
  it("has a model for every kind of furniture", async () => {
    const models = (await import("../../content/sprites/furniture-models.json")).default as Record<string, unknown[]>;
    for (const kind of ["cat_tower", "window_seat", "sofa", "table", "chair", "cat_bed", "box", "plant", "toys", "bowls", "cushion", "scratching_post", "lamp"]) {
      expect(models[kind]?.length ?? 0, `${kind}'s model`).toBeGreaterThanOrEqual(1);
    }
  });

  it("lays a knocked-over plant down as its pot and leaves, long and low toward the viewer, not one bar", async () => {
    const { pieceParts } = await import("../src/pieces");
    const standing = pieceParts(piece(1, "plant", 4, 5, 1, 1), heights);
    const lying = pieceParts({ ...piece(1, "plant", 4, 5, 1, 1), toppled: true }, heights);
    // As many parts lying down as standing, in the same colours.
    expect(lying.map((p) => p.slot)).toEqual(standing.map((p) => p.slot));
    // Low: nothing lying stands taller than the standing plant is wide.
    expect(Math.max(...lying.map((p) => p.z)), "lying low").toBeLessThan(Math.max(...standing.map((p) => p.z)));
    // Long toward the viewer (+y): the parts reach further along y than standing.
    const reach = (ps: typeof lying) => Math.max(...ps.map((p) => p.y + p.h)) - Math.min(...ps.map((p) => p.y));
    expect(reach(lying), "lying along the floor").toBeGreaterThan(reach(standing));
    // Still on its own tile.
    for (const p of lying) expect(p.y >= 5 - 1e-9 && p.y + p.h <= 6 + 1e-9 && p.x >= 4 - 1e-9 && p.x + p.w <= 5 + 1e-9, "inside its tile").toBe(true);
  });
});
