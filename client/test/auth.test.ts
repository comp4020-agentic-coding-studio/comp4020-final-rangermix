import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import page from "../index.html?raw";
import { showAuth } from "../src/auth";
import type { ApiMe } from "../src/protocol/ApiMe";

// Slice 20: one way in for everyone. A name and a password, Walk in to log
// in, I'm new to sign up, the look a step after it.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const settle = () => new Promise((r) => setTimeout(r, 0));

type Route = (body: Record<string, unknown>) => Response;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (name: string, recoveryCode?: string): ApiMe => ({ id: 7, name, look: { avatar: 0, colour: 0 }, ...(recoveryCode ? { recoveryCode } : {}) });

let calls: { path: string; body: Record<string, unknown> }[];
function serve(routes: Record<string, Route>): void {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      calls.push({ path, body });
      const route = routes[path];
      if (!route) throw new Error(`nothing serves ${path}`);
      return route(body);
    }),
  );
}

function fill(name: string, password: string): void {
  $<HTMLInputElement>("way-in-name").value = name;
  $<HTMLInputElement>("way-in-password").value = password;
}

beforeEach(() => {
  document.body.innerHTML = page.match(/<body>([\s\S]*)<\/body>/)![1];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("one way in", () => {
  it("is one form, a name and a password, Walk in first so Enter logs in, then I'm new, the name focused", () => {
    showAuth(() => {});
    const form = $<HTMLFormElement>("way-in");
    expect($("auth").hidden).toBe(false);
    expect(form.hidden).toBe(false);
    expect($("look-step").hidden).toBe(true);
    const submits = [...form.querySelectorAll<HTMLButtonElement>("button[type=submit]")];
    expect(submits.map((b) => b.textContent)).toEqual(["Walk in", "I'm new"]);
    expect(document.querySelector("[role=tab]"), "no tabs any more").toBeNull();
    expect(document.activeElement).toBe($("way-in-name"));
  });

  it("logs in with Walk in, and walks in", async () => {
    serve({ "/api/login": () => json(200, me("sam")) });
    const enter = vi.fn();
    showAuth(enter);
    fill("sam", "correct horse");
    $("log-in").click();
    await settle();
    expect(calls).toEqual([{ path: "/api/login", body: { name: "sam", password: "correct horse" } }]);
    expect(enter).toHaveBeenCalledWith(me("sam"));
    expect($("auth").hidden).toBe(true);
  });

  it("says a refused log-in's reason, and points a newcomer to I'm new", async () => {
    serve({ "/api/login": () => json(401, { error: "badLogin", detail: "That name and password don't match." }) });
    const enter = vi.fn();
    showAuth(enter);
    fill("sam", "wrong horse");
    $("log-in").click();
    await settle();
    expect(enter).not.toHaveBeenCalled();
    expect($("auth-error").textContent).toBe("That name and password don't match. New here? Press I'm new.");
  });

  it("asks whether the name is free when they're new, and stays to say why it isn't", async () => {
    serve({ "/api/check-name": () => json(409, { error: "nameTaken", detail: "That name is taken." }) });
    showAuth(() => {});
    fill("sam", "correct horse");
    $("im-new").click();
    await settle();
    expect(calls).toEqual([{ path: "/api/check-name", body: { name: "sam" } }]);
    expect($("way-in").hidden).toBe(false);
    expect($("look-step").hidden).toBe(true);
    expect($("auth-error").textContent).toBe("That name is taken.");
  });

  it("asks for a password long enough before asking anything of the café", async () => {
    serve({});
    showAuth(() => {});
    fill("sam", "short");
    $("im-new").click();
    await settle();
    expect(calls).toEqual([]);
    expect($("auth-error").textContent).toBe("A password is 8 to 128 characters.");
  });

  it("with a free name, asks for a look by name; Back returns with the fields kept", async () => {
    serve({ "/api/check-name": () => new Response(null, { status: 204 }) });
    showAuth(() => {});
    fill("pip", "correct horse");
    $("im-new").click();
    await settle();
    expect($("way-in").hidden).toBe(true);
    expect($("look-step").hidden).toBe(false);
    expect($("look-heading").textContent).toBe("Choose your look, pip");
    expect(document.activeElement?.getAttribute("name"), "the avatars first").toBe("avatar");
    $("look-back").click();
    expect($("way-in").hidden).toBe(false);
    expect($("look-step").hidden).toBe(true);
    expect($<HTMLInputElement>("way-in-name").value).toBe("pip");
    expect($<HTMLInputElement>("way-in-password").value).toBe("correct horse");
    expect(document.activeElement).toBe($("im-new"));
  });

  it("signs up with the look chosen, shows the recovery code, and walks in from it", async () => {
    serve({
      "/api/check-name": () => new Response(null, { status: 204 }),
      "/api/signup": () => json(200, me("pip", "ABCD-EFGH-JKLM-NPQR")),
    });
    const enter = vi.fn();
    showAuth(enter);
    fill("pip", "correct horse");
    $("im-new").click();
    await settle();
    $<HTMLInputElement>("look-picker").querySelector<HTMLInputElement>("input[name=avatar][value='2']")!.click();
    $<HTMLInputElement>("look-picker").querySelector<HTMLInputElement>("input[name=colour][value='4']")!.click();
    $("sign-up").click();
    await settle();
    expect(calls.at(-1)).toEqual({ path: "/api/signup", body: { name: "pip", password: "correct horse", look: { avatar: 2, colour: 4 } } });
    expect($("code").hidden).toBe(false);
    expect($("code-text").textContent).toBe("ABCD-EFGH-JKLM-NPQR");
    expect($("look-step").hidden).toBe(true);
    expect(enter).not.toHaveBeenCalled();
    $("code-done").click();
    expect(enter).toHaveBeenCalledWith(me("pip", "ABCD-EFGH-JKLM-NPQR"));
  });

  it("goes back to the first step if the name was taken while they chose a look", async () => {
    serve({
      "/api/check-name": () => new Response(null, { status: 204 }),
      "/api/signup": () => json(409, { error: "nameTaken", detail: "That name is taken." }),
    });
    showAuth(() => {});
    fill("pip", "correct horse");
    $("im-new").click();
    await settle();
    $("sign-up").click();
    await settle();
    expect($("way-in").hidden).toBe(false);
    expect($("look-step").hidden).toBe(true);
    expect($("auth-error").textContent).toBe("That name is taken.");
  });

  it("stays on the look step to say a sign-up was refused for trying too often", async () => {
    serve({
      "/api/check-name": () => new Response(null, { status: 204 }),
      "/api/signup": () => json(429, { error: "rateLimited", detail: "Too many tries. Wait a minute and try again." }),
    });
    showAuth(() => {});
    fill("pip", "correct horse");
    $("im-new").click();
    await settle();
    $("sign-up").click();
    await settle();
    expect($("look-step").hidden).toBe(false);
    expect($("auth-error").textContent).toBe("Too many tries. Wait a minute and try again.");
  });

  it("recovers from I've forgotten my password, carrying the name over, and Back returns", async () => {
    serve({ "/api/recover": () => json(200, me("sam", "WXYZ-WXYZ-WXYZ-WXYZ")) });
    const enter = vi.fn();
    showAuth(enter);
    fill("sam", "");
    $("show-recover").click();
    expect($("recover").hidden).toBe(false);
    expect($("way-in").hidden).toBe(true);
    const recover = $<HTMLFormElement>("recover");
    expect(recover.querySelector<HTMLInputElement>("input[name=name]")!.value).toBe("sam");
    recover.querySelector<HTMLInputElement>("input[name=code]")!.value = "abcd-efgh";
    recover.querySelector<HTMLInputElement>("input[name=password]")!.value = "new horse battery";
    recover.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
    await settle();
    expect(calls).toEqual([{ path: "/api/recover", body: { name: "sam", code: "abcd-efgh", password: "new horse battery" } }]);
    expect($("code-text").textContent).toBe("WXYZ-WXYZ-WXYZ-WXYZ");
    $("code-done").click();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it("shown again, for someone else, starts empty at the first step, the last one's words gone", async () => {
    serve({ "/api/login": () => json(401, { error: "badLogin", detail: "That name and password don't match." }) });
    showAuth(() => {});
    fill("sam", "wrong horse");
    $("log-in").click();
    await settle();
    $("show-recover").click();
    const enter = vi.fn();
    showAuth(enter);
    expect($("way-in").hidden).toBe(false);
    expect($("recover").hidden).toBe(true);
    expect($("code").hidden).toBe(true);
    expect($<HTMLInputElement>("way-in-name").value).toBe("");
    expect($<HTMLInputElement>("way-in-password").value).toBe("");
    expect($("auth-error").textContent).toBe("");
    expect(document.activeElement).toBe($("way-in-name"));
    // And the second showing's way in is the one that answers.
    serve({ "/api/login": () => json(200, me("jo")) });
    fill("jo", "correct horse");
    $("log-in").click();
    await settle();
    expect(calls).toHaveLength(1);
    expect(enter).toHaveBeenCalledWith(me("jo"));
  });

  // Slice 20's review, findings 1 and 5: nothing of one visitor's way in
  // stays in the page for the next.
  it("leaves no recovery code and no password in the page once they're in", async () => {
    serve({
      "/api/check-name": () => new Response(null, { status: 204 }),
      "/api/signup": () => json(200, me("pip", "ABCD-EFGH-JKLM-NPQR")),
    });
    showAuth(() => {});
    fill("pip", "correct horse");
    $("im-new").click();
    await settle();
    $("sign-up").click();
    await settle();
    $("copy-code").textContent = "Copied";
    $("code-done").click();
    expect($("code-text").textContent).toBe("");
    expect($("copy-code").textContent).toBe("Copy");
    expect($<HTMLInputElement>("way-in-name").value).toBe("");
    expect($<HTMLInputElement>("way-in-password").value).toBe("");
  });

  it("clears the way in after a log-in, and the recovery form after a recovery", async () => {
    serve({ "/api/login": () => json(200, me("sam")), "/api/recover": () => json(200, me("sam", "WXYZ-WXYZ-WXYZ-WXYZ")) });
    showAuth(() => {});
    fill("sam", "correct horse");
    $("log-in").click();
    await settle();
    expect($<HTMLInputElement>("way-in-password").value).toBe("");
    showAuth(() => {});
    $("show-recover").click();
    const recover = $<HTMLFormElement>("recover");
    recover.querySelector<HTMLInputElement>("input[name=name]")!.value = "sam";
    recover.querySelector<HTMLInputElement>("input[name=code]")!.value = "abcd-efgh";
    recover.querySelector<HTMLInputElement>("input[name=password]")!.value = "new horse battery";
    recover.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
    await settle();
    $("code-done").click();
    expect(recover.querySelector<HTMLInputElement>("input[name=password]")!.value).toBe("");
    expect(recover.querySelector<HTMLInputElement>("input[name=code]")!.value).toBe("");
    expect($("code-text").textContent).toBe("");
  });

  it("shown again, holds no code a sign-up left behind", () => {
    $("code-text").textContent = "ABCD-EFGH-JKLM-NPQR";
    showAuth(() => {});
    expect($("code-text").textContent).toBe("");
  });

  // Slice 20's review, finding 9: the focus never falls to the page.
  it("puts the focus on the password after a refused log-in", async () => {
    serve({ "/api/login": () => json(401, { error: "badLogin", detail: "That name and password don't match." }) });
    showAuth(() => {});
    fill("sam", "wrong horse");
    $("log-in").focus();
    $("log-in").click();
    await settle();
    expect(document.activeElement).toBe($("way-in-password"));
  });

  it("puts the focus back on Walk in after a sign-up refused for trying too often", async () => {
    serve({
      "/api/check-name": () => new Response(null, { status: 204 }),
      "/api/signup": () => json(429, { error: "rateLimited", detail: "Too many tries. Wait a minute and try again." }),
    });
    showAuth(() => {});
    fill("pip", "correct horse");
    $("im-new").click();
    await settle();
    $("sign-up").focus();
    $("sign-up").click();
    await settle();
    expect(document.activeElement).toBe($("sign-up"));
  });

  it("puts the focus on the code after a refused recovery", async () => {
    serve({ "/api/recover": () => json(401, { error: "badRecovery", detail: "That name and code don't match." }) });
    showAuth(() => {});
    $("show-recover").click();
    const recover = $<HTMLFormElement>("recover");
    recover.querySelector<HTMLInputElement>("input[name=name]")!.value = "sam";
    recover.querySelector<HTMLInputElement>("input[name=code]")!.value = "nope";
    recover.querySelector<HTMLInputElement>("input[name=password]")!.value = "new horse battery";
    recover.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
    await settle();
    expect(document.activeElement).toBe(recover.querySelector("input[name=code]"));
  });

  // Slice 20's review, finding 10: characters, as the server counts them.
  it("counts a password in characters, so four emoji are too short for I'm new", async () => {
    serve({});
    showAuth(() => {});
    fill("pip", "😺😺😺😺");
    $("im-new").click();
    await settle();
    expect(calls).toEqual([]);
    expect($("auth-error").textContent).toBe("A password is 8 to 128 characters.");
    expect(document.activeElement).toBe($("way-in-password"));
  });

  it("goes back to the password when the look step's sign-up refuses it", async () => {
    serve({
      "/api/check-name": () => new Response(null, { status: 204 }),
      "/api/signup": () => json(400, { error: "badInput", detail: "A password is 8 to 128 characters." }),
    });
    showAuth(() => {});
    fill("pip", "correct horse");
    $("im-new").click();
    await settle();
    $("sign-up").click();
    await settle();
    expect($("way-in").hidden).toBe(false);
    expect(document.activeElement).toBe($("way-in-password"));
  });

  // Slice 20's review, finding 8: Back and I'm new again doesn't spend a try.
  it("doesn't ask about the same name twice in one showing once it was free", async () => {
    serve({ "/api/check-name": () => new Response(null, { status: 204 }) });
    showAuth(() => {});
    fill("pip", "correct horse");
    for (let i = 0; i < 4; i++) {
      $("im-new").click();
      await settle();
      expect($("look-step").hidden).toBe(false);
      $("look-back").click();
    }
    expect(calls.filter((c) => c.path === "/api/check-name")).toHaveLength(1);
    // A different name is asked about.
    fill("pip2", "correct horse");
    $("im-new").click();
    await settle();
    expect(calls.filter((c) => c.path === "/api/check-name")).toHaveLength(2);
  });

  // Slice 20's review, finding 11: a password manager offers a new password for a sign-up.
  it("marks the password a new one once they say they're new, and a current one again on Back", async () => {
    serve({ "/api/check-name": () => new Response(null, { status: 204 }) });
    showAuth(() => {});
    expect($("way-in-password").getAttribute("autocomplete")).toBe("current-password");
    fill("pip", "correct horse");
    $("im-new").click();
    await settle();
    expect($("way-in-password").getAttribute("autocomplete")).toBe("new-password");
    $("look-back").click();
    expect($("way-in-password").getAttribute("autocomplete")).toBe("current-password");
  });
});
