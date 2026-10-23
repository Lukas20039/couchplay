// App-weiter Musik-Player (eine Instanz) + Hook für die Lautstärkestufe in der UI.
import { TV_PATH } from "@couchplay/protocol/constants";
import { useEffect, useState } from "preact/hooks";
import { LEVEL_STORAGE_KEY, MusicPlayer, loadLevel, type Level } from "./music.js";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let player: MusicPlayer | null = null;
const listeners = new Set<(l: Level) => void>();

export function music(): MusicPlayer {
  if (!player) {
    player = new MusicPlayer({ base: `${TV_PATH}music/` });
    player.setLevel(loadLevel(storage()));
  }
  return player;
}

export function setMusicLevel(level: Level): void {
  music().setLevel(level);
  try {
    storage()?.setItem(LEVEL_STORAGE_KEY, String(level));
  } catch {
    // Speicher voll/gesperrt: Stufe gilt nur bis zum Neuladen.
  }
  for (const fn of listeners) fn(level);
}

/** Aktuelle Stufe + Weiterschalten (Aus → Leise → Mittel → Laut → Aus). */
export function useMusicLevel(): [Level, () => void] {
  const [level, setLevel] = useState<Level>(() => music().volumeLevel);
  useEffect(() => {
    listeners.add(setLevel);
    return () => {
      listeners.delete(setLevel);
    };
  }, []);
  return [level, () => setMusicLevel(((level + 1) % 4) as Level)];
}
