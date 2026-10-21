import "./style.css";
import { announce } from "./announce";
import * as api from "./api";
import { type ArmsBar, showArms } from "./arms";
import { showAuth } from "./auth";
import { Bubbles } from "./bubbles";
import { Cafe } from "./cafe";
import { type Target, attachInput } from "./input";
import { closeMenu, isMenuOpen, moveRing, openMenu, ringSlide } from "./menu";
import { catInArms, menuFor } from "./menus";
import { renderChalkboard, renderHere, renderSaid, renderYourCats } from "./panels";
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
      // Out of the way of the nudge, which must be seen (slice 02's review, finding 2).
      hideBoard();
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
  /** A tile's middle on screen: on the floor, or up the street wall for row 0. */
  const middle = (tile: { x: number; y: number }) => (tile.y === 0 ? stage.wallToCss(tile.x + 0.5) : stage.tileToCss(tile.x + 0.5, tile.y + 0.5));
  const anchor = (tile: { x: number; y: number }) => {
    const centre = middle(tile);
    if (ringLayout()) return centre;
    // Beside the tile's diamond: its left and right corners, from its top.
    return { left: centre.left - 16 * stage.scale, top: centre.top - 8 * stage.scale, right: centre.left + 16 * stage.scale };
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
  // A ring sits round a tile: when the room pans under it, it follows the tile.
  let ringTile: { x: number; y: number } | null = null;
  stage.panHooks.push(() => {
    if (ringLayout() && ringTile) moveRing(middle(ringTile));
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
  // The chalkboard, read in a dialog by tapping, clicking or Tab-and-Enter on
  // its tile in the room (slice 02): the only way on a phone, and handy anywhere.
  // It's modal: the café behind is inert while it's open, and a click beside
  // it closes it without acting on the room (slice 02's review, finding 1).
  const board = $("board");
  const backdrop = $("board-backdrop");
  const showBoard = () => {
    closeMenu();
    if (cafe.state) renderChalkboard($("board-lines"), cafe.state);
    $("cafe").inert = true;
    backdrop.hidden = false;
    board.hidden = false;
    $("board-close").focus();
  };
  const hideBoard = () => {
    if (board.hidden) return;
    board.hidden = true;
    backdrop.hidden = true;
    $("cafe").inert = false;
    canvas.focus();
  };
  $("board-close").onclick = hideBoard;
  backdrop.onclick = hideBoard;
  board.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      hideBoard();
    } else if (e.key === "Tab") {
      // A dialog holds the focus until it's closed; Close is all there is to reach.
      e.preventDefault();
      $("board-close").focus();
    }
  });
  const act = (targets: Target[], at: { x: number; y: number }) => {
    if (place(at)) return;
    const state = cafe.state;
    if (!state) return;
    if (targets.some((t) => t.kind === "board")) {
      showBoard();
      return;
    }
    ringTile = at;
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
    // A ring opened by keyboard takes the focus from the room, which would
    // send the view back to you and leave the ring round nothing: the room
    // holds still until it closes.
    stage.holdStill = ringLayout();
    // By the room's edges the view can't centre the tile, and a ring round it
    // would hang off the screen: the room moves over, past its edge if it
    // must, until the ring fits round it.
    if (stage.holdStill) stage.shiftBy(ringSlide(anchor(at)));
  };
  stage.frameHooks.push(() => {
    if (stage.holdStill && !isMenuOpen()) stage.holdStill = false;
  });
  // The carrying bar (a piece, or a cat, in your arms), and the preview of
  // where a piece would go.
  const arms: ArmsBar = {
    carrying: $("carrying"),
    text: $("carrying-text"),
    putBack: $("put-back"),
    putAway: $("put-away"),
    putDown: $("put-cat-down"),
    add: $<HTMLButtonElement>("add-furniture"),
  };
  // Undefined while there's no café to know it from, so the bar is redrawn from
  // the welcome after a wait (slice 07's review, finding 4).
  let wasCarrying: string | null | undefined;
  stage.frameHooks.push(() => {
    const state = cafe.state;
    if (!state) {
      wasCarrying = undefined;
      stage.pointer.ghost = null;
      return;
    }
    const held = carrying();
    const cat = state ? catInArms(state) : null;
    const inArms = held ? `piece ${held.id}` : cat ? `cat ${cat.id}` : null;
    if (inArms !== wasCarrying) {
      wasCarrying = inArms;
      if (state) showArms(arms, state);
      canvas.classList.toggle("placing", !!held);
      if (held) {
        const what = pieceName(held.kind);
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
  $("put-cat-down").onclick = () => {
    cafe.send({ type: "putDown" });
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
      else if (cafe.state && catInArms(cafe.state)) cafe.send({ type: "putDown" });
    },
  });
  const unsubscribe = cafe.onChange(() => {
    $("status-text").textContent = cafe.statusLine();
    $("waking").hidden = !cafe.waking;
    // Nothing to act on while it wakes (slice 07's review, finding 5).
    for (const button of document.querySelectorAll<HTMLButtonElement>("#emotes button")) button.disabled = cafe.waking;
    const s = cafe.state;
    if (!s) {
      // Waking: nothing of the café until its welcome (slice 07), and nothing
      // left over from before it either.
      if (cafe.waking) {
        closeMenu();
        hideBoard();
        $("carrying").hidden = true;
        $<HTMLButtonElement>("add-furniture").disabled = true;
        for (const id of ["here", "your-cats", "chalk-lines", "board-lines"]) {
          $(id).replaceChildren();
          delete $(id).dataset.lines;
        }
      }
      return;
    }
    renderHere($("here"), s);
    talk.peopleChanged(new Set(s.people.keys()));
    renderSaid($("said"), s);
    renderYourCats($("your-cats"), s, () => cafe.send({ type: "putTreat" }));
    renderChalkboard($("chalk-lines"), s);
    if (!board.hidden) renderChalkboard($("board-lines"), s);
  });
  function stop(): void {
    detach();
    talk.dispose();
    unsubscribe();
    stage.stop();
    closeMenu();
    hideBoard();
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
}

void start();
