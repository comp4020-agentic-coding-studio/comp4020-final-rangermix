# 0021. Grow the room by its tile, float the bars, and carry the street to the window's edges

- **Status:** Proposed
- **Date:** 2026-11-06

## Context

[ADR 0018](0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
kept the isometric camera at 32-px tiles and floated the desktop's panels
over the room, so at 1920×1080 the room fits at 4×, 1344×928. On
2026-11-06 the user sent a screenshot of it, framed by the page's
background on all sides, and asked for three things: at 1080p, a room that
fills the page, by a bigger tile and not a bigger zoom; something in the
room's empty bottom corners; and the street's background carried end to
end, even where the room doesn't reach.

The study is [notes/slice-16-study.md](../notes/slice-16-study.md). What
it found:

- **The room is held back by the window's height.** At 1920×1080 the
  stage is about 1904×966 once the status and talk bars take their rows;
  4× fills it down to 38 px, with 560 px spare across. A 36-px tile makes
  the room 1512×1040 at 4×, which doesn't fit 966: with the bars in rows,
  a bigger tile drops the room to 3× and makes it *smaller*.
- **Floating the bars over the room**, as the phone's layout B already
  does, gives the room the whole height. On its own it takes the room up
  a step on most real windows (a maximised browser at 1080p is about
  1920×955: 3× now, 4× floating).
- **A fixed 36-px tile is a gamble on the window:** 26% bigger at exactly
  1920×1080, but 15% smaller than 32-px tiles in a maximised browser on
  the same screen.
- **Cats and people are pixel art at 24 and 32 px**; at a bigger tile they
  stay that size unless redrawn, which the user has said isn't wanted now.

## Options

**How the room grows.**

1. **Float the bars; the tile 32 or 36 by the window**, whichever room is
   bigger. The biggest room on every window, never smaller than today's;
   every piece of the room drawn to two sizes and checked at both.
2. **Float the bars; always 36-px tiles.** The user's ask as said, 26%
   bigger at exactly 1920×1080; smaller than option 3 in a maximised
   browser.
3. **Float the bars; keep 32-px tiles.** One size to draw; the room up a
   step on most windows, but not at exactly 1920×1080.
4. **Keep the bars in rows; a bigger tile only where it fits.** At
   1920×1080 that's nowhere above 32, so nothing changes there.

**The bottom corners.** A terrace (paving, a bench, planters, a table
under an umbrella, a street lamp), a garden (grass, a hedge, trees, flower
beds), a deeper plinth, or the pavement alone. Scenery in each case: off
the server's grid, taking no click.

**The street end to end.** One canvas over the whole window with the room
in its middle, or a second canvas behind the room for the street alone.

## Decision

Proposed, for the user to decide (slice 16's open questions): float the
bars on a desktop; choose the tile, 32 or 36, by the window (option 1);
keep cats and people at 24 and 32 px; put the terrace in the bottom
corners, as data in `content/street.toml`; draw the street on a canvas of
its own behind the room, across the whole window.

## Consequences

- **ADR 0018's "32-px tiles" becomes "32 or 36, by the window"** if
  accepted; its camera, its walking and its floating panels stand. The
  design's "the largest whole-number scale, so pixels stay crisp" still
  holds: the scale stays whole, and the tile is the new choice.
- **Nothing reaches the server or the protocol.** The grid, walks and every
  rule stay about tiles; the tile's size in pixels is the client's.
- **Every sum from a pointer to a tile depends on the tile now**, and a
  resize can change it. The browser checks that hold 336 and 1344 read
  the room's size from the client instead, and run at both tiles.
- **The status and talk bars move over the room** on a desktop. They must
  hide no floor tile and keep every control reachable by keyboard, touch
  and mouse, with text at 4.5:1 over anything behind.
- **Cats and people look a little smaller in a 36-px room**: a cat is two
  thirds of a tile instead of three quarters. Redrawing them is a slice of
  its own, if the user wants it.
- **The street is the page's background on a desktop**, so it must cover
  the window by day and by night with nothing of the page showing; the
  phone's layout A keeps its column.
