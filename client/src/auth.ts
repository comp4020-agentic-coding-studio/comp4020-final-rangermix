import * as api from "./api";
import type { ApiMe } from "./protocol/ApiMe";
import { AVATARS, COLOURS, Sprites, shirtColour } from "./sprites";

// The way in (ADR 0007), one form for everyone since slice 20 (ADR 0023): a
// name and a password, Walk in to log in, I'm new to sign up, which asks
// whether the name is free and then for a look. Recovery with the code shown
// once at sign-up, as before.

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const COLOUR_NAMES = ["Red", "Orange", "Green", "Sky blue", "Purple", "Pink"];
const STEPS = ["way-in", "look-step", "recover", "code"] as const;
type Step = (typeof STEPS)[number];

/**
 * Shows the way in, at its first step, empty: for a first visit, a session
 * the server ended, or someone who said they're not the last person. Wired
 * afresh each time by assignment, so each press is answered once, by this
 * showing's `enter`.
 */
export function showAuth(enter: (me: ApiMe) => void): void {
  const error = $("auth-error");
  const wayIn = $<HTMLFormElement>("way-in");
  const look = $<HTMLFormElement>("look-step");
  const recover = $<HTMLFormElement>("recover");
  const name = $<HTMLInputElement>("way-in-name");
  const password = $<HTMLInputElement>("way-in-password");
  const show = (step: Step, focus?: HTMLElement | null) => {
    for (const id of STEPS) $(id).hidden = id !== step;
    error.textContent = "";
    focus?.focus();
  };
  const busy = (form: HTMLElement, on: boolean) => form.querySelectorAll("button").forEach((b) => (b.disabled = on));
  const done = (me: ApiMe) => {
    if (me.recoveryCode) showCode(me.recoveryCode, () => finish(me));
    else finish(me);
  };
  const finish = (me: ApiMe) => {
    $("auth").hidden = true;
    enter(me);
  };

  wayIn.reset();
  recover.reset();
  buildLookPicker();
  $("door").hidden = true;
  $("auth").hidden = false;
  show("way-in", name);

  wayIn.onsubmit = async (event) => {
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter ?? document.activeElement;
    const isNew = submitter === $("im-new");
    if (isNew && (password.value.length < 8 || password.value.length > 128)) {
      error.textContent = "A password is 8 to 128 characters.";
      password.focus();
      return;
    }
    busy(wayIn, true);
    error.textContent = "";
    if (isNew) {
      const answer = await api.checkName({ name: name.value });
      busy(wayIn, false);
      if (!answer.ok) {
        error.textContent = answer.error.detail;
        name.focus();
        return;
      }
      $("look-heading").textContent = `Choose your look, ${name.value}`;
      show("look-step", look.querySelector<HTMLInputElement>("input[name=avatar]:checked"));
      return;
    }
    const answer = await api.logIn({ name: name.value, password: password.value });
    busy(wayIn, false);
    if (!answer.ok) {
      error.textContent = answer.error.error === "badLogin" ? `${answer.error.detail} New here? Press I'm new.` : answer.error.detail;
      return;
    }
    done(answer.value);
  };

  look.onsubmit = async (event) => {
    event.preventDefault();
    const chosen = (field: string) => Number(look.querySelector<HTMLInputElement>(`input[name=${field}]:checked`)?.value ?? 0);
    busy(look, true);
    error.textContent = "";
    const answer = await api.signUp({ name: name.value, password: password.value, look: { avatar: chosen("avatar"), colour: chosen("colour") } });
    busy(look, false);
    if (!answer.ok) {
      // A name taken while they chose a look, or one refused after all:
      // back to the name, to say why. Anything else is said here.
      if (answer.error.error === "nameTaken" || answer.error.error === "badInput") {
        show("way-in", name);
      }
      error.textContent = answer.error.detail;
      return;
    }
    done(answer.value);
  };
  $("look-back").onclick = () => show("way-in", $("im-new"));

  $("show-recover").onclick = () => {
    recover.querySelector<HTMLInputElement>("input[name=name]")!.value = name.value;
    show("recover", recover.querySelector<HTMLInputElement>(name.value ? "input[name=code]" : "input[name=name]"));
  };
  $("hide-recover").onclick = () => show("way-in", $("show-recover"));
  recover.onsubmit = async (event) => {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(recover)) as Record<string, string>;
    busy(recover, true);
    error.textContent = "";
    const answer = await api.recover({ name: f.name, code: f.code, password: f.password });
    busy(recover, false);
    if (!answer.ok) {
      error.textContent = answer.error.detail;
      return;
    }
    done(answer.value);
  };
}

function showCode(code: string, then: () => void): void {
  for (const id of STEPS) $(id).hidden = id !== "code";
  $("auth-error").textContent = "";
  $("code-text").textContent = code;
  const copy = $<HTMLButtonElement>("copy-code");
  copy.textContent = "Copy";
  copy.onclick = async () => {
    await navigator.clipboard?.writeText(code).catch(() => undefined);
    copy.textContent = "Copied";
  };
  const doneButton = $<HTMLButtonElement>("code-done");
  doneButton.onclick = () => {
    $("code").hidden = true;
    then();
  };
  doneButton.focus();
}

let sprites: Sprites | null = null;

/** Four avatars, previewed in the chosen colour, and six colours: native radio groups, so arrow keys work. */
function buildLookPicker(): void {
  const picker = $("look-picker");
  sprites ??= new Sprites();
  const avatarRow = document.createElement("div");
  const colourRow = document.createElement("div");
  avatarRow.className = colourRow.className = "look-row";
  const previews: HTMLCanvasElement[] = [];
  const radio = (name: string, value: number, label: string) => {
    const input = Object.assign(document.createElement("input"), { type: "radio", name, value: String(value), checked: value === 0 });
    input.setAttribute("aria-label", label);
    return input;
  };
  for (let a = 0; a < AVATARS; a++) {
    // As big as the avatar's sprite (32 since slice 11); CSS shows it at 48 px.
    const size = sprites.avatar({ avatar: a, colour: 0 }, "stand")?.width ?? 32;
    const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
    previews.push(canvas);
    const label = document.createElement("label");
    label.append(radio("avatar", a, `Look ${a + 1}`), canvas);
    avatarRow.append(label);
  }
  for (let c = 0; c < COLOURS; c++) {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = shirtColour(c);
    const input = radio("colour", c, COLOUR_NAMES[c] ?? `Colour ${c + 1}`);
    input.addEventListener("change", draw);
    const label = document.createElement("label");
    label.append(input, swatch);
    colourRow.append(label);
  }
  picker.replaceChildren(avatarRow, colourRow);
  function draw(): void {
    const chosen = picker.querySelector<HTMLInputElement>("input[name=colour]:checked");
    const colour = Number(chosen?.value ?? 0);
    previews.forEach((canvas, avatar) => {
      const ctx = canvas.getContext("2d");
      const img = sprites?.avatar({ avatar, colour }, "stand");
      if (ctx && img) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
    });
  }
  draw();
}
