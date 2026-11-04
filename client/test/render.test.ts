import { describe, expect, it } from "vitest";
import type { ServerMsg } from "../src/protocol/ServerMsg";
import heights from "../../content/sprites/heights.json";
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
    const box = palettes.day.furniture[3].toLowerCase();
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
    const cat = { id: "mochi", name: "Mochi", coat: "white_grey", at: { x: 3, y: 6 }, pose: "sit" as const, walk: null, heldBy: null };
    const me = { id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside" as const, at: { x: 8, y: 6 }, walk: null, sitting: false };
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
