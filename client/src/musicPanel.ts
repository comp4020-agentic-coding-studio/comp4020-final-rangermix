import { announce } from "./announce";
import { canberraHour } from "./canberra";
import { type Loaded, type MusicSaved, type Track, ended, next, previous, rememberMusic, rememberedMusic, settle, start, trackOf } from "./music";

// The music panel (slice 15, ADR 0020): one <audio> element, and the
// track's title and artist, Play or Pause, Previous, Next and a volume.
// music.ts makes the choices; this plays them. Nothing here reaches the
// server: a press on the panel is a press in the café, which is all the
// café hears of it (its presence ping, main.ts).

/**
 * Each track's address in the build, by its file: Vite copies every MP3 in
 * content/music/ into the client's assets, so a new track is a file and a
 * playlist entry, never code. None is fetched until it plays.
 */
const FILES = import.meta.glob<string>("../../content/music/*.mp3", { query: "?url", import: "default", eager: true });

export function urlOf(track: Track): string {
  const url = FILES[`../../content/music/${track.file}`];
  if (!url) throw new Error(`content/music/${track.file} isn't in the build`);
  return url;
}

export interface MusicEls {
  audio: HTMLAudioElement;
  title: HTMLElement;
  artist: HTMLElement;
  play: HTMLButtonElement;
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  volume: HTMLInputElement;
}

/** How often the clock is looked at, so a track not yet begun follows it across 17:00 and 6:00. */
const LOOK_EVERY = 30_000;

const same = (a: Loaded | null, b: Loaded) => !!a && a.set === b.set && a.index === b.index;

export class Music {
  /** The track the panel names: what Play plays, or what's playing. */
  private loaded: Loaded;
  /** The track the audio element holds, if any: none until Play, and none after a skip while paused. */
  private held: Loaded | null = null;
  /** On and the volume, as this device remembers them. */
  private readonly saved: MusicSaved;
  /** Remembered on, and the browser hasn't let it play yet: the first press in the café starts it. */
  private waiting = false;
  /** Whether the element is playing, by its own play and pause events: a pause counts only after a play. */
  private sounding = false;
  private readonly ticker: number;
  private readonly undo: (() => void)[] = [];

  constructor(
    private readonly els: MusicEls,
    private readonly hour: () => number = () => canberraHour(),
  ) {
    const { audio, play, volume } = els;
    this.loaded = start(hour());
    audio.preload = "none";
    this.unload();
    this.saved = rememberedMusic();
    volume.min = "0";
    volume.max = "100";
    volume.step = "5";
    volume.value = String(this.saved.volume);
    // On iOS a page can't set the volume (it reads 1 whatever it's given):
    // the phone's own buttons do it, so the slider goes.
    audio.volume = 0.5;
    volume.hidden = Math.abs(audio.volume - 0.5) > 0.01;
    audio.volume = this.saved.volume / 100;
    this.on(play, "click", () => {
      this.waiting = false;
      if (audio.paused) {
        this.remember({ on: true });
        return this.playLoaded(true);
      }
      this.remember({ on: false });
      // `paused` turns true at once, but the pause event comes a task later:
      // the panel says Play now.
      audio.pause();
      this.show();
    });
    this.on(els.next, "click", () => this.skip(next));
    this.on(els.previous, "click", () => this.skip(previous));
    this.on(volume, "input", () => {
      audio.volume = Number(volume.value) / 100;
      this.remember({ volume: Number(volume.value) });
    });
    // On or off, whoever turned it: the panel, a keyboard's media key, a
    // headset's button or the phone's media controls (slice 15's review,
    // finding 3). A pause counts only after a play, so a refused play() is
    // nothing; the pause a browser makes as a song ends isn't the visitor's;
    // and the pause dispose() makes comes after these are gone.
    this.on(audio, "play", () => {
      this.waiting = false;
      this.sounding = true;
      this.remember({ on: true });
    });
    this.on(audio, "pause", () => {
      if (!this.sounding) return;
      this.sounding = false;
      if (!audio.ended) this.remember({ on: false });
    });
    // A track that failed to load leaves the element in error, where play()
    // fetches and plays nothing: it holds nothing now, so the next Play
    // sets its source again (slice 15's review, finding 1).
    this.on(audio, "error", () => (this.held = null));
    for (const type of ["play", "pause", "emptied", "error"]) this.on(audio, type, () => this.show());
    this.mediaSession(true);
    this.on(audio, "ended", () => {
      this.loaded = ended(this.loaded, this.hour());
      this.playLoaded(true);
    });
    this.ticker = window.setInterval(() => this.look(), LOOK_EVERY);
    this.show();
  }

  /**
   * Entering the café: if this device remembers the music on, it plays, at
   * the remembered volume, from the set's first track. A browser that won't
   * play before a press refuses; then the first press in the café starts it
   * (pressed()). Signing in, or pressing Come back in, is a press, so it
   * usually starts at once.
   */
  enter(): void {
    if (!this.saved.on) return;
    this.waiting = true;
    this.playLoaded();
  }

  /**
   * A click, tap or key press in the café (main.ts). If the music is
   * waiting for one, it starts. The Play button is left to its own click,
   * which would otherwise pause what this had just started.
   */
  pressed(target?: EventTarget | null): void {
    if (!this.waiting || !this.els.audio.paused) return;
    if (target instanceof Node && this.els.play.contains(target)) return;
    this.playLoaded(true);
  }

  /**
   * The system's media controls (a phone's lock screen and notification, a
   * keyboard's media keys): they name the track, and their Play, Pause,
   * Next and Previous work as the panel's do (slice 15's review, finding 3).
   */
  private mediaSession(on: boolean): void {
    if (!("mediaSession" in navigator)) return;
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => this.els.audio.paused && this.els.play.click()],
      ["pause", () => !this.els.audio.paused && this.els.play.click()],
      ["nexttrack", () => this.skip(next)],
      ["previoustrack", () => this.skip(previous)],
    ];
    for (const [action, fn] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, on ? fn : null);
      } catch {
        // A browser that doesn't know the action leaves it to the panel.
      }
    }
  }

  private remember(change: Partial<MusicSaved>): void {
    Object.assign(this.saved, change);
    rememberMusic(this.saved);
  }

  private on(target: EventTarget, type: string, fn: () => void): void {
    target.addEventListener(type, fn);
    this.undo.push(() => target.removeEventListener(type, fn));
  }

  /**
   * Plays the track the panel names: from where it was paused if the
   * element holds it, else from its start. `pressed` says a press is
   * happening now, which a browser lets start sound.
   */
  private playLoaded(pressed = false): void {
    const { audio } = this.els;
    // The clock may have crossed 17:00 or 6:00 since it was last looked at:
    // a track not yet begun follows it now, not up to 30 s later (slice 15's
    // review, finding 2).
    this.loaded = settle(this.loaded, this.hour(), this.played());
    // Nothing is set loading while the browser surely won't play: before
    // any press in the page, it would refuse (slice 15's review, finding 4).
    // A browser that can't say tries, and a refusal unloads below.
    if (!pressed && navigator.userActivation?.hasBeenActive === false) {
      this.show();
      return;
    }
    if (!same(this.held, this.loaded)) {
      audio.src = urlOf(trackOf(this.loaded));
      this.held = { ...this.loaded };
    }
    // A browser that won't play before a press refuses here: the element
    // lets go of its source, so nothing loads, the panel goes on saying
    // Play, and the press that comes starts it.
    audio.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "NotAllowedError" && audio.paused) this.unload();
      this.show();
    });
    this.show();
  }

  /** Next or Previous: playing, the new track plays; paused, it's named and nothing loads. */
  private skip(to: typeof next): void {
    const playing = !this.els.audio.paused;
    this.loaded = to(this.loaded, this.hour());
    if (playing) this.playLoaded(true);
    else {
      this.unload();
      this.show();
    }
    // What's loaded now, for a screen reader (slice 15's review, finding 6).
    const track = trackOf(this.loaded);
    announce(`${track.title}, by ${track.artist}`);
  }

  /** Empties the element, so it holds and fetches nothing. */
  private unload(): void {
    const { audio } = this.els;
    this.held = null;
    if (!audio.hasAttribute("src")) return;
    audio.removeAttribute("src");
    audio.load();
  }

  /** How far into what the panel names the player is, in seconds: none if the element doesn't hold it, and a moment at least if it's playing. */
  private played(): number {
    if (!same(this.held, this.loaded)) return 0;
    const { audio } = this.els;
    return audio.paused ? audio.currentTime : Math.max(audio.currentTime, 0.001);
  }

  /** The clock may have crossed 17:00 or 6:00: a track not yet begun follows it. */
  private look(): void {
    const settled = settle(this.loaded, this.hour(), this.played());
    if (settled === this.loaded) return;
    this.loaded = settled;
    this.unload();
    this.show();
  }

  /** The panel as things are: the track it names, and Play or Pause by whether the element plays. */
  private show(): void {
    const track = trackOf(this.loaded);
    const playing = !this.els.audio.paused;
    if (this.els.title.textContent !== track.title) this.els.title.textContent = track.title;
    if (this.els.artist.textContent !== track.artist) this.els.artist.textContent = track.artist;
    this.els.play.setAttribute("aria-label", playing ? "Pause" : "Play");
    this.els.play.classList.toggle("playing", playing);
    if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
      const now = navigator.mediaSession.metadata;
      if (now?.title !== track.title) navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: "Public Domain Lofi" });
    }
  }

  /** The visit is over: the music stops, and the element lets go of its track. */
  dispose(): void {
    window.clearInterval(this.ticker);
    for (const u of this.undo.splice(0)) u();
    this.mediaSession(false);
    this.els.audio.pause();
    this.unload();
  }
}
