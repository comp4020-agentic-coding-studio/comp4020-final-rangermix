import type { Cafe } from "./cafe";
import { canberraHour } from "./canberra";
import { type Layout, panOffset } from "./layout";
import { positionAt } from "./motion";
import { type Pointer, draw } from "./render";
import { TILE, fitScale } from "./scale";
import { Sprites } from "./sprites";
import { serverNow } from "./state";

/** The room on screen: sized to the largest whole-number scale that fits, drawn every frame. */
export class Stage {
  readonly sprites = new Sprites();
  readonly pointer: Pointer = { tile: null, visible: false, hover: null, ghost: null };
  /** Run after each frame is drawn (bubbles follow the people they belong to). */
  readonly frameHooks: (() => void)[] = [];
  scale = 1;
  layout: Layout = "a";
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

  /** CSS pixels, within the stage box, of a point given in tiles. */
  tileToCss(x: number, y: number): { left: number; top: number } {
    return { left: this.canvas.offsetLeft + x * TILE * this.scale, top: this.canvas.offsetTop + y * TILE * this.scale };
  }

  /** The tile under a pointer, or null outside the room. */
  cssToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const room = this.cafe.state?.room;
    if (!room) return null;
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - r.left) / (TILE * this.scale));
    const y = Math.floor((clientY - r.top) / (TILE * this.scale));
    return x >= 0 && y >= 0 && x < room.width && y < room.height ? { x, y } : null;
  }

  /** Switches between the phone's layouts; A everywhere else. */
  setLayout(layout: Layout): void {
    this.layout = layout;
    this.fit();
  }

  fit(): void {
    const room = this.cafe.state?.room;
    const w = room?.width ?? 12;
    const h = room?.height ?? 10;
    if (this.layout === "b") {
      // Layout B: the room at 3x, bigger than the screen, panned to follow you.
      this.scale = 3;
    } else {
      // On a phone the page scrolls, so only the width limits the room.
      const phone = matchMedia("(max-width: 700px)").matches;
      this.scale = fitScale(this.box.clientWidth, phone ? Infinity : this.box.clientHeight, w, h);
      this.canvas.style.left = "";
      this.canvas.style.top = "";
    }
    this.canvas.width = w * TILE;
    this.canvas.height = h * TILE;
    this.canvas.style.width = `${w * TILE * this.scale}px`;
    this.canvas.style.height = `${h * TILE * this.scale}px`;
  }

  private paint(): void {
    const state = this.cafe.state;
    if (!state) return;
    if (this.canvas.width !== state.room.width * TILE) this.fit();
    if (this.layout === "b") this.pan(state);
    const ctx = this.canvas.getContext("2d");
    if (ctx) draw(ctx, state, this.sprites, Date.now(), this.pointer, canberraHour());
  }

  /** Keeps your avatar in the middle of the screen in layout B. */
  private pan(state: NonNullable<Cafe["state"]>): void {
    const me = state.people.get(state.you);
    const spot = me ? positionAt(me.walk, me.at, serverNow(state)) : { x: state.room.width / 2, y: state.room.height / 2 };
    const px = TILE * this.scale;
    const offset = panOffset(
      { x: (spot.x + 0.5) * px, y: (spot.y + 0.5) * px },
      { w: this.box.clientWidth, h: this.box.clientHeight },
      { w: state.room.width * px, h: state.room.height * px },
    );
    this.canvas.style.left = `${-offset.x}px`;
    this.canvas.style.top = `${-offset.y}px`;
  }
}
