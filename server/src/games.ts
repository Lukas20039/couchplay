// Eingebaute Spiele. Neue Spiele hier registrieren (eine Zeile pro Spiel).
import type { AnyGameDefinition } from "@couchplay/game-sdk";
import blockblast from "@couchplay/game-blockblast/server";
import flunkern from "@couchplay/game-flunkern/server";
import kennstdu from "@couchplay/game-kennstdu/server";
import quiz from "@couchplay/game-quiz/server";
import allesodernichts from "@couchplay/game-allesodernichts/server";
import schaetzen from "@couchplay/game-schaetzen/server";
import sortiert from "@couchplay/game-sortiert/server";
import schiffe from "@couchplay/game-schiffe/server";
import tictactoe from "@couchplay/game-tictactoe/server";
import wuerdeeher from "@couchplay/game-wuerdeeher/server";
import zeichnen from "@couchplay/game-zeichnen/server";
import wortgarten from "@couchplay/game-wortgarten/server";
import stadtland from "@couchplay/game-stadtland/server";
import spion from "@couchplay/game-spion/server";
import viergewinnt from "@couchplay/game-viergewinnt/server";

export const BUILTIN_GAMES: readonly AnyGameDefinition[] = [quiz, allesodernichts, schaetzen, sortiert, flunkern, zeichnen, kennstdu, wuerdeeher, stadtland, spion, tictactoe, wortgarten, schiffe, viergewinnt, blockblast];
