import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
  }
}

// The spec checks a RUNNING app over HTTP, so it holds whatever the app is
// built with. `pnpm check` (scripts/check.sh) builds and starts a fresh copy,
// the same way in CI and locally, and points APP_URL at it, so what passes
// there is what deploys. `pnpm test` runs the spec alone against whatever
// APP_URL names. It waits up to a minute, since some stacks take a while to
// boot or migrate.
export default async function setup(project: TestProject): Promise<void> {
  const baseUrl = process.env.APP_URL ?? "http://localhost:8080";

  for (let attempt = 0; ; attempt++) {
    try {
      await fetch(baseUrl);
      break;
    } catch {
      // not up yet
    }
    if (attempt >= 300) {
      throw new Error(
        `nothing is answering at ${baseUrl}: start your app first, or set APP_URL to where it's listening`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  project.provide("baseUrl", baseUrl);
}
