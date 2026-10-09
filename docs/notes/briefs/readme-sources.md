# Brief: sources for the user's README

Phase 1, Task 17 ([plan-phase-1.md](../plan-phase-1.md)). The brief for the
final project asks `README.md` to argue what "good" means for this app, with
sources, in the user's own words. This brief asks for the sources only. Nobody
but the user writes `README.md`.

## The app, in short

An online cat café in pixel art (`docs/design.md`; ADRs in `docs/adr/`). One
shared room: at most six people inside, the rest waiting at the window (ADR
0008); a quiet seat freed only when someone is waiting (ADR 0009); speech
bubbles that are public and fleeting, never stored (ADR 0010); three cats
driven by data-defined characters who remember each person through trust that
never fades with absence (ADR 0011); one world that keeps living while nobody
is there (ADR 0006). The user's README says good is "accompany, warmness,
relaxed time with friends", a "friendly yet simple 2d pixel art design", "light
chat available, no history", and that "connection is what make people happy":
cats with memories and characters that grow trust in you.

## What to find

Sources that bear on that idea of good, in these areas:

1. **Third places**: Ray Oldenburg, *The Great Good Place*, and later work on
   cafés as third places, including online ones.
2. **Software for a small known group**: Clay Shirky, "Situated Software";
   Robin Sloan, "An app can be a home-cooked meal".
3. **Cozy games**: the Project Horseshoe 2017 group report on coziness in
   games; later writing on cozy game design.
4. **Neko Atsume's design**: cats that visit while the app is closed, and why
   that works.
5. **Cat cafés and the cats' welfare**: visitor caps, rules that protect the
   cats, what cat cafés do about crowding (bears on ADR 0008's cap of six).
6. **Co-presence and ambient awareness**: feeling others are there without
   talking; small-group presence online.
7. **Fleeting talk versus logged chat**: ephemeral messaging and why people
   say different things when nothing is kept (bears on ADR 0010).

## The answer's form

For each source:

- a citation (author, title, venue, year) and a URL that opened when you
  checked it;
- a two- or three-sentence summary in your own words;
- the decision it bears on (ADR numbers, or the README's own claims) and
  whether it supports or cuts against it;
- at most one quote, under fifteen words, copied exactly from the page you
  opened, or none.

Fetch every URL before citing it. Mark a source you couldn't open, and don't
build a claim on it. Prefer primary sources (the author's own page, the
publisher, the paper) over summaries of them. Two to four good sources per
area is plenty; say so when an area has nothing solid.

Write the result to `docs/notes/readme-material.md`. Nothing goes in
`README.md`.
