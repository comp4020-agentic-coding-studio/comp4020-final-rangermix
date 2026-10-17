#!/usr/bin/env node
// Checks the app's own output, as CI collects it after the spec has run
// (design.md, "Logging"; plan-phase-3.md, Task 8): every line is one JSON
// object with a time and a target; an action line says who did what (an
// account refusal alone has no name, since a password sometimes lands in the
// name field); a say line has its length; every start ("listening") says
// which clock it's on (slice 08) and is followed by its own wake-up line,
// with numbers, before the next start or the log's end (slices 01 and 07);
// and no line holds anything someone said.
// The words the spec said are given as arguments:
//
//   docker logs app 2>&1 | node scripts/check-logs.ts "hello there" ...
import { createInterface } from "node:readline";

const said = process.argv.slice(2);
const ACCOUNT = new Set(["signup", "login", "logout", "recover"]);
const problems: string[] = [];
let count = 0;
/** A start whose wake-up hasn't been logged yet, by its line number (slices 01 and 07). */
let waking: number | null = null;

function check(raw: string, n: number): void {
  if (raw.trim() === "") return;
  let l: Record<string, unknown>;
  try {
    l = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    problems.push(`line ${n} isn't a JSON line: ${raw.slice(0, 120)}`);
    return;
  }
  count++;
  if (typeof l.timestamp !== "string" || typeof l.target !== "string") problems.push(`line ${n} has no time or target: ${raw}`);
  for (const words of said) {
    if (raw.includes(words)) problems.push(`line ${n} holds something said ("${words}")`);
  }
  // Every start listens at once, replays the gap behind open doors, and then
  // logs its wake-up, with numbers.
  if (l.target === "sys" && l.message === "listening") {
    if (waking !== null) problems.push(`line ${waking} is a start that never logged its wake-up`);
    // Slice 08: "wall", or the instant a test started the clock at.
    if (typeof l.clock !== "string") problems.push(`line ${n} is a start that doesn't say its clock: ${raw}`);
    waking = n;
  }
  // A start stopped while it woke ends there: its last save stands, and the
  // next start replays the same gap (slice 07's review, finding 8).
  if (l.target === "sys" && String(l.message ?? "").startsWith("stopping while the café wakes")) waking = null;
  if (l.target === "cafe" && l.what === "woke") {
    for (const key of ["gap_secs", "steps", "took_ms"]) {
      if (typeof l[key] !== "number") problems.push(`line ${n} is a wake-up without its ${key}: ${raw}`);
    }
    if (waking === null) problems.push(`line ${n} is a wake-up with no start before it: ${raw}`);
    waking = null;
  }
  if (l.target !== "action") return;
  if (typeof l.what !== "string") problems.push(`line ${n} doesn't say what was done: ${raw}`);
  const nameless = ACCOUNT.has(String(l.what)) && l.outcome === "refused";
  if (!nameless && (typeof l.who !== "string" || typeof l.uid !== "number")) problems.push(`line ${n} doesn't say who: ${raw}`);
  if (l.what === "say" && l.outcome !== "refused" && typeof l.len !== "number") problems.push(`line ${n} is a say line without its length: ${raw}`);
}

let n = 0;
const lines = createInterface({ input: process.stdin });
lines.on("line", (raw) => check(raw, ++n));
lines.on("close", () => {
  if (waking !== null) problems.push(`line ${waking} is a start that never logged its wake-up`);
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`${count} log lines checked: each says when, what and who, and none holds anything said.`);
});
