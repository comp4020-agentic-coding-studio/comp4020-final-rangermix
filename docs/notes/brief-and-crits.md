# The brief, the crits and the fixed constraints

Read on 2026-10-07 from the course site and this repo's starter files, so later
sessions don't have to fetch them again. Paraphrased; short quotes are marked.
Follow the links for the exact wording.

- [Final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
- [C8 It's alive!](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/08-its-alive/),
  [C9 All at once](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/09-all-at-once/),
  [C10 Fly by instruments](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/10-fly-by-instruments/)
- [Crit cutoffs by group](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/)
- [Assessment mechanics and marking viewports](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/)

## The brief (A3, 40% of the course)

- The whole brief is one line: "Make a multi-user, real-time website that's good."
- **Multi-user:** two or more people, each in their own browser, act on shared
  state, and the app tells them apart. What counts as a person (account,
  pseudonym, anonymous visitor) is our call.
- **Real-time:** one person's change reaches every other open session within
  about a second, with no reload. Any mechanism, but the choice is explained.
- **Persists:** actions survive sessions, restarts and redeploys, for the
  person who made them and for anyone else.
- **Design for co-presence:** the app should be more interesting because
  others are using it at the same time. The showcase, a full room using it at
  once, is the situation to design for.
- **Nothing is prescribed:** no required accounts, profiles, feeds, rooms or
  scores. Deciding what not to build is part of the work.
- **Good lives in three places, and they must agree:** `README.md` is the
  argument (400 to 600 words, with sources, published in full at `/readme/`),
  `CLAUDE.md` is the rules, `spec/` is the checks. The strongest READMEs say
  which claims are enforced, which are judged, and how the judged ones were
  assessed.
- **Marked down whether or not the checks pass:** "a chat room with the nouns
  swapped", features with no reason to exist, and a README promising a kind of
  good that the rules and checks never mention.
- **How markers use the app:** they start at `/readme/`, then use the app for
  about ten minutes as a newly invited member: two sessions side by side, both
  marking viewports, a resize mid-use, a keyboard-only pass, and trying the
  promises `spec/` names, live. The top band needs it to withstand two people
  acting at once, a slow connection, and a session resumed the next day.
- **Marking viewports:** 1920×1080 desktop and 390×844 phone (Chrome DevTools'
  iPhone preset), in the latest stable Chrome. Both count fully.
- **Weights (COMP4020):** legibility of process 50%, deployed app 25%, response
  to the brief 25%.
- **`PROCESS.md`:** 900 to 1100 words, rewritten (not appended) at each crit.
  It must make the case for the stack and the agent workflow, with citations.
  ADRs can be linked instead of restated.
- **Due:** noon, Monday 9 November 2026. **Showcase:** Wednesday 11 November,
  12 to 2pm (time and venue TBC), in person and unmarked.

## Fixed constraints (from `fly.toml`, `Dockerfile`, `spec/README.md`)

- One `shared-cpu-1x` machine with **256 MB** of memory, region `syd`.
- One **1 GB volume at `/data`**: the only storage that survives a restart or a
  redeploy. No separate database server.
- The app serves plain HTTP on `0.0.0.0:$PORT` (8080); Fly terminates TLS.
- `auto_stop_machines = "stop"` with `min_machines_running = 0`: **the machine
  stops when nobody is using it** and starts again on the next request.
  Anything the server simulates stops with it, so the design has to say what
  happens to the world while it sleeps.
- Two shipped checks: `/` answers 200, and `/readme/` carries the README's
  headings, in order, in the HTML the server sends (no script runs).
- `pnpm check` and `pnpm check:evidence` must pass. Once the repo is public, CI
  checks and deploys every push to `main`.

## The crits in this repo (2% each, judged on their own terms)

- **C8 "It's alive!" (week 9, this week).** Deployed by the cutoff; a stranger
  can visit, do the core thing, and find their trace still there when they come
  back; a first README with what was read to get there; the repo goes public
  at the cutoff; `PROCESS.md`; `reflections/crit-8.md`. Start from "the
  smallest schema that can carry the core interaction."
- **C9 "All at once" (week 10).** Real-time by the brief's definition, deployed;
  one recorded decision about how the app behaves when several people use it
  at once, with the alternatives and the cost (an ADR is suggested); the pod
  uses it together and argues for the option not picked; `reflections/crit-9.md`.
- **C10 "Fly by instruments" (week 11).** One structured server-side log line
  per user action (who, what, when); a live view (a `flyctl logs` tail or a
  small stats page); a demo by the logs alone while the group uses the app;
  `reflections/crit-10.md`.
- **Cutoffs** are two hours before the group's session. C8 moved for the Labour
  Day holiday: Shítāo Tue 6 Oct 12:00, Bādà Wed 7 Oct 13:30, and the Wednesday
  groups keep their usual Wed 7 Oct cutoffs (07:00, 08:30, 12:00, 13:30).
  Which group this project's author is in isn't recorded here yet.

## Not yet checked

- How `/ship` cutoff tags separate each crit's snapshot in the shared repo.
- The studio crit model's "When a week runs differently" section for weeks 9
  to 11.
