# Catppuccino

Welcome to the online cat cafe **Catppuccino**! It's a place for you and/or friends to chill and enjoy fluffy companions. Come inside, relax, enjoy the chill vibe, and become good friends of the cats.

## What's good?

### Defining the app first

I want to build a relaxing environment for people. I imagine it to be an idle app people would open whenever they're by their computer. It's like the background music in a cafe, or the always-on TV at grandma's living room. However IMO in those two senarios it's not the music or TV themself give you the comfort feeling, it's the companion in there - friends, staff, and grandma, or maybe grandpa's dog. To add the companion part, I choose to environment to be a cat cafe - you can enjoy it with friends, or by yourself with the cats.

### Setting the tone

The app need

For this project I define "good" from the following aspects, with difficulty of measuring by the title:

- Tech | easy
  - minimal resource usage so it user can just left it open and enjoy companion
  - minimal latency of interaction - websocket's full duplex connection fits perfectly
  - multi-user consistency - assured by server centralised communication / compute
  - fast simulation while keep minimal memory usage - rust backend
-
- Design (hard to measure)
  - Visual
    - The current simple 2D
  - Game
    - People come here for accompany, warmness, relaxed time with friends.
      - friendly yet simple 2d pixel art design
      - soothing music
      - options to interact with cat
      - light chat available, no history
    - Connection is what make people happy
      - cats have memories
      - cats have characters
      - cats can grow trust and affection on you
    - Cats
      - everyone (should) loves cat

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

## Inspiration

I mainly got inspiration from two game: Neko Atsume and Bongo Cat. One is for the cat cafe theme and one for the people connection part. Also the name and colour palate is from the colour theme [Catppuccin](https://catppuccin.com/).

## Credits

- **Music:** six tracks from [*Public Domain Lofi*](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi) by [HoliznaCC0](https://freemusicarchive.org/music/holiznacc0), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) on the Free Music Archive. By day: [Bubbles](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/bubbles-lofi-bright-relaxed/), [Ocean Breeze](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ocean-breeze-lofi-ukulele-peaceful-mp3/) and [Tranquil Mindscape](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/tranquil-mindscape-lofi-happy-reflection/). By night: [Moon Unit](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/moon-unit-lofi-reflection-dreamy/), [Ease into Night](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ease-into-night-lofi-relax-chill/) and [One Night in France](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/one-night-in-france-lofi-nostalgic-chill/). They play in the café once [slice 15](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/blob/main/docs/slices/15-music-while-you-sit.md) is built.
- **Colours:** [Catppuccin](https://catppuccin.com/), under the MIT licence ([credits](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/blob/main/content/sprites/CREDITS.md)).
