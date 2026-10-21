import type { Cafe } from "./cafe";
import { canberraHour } from "./canberra";
import { type Layout, panOffset } from "./layout";
import { positionAt } from "./motion";
import { ISO, pickTile, toCanvas } from "./iso";
import { type Pointer, draw, hitAt } from "./render";
import { fitScale } from "./scale";
import { Sprites } from "./sprites";
import { serverNow } from "./state";

/** How tall someone stands, in canvas pixels at 1x: today's 16-px sprites, till slice 11. */
const FIGURE = 16;
/** A face in the window is drawn from 30 to 39 px up the street wall, over a sill at 20 (render.ts). */
const FACE_TOP = 39;
const SILL = 20;

/** The room on screen: sized to the largest whole-number scale that fits, drawn every frame. */
export class Stage {
  readonly sprites = new Sprites();
  readonly pointer: Pointer = { tile: null, visible: false, hover: null, ghost: null };
  /** Run after each frame is drawn (bubbles follow the people they belong to). */
  readonly frameHooks: (() => void)[] = [];
  /** Run when the room is refitted or panned: anything placed over it is stale. */
  readonly panHooks: (() => void)[] = [];
  scale = 1;
  layout: Layout = "a";
  /** Layout B holds still while a ring is open, so the ring stays round its tile. */
  holdStill = false;
  private frame = 0;
  private readonly resize = new ResizeObserver(() => this.fit());

  constructor(
    private readonly cafe: Cafe,
    readonly canvas: HTMLCanvasElement,
    private readonly box: HTMLElement,
  ) {
    this.resize.observe(box);
  }

  start(): void {
    const loop = () => {
      this.paint();
      for (const hook of this.frameHooks) hook();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
  }

  /** CSS pixels, within the stage box, of a point on the floor given in tiles. */
  tileToCss(x: number, y: number): { left: number; top: number } {
    const p = toCanvas(x, y);
    return { left: this.canvas.offsetLeft + p.x * this.scale, top: this.canvas.offsetTop + p.y * this.scale };
  }

  /** CSS pixels, within the stage box, halfway up the street wall over column `x`: where row 0's tiles are. */
  wallToCss(x: number): { left: number; top: number } {
    const p = toCanvas(x, 1);
    return { left: this.canvas.offsetLeft + p.x * this.scale, top: this.canvas.offsetTop + (p.y - ISO.wall / 2) * this.scale };
  }

  /** The room's canvas, within the stage box, in CSS pixels. */
  roomBox(): { left: number; top: number; right: number; bottom: number } {
    const left = this.canvas.offsetLeft;
    const top = this.canvas.offsetTop;
    return { left, top, right: left + ISO.width * this.scale, bottom: top + ISO.height * this.scale };
  }

  /**
   * Where someone standing at `spot` is, in CSS pixels within the stage box:
   * their feet on the tile's centre, raised by `lift` canvas pixels if
   * they're up on a seat, their head a figure's height above.
   */
  figureToCss(spot: { x: number; y: number }, lift = 0): { x: number; head: number; feet: number } {
    const centre = this.tileToCss(spot.x + 0.5, spot.y + 0.5);
    const feet = centre.top - lift * this.scale;
    return { x: centre.left, head: feet - FIGURE * this.scale, feet };
  }

  /**
   * A face peeking in through the window over column `x`, in CSS pixels
   * within the stage box: its top and the window's sill below it, so a
   * bubble goes above the face, or below the window, never over it.
   */
  windowFaceToCss(x: number): { x: number; head: number; feet: number } {
    const foot = this.tileToCss(x + 0.5, 1);
    return { x: foot.left, head: foot.top - FACE_TOP * this.scale, feet: foot.top - SILL * this.scale };
  }

  /** The floor's tile under a pointer (or the street wall's, for row 0), or null outside the room. */
  cssToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const room = this.cafe.state?.room;
    if (!room) return null;
    const r = this.canvas.getBoundingClientRect();
    return pickTile((clientX - r.left) / this.scale, (clientY - r.top) / this.scale, room);
  }

  /**
   * The tile of what's drawn under a pointer: a cat, person, piece or treat
   * where it's drawn, which stands up off its tile at an angle; else the
   * floor's tile under it (slice 09's review, finding 1).
   */
  whatsDrawnAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const state = this.cafe.state;
    if (!state) return null;
    const r = this.canvas.getBoundingClientRect();
    return hitAt(state, (clientX - r.left) / this.scale, (clientY - r.top) / this.scale, Date.now()) ?? this.cssToTile(clientX, clientY);
  }

  /**
   * Moves the room by `by` CSS pixels, past its edges if need be, to whole
   * pixels so it stays crisp: in layout B, so a ring fits round its tile.
   */
  shiftBy(by: { x: number; y: number }): void {
    const dx = Math.round(by.x);
    const dy = Math.round(by.y);
    if (dx === 0 && dy === 0) return;
    this.canvas.style.left = `${(parseFloat(this.canvas.style.left) || 0) + dx}px`;
    this.canvas.style.top = `${(parseFloat(this.canvas.style.top) || 0) + dy}px`;
    for (const hook of this.panHooks) hook();
  }

  /** Switches between the phone's layouts; A everywhere else. */
  setLayout(layout: Layout): void {
    this.layout = layout;
    this.fit();
  }

  fit(): void {
    if (this.layout === "b") {
      // Layout B: the room at 3x, bigger than the screen, panned to follow you.
      this.scale = 3;
    } else {
      // On a phone the page scrolls, so only the width limits the room.
      const phone = matchMedia("(max-width: 700px)").matches;
      this.scale = fitScale(this.box.clientWidth, phone ? Infinity : this.box.clientHeight);
      this.canvas.style.left = "";
      this.canvas.style.top = "";
    }
    this.canvas.width = ISO.width;
    this.canvas.height = ISO.height;
    this.canvas.style.width = `${ISO.width * this.scale}px`;
    this.canvas.style.height = `${ISO.height * this.scale}px`;
    for (const hook of this.panHooks) hook();
  }

  private paint(): void {
    const state = this.cafe.state;
    if (!state) {
      // Waking, or not yet welcomed: no room to show, and no old one either.
      this.canvas.getContext("2d")?.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    if (this.canvas.width !== ISO.width) this.fit();
    if (this.layout === "b") this.pan(state);
    const ctx = this.canvas.getContext("2d");
    if (ctx) draw(ctx, state, this.sprites, Date.now(), this.pointer, canberraHour());
  }

  /**
   * Keeps your avatar in the middle of the screen in layout B, or the
   * keyboard's pointer while it's out, so what Enter acts on is in view.
   */
  private pan(state: NonNullable<Cafe["state"]>): void {
    if (this.holdStill) return;
    const me = state.people.get(state.you);
    const pointer = this.pointer.visible ? this.pointer.tile : null;
    const spot = pointer ?? (me ? positionAt(me.walk, me.at, serverNow(state)) : { x: state.room.width / 2, y: state.room.height / 2 });
    // The chalkboard's row is up the wall: follow the floor just in front of it.
    const at = toCanvas(spot.x + 0.5, Math.max(spot.y, 1) + 0.5);
    const offset = panOffset(
      { x: at.x * this.scale, y: at.y * this.scale },
      { w: this.box.clientWidth, h: this.box.clientHeight },
      { w: ISO.width * this.scale, h: ISO.height * this.scale },
    );
    const left = `${-offset.x}px`;
    const top = `${-offset.y}px`;
    if (left !== this.canvas.style.left || top !== this.canvas.style.top) {
      this.canvas.style.left = left;
      this.canvas.style.top = top;
      for (const hook of this.panHooks) hook();
    }
  }
}
