// Sichtprüfung: baut nicht selbst – vorher `npm run build -w controller-pwa`.
// Startet vite preview (API, wird am Ende beendet), simuliert den Server per
// Playwright-routeWebSocket und speichert Screenshots nach <repo>/.jait/shots/.
//   node controller-pwa/scripts/screenshots.mjs [webkit|chromium …]
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, devices, webkit } from "playwright";
import { preview } from "vite";

const pkg = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../..", import.meta.url));
const outDir = `${repo}.jait/shots/`;
mkdirSync(outDir, { recursive: true });

const manifest = (id) => JSON.parse(readFileSync(`${repo}games/${id}/manifest.json`, "utf8"));
const catalog = [manifest("quiz"), manifest("tictactoe")];
const TOKEN = "q8V0mZ2pYwL4nB7cR1sT6uX9dE3fG5hJ";

function defaults(game) {
  return Object.fromEntries(game.settings.map((f) => [f.key, f.default]));
}

/** Kleiner Fake-Server: genug Protokoll für Join, Lobby, Spielwahl, Settings. */
function mockServer(ws, state) {
  const send = (m) => ws.send(JSON.stringify(m));
  const pushState = () => send({ t: "room.state", room: state.room });
  state.push = (patch) => {
    Object.assign(state.room, patch);
    pushState();
  };
  ws.onMessage((raw) => {
    const m = JSON.parse(String(raw));
    switch (m.t) {
      case "room.join": {
        const me = { id: "p_me", name: m.name, avatar: m.avatar, color: 4, connected: true, isHost: true };
        state.room = {
          code: m.code,
          phase: "lobby",
          joinUrl: `http://localhost/j/${m.code}`,
          players: [
            me,
            { id: "p_b", name: "Bert", avatar: "panda", color: 1, connected: true, isHost: false },
            { id: "p_c", name: "Cleo", avatar: "einhorn", color: 7, connected: true, isHost: false },
            { id: "p_d", name: "Dario", avatar: "roboter", color: 2, connected: false, isHost: false },
          ],
          hostId: "p_me",
          tvConnected: true,
          selectedGameId: null,
          playerLimits: null,
          settings: {},
          gamePlayerIds: [],
          results: null,
        };
        send({ t: "room.joined", v: 1, code: m.code, playerId: "p_me", token: TOKEN, rid: m.rid });
        send({ t: "catalog", games: catalog });
        pushState();
        break;
      }
      case "lobby.selectGame": {
        const g = catalog.find((x) => x.id === m.gameId);
        state.push({ selectedGameId: g.id, playerLimits: { minPlayers: g.minPlayers, maxPlayers: g.maxPlayers }, settings: defaults(g) });
        break;
      }
      case "lobby.updateSettings":
        state.push({ settings: { ...state.room.settings, ...m.settings } });
        break;
      case "ping":
        send({ t: "pong", ts: m.ts, serverTime: Date.now() });
        break;
    }
  });
}

const server = await preview({ root: pkg, preview: { port: 4174, strictPort: true } });
const base = "http://localhost:4174";

const wanted = process.argv.slice(2);
const profiles = [
  { tag: "iphone13", device: "iPhone 13", engine: webkit },
  { tag: "pixel7", device: "Pixel 7", engine: chromium },
].filter((p) => wanted.length === 0 || wanted.includes(p.engine.name()));

try {
  for (const p of profiles) {
    let browser;
    try {
      browser = await p.engine.launch();
    } catch (e) {
      console.warn(`${p.engine.name()} nicht startbar → Fallback Chromium mit ${p.device}-Profil:`, String(e).split("\n")[0]);
      browser = await chromium.launch();
    }
    const { defaultBrowserType: _ignored, ...device } = devices[p.device];
    const context = await browser.newContext({ ...device, serviceWorkers: "block" });
    const page = await context.newPage();
    const state = {};
    await page.routeWebSocket(/\/ws$/, (ws) => mockServer(ws, state));
    const shot = async (name) => {
      await page.waitForTimeout(250);
      const file = `${outDir}controller-${p.tag}-${name}.png`;
      await page.screenshot({ path: file });
      console.log("→", file);
    };

    await page.goto(base + "/");
    await page.getByTestId("code-input").waitFor();
    await page.getByTestId("code-input").pressSequentially("0421");
    await shot("join");

    await page.getByTestId("code-input").pressSequentially("37");
    await page.getByTestId("name-input").fill("Anna");
    await page.getByTestId("avatar-option-fuchs").click();
    await shot("profile");

    await page.getByTestId("join-button").click();
    await page.getByTestId("lobby-status").waitFor();
    await page.getByTestId("game-option-quiz").click();
    await page.getByTestId("host-settings").waitFor();
    await page.evaluate(() => document.getElementById("app").scrollTo(0, 0));
    await shot("lobby-host");
    await page.evaluate(() => document.getElementById("app").scrollTo(0, 99999));
    await shot("lobby-host-settings");

    await page.getByTestId("game-option-tictactoe").click();
    await page.getByTestId("host-participants").waitFor();
    await page.evaluate(() => document.getElementById("app").scrollTo(0, 99999));
    await shot("lobby-host-participants");

    state.push({ phase: "game", gamePlayerIds: ["p_b", "p_c"] });
    await page.getByTestId("spectator-screen").waitFor();
    await shot("spectator");

    state.push({
      phase: "results",
      results: {
        gameId: "tictactoe",
        ranking: [
          { playerId: "p_me", score: 3, rank: 1 },
          { playerId: "p_b", score: 1, rank: 2 },
        ],
      },
      gamePlayerIds: ["p_me", "p_b"],
    });
    await page.getByTestId("results").waitFor();
    await shot("results");

    state.push({
      phase: "results",
      results: {
        gameId: "tictactoe",
        ranking: [{ playerId: "p_me", score: 0, rank: 1 }],
        data: { winnerId: "bot", bot: { difficulty: "unbesiegbar", mark: "O" }, series: {}, outcome: "win", players: [] },
      },
      gamePlayerIds: ["p_me"],
    });
    await page.getByTestId("bot-wins").waitFor();
    await shot("results-bot");

    await browser.close();
  }
} finally {
  await new Promise((r) => server.httpServer.close(r));
}
