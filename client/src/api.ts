import type { ApiError } from "./protocol/ApiError";
import type { ApiMe } from "./protocol/ApiMe";
import type { LogInRequest } from "./protocol/LogInRequest";
import type { RecoverRequest } from "./protocol/RecoverRequest";
import type { SignUpRequest } from "./protocol/SignUpRequest";

// The accounts API (ADR 0007). The session is an HttpOnly cookie the page never sees.

export type Answer<T> = { ok: true; value: T } | { ok: false; error: ApiError };

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<Answer<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: { error: "server", detail: "Can't reach the café. Check your connection and try again." } };
  }
  if (res.status === 204) return { ok: true, value: undefined as T };
  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return { ok: true, value: data as T };
  return { ok: false, error: (data as ApiError | null) ?? { error: "server", detail: `The café answered ${res.status}.` } };
}

export const me = () => call<ApiMe>("GET", "/api/me");
export const signUp = (req: SignUpRequest) => call<ApiMe>("POST", "/api/signup", req);
export const logIn = (req: LogInRequest) => call<ApiMe>("POST", "/api/login", req);
export const recover = (req: RecoverRequest) => call<ApiMe>("POST", "/api/recover", req);
export const logOut = () => call<void>("POST", "/api/logout");
