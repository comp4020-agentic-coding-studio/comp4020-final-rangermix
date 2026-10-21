# The café's sprites and colours

- `*.txt`: each sprite as a grid of palette slots (`0`–`f`, `.` clear).
- `heights.json`: how tall each kind of furniture's block stands, until its
  art is drawn (slice 09).
- `coats.json`: each cat coat's colours by day. **A new coat is a key
  here**, then `node scripts/palettes.ts`.
- `palettes.json`: **written by `scripts/palettes.ts`, not by hand.** The
  café's colours by day and by night, Catppuccin-led (slice 10). Change the
  mix in the script, or a coat in `coats.json`, then run it. A client test
  fails if this file isn't what the script writes.
- `CREDITS.md`: where the colours come from, and Catppuccin's licence.
