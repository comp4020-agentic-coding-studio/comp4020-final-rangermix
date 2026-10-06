import { announce } from "./announce";
import type { Cafe } from "./cafe";
import { positionAt } from "./motion";
import type { Stage } from "./stage";
import { type CafeState, pieceName, serverNow } from "./state";

// Point, then act (design.md, "People"): one model for mouse, touch and keys.

type Tile = { x: number; y: number };
export type Target = { kind: "cat"; id: string; tile: Tile } | { kind: "person"; id: number; tile: Tile } | { kind: "piece"; id: number; tile: Tile };

function rounded(state: CafeState, walk: Parameters<typeof positionAt>[0], at: Tile, localNow: number): Tile {
  const p = positionAt(walk, at, serverNow(state, localNow));
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/** Everything you can act on (cats, and other people inside), where each is now. */
function everyone(state: CafeState, localNow: number): Target[] {
  const out: Target[] = [];
  for (const c of state.cats.values()) out.push({ kind: "cat", id: c.id, tile: rounded(state, c.walk, c.at, localNow) });
  for (const p of state.people.values()) {
    if (p.place === "inside" && p.id !== state.you) out.push({ kind: "person", id: p.id, tile: rounded(state, p.walk, p.at, localNow) });
  }
  return out;
}

/** The furniture that can be moved, by its top-left tile. */
function movable(state: CafeState): { target: Target; covers: (t: Tile) => boolean }[] {
  return state.room.furniture
    .filter((f) => f.movable)
    .map((f) => ({
      target: { kind: "piece" as const, id: f.id, tile: { x: f.x, y: f.y } },
      covers: (t: Tile) => t.x >= f.x && t.x < f.x + f.w && t.y >= f.y && t.y < f.y + f.h,
    }));
}

/** What's on a tile: cats first, since they're the point, then people, then furniture. */
export function targetsAt(state: CafeState, tile: Tile, localNow: number): Target[] {
  const living = everyone(state, localNow).filter((t) => t.tile.x === tile.x && t.tile.y === tile.y);
  return [...living, ...movable(state).filter((m) => m.covers(tile)).map((m) => m.target)];
}

/** What Tab steps through: nearest first. */
export function cycleOrder(state: CafeState, from: Tile, localNow: number): Target[] {
  const distance = (t: Target) => Math.abs(t.tile.x - from.x) + Math.abs(t.tile.y - from.y);
  return [...everyone(state, localNow), ...movable(state).map((m) => m.target)].sort((a, b) => distance(a) - distance(b));
}

function nameOf(state: CafeState, t: Target): string {
  if (t.kind === "cat") return state.cats.get(t.id)?.name ?? "a cat";
  if (t.kind === "person") return state.people.get(t.id)?.name ?? "someone";
  const kind = state.room.furniture.find((f) => f.id === t.id)?.kind;
  return kind ? `the ${pieceName(kind)}` : "a piece of furniture";
}

export interface InputHooks {
  act(target: Target, at: Tile): void;
  walk(tile: Tile): void;
  talk(): void;
  close(): void;
}

const MOVES: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

export function attachInput(stage: Stage, cafe: Cafe, hooks: InputHooks): () => void {
  const canvas = stage.canvas;
  const pointer = stage.pointer;
  let cycle: Target[] = [];
  let index = -1;

  const actAt = (tile: Tile) => {
    const state = cafe.state;
    if (!state) return;
    const [target] = targetsAt(state, tile, Date.now());
    if (target) hooks.act(target, tile);
    else hooks.walk(tile);
  };
  const myTile = (): Tile => {
    const s = cafe.state;
    const me = s?.people.get(s.you);
    return s && me ? rounded(s, me.walk, me.at, Date.now()) : { x: 6, y: 5 };
  };

  const onPointer = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const tile = stage.cssToTile(e.clientX, e.clientY);
    if (!tile) return;
    pointer.visible = false;
    actAt(tile);
  };

  const onKey = (e: KeyboardEvent) => {
    const state = cafe.state;
    if (!state) return;
    const move = MOVES[e.key];
    if (move) {
      e.preventDefault();
      // The first arrow shows the pointer where you stand; the next ones move it.
      const from = pointer.visible && pointer.tile ? pointer.tile : myTile();
      const step = pointer.visible ? move : [0, 0];
      pointer.tile = {
        x: Math.max(0, Math.min(state.room.width - 1, from.x + step[0])),
        y: Math.max(1, Math.min(state.room.height - 1, from.y + step[1])),
      };
      pointer.visible = true;
      cycle = [];
      return;
    }
    if (e.key === "Tab" && pointer.visible) {
      e.preventDefault();
      if (cycle.length === 0) {
        cycle = cycleOrder(state, myTile(), Date.now());
        index = -1;
      }
      if (cycle.length === 0) return;
      index = (index + (e.shiftKey ? -1 : 1) + cycle.length) % cycle.length;
      pointer.tile = cycle[index].tile;
      announce(nameOf(state, cycle[index]));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (pointer.visible && pointer.tile) actAt(pointer.tile);
      else hooks.talk();
      return;
    }
    if (e.key === "Escape") {
      // Puts the pointer away, so Tab leaves the room as it would anywhere else.
      pointer.visible = false;
      cycle = [];
      hooks.close();
    }
  };
  const onBlur = () => {
    pointer.visible = false;
  };

  canvas.addEventListener("pointerup", onPointer);
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("blur", onBlur);
  return () => {
    canvas.removeEventListener("pointerup", onPointer);
    canvas.removeEventListener("keydown", onKey);
    canvas.removeEventListener("blur", onBlur);
  };
}
