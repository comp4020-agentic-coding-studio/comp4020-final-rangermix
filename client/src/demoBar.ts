// The demo bar (slice 17, ADR 0022): what a demo account moves the café's
// clock on with, lays out a furniture set with (part 2), and adds or
// removes bots with. Only a demo account sees it;
// the server checks every ask, and everyone sees what it did.
import { announce } from "./announce";
import type { ClientMsg } from "./protocol/ClientMsg";
import { type CafeState, serverNow } from "./state";

/** The four times, picked for the cats (the spec, "The demo bar"). */
export const PRESETS: { label: string; minute: number }[] = [
  { label: "Morning", minute: 7 * 60 },
  { label: "Afternoon", minute: 13 * 60 + 30 },
  { label: "Evening", minute: 18 * 60 + 30 },
  { label: "Night", minute: 23 * 60 + 30 },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const CLOCK = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The café's time, as HH:MM in Canberra. */
export function clockText(cafeNow: number): string {
  return CLOCK.format(new Date(cafeNow));
}

/** Minutes past midnight in Canberra at `cafeNow`. */
function minuteNow(cafeNow: number): number {
  const [h, m] = clockText(cafeNow).split(":").map(Number);
  return h * 60 + m;
}

/** How far the café's clock runs ahead of Canberra's. */
export function aheadText(ms: number): string {
  if (ms <= 0) return "on Canberra time";
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))} min ahead`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ahead`;
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const whole = days === 1 ? "a day" : `${days} days`;
  return `${whole}${hours > 0 ? ` and ${hours} h` : ""} ahead`;
}

/** A typed "HH:MM" as minutes past midnight, or null. */
export function minuteOf(text: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** An hour on from the café's time, as minutes past midnight. */
export function hourOn(cafeNow: number): number {
  return (minuteNow(cafeNow) + 60) % (24 * 60);
}

/** How long until the clock can move again, or null when it can. */
export function waitText(nextJump: number, cafeNow: number): string | null {
  if (nextJump <= cafeNow) return null;
  return `Next move in ${Math.ceil((nextJump - cafeNow) / 1000)} s`;
}

/** Said once, when a jump lands: the countdown itself isn't read out every second. */
export function movesAgainAt(nextJump: number): string {
  return `The clock can move on again at ${clockText(nextJump)}.`;
}

export function botsText(n: number): string {
  return n === 0 ? "No bots" : n === 1 ? "1 bot" : `${n} bots`;
}

export interface DemoBarEls {
  bar: HTMLElement;
  time: HTMLElement;
  ahead: HTMLElement;
  wait: HTMLElement;
  toggles: HTMLButtonElement[];
  /** The presets go just before it. */
  hourOn: HTMLButtonElement;
  at: HTMLInputElement;
  go: HTMLButtonElement;
  canberra: HTMLButtonElement;
  /** The furniture sets' buttons go in here, one per set (slice 17, part 2). */
  sets: HTMLElement;
  botCount: HTMLElement;
  addBot: HTMLButtonElement;
  removeBot: HTMLButtonElement;
}

/**
 * Wires the bar to the café. Each control sends one ask; whether it's done
 * is the server's (AGENTS.md), and a refusal says why as any error does.
 */
export class DemoBar {
  private state: CafeState | null = null;
  private waking = false;
  /** The wait last said, so it's announced once (slice 17's review, finding 7). */
  private told: number | null = null;
  private readonly presets: HTMLButtonElement[];
  /** One button per furniture set, by the sets' ids in order, rebuilt only when they change. */
  private setButtons: HTMLButtonElement[] = [];
  private setsKey = "";

  constructor(
    private readonly els: DemoBarEls,
    private readonly send: (msg: ClientMsg) => void,
  ) {
    const jump = (minute: number | null) => {
      this.send({ type: "setClock", minute });
      this.close();
    };
    this.presets = PRESETS.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "demo-preset";
      const hh = String(Math.floor(preset.minute / 60)).padStart(2, "0");
      const mm = String(preset.minute % 60).padStart(2, "0");
      button.textContent = `${preset.label} ${hh}:${mm}`;
      button.onclick = () => jump(preset.minute);
      els.hourOn.before(button);
      return button;
    });
    els.hourOn.onclick = () => this.state && jump(hourOn(serverNow(this.state)));
    els.canberra.onclick = () => jump(null);
    els.go.onclick = () => {
      const minute = minuteOf(els.at.value);
      if (minute === null) {
        els.at.focus();
        return;
      }
      jump(minute);
    };
    els.at.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        els.go.click();
      }
    };
    els.addBot.onclick = () => this.send({ type: "addBot" });
    els.removeBot.onclick = () => this.send({ type: "removeBot" });
    for (const toggle of els.toggles) {
      toggle.onclick = () => this.open(toggle.getAttribute("aria-expanded") === "true" ? null : toggle);
    }
    els.bar.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const open = els.toggles.find((t) => t.getAttribute("aria-expanded") === "true");
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      this.open(null);
      open.focus();
    });
  }

  /** On a phone each group opens below its button, one at a time. */
  private open(toggle: HTMLButtonElement | null): void {
    for (const t of this.els.toggles) {
      const on = t === toggle;
      t.setAttribute("aria-expanded", String(on));
      document.getElementById(t.getAttribute("aria-controls")!)?.classList.toggle("open", on);
    }
  }

  private close(): void {
    this.open(null);
  }

  /** Shows the bar to a demo account only, with the café's time as it is now. */
  update(state: CafeState | null, waking: boolean, localNow = Date.now()): void {
    this.state = state;
    this.waking = waking;
    const show = Boolean(state?.demo) || (waking && !this.els.bar.hidden);
    this.els.bar.hidden = !show;
    document.body.classList.toggle("demo", show);
    if (!state) {
      this.disable(true, null);
      return;
    }
    const now = serverNow(state, localNow);
    this.els.time.textContent = clockText(now);
    this.els.ahead.textContent = aheadText(state.ahead);
    this.showSets(state.layouts);
    const bots = [...state.people.values()].filter((p) => p.bot).length;
    this.els.botCount.textContent = botsText(bots);
    const wait = waitText(state.nextJump, now);
    if (wait !== null && state.demo && this.told !== state.nextJump) {
      this.told = state.nextJump;
      announce(movesAgainAt(state.nextJump));
    }
    this.disable(this.waking, wait, bots === 0);
  }

  /**
   * A button per furniture set, in the welcome's order. Built again only
   * when the sets change, so a button under the keyboard's focus stays.
   */
  private showSets(sets: { id: string; name: string }[]): void {
    const key = sets.map((s) => `${s.id}=${s.name}`).join(";");
    if (key === this.setsKey) return;
    this.setsKey = key;
    this.setButtons = sets.map((set) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "demo-set";
      button.textContent = set.name;
      button.onclick = () => {
        this.send({ type: "layOut", set: set.id });
        this.close();
      };
      return button;
    });
    this.els.sets.replaceChildren(...this.setButtons);
  }

  /**
   * While the café wakes or jumps, nothing; until the clock can move, not
   * the time; with no bots, no removing one. A control disabled under the
   * keyboard's focus hands it to the bar's clock, so the focus is never
   * lost (slice 17's review, finding 7).
   */
  private disable(waking: boolean, wait: string | null, noBots = true): void {
    const timeControls = [...this.presets, this.els.hourOn, this.els.go, this.els.canberra];
    const off = new Set<HTMLElement>();
    for (const b of timeControls) if (waking || wait !== null) off.add(b);
    if (waking) off.add(this.els.at).add(this.els.addBot);
    if (waking) for (const b of this.setButtons) off.add(b);
    if (waking || noBots) off.add(this.els.removeBot);
    if (off.has(document.activeElement as HTMLElement)) this.els.time.focus();
    for (const b of timeControls) b.disabled = off.has(b);
    this.els.at.disabled = off.has(this.els.at);
    this.els.addBot.disabled = off.has(this.els.addBot);
    for (const b of this.setButtons) b.disabled = off.has(b);
    this.els.removeBot.disabled = off.has(this.els.removeBot);
    this.els.wait.textContent = wait ?? "";
    this.els.wait.hidden = wait === null;
  }
}
