#!/usr/bin/env node
// The live view for crit 10 (design.md, "Logging"): reads the server's JSON
// log lines, raw or as flyctl prints them, on stdin and writes each as a
// sentence. `pnpm logs` pipes `flyctl logs` through it. Nothing said in the
// café is ever in a line, so nothing said can show up here.
import { createInterface } from "node:readline";

type Line = Record<string, unknown>;

const CLOCK = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const PET: Record<string, string> = {
  sniff: "who sniffed their hand",
  welcome: "who purred",
  tolerate: "who put up with it",
  refuse: "who pulled away",
  pushed: "who'd had enough (pushing)",
  scratch: "who scratched them",
};

const EMOTE: Record<string, string> = { wave: "waved", laugh: "laughed", heart: "sent a heart", yawn: "yawned" };

/** What a person did, as words; null for a `what` this doesn't know. */
function action(l: Line): string | null {
  const who = String(l.who ?? "someone");
  const cat = l.cat ? String(l.cat) : "a cat";
  const piece = l.piece ? `the ${String(l.piece).replaceAll("_", " ")}` : "something";
  if (l.outcome === "refused") return `${who} tried to ${String(l.what).replaceAll("_", " ")}, refused: ${String(l.code)}`;
  if (l.outcome === "walking") return `${who} is walking over to ${String(l.what).replaceAll("_", " ")}`;
  switch (l.what) {
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
      return `${who} petted ${cat}, ${PET[String(l.outcome)] ?? String(l.outcome)}`;
    case "grab":
      return `${who} picked up ${piece}`;
    case "take":
      return `${who} took ${piece.replace(/^the /, "a ")} from the catalogue`;
    case "place":
      return `${who} put ${piece} down at (${String(l.x)}, ${String(l.y)})`;
    case "put_back":
      return `${who} put ${piece} back`;
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

/** What a cat did, as words. */
function cat(l: Line): string {
  const name = String(l.cat ?? "A cat");
  const on = l.on && l.on !== "floor" ? ` the ${String(l.on).replaceAll("_", " ")}` : "";
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
    default:
      return `${name}: ${String(l.what).replaceAll("_", " ")}${on ? ` (${on.trim()})` : ""}${l.with ? ` with ${withWho}` : ""}`;
  }
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
    text = `${String(l.target ?? "server")}: ${String(l.message ?? l.what ?? "")}`;
  }
  return `${when}  ${text}`;
}

// Run as a script: a filter from stdin to stdout.
if (import.meta.url === `file://${process.argv[1]}`) {
  const lines = createInterface({ input: process.stdin });
  lines.on("line", (raw) => {
    const said = narrate(raw);
    if (said) console.log(said);
  });
}
