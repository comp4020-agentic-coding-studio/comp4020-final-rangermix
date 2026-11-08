import * as api from "./api";
import { canberraHour } from "./canberra";
import type { ApiMe } from "./protocol/ApiMe";
import { Sprites } from "./sprites";

// The door (slice 20, ADR 0023): a returning visitor is greeted by name and
// joins the café only at Walk in; after Leave, the same door says hi. Either
// way, "I'm not <name>" signs out, for whoever sits down next.

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/** Arriving with a session, or back at the door after Leave or a walk-out. */
export type DoorMood = { kind: "arrive" } | { kind: "left"; text: string };

export interface DoorWays {
  /** Walk in, or Come back in. */
  enter: () => void;
  /** Signed out by "I'm not <name>": show the way in. */
  signedOut: () => void;
}

/**
 * The hour's greeting, by Canberra's clock: morning from 5, afternoon from
 * 12, evening from 18, and from 22 a question, since "good night" means
 * goodbye.
 */
export function greeting(hour: number, name: string): string {
  if (hour >= 5 && hour < 12) return `Good morning, ${name}.`;
  if (hour >= 12 && hour < 18) return `Good afternoon, ${name}.`;
  if (hour >= 18 && hour < 22) return `Good evening, ${name}.`;
  return `Still up, ${name}?`;
}

let sprites: Sprites | null = null;

/**
 * Shows the door, everything else hidden. Nothing joins the café until
 * Walk in. The hour is the device's Canberra hour: the page hasn't heard
 * the café's clock yet (a demo account's may run ahead).
 */
export function showDoor(me: ApiMe, mood: DoorMood, ways: DoorWays, hour = canberraHour()): void {
  $("auth").hidden = true;
  $("cafe").hidden = true;
  const door = $("door");
  const inButton = $<HTMLButtonElement>("door-in");
  const notMe = $<HTMLButtonElement>("not-me");
  const error = $("door-error");
  drawAvatar($<HTMLCanvasElement>("door-avatar"), me);
  $("door-greeting").textContent = mood.kind === "arrive" ? greeting(hour, me.name) : `Hi, ${me.name}.`;
  $("door-text").textContent = mood.kind === "arrive" ? "The cats are about. Come in when you're ready." : mood.text;
  inButton.textContent = mood.kind === "arrive" ? "Walk in" : "Come back in";
  notMe.textContent = `I'm not ${me.name}`;
  error.textContent = "";
  inButton.disabled = notMe.disabled = false;
  // Assigned, not added, so a door shown again answers each press once.
  inButton.onclick = () => {
    door.hidden = true;
    ways.enter();
  };
  notMe.onclick = async () => {
    inButton.disabled = notMe.disabled = true;
    error.textContent = "";
    const answer = await api.logOut();
    inButton.disabled = notMe.disabled = false;
    if (!answer.ok) {
      // Still signed in: say so, rather than seem to have signed out, the
      // focus back on the button (slice 20's review, finding 9).
      error.textContent = answer.error.detail;
      notMe.focus();
      return;
    }
    door.hidden = true;
    ways.signedOut();
  };
  door.hidden = false;
  inButton.focus();
}

/** The visitor's avatar standing, in their colour, as the look picker draws it. */
function drawAvatar(canvas: HTMLCanvasElement, me: ApiMe): void {
  sprites ??= new Sprites();
  const img = sprites.avatar(me.look, "stand");
  canvas.width = img?.width ?? 32;
  canvas.height = img?.height ?? 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (img) ctx.drawImage(img, 0, 0);
}

// A reload the café makes itself, for a new build (slice 07's update), comes
// from a visitor already inside: it goes straight back in, past the door.
const BACK_INSIDE = "cafe.backInside";

/** Notes, just before the café reloads the tab for a new build, that it was inside. */
export function noteBackInside(): void {
  try {
    sessionStorage.setItem(BACK_INSIDE, "1");
  } catch {
    // Nowhere to note it: the reload meets the door, which is safe.
  }
}

/** Whether this opening is the café's own reload; taking the note, so only once. */
export function backInside(): boolean {
  try {
    const was = sessionStorage.getItem(BACK_INSIDE) === "1";
    sessionStorage.removeItem(BACK_INSIDE);
    return was;
  } catch {
    return false;
  }
}
