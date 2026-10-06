import "./style.css";
import * as api from "./api";
import { showAuth } from "./auth";
import { Cafe } from "./cafe";
import type { ApiMe } from "./protocol/ApiMe";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

async function start(): Promise<void> {
  const me = await api.me();
  if (me.ok) enter(me.value);
  else showAuth(enter);
}

function enter(me: ApiMe): void {
  $("left-cafe").hidden = true;
  $("cafe").hidden = false;
  const cafe = new Cafe(me, {
    onSignedOut: () => {
      $("cafe").hidden = true;
      showAuth(enter);
    },
  });
  cafe.onChange(() => {
    $("status-text").textContent = cafe.statusLine();
  });
  $("leave").onclick = () => {
    cafe.leave();
    $("cafe").hidden = true;
    $("left-cafe").hidden = false;
    $("come-back").onclick = () => enter(me);
  };
  cafe.start();
}

void start();
