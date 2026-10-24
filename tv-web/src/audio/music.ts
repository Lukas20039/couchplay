// Hintergrundmusik der TV-App: ein Stück je Bildschirm (Lobby, jedes Spiel, Ergebnis),
// weiche Übergänge, nahtlose Schleifen per Überblendung (MP3 hat am Anfang immer etwas Stille,
// `loop` allein würde hörbar stocken). Stücke liegen in public/music/ (Lizenzen: CREDITS.md).
import type { RoomState } from "@couchplay/protocol";

export interface Track {
  file: string;
  /** Überblendung am Schleifenende (s); länger bei Stücken mit Ausklang. */
  overlap: number;
}

export const TRACKS: Record<string, Track> = {
  lobby: { file: "lobby.mp3", overlap: 0.8 },
  results: { file: "results.mp3", overlap: 0.8 },
  quiz: { file: "quiz.mp3", overlap: 1.5 },
  tictactoe: { file: "tictactoe.mp3", overlap: 0.8 },
  wortgarten: { file: "wortgarten.mp3", overlap: 4 },
  schiffe: { file: "schiffe.mp3", overlap: 3 },
  blockblast: { file: "blockblast.mp3", overlap: 0.8 },
  kennstdu: { file: "kennstdu.mp3", overlap: 1.5 },
};

/** Lautstärkestufen: Aus, Leise, Mittel, Laut. */
export const LEVELS = [0, 0.22, 0.45, 0.8] as const;
export type Level = 0 | 1 | 2 | 3;
export const DEFAULT_LEVEL: Level = 2;
export const LEVEL_STORAGE_KEY = "couchplay.tv.music";

/** Welches Stück zum Raumzustand passt (null = Stille, z. B. Startbildschirm). */
export function trackFor(room: Pick<RoomState, "phase" | "selectedGameId"> | null): string | null {
  if (!room) return null;
  if (room.phase === "results") return "results";
  if (room.phase === "game") return room.selectedGameId && TRACKS[room.selectedGameId] ? room.selectedGameId : "lobby";
  return "lobby";
}

export function loadLevel(storage: Pick<Storage, "getItem"> | null): Level {
  const v = Number(storage?.getItem(LEVEL_STORAGE_KEY) ?? NaN);
  return v === 0 || v === 1 || v === 2 || v === 3 ? v : DEFAULT_LEVEL;
}

/** Das Nötigste von HTMLAudioElement (für Tests ersetzbar). */
export interface AudioLike {
  src: string;
  volume: number;
  currentTime: number;
  readonly duration: number;
  preload: string;
  /** Sicherheitsnetz, falls der Timer gedrosselt wird; die Überblendung kommt vorher. */
  loop: boolean;
  play(): Promise<void> | void;
  pause(): void;
}

export interface MusicOptions {
  /** Basis-URL der Dateien, z. B. "/tv/music/". */
  base: string;
  createAudio?: () => AudioLike;
  /** Uhr in ms (Tests). */
  now?: () => number;
  setInterval?: (fn: () => void, ms: number) => number;
  clearInterval?: (id: number) => void;
}

interface Voice {
  id: string;
  audio: AudioLike;
  /** Lautstärke 0–1 vor der Stufe; läuft linear auf `target` zu. */
  gain: number;
  target: number;
  /** Änderung pro ms. */
  rate: number;
  /** Diese Stimme hat ihre Nachfolgerin (Schleife) schon gestartet. */
  looped: boolean;
}

const FADE_MS = 1200;
const TICK_MS = 100;

export class MusicPlayer {
  private voices: Voice[] = [];
  private current: string | null = null;
  private level: Level = DEFAULT_LEVEL;
  private suspended = false;
  /** Autoplay vom Browser verweigert → beim nächsten Tastendruck erneut versuchen. */
  blocked = false;
  private timer: number | null = null;
  private last = 0;
  private readonly createAudio: () => AudioLike;
  private readonly now: () => number;
  private readonly setInt: (fn: () => void, ms: number) => number;
  private readonly clearInt: (id: number) => void;

  constructor(private readonly opts: MusicOptions) {
    this.createAudio = opts.createAudio ?? (() => new Audio() as AudioLike);
    this.now = opts.now ?? (() => Date.now());
    this.setInt = opts.setInterval ?? ((fn, ms) => window.setInterval(fn, ms));
    this.clearInt = opts.clearInterval ?? ((id) => window.clearInterval(id));
  }

  get track(): string | null {
    return this.current;
  }

  get volumeLevel(): Level {
    return this.level;
  }

  setLevel(level: Level): void {
    this.level = level;
    if (level === 0) {
      // Aus = wirklich anhalten (spart Strom/Decoder auf schwachen TVs).
      for (const v of this.voices) v.audio.pause();
      this.voices = [];
      this.stopTimer();
      return;
    }
    if (this.voices.length === 0 && this.current) this.startVoice(this.current, 0);
    this.apply();
  }

  /** Stück wechseln (gleiches Stück = nichts tun); null blendet aus. */
  setTrack(id: string | null): void {
    const next = id && TRACKS[id] ? id : null;
    if (next === this.current) return;
    this.current = next;
    for (const v of this.voices) this.fadeTo(v, 0, FADE_MS);
    if (next && this.level > 0) this.startVoice(next, 0);
    this.ensureTimer();
  }

  /** App im Hintergrund: anhalten bzw. fortsetzen. */
  setSuspended(suspended: boolean): void {
    if (suspended === this.suspended) return;
    this.suspended = suspended;
    for (const v of this.voices) {
      if (suspended) v.audio.pause();
      else this.play(v);
    }
  }

  /** Nach einer Nutzeraktion: von Autoplay-Sperre blockierte Wiedergabe erneut starten. */
  unlock(): void {
    if (!this.blocked) return;
    this.blocked = false;
    for (const v of this.voices) this.play(v);
  }

  dispose(): void {
    for (const v of this.voices) v.audio.pause();
    this.voices = [];
    this.stopTimer();
  }

  private startVoice(id: string, fromGain: number): Voice {
    const audio = this.createAudio();
    audio.preload = "auto";
    audio.loop = true;
    audio.src = this.opts.base + TRACKS[id]!.file;
    audio.currentTime = 0;
    const v: Voice = { id, audio, gain: fromGain, target: 1, rate: 1 / FADE_MS, looped: false };
    this.voices.push(v);
    this.apply();
    if (!this.suspended) this.play(v);
    this.ensureTimer();
    return v;
  }

  private play(v: Voice): void {
    try {
      const p = v.audio.play();
      if (p && typeof p.catch === "function") {
        p.catch((err: unknown) => {
          if ((err as { name?: string })?.name === "NotAllowedError") this.blocked = true;
        });
      }
    } catch {
      this.blocked = true;
    }
  }

  private fadeTo(v: Voice, target: number, ms: number): void {
    v.target = target;
    v.rate = Math.abs(target - v.gain) / Math.max(1, ms);
  }

  private apply(): void {
    const g = LEVELS[this.level];
    for (const v of this.voices) v.audio.volume = Math.max(0, Math.min(1, v.gain * g));
  }

  private ensureTimer(): void {
    if (this.timer !== null || this.voices.length === 0) return;
    this.last = this.now();
    this.timer = this.setInt(() => this.tick(), TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer !== null) this.clearInt(this.timer);
    this.timer = null;
  }

  /** Überblendungen fortschreiben, Schleifen starten, ausgeblendete Stimmen entfernen. */
  tick(): void {
    const t = this.now();
    const dt = t - this.last;
    this.last = t;
    if (this.suspended) return;
    for (const v of [...this.voices]) {
      if (v.gain < v.target) v.gain = Math.min(v.target, v.gain + v.rate * dt);
      else if (v.gain > v.target) v.gain = Math.max(v.target, v.gain - v.rate * dt);
      const track = TRACKS[v.id]!;
      const d = v.audio.duration;
      if (!v.looped && v.id === this.current && v.target > 0 && Number.isFinite(d) && d > 0 && v.audio.currentTime >= d - track.overlap) {
        v.looped = true;
        const fade = track.overlap * 1000;
        this.fadeTo(v, 0, fade);
        const next = this.startVoice(v.id, 0);
        this.fadeTo(next, 1, fade);
      }
      if (v.target === 0 && v.gain === 0) {
        v.audio.pause();
        this.voices = this.voices.filter((x) => x !== v);
      }
    }
    this.apply();
    if (this.voices.length === 0) this.stopTimer();
  }
}
