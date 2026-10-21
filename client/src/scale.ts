import { ISO } from "./iso";

/** The top-down room's tile, in pixels; the sprites are still drawn at this size until slice 11. */
export const TILE = 16;

/** The largest whole-number scale at which the room's canvas fits, so pixels stay crisp; never below 1. */
export function fitScale(availWidth: number, availHeight: number): number {
  return Math.max(1, Math.floor(Math.min(availWidth / ISO.width, availHeight / ISO.height)));
}
