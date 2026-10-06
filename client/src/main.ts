import "./style.css";
import { announce } from "./announce";
import * as api from "./api";
import { showAuth } from "./auth";
import { Bubbles } from "./bubbles";
import { Cafe } from "./cafe";
import { type Target, attachInput } from "./input";
import { closeMenu, openMenu } from "./menu";
import { renderHere, renderSaid, renderYourCats } from "./panels";
import type { ApiMe } from "./protocol/ApiMe";
import { pieceName } from "./state";
import { Stage } from "./stage";
import { Talk } from "./talk";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

async function start(): Promise<void> {
  const me = await api.me();
  if (me.ok) enter(me.value);
  else showAuth(enter);
}

/** A short note over the room, for refusals ("Mochi moved away"). */
function toast(overlay: HTMLElement, text: string): void {
  const note = document.createElement("div");
  note.className = "toast";
  note.textContent = text;
  overlay.append(note);
  window.setTimeout(() => note.remove(), 2500);
}

function enter(me: ApiMe): void {
  $("left-cafe").hidden = true;
  $("cafe").hidden = false;
  const canvas = $<HTMLCanvasElement>("room");
  const overlay = $("overlay");
  const cafe = new Cafe(me, {
    onSignedOut: () => {
      stop();
      $("cafe").hidden = true;
      showAuth(enter);
    },
    onError: (e) => toast(overlay, e.detail),
  });
  const stage = new Stage(cafe, canvas, $("stage"));
  const bubbles = new Bubbles(overlay, stage);
  const talk = new Talk(cafe, $<HTMLFormElement>("talk"), $<HTMLInputElement>("talk-input"), $<HTMLButtonElement>("talk-to"));
  stage.frameHooks.push(() => {
    if (cafe.state) bubbles.update(cafe.state);
  });
  const anchor = (tile: { x: number; y: number }) => {
    const { left, top } = stage.tileToCss(tile.x + 1, tile.y);
    return { left: left + 4, top };
  };
  let placing: number | null = null;
  const stopPlacing = () => {
    placing = null;
    canvas.classList.remove("placing");
  };
  /** Puts the piece being placed down at `tile`, if one is; the server decides whether it fits. */
  const place = (tile: { x: number; y: number }): boolean => {
    if (placing === null) return false;
    cafe.send({ type: "moveFurniture", id: placing, to: tile });
    stopPlacing();
    return true;
  };
  const act = (target: Target, at: { x: number; y: number }) => {
    if (place(at)) return;
    const state = cafe.state;
    if (!state) return;
    if (target.kind === "cat") {
      const cat = state.cats.get(target.id);
      if (!cat) return;
      const trust = state.trust.get(cat.id);
      const note = trust ? `${cat.name}'s trust in you: ${trust.value} of 100` : null;
      openMenu(overlay, anchor(at), cat.name, note, [
        { label: `Pet ${cat.name}`, run: () => cafe.send({ type: "pet", cat: cat.id }) },
        { label: `Call ${cat.name}`, run: () => cafe.send({ type: "call", cat: cat.id }) },
      ], canvas);
    } else if (target.kind === "piece") {
      const piece = state.room.furniture.find((f) => f.id === target.id);
      if (!piece) return;
      const what = pieceName(piece.kind);
      openMenu(overlay, anchor(at), what[0].toUpperCase() + what.slice(1), null, [
        {
          label: `Move the ${what}`,
          run: () => {
            // The next spot chosen, by click, tap or Enter, is where it goes.
            placing = piece.id;
            canvas.classList.add("placing");
            // Arrows move on from the piece, not from where you stand.
            stage.pointer.tile = { x: piece.x, y: piece.y };
            stage.pointer.visible = true;
            const hint = `Choose where the ${what} goes. Escape to keep it where it is.`;
            toast(overlay, hint);
            announce(hint);
          },
        },
      ], canvas);
    } else {
      const person = state.people.get(target.id);
      if (!person) return;
      openMenu(overlay, anchor(at), person.name, null, [
        {
          label: `Talk to ${person.name}`,
          run: () => {
            talk.address({ id: person.id, name: person.name });
            talk.focus();
          },
        },
      ], canvas);
    }
  };
  const detach = attachInput(stage, cafe, {
    act,
    walk: (tile) => {
      closeMenu();
      if (place(tile)) return;
      cafe.send({ type: "walkTo", tile });
    },
    talk: () => talk.focus(),
    close: () => {
      closeMenu();
      stopPlacing();
    },
  });
  const unsubscribe = cafe.onChange(() => {
    $("status-text").textContent = cafe.statusLine();
    const s = cafe.state;
    if (!s) return;
    renderHere($("here"), s);
    renderSaid($("said"), s);
    renderYourCats($("your-cats"), s);
  });
  function stop(): void {
    detach();
    unsubscribe();
    stage.stop();
    closeMenu();
  }
  $("leave").onclick = () => {
    cafe.leave();
    stop();
    $("cafe").hidden = true;
    $("left-cafe").hidden = false;
    $<HTMLButtonElement>("come-back").focus();
    $("come-back").onclick = () => enter(me);
  };
  cafe.start();
  stage.start();
  canvas.focus();
  announce("You're walking into the café.");
}

void start();
