import type { ChalkLine } from "./protocol/ChalkLine";
import type { CafeState } from "./state";

// The chalkboard (design.md, "The room"; slice 02): the server sends what the
// cats did as fixed fields, and the client puts it into words, in Canberra
// time. People never write on it.

const CLOCK = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit", hour12: true });

const the = (kind: string) => `the ${kind.replaceAll("_", " ")}`;

/** What the cat did, as words: "Burakku knocked over the plant". */
export function chalkWords(line: ChalkLine): string {
  const w = line.what;
  switch (w.kind) {
    case "knockedOver":
      return w.piece === "toys" ? `${line.cat} scattered the toys` : `${line.cat} knocked over ${the(w.piece)}`;
    case "met":
      return `${line.cat} met ${w.with} for the first time`;
    case "greeted":
      return `${line.cat} greeted ${w.with} at the door`;
    case "lap":
      return `${line.cat} slept on ${w.with}'s lap for ${w.minutes} ${w.minutes === 1 ? "minute" : "minutes"}`;
    case "playedWith":
      return `${line.cat} played with ${w.with}`;
    case "played":
      return `${line.cat} played with the toys`;
    case "investigated":
      return `${line.cat} looked over the new ${w.piece.replaceAll("_", " ")}`;
    case "perched":
      return `${line.cat} watched the street from the window seat`;
  }
}

/** When, by Canberra's clock: "3:12am". */
export function chalkTime(at: number): string {
  const parts = CLOCK.formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}${part("dayPeriod").replace(/[\s.]/g, "").toLowerCase()}`;
}

/**
 * The lines to show: the last day's by the server's clock, the latest few,
 * oldest first, by the numbers the server sends (tuning.toml's chalk_hours
 * and chalk_shown).
 */
export function boardLines(state: CafeState, localNow = Date.now()): ChalkLine[] {
  const now = localNow + state.offset;
  return state.chalkboard.filter((l) => now - l.at < state.chalkHours * 3_600_000).slice(-state.chalkShown);
}
