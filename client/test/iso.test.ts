import { describe, expect, it } from "vitest";
import { ISO, inDrawOrder, pickTile, toCanvas } from "../src/iso";

// The camera (slice 09, ADR 0017): a 2:1 isometric view of the same 12 by 10
// grid, the floor rows 1 to 9 and the street wall, row 0, up the back right.

const room = { width: 12, height: 10 };

describe("the isometric camera", () => {
  it("is a 336 by 232 canvas, as in the study the look was chosen from", () => {
    expect(ISO.width).toBe(336);
    expect(ISO.height).toBe(232);
  });

  it("puts the floor's four corners where the study did, filling the canvas", () => {
    expect(toCanvas(0, 1)).toEqual({ x: 144, y: 64 });
    expect(toCanvas(12, 1)).toEqual({ x: 336, y: 160 });
    expect(toCanvas(0, 10)).toEqual({ x: 0, y: 136 });
    expect(toCanvas(12, 10)).toEqual({ x: 192, y: 232 });
  });

  it("picks every floor tile from its centre and from just inside each corner of its diamond", () => {
    for (let y = 1; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const c = toCanvas(x + 0.5, y + 0.5);
        expect(pickTile(c.x, c.y, room), `centre of (${x},${y})`).toEqual({ x, y });
        const top = toCanvas(x + 0.05, y + 0.05);
        const right = toCanvas(x + 0.95, y + 0.05);
        const bottom = toCanvas(x + 0.95, y + 0.95);
        const left = toCanvas(x + 0.05, y + 0.95);
        for (const p of [top, right, bottom, left]) expect(pickTile(p.x, p.y, room), `inside (${x},${y})`).toEqual({ x, y });
      }
    }
  });

  it("picks row 0 on the street wall's face, at the column under the point", () => {
    // Halfway up the back-right wall, over each column.
    for (let x = 0; x < room.width; x++) {
      const foot = toCanvas(x + 0.5, 1);
      expect(pickTile(foot.x, foot.y - ISO.wall / 2, room), `wall over column ${x}`).toEqual({ x, y: 0 });
    }
  });

  it("picks nothing off the room, or on the back-left wall", () => {
    expect(pickTile(2, 2, room)).toBeNull();
    expect(pickTile(330, 228, room)).toBeNull();
    // Halfway up the back-left wall, by row 5.
    const foot = toCanvas(0, 5.5);
    expect(pickTile(foot.x - 2, foot.y - ISO.wall / 2, room)).toBeNull();
    // Above the street wall's top.
    const top = toCanvas(6.5, 1);
    expect(pickTile(top.x, top.y - ISO.wall - 4, room)).toBeNull();
  });

  it("draws what's nearer the viewer later, around a long piece too", () => {
    const sofa = { name: "sofa", x: 0, y: 5, w: 3, h: 1 };
    const cats = [
      { name: "behind", x: 1, y: 4, w: 1, h: 1, after: false },
      { name: "behind its far end", x: 2, y: 4, w: 1, h: 1, after: false },
      { name: "in front", x: 1, y: 6, w: 1, h: 1, after: true },
      { name: "beside", x: 3, y: 5, w: 1, h: 1, after: true },
      { name: "behind and beside", x: 3, y: 4, w: 1, h: 1, after: true },
    ];
    for (const cat of cats) {
      // Whichever order they come in.
      for (const items of [
        [sofa, cat],
        [cat, sofa],
      ]) {
        const order = inDrawOrder(items).map((i) => i.name);
        expect(order.indexOf(cat.name) > order.indexOf("sofa"), `the cat ${cat.name} the sofa`).toBe(cat.after);
      }
    }
  });

  it("draws a whole room in an order where nothing nearer comes first", () => {
    // The starting room's footprints and two cats between them.
    const items = [
      { name: "cat_tower", x: 0, y: 1, w: 2, h: 2 },
      { name: "window_seat", x: 2, y: 1, w: 2, h: 1 },
      { name: "table", x: 9, y: 3, w: 2, h: 1 },
      { name: "chair", x: 9, y: 4, w: 1, h: 1 },
      { name: "sofa", x: 0, y: 5, w: 3, h: 1 },
      { name: "cat a", x: 1, y: 4, w: 1, h: 1 },
      { name: "cat b", x: 10, y: 2, w: 1, h: 1 },
      { name: "bowls", x: 10, y: 9, w: 2, h: 1 },
    ];
    const order = inDrawOrder([...items].reverse());
    const behind = (a: (typeof items)[0], b: (typeof items)[0]) => a.x + a.w <= b.x || a.y + a.h <= b.y;
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        expect(behind(order[j], order[i]) && !behind(order[i], order[j]), `${order[j].name} is behind ${order[i].name} but drawn after it`).toBe(false);
      }
    }
  });
});
