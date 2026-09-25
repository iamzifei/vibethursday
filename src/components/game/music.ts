/**
 * Background music for /play: one loop per scene, cross-faded.
 *
 * The four tracks were made for this game with Suno (via MusicAPI) as
 * instrumental anime-RPG themes, then loudness-normalised to −18 LUFS so they
 * sit under the game rather than over it. Each is loaded only when its scene
 * first plays, so somebody who never takes the train never downloads the
 * train's music.
 *
 * Browsers refuse to start audio before the page has been touched, so nothing
 * plays until the first tap; `play()` before then only remembers the scene.
 */

export type Track = "title" | "harbour" | "chatswood" | "train";

const SRC: Record<Track, string> = {
  title: "/audio/play/title.mp3",
  harbour: "/audio/play/harbour.mp3",
  chatswood: "/audio/play/chatswood.mp3",
  train: "/audio/play/train.mp3",
};

const VOLUME = 0.45;
const FADE_MS = 900;
export const MUSIC_KEY = "vt-play-music";

/**
 * Volume goes through Web Audio gain nodes, not `audio.volume`: iOS Safari
 * ignores `volume` entirely (it is read-only there and always 1), so fades and
 * the background level would silently do nothing on exactly the phones most
 * players use.
 */
export class Music {
  private players = new Map<Track, { audio: HTMLAudioElement; gain: GainNode }>();
  private context: AudioContext | null = null;
  private current: Track | null = null;
  private wanted: Track | null = null;
  private enabled: boolean;

  constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(MUSIC_KEY);
    } catch {
      // Blocked storage: default on.
    }
    this.enabled = stored !== "off";
  }

  isEnabled() {
    return this.enabled;
  }

  /** Call from inside a tap or click: the one moment a browser allows sound. */
  unlock() {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
    }
    if (this.context.state === "suspended") void this.context.resume();
    if (this.enabled && this.wanted) this.switchTo(this.wanted);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(MUSIC_KEY, on ? "on" : "off");
    } catch {
      // Remembered for this visit only.
    }
    if (!on) {
      for (const player of this.players.values()) this.fade(player, 0, () => !this.enabled && player.audio.pause());
      this.current = null;
    } else {
      this.unlock();
    }
  }

  play(track: Track) {
    this.wanted = track;
    if (this.enabled && this.context) this.switchTo(track);
  }

  stop() {
    for (const { audio } of this.players.values()) {
      audio.pause();
      audio.removeAttribute("src");
    }
    this.players.clear();
    this.current = null;
    void this.context?.close();
    this.context = null;
  }

  private switchTo(track: Track) {
    const context = this.context;
    if (!context || this.current === track) return;
    const leaving = this.current;
    const previous = leaving ? this.players.get(leaving) : null;
    // Paused only if nobody switched back to it while it was fading out.
    if (previous) this.fade(previous, 0, () => this.current !== leaving && previous.audio.pause());

    let player = this.players.get(track);
    if (!player) {
      const audio = new Audio(SRC[track]);
      audio.loop = true;
      audio.preload = "auto";
      const gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(audio).connect(gain).connect(context.destination);
      player = { audio, gain };
      this.players.set(track, player);
    }
    this.current = track;
    // A refused play() (the tab is in the background, say) is not worth
    // surfacing; the next tap calls unlock() and tries again.
    void player.audio.play().catch(() => undefined);
    this.fade(player, VOLUME);
  }

  private fade(player: { gain: GainNode }, to: number, done?: () => void) {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    player.gain.gain.cancelScheduledValues(now);
    player.gain.gain.setValueAtTime(player.gain.gain.value, now);
    player.gain.gain.linearRampToValueAtTime(to, now + FADE_MS / 1000);
    if (done) setTimeout(done, FADE_MS + 50);
  }
}
