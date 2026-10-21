// The café keeps Canberra time (design.md, "The café"), whoever is looking.

const HOUR = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" });

export function canberraHour(date = new Date()): number {
  return Number(HOUR.format(date)) % 24;
}

/**
 * How far toward night the café's light is: day, the evening's halfway, or
 * night. Its own type, so an hour can't be passed where a light goes
 * (slice 10's review, finding 1).
 */
export type Light = 0 | 0.5 | 1;

/**
 * The café's light by the hour (design.md, "Numbers to tune"): day from 6,
 * through the afternoon; halfway in the evening, from 17; night from 21. The
 * colours blend by it (slice 10).
 */
export function lightAt(hour: number): Light {
  if (hour >= 21 || hour < 6) return 1;
  if (hour >= 17) return 0.5;
  return 0;
}
