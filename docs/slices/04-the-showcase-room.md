# 04. The showcase room

- **Status:** Proposed
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-04-load.md`
- **Design:** "Six inside, the rest at the window" under The café; Real-time;
  the fixed constraints in `docs/notes/brief-and-crits.md` (one machine, 256 MB);
  [ADR 0004](../adr/0004-run-one-authoritative-world-over-websockets.md),
  [ADR 0008](../adr/0008-cap-the-cafe-at-six-with-a-line-at-the-window.md)

## Story

At the showcase forty people open the café at once. Six walk in, and the other
thirty-four wait at the window: as many faces as fit, and a count for the
rest. Bubbles still reach everyone within a second, the machine stays inside
its 256 MB, and each time someone leaves, the first in line walks in.

## In this slice

- A load script that signs up forty visitors, connects them, and has them talk
  and act at the design's rate limits for several minutes, measuring how long
  a bubble takes to reach everyone and how much memory the server uses.
- Run against the image with a 256 MB memory limit, and fixes for whatever it
  finds.
- The window's count for those whose faces don't fit, which the design asks
  for and the room doesn't yet draw. The who's-here panel already counts them.

## Not in this slice

- More than one café, or raising the cap of six.

## Done when

| What must be true | Held by |
| --- | --- |
| With forty connected, six are inside, the rest are at the window, and the window shows a count beyond the faces that fit | the load script; browser check for the count |
| 95% of bubbles reach every open session within a second with forty connected, everyone talking at the burst limit | the load script, against the image, results in `docs/notes/` |
| The server stays well inside 256 MB under that load | the load script, under a 256 MB container limit |
| No connection is dropped for falling behind under that load | the load script |
| When someone leaves, the first in line walks in, under load | the load script |
| The café is still pleasant with thirty-four faces at the window, at both sizes | judged: by the user, from screenshots in `docs/notes/screens/` |

## Rules it touches

- **The cap is enforced on the server.**
- **The server decides every outcome.**

## Numbers

- People inside: 6.
- Falling behind: a connection with 256 unsent messages is dropped to
  reconnect.
- Bubbles: 5 in a burst, then 1 every 2 seconds.
- Sign-up attempts: 60 a minute per IP address, which forty sign-ups from one
  machine fit inside.

## Open questions

- **Run it against the live café too?** Forty sign-ups would leave forty
  accounts in the live database, since there's no way to delete one.
  Proposed: run against the image only, and check the live machine with a
  handful of real browsers.
