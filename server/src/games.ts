// Eingebaute Spiele. Neue Spiele hier registrieren (eine Zeile pro Spiel).
import type { AnyGameDefinition } from "@couchplay/game-sdk";
import quiz from "@couchplay/game-quiz/server";
import schiffe from "@couchplay/game-schiffe/server";
import tictactoe from "@couchplay/game-tictactoe/server";
import wortgarten from "@couchplay/game-wortgarten/server";

export const BUILTIN_GAMES: readonly AnyGameDefinition[] = [quiz, tictactoe, wortgarten, schiffe];
