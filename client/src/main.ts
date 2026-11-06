import "./style.css";
import { announce } from "./announce";
import * as api from "./api";
import { type ArmsBar, showArms } from "./arms";
import { showAuth } from "./auth";
import { Bubbles } from "./bubbles";
import { Cafe } from "./cafe";
import { DemoBar } from "./demoBar";
import { cafeHour } from "./canberra";
import { type Target, attachInput } from "./input";
import { closeMenu, freeArea, isMenuOpen, moveRing, openMenu, ringSlide } from "./menu";
import { catInArms, menuFor } from "./menus";
import { renderChalkboard, renderHere, renderSaid, renderYourCats, showTreatButton } from "./panels";
import { PHONE, chooseLayout, saveLayout, savedLayout } from "./layout";
import { Floating } from "./floating";
import { Music } from "./musicPanel";
import { guessPlace } from "./placing";
import type { ApiMe } from "./protocol/ApiMe";
import type { Emote } from "./protocol/Emote";
import { pieceName } from "./state";
import { Stage } from "./stage";
import { FLOOR, ISO } from "./iso";
import { Talk } from "./talk";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

async function start(): Promise<void> {
  const me = await api.me();
  if (me.ok) enter(me.value);
  else showAuth(enter);
}

/**
 * A short note over the room, for refusals ("Mochi moved away"), at the
 * foot of the band the floating bars leave clear, so the talk bar never
 * covers it (slice 16's review, finding 3).
 */
function toast(overlay: HTMLElement, text: string): void {
  const note = document.createElement("div");
  note.className = "toast";
  note.textContent = text;
  note.style.bottom = `${Math.max(0, overlay.clientHeight - freeArea(overlay).bottom) + 8}px`;
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
  // The music, this visitor's own (slice 15): nothing of it reaches the
  // café but the presence ping any press sends (touched, above). It isn't
  // the café's, so it stays live while the café wakes, drawn over the
  // dusting cover.
  const music = new Music(
    {
      audio: $<HTMLAudioElement>("music-audio"),
      title: $("music-title"),
      artist: $("music-artist"),
      play: $<HTMLButtonElement>("music-play"),
      previous: $<HTMLButtonElement>("music-previous"),
      next: $<HTMLButtonElement>("music-next"),
      volume: $<HTMLInputElement>("music-volume"),
    },
    // The café's hour picks the set (slice 17): a demo account's jump to
    // the night brings the night's music.
    () => cafeHour(cafe.state),
  );
  const touched = () => cafe.touched();
  // Music remembered on that the browser wouldn't play yet starts at the
  // first press in the café (slice 15): as the finger lifts, since a
  // browser lets a tap start sound only then, or as a key goes down; and
  // at the click a tap ends in, which is what Safari is known to honour
  // (slice 15's review, finding 8). Once it plays, the rest do nothing.
  const pressed = (e: Event) => music.pressed(e.target);
  const visibility = () => cafe.send({ type: "presence", hidden: document.hidden });
  document.addEventListener("pointerdown", touched);
  document.addEventListener("keydown", touched);
  document.addEventListener("pointerup", pressed);
  document.addEventListener("click", pressed);
  document.addEventListener("keydown", pressed);
  document.addEventListener("visibilitychange", visibility);
  const stage = new Stage(cafe, canvas, $("stage"));
  // On a desktop the panels float over the room's corners (slice 14).
  // The floor's corner tiles, in the window: no panel grows over them (slice 16's review, finding 7).
  const corners = () => {
    const room = cafe.state?.room;
    if (!room) return [];
    const box = $("stage").getBoundingClientRect();
    return [
      { x: 0, y: 1 },
      { x: room.width - 1, y: 1 },
      { x: 0, y: room.height - 1 },
      { x: room.width - 1, y: room.height - 1 },
    ].map((t) => {
      const at = stage.tileToCss(t.x + 0.5, t.y + 0.5);
      return { x: box.left + at.left, y: box.top + at.top };
    });
  };
  const floating = new Floating($("stage"), [$("chalkboard"), $("cats-panel"), $("here-panel"), $("music-panel")], corners);
  const bubbles = new Bubbles(overlay, stage);
  const talk = new Talk(cafe, $<HTMLFormElement>("talk"), $<HTMLInputElement>("talk-input"), $<HTMLButtonElement>("talk-to"), (why) => {
    toast(overlay, why);
    announce(why);
  });
  stage.frameHooks.push(() => {
    if (cafe.state) bubbles.update(cafe.state);
  });
  const ringLayout = () => document.body.classList.contains("layout-b");
  /** A tile's middle on screen, within the stage: on the floor, or up the street wall for row 0. */
  const middle = (tile: { x: number; y: number }) => (tile.y === 0 ? stage.wallToCss(tile.x + 0.5) : stage.tileToCss(tile.x + 0.5, tile.y + 0.5));
  // Where a tile is in the window, read-only: the room is seen at an angle, so
  // a fraction of the canvas isn't a tile (slice 09). The browser checks find
  // tiles through it, and it tells nothing the canvas doesn't show.
  (window as unknown as { cafeRoom: unknown }).cafeRoom = Object.freeze({
    /** The room's canvas at 1×, which grows with the floor (slice 16). */
    size: Object.freeze({ width: ISO.width, height: ISO.height }),
    /** The grid: its columns, and its rows with the street wall's row 0 (slice 16's review, finding 9). */
    grid: Object.freeze({ ...FLOOR }),
    tileAt(x: number, y: number): { x: number; y: number } {
      const box = $("stage").getBoundingClientRect();
      const at = middle({ x, y });
      return { x: box.left + at.left, y: box.top + at.top };
    },
  });
  /** Where a menu goes: beside the tile, or (for a ring) round its middle. */
  const anchor = (tile: { x: number; y: number }) => {
    const centre = middle(tile);
    if (ringLayout()) return centre;
    // Beside the tile's diamond: its left and right corners, from its top.
    return { left: centre.left - 16 * stage.scale, top: centre.top - 8 * stage.scale, right: centre.left + 16 * stage.scale };
  };
  // The phone's two layouts: B unless this device chose A, remembered (slice 09).
  const phoneQuery = matchMedia(PHONE);
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
  // Opening the drawer takes the focus to its first control, the music's
  // row at its top, as on screen; Escape inside it closes it and gives the
  // focus back to its toggle (slice 15's review, finding 6). The drawer's
  // panels stand apart in the page, after the bar's own buttons and the
  // talk bar, so Tab alone would reach the music last.
  const drawerPanels = ["music-panel", "here-panel", "cats-panel"];
  $("drawer-toggle").setAttribute("aria-controls", drawerPanels.join(" "));
  const setDrawer = (open: boolean) => {
    document.body.classList.toggle("drawer-open", open);
    $("drawer-toggle").setAttribute("aria-expanded", String(open));
    fitDrawer();
    if (open) {
      const first = drawerPanels.flatMap((id) => [...$(id).querySelectorAll<HTMLElement>("button, input")]).find((el) => el.offsetParent !== null);
      first?.focus();
    }
  };
  $("drawer-toggle").onclick = () => setDrawer(!document.body.classList.contains("drawer-open"));
  const drawerEscape = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !document.body.classList.contains("drawer-open")) return;
    if (!drawerPanels.some((id) => $(id).contains(document.activeElement))) return;
    e.preventDefault();
    setDrawer(false);
    $("drawer-toggle").focus();
  };
  document.addEventListener("keydown", drawerEscape);
  // The drawer stands between the bars, measured, since the status bar
  // wraps to two rows on a narrow phone: the music's row at its top, then
  // who's here and your cats sharing what's left (slice 15).
  const fitDrawer = () => {
    const top = document.querySelector(".status")!.getBoundingClientRect().bottom;
    const talk = document.querySelector(".talk")!.getBoundingClientRect().top;
    const row = $("music-panel").offsetHeight;
    const root = document.documentElement.style;
    root.setProperty("--drawer-top", `${Math.round(top)}px`);
    root.setProperty("--drawer-bottom", `${Math.round(window.innerHeight - talk)}px`);
    root.setProperty("--music-row", `${row}px`);
    root.setProperty("--drawer-space", `${Math.max(80, Math.round(talk - top - row - 32))}px`);
  };
  const drawerWatch = new ResizeObserver(fitDrawer);
  for (const el of [document.querySelector(".status")!, document.querySelector(".talk")!, $("music-panel")]) drawerWatch.observe(el);
  window.addEventListener("resize", fitDrawer);
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
  // Only a press that began on the backdrop closes the board. A tap on the
  // chalkboard opens it as the finger lifts, and the click a phone sends
  // after that tap lands on the backdrop now under the finger; it isn't a
  // click beside the board (seen once the board's tile moved, slice 09).
  let pressedBeside = false;
  backdrop.addEventListener("pointerdown", () => (pressedBeside = true));
  backdrop.onclick = () => {
    if (pressedBeside) hideBoard();
    pressedBeside = false;
  };
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
  // The demo bar (slice 17): a demo account's controls, under the status
  // bar, with the café's time kept up to the second.
  const demoBar = new DemoBar(
    {
      bar: $("demo-bar"),
      time: $("demo-time"),
      ahead: $("demo-ahead"),
      wait: $("demo-wait"),
      toggles: [...document.querySelectorAll<HTMLButtonElement>("#demo-bar .demo-toggle")],
      hourOn: $<HTMLButtonElement>("demo-hour-on"),
      at: $<HTMLInputElement>("demo-at"),
      go: $<HTMLButtonElement>("demo-go"),
      canberra: $<HTMLButtonElement>("demo-canberra"),
      botCount: $("demo-bot-count"),
      addBot: $<HTMLButtonElement>("demo-add-bot"),
      removeBot: $<HTMLButtonElement>("demo-remove-bot"),
    },
    (msg) => cafe.send(msg),
  );
  const placeDemoBar = () => {
    const below = document.querySelector(".status")!.getBoundingClientRect().bottom;
    document.documentElement.style.setProperty("--demo-top", `${Math.round(below + 8)}px`);
  };
  const demoTick = window.setInterval(() => demoBar.update(cafe.state, cafe.waking), 1000);
  window.addEventListener("resize", placeDemoBar);
  const unsubscribe = cafe.onChange(() => {
    $("status-text").textContent = cafe.statusLine();
    demoBar.update(cafe.state, cafe.waking);
    placeDemoBar();
    $("waking").hidden = !cafe.waking;
    $("waking-text").textContent = cafe.wakingText;
    // The panels float over the stage, under the dusting cover while the
    // café wakes: out of Tab's reach too (slice 14's review, finding 8).
    for (const id of ["chalkboard", "cats-panel", "here-panel"]) $(id).inert = cafe.waking;
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
        $("put-treat").hidden = true;
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
    renderYourCats($("your-cats"), s);
    showTreatButton($<HTMLButtonElement>("put-treat"), s, cafe.waking, () => cafe.send({ type: "putTreat" }));
    renderChalkboard($("chalk-lines"), s);
    if (!board.hidden) renderChalkboard($("board-lines"), s);
    floating.changed();
  });
  function stop(): void {
    // Leaving, being signed out or walked out: the music stops (slice 15).
    music.dispose();
    drawerWatch.disconnect();
    window.removeEventListener("resize", fitDrawer);
    window.removeEventListener("resize", placeDemoBar);
    window.clearInterval(demoTick);
    demoBar.update(null, false);
    floating.dispose();
    detach();
    talk.dispose();
    unsubscribe();
    stage.stop();
    closeMenu();
    hideBoard();
    document.removeEventListener("pointerdown", touched);
    document.removeEventListener("keydown", touched);
    document.removeEventListener("pointerup", pressed);
    document.removeEventListener("click", pressed);
    document.removeEventListener("keydown", pressed);
    document.removeEventListener("keydown", drawerEscape);
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
  // Remembered on, it plays as the café opens, or at the first press if
  // the browser won't let it yet (slice 15).
  music.enter();
}

void start();
