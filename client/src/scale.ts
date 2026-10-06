export const TILE = 16;

/** The largest whole-number scale at which the room fits, so pixels stay crisp; never below 1. */
export function fitScale(availWidth: number, availHeight: number, roomWidth: number, roomHeight: number): number {
  return Math.max(1, Math.floor(Math.min(availWidth / (roomWidth * TILE), availHeight / (roomHeight * TILE))));
}
