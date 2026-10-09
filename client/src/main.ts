import "./style.css";
import { announce } from "./announce";
import * as api from "./api";
import { showAuth } from "./auth";
import { Bubbles } from "./bubbles";
import { Cafe } from "./cafe";
import { type Target, attachInput } from "./input";
import { closeMenu, openMenu } from "./menu";
import { menuFor } from "./menus";
import { renderHere, renderSaid, renderYourCats } from "./panels";
import { chooseLayout, saveLayout, savedLayout } from "./layout";
import { guessPlace } from "./placing";
import type { ApiMe } from "./protocol/ApiMe";
import type { Emote } from "./protocol/Emote";
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
    onOutdated: () => {
      $("outdated").hidden = false;
      $("refresh").onclick = () => location.reload();
      announce("The café was updated. Refresh to get the new version.");
    },
    onStillThere: () => {
      $("still-there").hidden = false;
      $("im-here").focus();
      announce("Still there? Someone's waiting for a seat.");
    },
    onNudgeOver: () => hideStillThere(),
    onWalkedOut: () => {
      hideStillThere();
      stop();
      showLeft("You'd gone quiet while someone was waiting, so your seat went to them. The cats will remember you.");
    },
  });
  const hideStillThere = () => {
    if ($("still-there").hidden) return;
    $("still-there").hidden = true;
    canvas.focus();
  };
  $("im-here").onclick = () => {
    cafe.here();
    hideStillThere();
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>("#emotes button")) {
    button.onclick = () => cafe.send({ type: "emote", emote: button.dataset.emote as Emote });
  }
  const touched = () => cafe.touched();
  const visibility = () => cafe.send({ type: "presence", hidden: document.hidden });
  document.addEventListener("pointerdown", touched);
  document.addEventListener("keydown", touched);
  document.addEventListener("visibilitychange", visibility);
  const stage = new Stage(cafe, canvas, $("stage"));
  const bubbles = new Bubbles(overlay, stage);
  const talk = new Talk(cafe, $<HTMLFormElement>("talk"), $<HTMLInputElement>("talk-input"), $<HTMLButtonElement>("talk-to"), (why) => {
    toast(overlay, why);
    announce(why);
  });
  stage.frameHooks.push(() => {
    if (cafe.state) bubbles.update(cafe.state);
  });
  const ringLayout = () => document.body.classList.contains("layout-b");
  /** Where a menu goes: beside the tile, or (for a ring) round its middle. */
  const anchor = (tile: { x: number; y: number }) => {
    if (ringLayout()) return stage.tileToCss(tile.x + 0.5, tile.y + 0.5);
    const { left, top } = stage.tileToCss(tile.x + 1, tile.y);
    return { left: left + 4, top };
  };
  // The phone's two layouts: B by choice, remembered on this device.
  const phoneQuery = matchMedia("(max-width: 700px)");
  const applyLayout = () => {
    const layout = chooseLayout(savedLayout(), phoneQuery.matches);
    document.body.classList.toggle("layout-b", layout === "b");
    $("layout-switch").textContent = layout === "b" ? "Whole room" : "Bigger room";
    $("layout-switch").setAttribute("aria-pressed", String(layout === "b"));
    stage.setLayout(layout);
  };
  $("layout-switch").onclick = () => {
    saveLayout(ringLayout() ? "a" : "b");
    applyLayout();
    announce(ringLayout() ? "The room fills the screen and follows you." : "The whole room is on screen.");
  };
  $("drawer-toggle").onclick = () => {
    const open = document.body.classList.toggle("drawer-open");
    $("drawer-toggle").setAttribute("aria-expanded", String(open));
  };
  phoneQuery.addEventListener("change", applyLayout);
  // A ring sits round a tile on screen; once the room moves under it, it's stale.
  stage.panHooks.push(() => {
    if (ringLayout()) closeMenu();
  });
  applyLayout();
  /** What you're carrying, if anything. */
  const carrying = () => (cafe.state ? (cafe.state.held.get(cafe.state.you) ?? null) : null);
  /** While you carry something, any tile you choose is where it goes; the server decides whether it fits. */
  const place = (tile: { x: number; y: number }): boolean => {
    if (!carrying()) return false;
    cafe.send({ type: "place", to: tile });
    return true;
  };
  const act = (targets: Target[], at: { x: number; y: number }) => {
    if (place(at)) return;
    const state = cafe.state;
    if (!state) return;
    const menu = menuFor(state, targets);
    if (!menu) return;
    openMenu(
      overlay,
      anchor(at),
      menu.title,
      menu.note,
      menu.actions.map((a) => ({
        label: a.label,
        run: () => {
          if (a.msg) cafe.send(a.msg);
          if (a.talkTo) {
            talk.address(a.talkTo);
            talk.focus();
          }
        },
      })),
      canvas,
      ringLayout(),
    );
  };
  // The carrying bar, and the preview of where the piece would go.
  let wasCarrying: number | null = null;
  stage.frameHooks.push(() => {
    const state = cafe.state;
    const held = carrying();
    if ((held?.id ?? null) !== wasCarrying) {
      wasCarrying = held?.id ?? null;
      $("carrying").hidden = !held;
      canvas.classList.toggle("placing", !!held);
      if (held) {
        const what = pieceName(held.kind);
        $("carrying-text").textContent = `Carrying the ${what}. Choose where it goes.`;
        // Arrows move on from the piece's old place, not from where you stand;
        // a keyboard user sees the pointer there straight away.
        stage.pointer.tile = { x: held.x, y: held.y };
        if (document.activeElement === canvas) stage.pointer.visible = true;
        announce(`You're carrying the ${what}. Choose where it goes, or press Escape to put it back.`);
      }
    }
    const at = stage.pointer.visible && stage.pointer.tile ? stage.pointer.tile : stage.pointer.hover;
    if (!state || !held || !at) {
      stage.pointer.ghost = null;
      return;
    }
    const people = [...state.people.values()].filter((p) => p.place === "inside" && p.id !== state.you).map((p) => p.at);
    stage.pointer.ghost = { piece: held, at, ok: guessPlace(state.room, held, at, people) };
  });
  $("put-back").onclick = () => {
    cafe.send({ type: "putBack" });
    canvas.focus();
  };
  $("put-away").onclick = () => {
    cafe.send({ type: "putAway" });
    canvas.focus();
  };
  $("add-furniture").onclick = () => {
    const state = cafe.state;
    if (!state) return;
    const box = $("add-furniture").getBoundingClientRect();
    const stageBox = $("stage").getBoundingClientRect();
    openMenu(
      overlay,
      { left: box.left - stageBox.left, top: 0 },
      "Add furniture",
      "It comes in your hands; then choose where it goes.",
      state.room.catalogue.map((k) => ({ label: `A ${pieceName(k.kind)}`, run: () => cafe.send({ type: "take", kind: k.kind }) })),
      $("add-furniture"),
    );
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
      if (carrying()) cafe.send({ type: "putBack" });
    },
  });
  const unsubscribe = cafe.onChange(() => {
    $("status-text").textContent = cafe.statusLine();
    const s = cafe.state;
    if (!s) return;
    renderHere($("here"), s);
    talk.peopleChanged(new Set(s.people.keys()));
    renderSaid($("said"), s);
    renderYourCats($("your-cats"), s);
  });
  function stop(): void {
    detach();
    talk.dispose();
    unsubscribe();
    stage.stop();
    closeMenu();
    document.removeEventListener("pointerdown", touched);
    document.removeEventListener("keydown", touched);
    document.removeEventListener("visibilitychange", visibility);
  }
  function showLeft(text: string): void {
    $("cafe").hidden = true;
    $("left-text").textContent = text;
    $("left-cafe").hidden = false;
    $<HTMLButtonElement>("come-back").focus();
    $("come-back").onclick = () => enter(me);
  }
  $("leave").onclick = () => {
    cafe.leave();
    stop();
    showLeft("You've left the café. The cats will remember you.");
  };
  cafe.start();
  stage.start();
  canvas.focus();
  announce("You're walking into the café.");
}

void start();
