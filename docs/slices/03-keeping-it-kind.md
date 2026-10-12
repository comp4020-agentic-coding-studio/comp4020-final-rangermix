# 03. Keeping it kind

- **Status:** Proposed
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-03-safety.md`
- **Design:** Accounts and safety ("Public text", "Admin ban"); Persistence
  (mutes and bans kept);
  [ADR 0007](../adr/0007-use-password-accounts-with-a-recovery-code.md),
  [ADR 0010](../adr/0010-keep-speech-public-and-fleeting.md)

## Story

Someone in the café says something cruel. A visitor opens that person's menu
and mutes them, and their bubbles stop on every device the visitor uses,
without the muted person being told. Slurs on the blocklist never show at all,
and their sender is told why. If someone keeps at it, the operator bans the
account over `fly ssh console`: it can't log in again, and its open sessions
close.

## In this slice

- Mute and unmute from a person's menu and from the who's-here list, stored
  with the account. The server stops sending a muted person's bubbles to
  whoever muted them, on any device.
- A whole-word slur blocklist in `content/blocklist.txt`, checked by the
  server. A blocked bubble isn't shown to anyone, and its sender is told why.
- An admin subcommand of the same binary, run over `fly ssh console`, to ban
  and unban an account. A banned account can't log in, and its open sessions
  close.
- Log lines for a mute, an unmute, a blocked bubble and a ban, none carrying
  any bubble text.

## Not in this slice

- Reports or flags from visitors, and any moderation page. The operator works
  from the logs.

## Done when

| What must be true | Held by |
| --- | --- |
| A muted person's bubbles stop reaching the muter, on every device, and start again on unmute | `spec/` |
| The muted person isn't told, and still sees their own bubbles | `spec/` |
| Mutes survive a restart | `spec/` |
| A listed word as a whole word stops the bubble for everyone and tells the sender why; the same letters inside another word pass | `cargo test`, `spec/` |
| The blocklist is data in `content/`, not code | `cargo test` (the loader reads it) |
| A ban stops log-in and closes the account's open sessions | `cargo test`; checked once by hand on the live machine over `fly ssh console`, recorded in `docs/notes/` |
| Mute and unmute work by keyboard, touch and mouse at both sizes | browser check |
| No log line for a mute, a blocked bubble or a ban carries what was said | `cargo test`, `spec/` (the log check) |

## Rules it touches

- **Never store or log what anyone says**, including a blocked bubble.
- **The server decides every outcome.** Mutes are applied by not sending.
- **Every action works by keyboard, touch and mouse**, at both sizes.

## Numbers

- Bubble length: 100 characters.

## Open questions

- **Where does the blocklist come from?** Someone has to choose the words.
  Proposed: a short list taken from a published open list, cited in the plan,
  for the user to look over before it ships.
