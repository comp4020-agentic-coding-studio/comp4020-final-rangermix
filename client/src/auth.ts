import * as api from "./api";
import type { ApiMe } from "./protocol/ApiMe";
import { AVATARS, COLOURS, Sprites, shirtColour } from "./sprites";

// The way in (ADR 0007): sign up with a name, a password and a look, log in,
// or recover with the code shown once at sign-up.

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const COLOUR_NAMES = ["Red", "Orange", "Green", "Sky blue", "Purple", "Pink"];
let wired = false;
let enterCafe: (me: ApiMe) => void = () => {};

export function showAuth(enter: (me: ApiMe) => void): void {
  enterCafe = enter;
  $("auth").hidden = false;
  if (wired) return;
  wired = true;
  const error = $("auth-error");
  const forms = { signup: $<HTMLFormElement>("signup"), login: $<HTMLFormElement>("login"), recover: $<HTMLFormElement>("recover") };
  const show = (which: keyof typeof forms) => {
    for (const [name, form] of Object.entries(forms)) form.hidden = name !== which;
    $("code").hidden = true;
    $("tab-signup").setAttribute("aria-selected", String(which === "signup"));
    $("tab-login").setAttribute("aria-selected", String(which !== "signup"));
    error.textContent = "";
    forms[which].querySelector("input")?.focus();
  };
  $("tab-signup").onclick = () => show("signup");
  $("tab-login").onclick = () => show("login");
  $("show-recover").onclick = () => show("recover");
  $("hide-recover").onclick = () => show("login");
  buildLookPicker();

  const fields = (form: HTMLFormElement) => Object.fromEntries(new FormData(form)) as Record<string, string>;
  const submit = (form: HTMLFormElement, send: (f: Record<string, string>) => Promise<api.Answer<ApiMe>>) => {
    form.onsubmit = async (event) => {
      event.preventDefault();
      const buttons = form.querySelectorAll("button");
      buttons.forEach((b) => (b.disabled = true));
      error.textContent = "";
      const answer = await send(fields(form));
      buttons.forEach((b) => (b.disabled = false));
      if (!answer.ok) {
        error.textContent = answer.error.detail;
        return;
      }
      const me = answer.value;
      if (me.recoveryCode) showCode(me.recoveryCode, () => done(me));
      else done(me);
    };
  };
  submit(forms.signup, (f) =>
    api.signUp({ name: f.name, password: f.password, look: { avatar: Number(f.avatar ?? 0), colour: Number(f.colour ?? 0) } }),
  );
  submit(forms.login, (f) => api.logIn({ name: f.name, password: f.password }));
  submit(forms.recover, (f) => api.recover({ name: f.name, code: f.code, password: f.password }));
}

function done(me: ApiMe): void {
  $("auth").hidden = true;
  enterCafe(me);
}

function showCode(code: string, then: () => void): void {
  for (const id of ["signup", "login", "recover"]) $(id).hidden = true;
  $("code").hidden = false;
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

/** Four avatars, previewed in the chosen colour, and six colours: native radio groups, so arrow keys work. */
function buildLookPicker(): void {
  const picker = $("look-picker");
  const sprites = new Sprites();
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
    const canvas = Object.assign(document.createElement("canvas"), { width: 16, height: 16 });
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
      const img = sprites.avatar({ avatar, colour }, "stand");
      if (ctx && img) {
        ctx.clearRect(0, 0, 16, 16);
        ctx.drawImage(img, 0, 0);
      }
    });
  }
  draw();
}
