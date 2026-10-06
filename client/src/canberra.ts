// The café keeps Canberra time (design.md, "The café"), whoever is looking.

const HOUR = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" });

export function canberraHour(date = new Date()): number {
  return Number(HOUR.format(date)) % 24;
}

export interface Tint {
  colour: string;
  alpha: number;
}

/** The light by the hour (design.md, "Numbers to tune"): morning from 6, afternoon from 12, evening from 17, night from 21. */
export function nightTint(hour: number): Tint | null {
  if (hour >= 21 || hour < 6) return { colour: "#0b1030", alpha: 0.38 };
  if (hour >= 17) return { colour: "#1d2350", alpha: 0.16 };
  if (hour >= 12) return { colour: "#ffb347", alpha: 0.06 };
  return null;
}
