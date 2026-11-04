# The café's sprites and colours

- `png/`: the cats' and people's art (slice 11), drawn by `scripts/cats.mjs`
  and `scripts/people.mjs` in a fixed key of slot colours
  (`scripts/sprites.ts`'s `CAT_KEY` and `PERSON_KEY`). **Edit these, then
  `node scripts/sprites.ts`.** A cat's build is a folder of frames.
- `cat.txt`, `avatar.txt`: **written by `scripts/sprites.ts` from `png/`,
  not by hand**; a client test fails if they aren't its output.
- `room.txt`, `furniture.txt`, `emotes.txt`: sprites as grids of palette
  slots (`0`–`f`, `.` clear), edited by hand.
- `furniture-models.json`: each kind of furniture as its parts, boxes
  within its footprint, each in a furniture palette slot (slice 11).
- `heights.json`: how tall each kind of furniture's block stands, until its
  art is drawn (slice 09).
- `coats.json`: each cat coat's colours by day. **A new coat is a key
  here**, then `node scripts/palettes.ts`.
- `palettes.json`: **written by `scripts/palettes.ts`, not by hand.** The
  café's colours by day and by night, Catppuccin-led (slice 10). Change the
  mix in the script, or a coat in `coats.json`, then run it. A client test
  fails if this file isn't what the script writes.
- `CREDITS.md`: where the colours come from, and Catppuccin's licence.
