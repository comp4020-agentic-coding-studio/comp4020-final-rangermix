# Brief: a builder's read of slice 15's spec

You are a talented TypeScript and web-audio engineer. You've been handed a
slice spec and asked to put together a plan to build what it describes.
You will not be able to talk to the person who wrote it.

Read, in this repo:

- `docs/slices/15-music-while-you-sit.md`, the spec.
- `docs/adr/0020-play-public-domain-lofi-each-visitor-their-own.md`, why.
- `AGENTS.md`, the repo's rules (the "What the app must keep" list).
- As much of the code as you need to judge it: `client/index.html`,
  `client/src/main.ts`, `client/src/layout.ts` (how the phone's layout
  is remembered), `client/src/canberra.ts` (the café's hours),
  `client/src/style.css`, `client/vite.config.ts`, `Dockerfile`, and
  `spec/browser.test.ts`.
- Slice 14, whose floating panels this slice's desktop panel joins, is
  built on the branch `origin/slice-14-panels` and not yet on `main`.
  Read its spec at `docs/slices/14-panels-over-the-room.md` and its plan
  with `git show origin/slice-14-panels:docs/notes/plan-slice-14-panels.md`;
  its module is `git show origin/slice-14-panels:client/src/floating.ts`.

Report only the questions you'd still need answered before you could plan
this well: places where you'd have to guess and a wrong guess would
matter. For each, give the question and why the answer changes the plan.
Rank them by importance.

Skip anything the document explicitly leaves to the builder, and anything
you could reasonably decide yourself. Skip nitpicks about wording.

If nothing important is left, say "nothing important left".

Write your answer to `docs/notes/reviews/slice-15-builder-check.md` and
change nothing else. Don't commit.
