import { expect, it } from "vitest";
import { baseUrl } from "./helpers";

// The way in links to the README, so a newcomer can find out what this is.
it("the log-in card links to the README", async () => {
  const html = await (await fetch(new URL("/", baseUrl))).text();
  expect(html).toMatch(/<a [^>]*href="\/readme\/"/);
});
