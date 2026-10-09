# README material

This is material gathered by agents and then checked, for you to draw on when you write your own README. It is not README text. Each source below was opened and read, or it is listed under "Dropped". "Bears on" lines point at the ADRs and README claims each source touches, including where it cuts against them.

## Third places: Oldenburg, The Great Good Place, and later work on cafes and online third places

- [Constance A. Steinkuehler and Dmitri Williams, "Where Everybody Knows Your (Screen) Name: Online Games as Third Places", Journal of Computer-Mediated Communication 11(4), 885-909, 2006](https://academic.oup.com/jcmc/article/11/4/885/4617625).
  The authors test massively multiplayer games against Oldenburg's traits of a third place. They conclude the games work as virtual third places that favour bridging ties: broad, loose connections with little emotional support. Bonding ties formed only occasionally. A sparsely populated game lost network diversity, like an empty bar, and third-place function faded as players moved into hardcore guild play.
  Bears on: supports the claim that an online room can be a third place (ADR 0008, a small room with regulars). Cuts against "connection" as deep bonds, since the paper finds mostly weak ties. The empty-bar finding also bears on room population and the ADR 0008/0009 cap.
  Quote: "game play is more akin to playing five-person poker in a neighborhood tavern"

- [Ray Oldenburg, The Great Good Place, 1989 (Berkshire Publishing reissue 2023), read via the Wikipedia article on the book](https://en.wikipedia.org/wiki/The_Great_Good_Place_(book)). Secondary source.
  Third places are informal gathering spots where talk is the main activity and meetups are unplanned. They level status, class and race, and support community, civility and civic life. Oldenburg ties their disappearance to weaker community and more isolation. Cite the book itself for claims about its contents.
  Bears on: supports the README's definition of good (accompany, warmness, relaxed time, light chat). Conversation as the main activity matches ADR 0010's public, light talk.

- [Oldenburg and Christensen's characteristics of third places, as summarised on Wikipedia's "Third place" article](https://en.wikipedia.org/wiki/Third_place). Secondary source, best used for the trait list.
  Seven traits: open and welcoming, relaxed, accessible, modest, has regulars with a host, talk-centred, and playful. The virtual section says game avatars strip social identifiers, which levels status, and that regulars set norms and informally moderate newcomers.
  Bears on: supports claims on warmth and friendly simplicity. Regulars and a host map to the cats and trust that remembers people (ADR 0011). Drop-in access bears on ADR 0008/0009, where the cap could cut against "open and inviting".

## Software for a small known group

- [Clay Shirky, "Situated Software", 30 March 2004, read via the gwern.net mirror](https://gwern.net/doc/technology/2004-03-30-shirky-situatedsoftware.html). The mirror is not the author's own page.
  Shirky argues for software built for a specific small community rather than for scale and generality. Such software can lean on the group's existing social structures (public embarrassment, shared spaces) instead of coding reputation or escrow. He accepts that it may be fragile and short-lived.
  Bears on: supports a small, known room of friends and ADR 0008 (cap of six). Supports skipping scale and heavy moderation machinery.
  Quote: "The N-squared problem is only a problem if N is large"

- [Robin Sloan, "An app can be a home-cooked meal", robinsloan.com, February 2020](https://www.robinsloan.com/notes/home-cooked-app/).
  Sloan built BoopSnoop, a messaging app for his family of four, after the app they used shut down. He compares such software to home cooking, made out of care rather than for a market. He values that he controls it: no redesigns, no ads. The family still uses it, with one feature added since.
  Bears on: supports framing the cafe as warm, home-made software for friends, and the small, no-growth scope (design.md, ADR 0008). BoopSnoop needs no login because it already knows its four users; the cafe is open to strangers, so it does need accounts (ADR 0007), which is a contrast worth noticing rather than a parallel. Do not stretch it to ADR 0010 (speech not stored); the source says nothing about message history.
  Quote: "I am the programming equivalent of a home cook."

## Cozy games

- [Short, T. X., Hurd, D., Forbes, J., Diaz, J., Ordon, A., Howe, C., Eiserloh, S., Cook, D. (2017). Group Report: Coziness in Games: An Exploration of Safety, Softness, and Satisfied Needs. Project Horseshoe 2017 report, section 3](https://www.projecthorseshoe.com/reports/featured/ph17r3.htm).
  The report defines coziness as the fantasy of safety, abundance and softness. Its "Cozy-Adjacent" section lists look-alikes (home, party, politeness, wealth and others). For multiplayer it covers escalating opt-in layers, persistent small groups, low-cost positive reciprocity and letting conversations ramble. The group called itself Cocoa & Quilts.
  Bears on: supports ADR 0008 (small cap, window to wait at), ADR 0010 (light, fleeting talk), ADR 0011 (cats that grow trust) and the warmth and relaxed-time claims.
  Quote: "Coziness is a shortcut to empathy."

- [Short, T. X. (ed.), with the Project Horseshoe 2017 group (2018, 5 March). Designing for Coziness. Game Developer](https://www.gamedeveloper.com/design/designing-for-coziness).
  Short's summary of the Horseshoe group analysis gives the three pillars and says coziness is opt-in, with enjoyment from the activity itself. It warns that min/maxing and predatory monetisation erode coziness. Its online advice: reduce strangers, persistent identities, layered opt-in social exposure, forgiveness and repair, and shared low-intensity activities.
  Bears on: supports ADR 0008 (fewer strangers, a place to linger), ADR 0011 (persistent identity building trust) and the simple and relaxed claims. Its persistent-identity advice sits slightly against ADR 0010's keeping nothing said, though trust with cats still persists.

- [Yap, K. L. (2023, 21 September). How to Fall in Love with a System: Coziness as a Catalyst for Participatory Agency. Autonomous Worlds N1](https://aw.network/posts/how-to-fall-in-love-with-a-system). Secondary source from a blockchain-games venue, so use it lightly.
  A later essay that draws on the Horseshoe report's definition and design strategies. It argues coziness is a way people find one another and a catalyst for participatory agency. It calls persistent autonomous worlds well suited hosts for cozy games, partly because tending a world makes it more worth tending.
  Bears on: supports ADR 0006 (a world that keeps living) and the claim that connection makes people happy, as a light secondary source only.
  Quote: "A cozy world is a world that you want to share"

## Neko Atsume design: cats visiting while the app is closed

- [Kill Screen, "Cats finally take over the world with mobile game Neko Atsume", 2015](https://www.killscreen.com/cats-finally-take-over-the-world-with-mobile-game-neko-atsume/). Secondary source. Cite it as the writer's and a cafe owner's view, not the designer's.
  Describes the tutorial framing: cats are cautious and will not visit at once, so you close or suspend the game and come back. The writer argues the idea suits a phone better than a console, since you leave a treat out and switch to another app while the cats appear. A New York cat-cafe co-owner says a quick look at cute art lifts a low mood. Takazaki's cat-cafe inspiration is only paraphrased via a link to The Verge.
  Bears on: ADR 0006 (world keeps living while nobody is there): supports. Warmth and relaxed-time claims: supports. Cat-cafe shape of the app: supports, though the creator's inspiration is second-hand.
  Quote: "They won't visit right away, so suspend or close the game"

- [Wikipedia, "Neko Atsume" (accessed 2026-10-09); cites Hit-Point developer Yutaka Takazaki](https://en.wikipedia.org/wiki/Neko_Atsume). Tertiary source.
  The game has no end and cats keep coming while the player puts out food. Cats leave silver or gold fish when they go. Takazaki's stated goal was a game enjoyable without much skill or time, with simple operations. It won the CEDEC best game design award and reached 10 million downloads by 4 December 2015. The page dates the award inconsistently, so cite 2015 only.
  Bears on: ADR 0006 and the "friendly yet simple" claim: supports (low demand on the player, no ending, simple operations). It does not cover the while-closed mechanic, so do not use it for that.

## Cat cafes and cat welfare

- [The Conversation, "Exotic animal cafes: cute trend or welfare crisis?"](https://theconversation.com/exotic-animal-cafes-cute-trend-or-welfare-crisis-271147).
  Reports that the RSPCA and Cats Protection urged phasing out cat cafes. They say cats are likely to find enforced closeness to other cats and unfamiliar visitors stressful. It cites England's 2018 licensing regulations, which require monitoring of behaviour, handling and customer interactions, and says disease and injury risks rise in cramped cafes.
  Bears on: ADR 0008 context. Supports the welfare worry about strangers and crowding. It sets no visitor limit, so it does not support "real cat cafes cap visitors" or the number six.
  Quote: "enforced proximity to other felines"

- [Yumiao Cat Cafe, "House Rules", the venue's own page (undated)](https://www.yumiaocatcafe.com/house-rules).
  A working cafe's visitor rules. Cats choose whether to approach, nobody lifts or chases them, no feeding or food in the lounge, sleeping cats are not woken, there is no flash, and touch is gentle. Staff may ask rule-breakers to leave. It states no capacity number.
  Bears on: ADR 0008 and the rule that cats change only through what a person does. Supports house rules that protect the cats. No support for the cap of six.
  Quote: "Cats are very good at finding and helping themselves to your drinks!" This is a weak quote for the claim, so the summary is better used alone.

- [dvm360, "Popularity of Cat Cafes Prompts Animal Welfare Concerns" (undated)](https://www.dvm360.com/view/popularity-of-cat-cafes-prompts-animal-welfare-concerns). Trade-press summary, secondary source.
  Cats Protection worries about many cats in a small space while strangers come and go all day. Cats evolved solitary, and unrelated cats in large groups can fight, so the setting may stress them and make them aggressive. It mentions no visitor caps. It includes a counterpoint that some cafes rehome cats.
  Bears on: ADR 0008. Supports the worry about crowding and a constant flow of strangers, not the specific cap of six.
  Quote: "put the welfare of the cat first" This is International Cat Care's call to cafe owners and patrons, not the article's own voice.

## Co-presence and ambient awareness

- [Wikipedia, "Social translucence"](https://en.wikipedia.org/wiki/Social_translucence). Secondary source; it summarises Erickson and Kellogg, ACM TOCHI 7(1), 59-83, 2000, DOI 10.1145/344949.345004, whose citation details are confirmed only through this page's reference list. The page uses "Erickson et al." loosely.
  It credits Erickson and Kellogg with three principles for socially translucent systems: visibility, awareness and accountability. It also mentions a later proposal of identity as a fourth principle.
  Bears on: the claim that being with others matters (weakly supports: visibility of others). ADR 0008 visible occupants: supports. ADR 0010 unlogged, fleeting speech: partly cuts against, since accountability means knowing who did what and when.

- [Wikipedia, "Ambient awareness"](https://en.wikipedia.org/wiki/Ambient_awareness). Secondary source; cites Clive Thompson, New York Times 2008, and Kaplan and Haenlein.
  Defines ambient awareness as peripheral social awareness from regular exposure to small information fragments through social media, letting people know of each other's lives without face-to-face talk. Thompson likens it to sensing someone's mood from nearby body language and passing remarks. The key caveat: the mechanisms are mostly asynchronous feeds and status updates, not a shared live room.
  Bears on: the claim of feeling accompanied without talking, by analogy only. It is about asynchronous feeds, not live co-presence.

## Fleeting talk versus logged chat (ADR 0010)

- [Cox, S. R., Jacobsen, R. M., van Berkel, N. (2025). The Impact of a Chatbot's Ephemerality-Framing on Self-Disclosure Perceptions. CUI '25 (ACM); arXiv:2505.20464](https://arxiv.org/abs/2505.20464). Chatbot study, not human-to-human, so cite it as indirect evidence.
  Participants chatted with a chatbot over two days, framed either as remembering them (Familiar) or as a new stranger each time. When emotional disclosure came first, the Stranger framing left people more comfortable, and they described it as anonymous and less judging. When factual chat came first, that gap vanished and the Familiar chatbot was enjoyed more. Familiar framing felt intrusive unless rapport was built through low-risk chat first.
  Bears on: ADR 0010: supports (not being remembered lowers the sense of being judged). "Light chat, no history": supports. ADR 0011 (cats that remember): nuanced, since memory is welcome after low-stakes rapport.

- [Zhang, Y., Wang, H., Luo, C., Chen, S. (2021). Ephemerality in Social Media: Unpacking the Personal and Social Characteristics of Time Limit Users on WeChat Moments. Frontiers in Psychology, 12:712440](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.712440/full). Correlational and about posts, not live chat. Cite only as weak support.
  A survey of 390 WeChat users, 263 of whom use the Time Limit setting. After correction, users posted more often, used privacy tags more and had smaller audiences than non-users. The 3-day group had the smallest audiences and posted least often, so frequency does not rise steadily with shorter expiry.
  Bears on: ADR 0010 and "light chat": weak support at most. It does not test what people say or live talk. It cuts against nothing.
  Quote: "Social media platforms increasingly give users the option of ephemerality"

## Enforced and judged

From `docs/design.md`, "Checks", as the repo stands on 2026-10-09 (phase 1
closing). The brief asks the README to say which parts of "good" a check
holds and which only a person can judge; this is what exists to point at.

**Enforced by `spec/`, black-box against the running image (and CI before
every deploy):**

- The app answers at `/` and publishes `README.md` at `/readme/`:
  `spec/invariants.test.ts`.
- Real-time: a bubble reaches someone else within a second, and a moved
  cushion shows for someone else within a second: `spec/realtime.test.ts`,
  `spec/furniture.test.ts`.
- Six inside, the rest at the window, who can only talk and come in when a
  seat frees: `spec/realtime.test.ts`.
- Speech is fleeting: a bubble is never replayed to someone who reconnects,
  and a bubble over 100 characters reaches nobody: `spec/realtime.test.ts`.
- One avatar per account, however many tabs: `spec/realtime.test.ts`.
- The cats remember you when you come back: `spec/realtime.test.ts`.
- Accounts: a recovery code shown once, names unique in any case, log-in,
  recovery, sign-out, a whole venue on one address, requests from other
  sites refused: `spec/accounts.test.ts`.
- The door's walkway is never blocked, and furniture changes are rate
  limited: `spec/furniture.test.ts`.
- The log-in card links to the README: `spec/login-page.test.ts`.

**Enforced by `cargo test`, with a seeded world and a controllable clock:**

- What was said never reaches a log line:
  `server/src/world/people.rs`, `what_was_said_is_never_logged`.
- Trust tapers within a Canberra day and never fades with absence:
  `server/src/trust.rs`, `gains_taper_within_a_day_and_stop_at_the_cap`
  and `absence_never_costs_trust`.
- Each cat's character: Mochi naps after lunch and overnight, noise sends
  shy Burakku into hiding but not bold Tora, Burakku is livelier and Mochi
  sleepier in an empty café, Tora has zoomies only in her waking hours:
  `server/src/cats.rs`. A first meeting always leaves a trace, a friend is
  greeted at the door, and a cat looks up at its name:
  `server/src/world/cat_life.rs`.
- The store keeps accounts, trust, the cats and the furniture across a stop
  and a start: `server/src/store.rs`, `server/src/world/furniture.rs`.
- Rate limits: `server/src/limits.rs`.

**Planned, not yet enforced:** the keyboard-only path at 390×844 and
1920×1080 with a resize mid-use (phase 2's browser checks); first grab wins
(phase 2); grudges (phase 3); the night's traces and fast-forward (phase 4);
the blocklist (phase 4).

**Judged, by people:** whether strangers end up talking because of the cats,
whether the cats feel like characters, and whether regulars feel remembered.
The design names where: the crit 9 pod session, the crit 10 logs, and the
showcase.

## Where the README and the design differ

The README as it stands on 2026-10-09, against `docs/design.md`. Each is the
user's call: build it, or change the line.

- **"soothing music".** The design has no music, and no phase plans any.
- **The template's first lines are still there.** The README opens with the
  template's `# Your app` heading and its `<!-- TEMPLATE ... Replace
  everything in it, this comment included. -->` comment, and `/readme/`
  publishes them.
- **No sources yet.** The brief asks the README to argue what good means
  with sources; the sections above are material for that.
- **"options to interact with cat".** Today: pet and call. The design adds
  feeding treats, play, and picking up and carrying (phase 3).
- **"cats have memories".** Today the memory is trust: who a cat has met
  and how much it trusts them. The design adds grudges (phase 3) and the
  chalkboard of what the cats got up to (phase 4).
- **What the README doesn't mention** that the design treats as central:
  the cap of six with a line at the window (ADR 0008) and the quiet-seat
  rule (ADR 0009), which is crit 9's recorded multi-user decision; the
  world going on while nobody is there (ADR 0006); accounts with a recovery
  code (ADR 0007); and that the cats remembering each person is the lasting
  trace.
- **Inspirations.** The README names Neko Atsume and Bongo Cat; the design
  names Neko Atsume and real cat cafés. Bongo Cat has no source above.

## Dropped

- Ducheneaut, Moore and Nickell, "Virtual Third Places" (CSCW 2007): the page returned HTTP 403, so nothing could be verified.
- CNN, "Neko Atsume is the addicting new app where you feed stray cats" (2015): the fetch returned HTTP 451, so it could not be read.
- Cats in a Cat Cafe, Animals (MDPI) 2025, doi:10.3390/ani15223233: the page returned 403. Re-add it once someone reads it by hand.
- Erickson and Kellogg, "Social translucence" (ACM TOCHI 2000), primary page: returned 403. Cite via the Wikipedia page, or read the paper directly.
- Dourish and Bly, "Portholes" (CHI 1992): the PDF text was unreadable through the fetcher, so the citation could not be confirmed.
- Xu et al., "Automatic Archiving versus Default Deletion" (CSCW 2016): the fetch returned only a cookie notice, so nothing could be verified.
- Bayer et al., "Sharing the small moments" (2016): the publisher returned HTTP 403, so nothing could be verified.
