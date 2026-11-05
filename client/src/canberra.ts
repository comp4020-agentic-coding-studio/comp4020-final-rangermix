// The café keeps Canberra time (design.md, "The café"), whoever is looking.

const HOUR = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" });

export function canberraHour(date = new Date()): number {
  return Number(HOUR.format(date)) % 24;
}

/**
 * The café's hour: by the server's clock, which a demo account can move on
 * (slice 17), the device's own only measuring the time since the welcome.
 * Before any welcome, the device's.
 */
export function cafeHour(state: { offset: number } | null, localNow = Date.now()): number {
  return canberraHour(new Date(localNow + (state?.offset ?? 0)));
}

const CLOCK = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** What everyone's page says while the café lives the hours of a jump. */
export function jumpText(by: string, to: number): string {
  return `${by} moved the café on to ${CLOCK.format(new Date(to))}. Time passes…`;
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
