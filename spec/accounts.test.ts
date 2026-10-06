import { describe, expect, it } from "vitest";
import { baseUrl, post, sessionCookie, signUp, uniqueName } from "./helpers";

// Accounts (ADR 0007): a name, a password, a look, and a recovery code shown once.
describe("accounts", () => {
  it("shows a recovery code once, at sign-up", async () => {
    const account = await signUp();
    expect(account.recoveryCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    const me = await fetch(new URL("/api/me", baseUrl), { headers: { cookie: account.cookie } });
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.name).toBe(account.name);
    expect(body).not.toHaveProperty("recoveryCode");
  });

  it("refuses a name that's taken in another case", async () => {
    const account = await signUp();
    const res = await post("/api/signup", {
      name: account.name.toUpperCase(),
      password: "another one",
      look: { avatar: 0, colour: 0 },
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("nameTaken");
  });

  it("logs in with the right password only", async () => {
    const account = await signUp();
    expect((await post("/api/login", { name: account.name, password: "not it at all" })).status).toBe(401);
    const ok = await post("/api/login", { name: account.name, password: account.password });
    expect(ok.status).toBe(200);
    expect(sessionCookie(ok)).toMatch(/^session=/);
  });

  it("recovers with the code, which then can't be used again", async () => {
    const account = await signUp();
    const res = await post("/api/recover", {
      name: account.name,
      code: account.recoveryCode.toLowerCase(),
      password: "a brand new one",
    });
    expect(res.status).toBe(200);
    const fresh = (await res.json()).recoveryCode as string;
    expect(fresh).not.toBe(account.recoveryCode);
    expect((await post("/api/login", { name: account.name, password: account.password })).status).toBe(401);
    expect((await post("/api/login", { name: account.name, password: "a brand new one" })).status).toBe(200);
    const again = await post("/api/recover", { name: account.name, code: account.recoveryCode, password: "and another" });
    expect(again.status).toBe(401);
  });

  it("signs out", async () => {
    const account = await signUp();
    expect((await post("/api/logout", {}, account.cookie)).status).toBe(204);
    const me = await fetch(new URL("/api/me", baseUrl), { headers: { cookie: account.cookie } });
    expect(me.status).toBe(401);
  });

  it("lets a whole room on one network sign up at once", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        post("/api/signup", { name: uniqueName("r"), password: "correct horse", look: { avatar: 0, colour: 0 } }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
  });

  it("refuses a request from another site", async () => {
    const res = await fetch(new URL("/api/login", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ name: "someone", password: "something" }),
    });
    expect(res.status).toBe(403);
  });
});
