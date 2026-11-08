import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import page from "../index.html?raw";
import { greeting, showDoor } from "../src/door";
import type { ApiMe } from "../src/protocol/ApiMe";

// Slice 20: the door a returning visitor meets, and the page after Leave.

const sam: ApiMe = { id: 3, name: "sam", look: { avatar: 1, colour: 2 } };
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = page.match(/<body>([\s\S]*)<\/body>/)![1];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the greeting by Canberra's hour", () => {
  it("says morning from 5, afternoon from 12, evening from 18, and asks who's still up from 22", () => {
    const at = (hour: number) => greeting(hour, "sam");
    expect(at(4)).toBe("Still up, sam?");
    expect(at(5)).toBe("Good morning, sam.");
    expect(at(11)).toBe("Good morning, sam.");
    expect(at(12)).toBe("Good afternoon, sam.");
    expect(at(17)).toBe("Good afternoon, sam.");
    expect(at(18)).toBe("Good evening, sam.");
    expect(at(21)).toBe("Good evening, sam.");
    expect(at(22)).toBe("Still up, sam?");
    expect(at(23)).toBe("Still up, sam?");
    expect(at(0)).toBe("Still up, sam?");
  });
});

describe("the door", () => {
  it("greets a returning visitor by the hour, with Walk in focused and a way to be someone else", () => {
    showDoor(sam, { kind: "arrive" }, { enter: () => {}, signedOut: () => {} }, 19);
    expect($("door").hidden).toBe(false);
    expect($("auth").hidden).toBe(true);
    expect($("cafe").hidden).toBe(true);
    expect($("door-greeting").textContent).toBe("Good evening, sam.");
    expect($("door-text").textContent).toBe("The cats are about. Come in when you're ready.");
    expect($("door-in").textContent).toBe("Walk in");
    expect($("not-me").textContent).toBe("I'm not sam");
    expect(document.activeElement).toBe($("door-in"));
    expect($("door-error").textContent).toBe("");
  });

  it("after Leave says hi above what it said before, with Come back in", () => {
    showDoor(sam, { kind: "left", text: "You've left the café. The cats will remember you." }, { enter: () => {}, signedOut: () => {} }, 9);
    expect($("door-greeting").textContent).toBe("Hi, sam.");
    expect($("door-text").textContent).toBe("You've left the café. The cats will remember you.");
    expect($("door-in").textContent).toBe("Come back in");
    expect($("not-me").textContent).toBe("I'm not sam");
    expect(document.activeElement).toBe($("door-in"));
  });

  it("after a walk-out says hi above why the seat went to someone waiting", () => {
    const why = "You'd gone quiet while someone was waiting, so your seat went to them. The cats will remember you.";
    showDoor(sam, { kind: "left", text: why }, { enter: () => {}, signedOut: () => {} });
    expect($("door-greeting").textContent).toBe("Hi, sam.");
    expect($("door-text").textContent).toBe(why);
    expect($("door-in").textContent).toBe("Come back in");
  });

  it("sets the name as text, never as markup", () => {
    const odd = { ...sam, name: "<b>x</b>" };
    showDoor(odd, { kind: "arrive" }, { enter: () => {}, signedOut: () => {} }, 8);
    expect($("door-greeting").textContent).toBe("Good morning, <b>x</b>.");
    expect($("not-me").textContent).toBe("I'm not <b>x</b>");
    expect($("door").querySelector("b")).toBeNull();
  });

  it("draws the avatar at the sprite's own size, hidden from a screen reader, since the greeting names them", () => {
    showDoor(sam, { kind: "arrive" }, { enter: () => {}, signedOut: () => {} }, 8);
    const avatar = $("door-avatar") as HTMLCanvasElement;
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect([avatar.width, avatar.height]).toEqual([32, 32]);
  });

  it("walks in only when Walk in is pressed, and goes", () => {
    const enter = vi.fn();
    showDoor(sam, { kind: "arrive" }, { enter, signedOut: () => {} }, 8);
    expect(enter).not.toHaveBeenCalled();
    $("door-in").click();
    expect(enter).toHaveBeenCalledTimes(1);
    expect($("door").hidden).toBe(true);
  });

  it("shown again, it answers each press once", () => {
    const enter = vi.fn();
    showDoor(sam, { kind: "arrive" }, { enter, signedOut: () => {} }, 8);
    showDoor(sam, { kind: "left", text: "Gone." }, { enter, signedOut: () => {} }, 8);
    $("door-in").click();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it("signs out on the server when they're someone else, then goes", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const signedOut = vi.fn();
    const enter = vi.fn();
    showDoor(sam, { kind: "arrive" }, { enter, signedOut }, 8);
    $("not-me").click();
    await settle();
    expect(fetch).toHaveBeenCalledWith("/api/logout", expect.objectContaining({ method: "POST" }));
    expect(signedOut).toHaveBeenCalledTimes(1);
    expect(enter).not.toHaveBeenCalled();
    expect($("door").hidden).toBe(true);
  });

  it("says why when signing out fails, and stays, still signed in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "server", detail: "The café couldn't do that just now." }), { status: 500 })),
    );
    const signedOut = vi.fn();
    showDoor(sam, { kind: "arrive" }, { enter: () => {}, signedOut }, 8);
    $("not-me").click();
    await settle();
    expect(signedOut).not.toHaveBeenCalled();
    expect($("door").hidden).toBe(false);
    expect($("door-error").textContent).toBe("The café couldn't do that just now.");
    expect(($("not-me") as HTMLButtonElement).disabled).toBe(false);
    expect(($("door-in") as HTMLButtonElement).disabled).toBe(false);
  });

  it("says why when the café can't be reached, and stays", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    const signedOut = vi.fn();
    showDoor(sam, { kind: "arrive" }, { enter: () => {}, signedOut }, 8);
    $("not-me").click();
    await settle();
    expect(signedOut).not.toHaveBeenCalled();
    expect($("door-error").textContent).toMatch(/Can't reach the café/);
  });

  it("clears an old refusal when shown again", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    showDoor(sam, { kind: "arrive" }, { enter: () => {}, signedOut: () => {} }, 8);
    $("not-me").click();
    await settle();
    showDoor(sam, { kind: "left", text: "Gone." }, { enter: () => {}, signedOut: () => {} }, 8);
    expect($("door-error").textContent).toBe("");
  });
});

describe("a reload the café makes for a new build (slice 20)", () => {
  afterEach(() => sessionStorage.clear());

  it("goes past the door once, since the visitor was inside and didn't open the café", async () => {
    const { noteBackInside, backInside } = await import("../src/door");
    expect(backInside(), "an ordinary opening meets the door").toBe(false);
    noteBackInside();
    expect(backInside(), "the café's own reload goes straight in").toBe(true);
    expect(backInside(), "only once: the next opening meets the door").toBe(false);
  });

  it("meets the door when the tab can't keep a note", async () => {
    const { noteBackInside, backInside } = await import("../src/door");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("no room", "QuotaExceededError");
    });
    noteBackInside();
    setItem.mockRestore();
    expect(backInside()).toBe(false);
  });
});
