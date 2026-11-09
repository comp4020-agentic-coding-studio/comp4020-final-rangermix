# Catppuccino

Welcome to the online cat cafe **Catppuccino**! It's a place for you and/or friends to chill and enjoy fluffy companions. Come inside, relax, enjoy the chill vibe, and become good friends of the cats.

## For markers

The cats get to know you over days, and the café keeps Canberra time, so ten minutes as a newcomer shows little of either. A demo account lets you see weeks in those ten minutes. Log in as `demo1` (or `demo2`, if the first is open elsewhere), password `catppuccino`. The cats already know this regular: Mochi naps on their lap, Tora greets them at the door, Burakku comes when called. A bar at the top of the room moves the café's clock forward (the café lives through the hours between, for everyone inside), lays out a furniture set, and adds or removes bots.

1. Window 1 at 1920×1080: sign up as yourself. Window 2 at 390×844: the demo account.
2. Both say "Mochi": she comes to the regular, and only looks up at you. Have the regular pass her to you: she won't go to a stranger.
3. Bar: **Afternoon**, then Furniture: **Lap time**. Sit the regular on a sofa, and Mochi takes the lap.
4. Bar: **Night**. Burakku is up and the others asleep; the board shows the hours you skipped. Talk a lot, and she hides.
5. Bar: **Morning**. The regular walks out and back in, and Tora greets them at the door.
6. As yourself, keep picking Tora up: she refuses, then scratches, then bans you for a while.
7. Bar: add **bots** until six are inside, then one more, who waits at the window. Leave and come back: the bot has taken your seat, so you wait at the window and can only talk. Remove a bot, and you walk in.
8. Both grab the same chair: the first grab wins. Bar: Furniture, **Play room**, and the cats go to look at the new pieces. Resize mid-use, switch the phone's layout, try the keyboard alone.
9. Bar: **Canberra time** puts the hour back. Come back tomorrow: the cats still know you.

## What's good?

### Defining the app first

I want to build a relaxing idle app people leave open whenever they're by their computer. Like the background music in a cafe, or the always-on TV in grandma's living room. But IMO it's not the music or TV that gives you the comfort feeling, it's the company - friends, staff, grandma, or maybe grandpa's dog. So I chose a cat cafe: enjoy it with friends, or by yourself with the cats.

It's for people who miss having a cat, and for regulars who make it theirs, so it has to feel good with only a few people inside. The cats are why you come, and the talk follows them, like a [third place](https://en.wikipedia.org/wiki/Third_place). What I left out on purpose: money, collecting, levels and chat history. There's nothing to grind, so nothing to rush.

### Setting the tone

Relaxing is the theme everywhere, along with long-term companionship and a growing relationship with the cats.

It should feel cosy in [Project Horseshoe's](https://www.projecthorseshoe.com/reports/featured/ph17r3.htm) sense: safe, abundant and soft. The bowls fill themselves, and what lasts is the cats' memory of you, not a record of what you said.

### Good in action

#### Technical Good

This part is easy to measure, and the agents build specs for it to keep them in control.

- minimal resource usage so you can just leave it open
- minimal latency over websocket's full duplex connection
- multi-user consistency - the server decides everything
- fast simulation on a tiny machine - rust backend (a night of cat life catches up in about a second)
- the cafe can sleep, crash or redeploy and nothing you did is lost
- nothing anyone says is saved or logged, and no email or IP address is kept; CI checks the logs on every push

#### Design Good

Judged mostly by my own eyes and ears: I discussed each part with AI, looked at screenshots, then decided.

##### The cats

- 3 cats with different characters: Mochi goes to everyone and naps after lunch; Burakku is up at night, hides when it's noisy and is slow to trust; Tora gets zoomies at dawn and dusk and would rather play than be petted. A new cat is just a data file, so more can come.
- they live on in the cafe even when you're offline
- they get to know you over time if you play gently, from sniffing a stranger's hand to coming when called, greeting you at the door, then napping on your lap.
- they can scratch you and ban you from touching them if you go too far

##### The cafe

- 6 people inside at a time so it's never crowded; others enjoy it from the window. sit quietly as long as you like; you're only asked "still there?" when someone's waiting
- the chalkboard keeps track of what the cats got up to in the last day
- no staff, so if a cat knocks a plant over, pls help get it back up. you get 3 treats a day to put down, offer or give to a friend
- arrange the cafe your way from lots of furniture
- the cafe keeps Canberra time. the door greets you by name and the hour ("Still up, sam?") and waits till you're ready

##### Visual

- welcoming 2D pixel art, a lofi city vibe and a palette inspired by Catppuccin
- you'll tell when it's day or night, or somewhere in between
- on a desktop the panels float in the room's empty corners like frosted glass; drag them, pin them, and they fade when left alone

##### Music

- relaxing lo-fi by [HoliznaCC0](https://freemusicarchive.org/music/holiznacc0), a different theme by day & night
- your own player, off until you turn it on, remembers your choice and volume

##### Talk

- talk is public and fleeting: bubbles float over your head for everyone inside and at the window, then they're gone
- click someone to talk to them, and their name shows on your bubble
- wave, laugh, send a heart or yawn, share the sofa, hand someone a treat

## Credits

I mainly got inspiration from two game: Neko Atsume and Bongo Cat. One is for the cat cafe theme and one for the people connection part. Also the name and colour palette is from the colour theme [Catppuccin](https://catppuccin.com/).

- **Music:** six tracks from [*Public Domain Lofi*](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi) by [HoliznaCC0](https://freemusicarchive.org/music/holiznacc0), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) on the Free Music Archive. By day: [Bubbles](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/bubbles-lofi-bright-relaxed/), [Ocean Breeze](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ocean-breeze-lofi-ukulele-peaceful-mp3/) and [Tranquil Mindscape](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/tranquil-mindscape-lofi-happy-reflection/). By night: [Moon Unit](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/moon-unit-lofi-reflection-dreamy/), [Ease into Night](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ease-into-night-lofi-relax-chill/) and [One Night in France](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/one-night-in-france-lofi-nostalgic-chill/).
- **Colours:** [Catppuccin](https://catppuccin.com/), under the MIT licence ([credits](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/blob/main/content/sprites/CREDITS.md)).

Word counts: README 654 (not counting marking instructions and credits), PROCESS.md 1,069, research note 807 (not counting its references).
