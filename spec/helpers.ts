import { inject } from "vitest";

// Helpers for checks that run against the running app (spec/global-setup.ts
// finds it). Every account they make has a fresh name.
export const baseUrl = inject("baseUrl");

/** A fresh name for each call, within the 20-character limit. */
export function uniqueName(prefix = "t"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 20);
}

export interface Account {
  name: string;
  password: string;
  cookie: string;
  id: number;
  recoveryCode: string;
}

export function sessionCookie(res: Response): string {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session="));
  if (!cookie) throw new Error(`no session cookie (status ${res.status})`);
  return cookie.split(";")[0];
}

export function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

export async function signUp(name = uniqueName(), password = "correct horse"): Promise<Account> {
  const res = await post("/api/signup", { name, password, look: { avatar: 1, colour: 2 } });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const me = (await res.json()) as { id: number; recoveryCode: string };
  return { name, password, cookie: sessionCookie(res), id: me.id, recoveryCode: me.recoveryCode };
}
