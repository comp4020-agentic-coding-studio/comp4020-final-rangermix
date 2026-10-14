#!/usr/bin/env node
// The live view for crit 10 (design.md, "Logging"): reads the server's JSON
// log lines, raw or as flyctl prints them, on stdin and writes each as a
// sentence. `pnpm logs` pipes `flyctl logs` through it. Nothing said in the
// café is ever in a line, so nothing said can show up here.
import { realpathSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

type Line = Record<string, unknown>;

const CLOCK = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** How a cat answered being handled, by the handling and the outcome. */
const ANSWER: Record<string, Record<string, string>> = {
  pet: {
    sniff: "who sniffed their hand",
    welcome: "who purred",
    tolerate: "who put up with it",
    refuse: "who pulled away",
  },
  play: {
    welcome: "who joined in",
    tolerate: "who played a little",
    refuse: "who wasn't in the mood",
  },
  offer: {
    welcome: "who ate it",
    tolerate: "who ate it, after a while",
    refuse: "who didn't want it",
  },
  pick_up: {
    welcome: "who purred in their arms",
    tolerate: "who put up with it",
    refuse: "who wriggled away",
  },
};
const PUSHED: Record<string, string> = { pushed: "who'd had enough (pushing)", scratch: "who scratched them" };

/** What a handling is, before the cat's name. */
const HANDLE: Record<string, string> = {
  pet: "petted",
  play: "played with",
  offer: "offered a treat to",
  pick_up: "picked up",
};

/** What a ban stops, as "{cat} won't {this} {who}". */
const BANNED: Record<string, string> = {
  pet: "be petted by",
  play: "play with",
  offer: "take treats from",
  pick_up: "be picked up by",
};

/** Each action as a verb, for "tried to ..." and "is walking over to ...". */
const VERB: Record<string, string> = {
  call: "call a cat",
  emote: "emote",
  give_treat: "give a treat to",
  login: "log in",
  logout: "log out",
  offer: "offer a treat to",
  pass_cat: "pass a cat to",
  pick_up: "pick up",
  place: "put down",
  play: "play with",
  put_treat: "put a treat down",
  recover: "recover an account",
  say: "say something",
  sit: "sit on",
  signup: "sign up",
  tidy: "stand up",
};

/** Why something carried went back without its carrier putting it back. */
const WENT: Record<string, string> = { dropped: "dropped", left: "left", walked_out: "walked out" };

const EMOTE: Record<string, string> = { wave: "waved", laugh: "laughed", heart: "sent a heart", yawn: "yawned" };

const words = (v: unknown) => String(v).replaceAll("_", " ");

/** "48" hours as "2 days", "4" as "4 hours". */
function hours(h: unknown): string {
  const n = Number(h);
  if (n >= 24 && n % 24 === 0) return n === 24 ? "a day" : `${n / 24} days`;
  return n === 1 ? "an hour" : `${n} hours`;
}

/** What a person did, as words; null for a `what` this doesn't know. */
function action(l: Line): string | null {
  const who = String(l.who ?? "someone");
  const cat = l.cat ? String(l.cat) : "a cat";
  const piece = l.piece ? `the ${words(l.piece)}` : "something";
  const what = String(l.what);
  // The toys aren't stood up but gathered: knocked over, they're scattered (slice 02).
  const gather = what === "tidy" && l.piece === "toys";
  if (l.outcome === "refused" || l.outcome === "walking") {
    const object = l.cat ?? (l.piece ? piece : undefined) ?? l.to;
    const doing = gather ? "gather up the toys" : `${VERB[what] ?? words(what)}${object ? ` ${String(object)}` : ""}`;
    if (l.outcome === "walking") return `${who} is walking over to ${doing}`;
    return `${who} tried to ${doing}, refused${l.code ? `: ${String(l.code)}` : ""}`;
  }
  switch (what) {
    case "signup":
      return `${who} signed up`;
    case "login":
      return `${who} logged in`;
    case "logout":
      return `${who} logged out`;
    case "recover":
      return `${who} recovered their account`;
    case "arrive":
      return l.place === "window" ? `${who} is waiting at the window` : `${who} came in`;
    case "come_in":
      return `${who} came in from the window`;
    case "leave":
      return l.why === "left" || l.why === undefined ? `${who} left` : `${who} left (${String(l.why)})`;
    case "walk":
      return `${who} walked to (${String(l.x)}, ${String(l.y)})`;
    case "say":
      return `${who} said something${l.to ? ` to ${String(l.to)}` : ""} (${String(l.len)} characters)`;
    case "call":
      return `${who} called a cat`;
    case "emote":
      return `${who} ${EMOTE[String(l.emote)] ?? String(l.emote)}`;
    case "pet":
    case "play":
    case "offer":
    case "pick_up": {
      const outcome = String(l.outcome);
      return `${who} ${HANDLE[what]} ${cat}, ${ANSWER[what][outcome] ?? PUSHED[outcome] ?? outcome}`;
    }
    case "banned":
      return `${cat} won't ${BANNED[String(l.action)] ?? words(l.action)} ${who} for ${hours(l.hours)}`;
    case "put_down":
      return `${who} put ${cat} down`;
    case "pass_cat":
      return l.outcome === "taken"
        ? `${who} passed ${cat} to ${String(l.to)}`
        : `${who} tried to pass ${cat} to ${String(l.to)}; ${cat} jumped down`;
    case "put_treat":
      return `${who} put a treat down at (${String(l.x)}, ${String(l.y)})`;
    case "give_treat":
      return `${who} gave ${String(l.to)} a treat`;
    case "tidy":
      if (gather) return l.outcome === "already_up" ? `${who} went to gather up the toys, but someone already had` : `${who} gathered up the toys`;
      return l.outcome === "already_up"
        ? `${who} went to stand ${piece} up, but someone already had`
        : `${who} stood ${piece} back up`;
    case "grab":
      return `${who} picked up ${piece}`;
    case "take":
      return `${who} took ${piece.replace(/^the /, "a ")} from the catalogue`;
    case "place":
      return `${who} put ${piece} down at (${String(l.x)}, ${String(l.y)})`;
    case "put_back": {
      if (l.outcome === "called_off") return `${who} stopped going for ${piece}`;
      const gone = l.outcome === "gone";
      if (!l.why) return `${who} put ${piece} back${gone ? " in the catalogue" : ""}`;
      const as = `as they ${WENT[String(l.why)] ?? words(l.why)}`;
      return `${piece} ${who} carried went back${gone ? " to the catalogue" : ""}, ${as}`;
    }
    case "put_away":
      return `${who} put ${piece} away`;
    case "sit":
      return `${who} sat on ${piece}`;
    case "nudge":
      return `${who} was asked if they're still there`;
    case "walk_out":
      return `${who} walked out after going quiet`;
    default:
      return null;
  }
}

/** Why a cat got down, as what it did. */
const JUMP: Record<string, string> = {
  put_down: "was put down",
  wont_go: "wouldn't be passed on, and jumped down",
  holder_left: "jumped down, with nobody left to hold it",
  had_enough: "had had enough of being held, and jumped down",
  door: "jumped down at the door",
  scratched: "scratched and got down",
  refused: "wriggled down",
  got_up: "hopped off a lap as its person got up",
};

/** What a cat did, as words. */
function cat(l: Line): string {
  const name = String(l.cat ?? "A cat");
  const on = l.on && l.on !== "floor" ? ` the ${words(l.on)}` : "";
  const withWho = l.with ? String(l.with) : "someone";
  switch (l.what) {
    case "nap":
      return on ? `${name} curled up on${on}` : `${name} fell asleep on the floor`;
    case "hide":
      return on ? `${name} hid in${on}` : `${name} hid`;
    case "come_to":
      return `${name} came over to ${withWho}`;
    case "greet":
      return `${name} went to greet ${withWho} at the door`;
    case "eat":
      return l.on === "treat" ? `${name} ate a treat` : `${name} ate from the bowls`;
    case "play":
      return l.with ? `${name} played with ${withWho}` : `${name} played with the toys`;
    case "perch":
      return `${name} perched on${on || " the window seat"} to watch the window`;
    case "investigate":
      return `${name} went to look at${on || " something new"}`;
    case "knock_over":
      return l.on === "toys" ? `${name} scattered the toys` : `${name} knocked over${on || " something"}`;
    case "lap":
      return `${name} curled up on ${withWho}'s lap`;
    case "jump_down":
      return `${name} ${JUMP[String(l.why)] ?? `jumped down (${words(l.why)})`}`;
    default:
      return `${name}: ${words(l.what)}${on ? ` (${on.trim()})` : ""}${l.with ? ` with ${withWho}` : ""}`;
  }
}

/** A length of time in seconds, as "45s", "12m", "8h 2m" or "2 days 4h". */
function duration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3_600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86_400) {
    const m = Math.floor((secs % 3_600) / 60);
    return `${Math.floor(secs / 3_600)}h${m ? ` ${m}m` : ""}`;
  }
  const days = Math.floor(secs / 86_400);
  const h = Math.floor((secs % 86_400) / 3_600);
  return `${days === 1 ? "1 day" : `${days} days`}${h ? ` ${h}h` : ""}`;
}

const TIMES = ["", "once", "twice"];

/**
 * Each cat's walks from a wake-up line: JSON pairs, `[["Burakku",40],…]`, or
 * the "Burakku:40 Mochi:3" the first live deploys wrote.
 */
function walksOf(field: unknown): { name: string; n: number }[] {
  try {
    const pairs = JSON.parse(String(field)) as unknown;
    if (Array.isArray(pairs)) return pairs.map((p) => ({ name: String((p as unknown[])[0]), n: Number((p as unknown[])[1]) }));
  } catch {
    // The older form, below.
  }
  return String(field ?? "")
    .split(" ")
    .map((w) => w.split(":"))
    .filter((w) => w.length === 2)
    .map(([name, n]) => ({ name, n: Number(n) }));
}

/**
 * A wake-up (slice 01): how long the café slept, how long it took to replay
 * the gap, and what the cats and the café's schedule did in it.
 */
function woke(l: Line): string {
  if (l.first) return "The café opened for the first time";
  if (Number(l.steps) === 0) return "The café woke with nothing to catch up on";
  const ms = Number(l.took_ms);
  const took = ms < 1_000 ? `${ms} ms` : `${(ms / 1_000).toFixed(1)} s`;
  let text = `The café woke after ${duration(Number(l.gap_secs))} asleep and caught up in ${took}${l.capped ? " (the last week of it)" : ""}`;
  const walks = walksOf(l.walks);
  const clauses: string[] = [];
  if (walks.some((w) => w.n > 0)) {
    const [first, ...rest] = walks;
    const counts = [`${first.name} walked ${first.n === 1 ? "once" : `${first.n} times`}`, ...rest.map((w) => `${w.name} ${w.n}`)];
    clauses.push(`meanwhile ${counts.length > 1 ? `${counts.slice(0, -1).join(", ")} and ${counts.at(-1)}` : counts[0]}`);
  }
  const refills = Number(l.refills ?? 0);
  if (refills > 0) clauses.push(`the bowls were filled ${TIMES[refills] ?? `${refills} times`}`);
  if (clauses.length > 0) text += `; ${clauses.join(", and ")}`;
  return text;
}

/** What the café itself did. */
function cafe(l: Line): string {
  if (l.what === "bowls_filled") return `The café filled the bowls (${String(l.portions)} portions)`;
  if (l.what === "woke") return woke(l);
  return `${String(l.target ?? "server")}: ${String(l.message ?? l.what ?? "")}`;
}

/** One log line as a sentence, or null for anything that isn't a log line. */
export function narrate(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let l: Line;
  try {
    l = JSON.parse(raw.slice(start)) as Line;
  } catch {
    return null;
  }
  const when = typeof l.timestamp === "string" ? CLOCK.format(new Date(l.timestamp)) : "--:--:--";
  let text: string;
  if (l.level === "ERROR" || l.level === "WARN") {
    text = `${String(l.level)} ${String(l.target)}: ${String(l.message ?? "")}${l.error ? ` (${String(l.error)})` : ""}`;
  } else if (l.target === "action") {
    text = action(l) ?? `${String(l.who ?? "someone")}: ${String(l.what)} (${String(l.outcome ?? "ok")})`;
  } else if (l.target === "cat") {
    text = cat(l);
  } else {
    text = cafe(l);
  }
  return `${when}  ${text}`;
}

// Run as a script: a filter from stdin to stdout. Compared as real paths, so
// a folder with a space in its name or a symlink on the way still runs it.
const main = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === main) {
  const lines = createInterface({ input: process.stdin });
  lines.on("line", (raw) => {
    const said = narrate(raw);
    if (said) console.log(said);
  });
}
