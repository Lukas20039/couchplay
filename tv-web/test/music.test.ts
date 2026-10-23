// Hintergrundmusik: Stückwahl je Raumphase, Überblendung, Schleife, Stufen, Autoplay-Sperre.
import { describe, expect, it } from "vitest";
import { MusicPlayer, TRACKS, loadLevel, trackFor, type AudioLike } from "../src/audio/music.js";

class FakeAudio implements AudioLike {
  static all: FakeAudio[] = [];
  src = "";
  volume = 1;
  currentTime = 0;
  duration = 60;
  preload = "";
  loop = false;
  paused = true;
  constructor() {
    FakeAudio.all.push(this);
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
}

function setup() {
  FakeAudio.all = [];
  let t = 0;
  const player = new MusicPlayer({
    base: "/tv/music/",
    createAudio: () => new FakeAudio(),
    now: () => t,
    setInterval: () => 1,
    clearInterval: () => {},
  });
  const advance = (ms: number) => {
    for (let i = 0; i < ms / 100; i++) {
      t += 100;
      player.tick();
    }
  };
  const playing = () => FakeAudio.all.filter((a) => !a.paused);
  return { player, advance, playing };
}

describe("trackFor", () => {
  it("wählt Lobby, Spiel und Ergebnis; Startbildschirm still; unbekanntes Spiel → Lobby", () => {
    expect(trackFor(null)).toBeNull();
    expect(trackFor({ phase: "lobby", selectedGameId: "quiz" })).toBe("lobby");
    expect(trackFor({ phase: "game", selectedGameId: "schiffe" })).toBe("schiffe");
    expect(trackFor({ phase: "game", selectedGameId: "neu" })).toBe("lobby");
    expect(trackFor({ phase: "results", selectedGameId: "quiz" })).toBe("results");
  });

  it("jedes eingebaute Spiel hat ein Stück", () => {
    for (const id of ["quiz", "tictactoe", "wortgarten", "schiffe", "blockblast"]) expect(TRACKS[id]).toBeDefined();
  });

  it("Lautstärkestufe aus dem Speicher, sonst Mittel", () => {
    expect(loadLevel(null)).toBe(2);
    expect(loadLevel({ getItem: () => "0" })).toBe(0);
    expect(loadLevel({ getItem: () => "9" })).toBe(2);
  });
});

describe("MusicPlayer", () => {
  it("blendet ein, beim Wechsel alt aus und neu ein", () => {
    const { player, advance, playing } = setup();
    player.setTrack("lobby");
    expect(playing()).toHaveLength(1);
    expect(playing()[0]!.src).toBe("/tv/music/lobby.mp3");
    advance(1500);
    expect(playing()[0]!.volume).toBeCloseTo(0.45);
    player.setTrack("quiz");
    advance(600);
    expect(playing()).toHaveLength(2);
    advance(1000);
    expect(playing().map((a) => a.src)).toEqual(["/tv/music/quiz.mp3"]);
    player.setTrack("quiz"); // gleiches Stück → nichts Neues
    expect(FakeAudio.all).toHaveLength(2);
  });

  it("Schleife: kurz vor Ende startet das Stück neu und überblendet", () => {
    const { player, advance, playing } = setup();
    player.setTrack("wortgarten");
    advance(1500);
    const first = playing()[0]!;
    first.currentTime = first.duration - TRACKS.wortgarten!.overlap;
    advance(100);
    expect(playing()).toHaveLength(2);
    advance(TRACKS.wortgarten!.overlap * 1000 + 200);
    expect(playing()).toHaveLength(1);
    expect(playing()[0]).not.toBe(first);
    expect(playing()[0]!.volume).toBeCloseTo(0.45);
  });

  it("Stufe Aus hält an, Stufe wieder an startet das aktuelle Stück", () => {
    const { player, playing } = setup();
    player.setTrack("lobby");
    player.setLevel(0);
    expect(playing()).toHaveLength(0);
    player.setTrack("results");
    expect(playing()).toHaveLength(0);
    player.setLevel(3);
    expect(playing().map((a) => a.src)).toEqual(["/tv/music/results.mp3"]);
  });

  it("Autoplay gesperrt → nach Nutzeraktion erneut abspielen; Hintergrund pausiert", async () => {
    const { player, playing } = setup();
    const orig = FakeAudio.prototype.play;
    FakeAudio.prototype.play = function (this: FakeAudio) {
      return Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    };
    player.setTrack("lobby");
    await Promise.resolve();
    await Promise.resolve();
    expect(player.blocked).toBe(true);
    FakeAudio.prototype.play = orig;
    player.unlock();
    expect(playing()).toHaveLength(1);
    player.setSuspended(true);
    expect(playing()).toHaveLength(0);
    player.setSuspended(false);
    expect(playing()).toHaveLength(1);
  });
});
