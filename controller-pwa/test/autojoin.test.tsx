// Gerendert: Auto-Join per QR-Link, alte Sitzung, NAME_TAKEN-Automatik, Profil in der Lobby ändern.
import { STORAGE_KEYS } from "@couchplay/protocol/constants";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App.js";
import { createApp } from "../src/app.js";
import { MockSocket, player, room, TOKEN } from "./helpers.js";

const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

async function start(pathname: string) {
  history.replaceState(null, "", pathname);
  const app = createApp({ pathname, url: "ws://t/ws", createSocket: (u) => new MockSocket(u), bindWindow: false });
  await act(() => render(<App app={app} />, document.getElementById("app")!));
  return app;
}

beforeEach(() => {
  localStorage.clear();
  MockSocket.reset();
  document.body.innerHTML = '<div id="app"></div>';
});
afterEach(() => render(null, document.getElementById("app")!));

describe("QR-Join", () => {
  it("wiederkehrend: tritt sofort bei (Ladeanzeige), danach URL = /", async () => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ name: "Anna", avatar: "eule" }));
    await start("/j/042137");
    expect(q("auto-joining")!.textContent).toContain("Trete Raum 042 137 bei");
    expect(q("name-input")).toBeNull();
    const ws = MockSocket.last();
    ws.open();
    expect(ws.sent[0]).toMatchObject({ t: "room.join", code: "042137", name: "Anna", avatar: "eule" });
    await act(() => {
      ws.receive({ t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN });
      ws.receive({ t: "room.state", room: room() });
    });
    expect(q("lobby-status")).not.toBeNull();
    expect(location.pathname).toBe("/");
  });

  it("alte Sitzung eines anderen Raums wird verworfen, kein Rejoin dorthin", async () => {
    localStorage.setItem(STORAGE_KEYS.playerSession, JSON.stringify({ code: "111111", playerId: "p9", token: TOKEN }));
    await start("/j/042137");
    expect(localStorage.getItem(STORAGE_KEYS.playerSession)).toBeNull();
    expect(MockSocket.all).toHaveLength(0);
    expect(q("profile-room")!.textContent).toBe("Raum 042 137");
  });

  it("NAME_TAKEN beim Auto-Join → automatisch „Anna2“; scheitert auch das → Name-Seite mit Hinweis", async () => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ name: "Anna", avatar: "eule" }));
    await start("/j/042137");
    MockSocket.last().open();
    await act(() => MockSocket.last().receive({ t: "error", code: "NAME_TAKEN", message: "x" }));
    expect(q("auto-joining")).not.toBeNull();
    MockSocket.last().open();
    expect(MockSocket.last().sent[0]).toMatchObject({ t: "room.join", name: "Anna2" });
    await act(() => MockSocket.last().receive({ t: "error", code: "NAME_TAKEN", message: "x" }));
    expect(q("auto-joining")).toBeNull();
    expect((q("name-input") as HTMLInputElement).value).toBe("Anna2");
    expect(q("name-suggestion")!.textContent).toContain("Anna3");
    // Gespeichertes Profil bleibt „Anna“ (Vorschlag ist nur für diesen Raum).
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.profile)!).name).toBe("Anna");
  });

  it("abgelaufener Raum aus dem Link → klare Meldung + Code-Eingabe", async () => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ name: "Anna", avatar: "eule" }));
    await start("/j/042137");
    MockSocket.last().open();
    await act(() => MockSocket.last().receive({ t: "error", code: "ROOM_NOT_FOUND", message: "x" }));
    expect(q("code-input")).not.toBeNull();
    expect(q("join-error")!.textContent).toContain("Diesen Raum gibt es nicht mehr");
  });

  it("ungültiger Link → Code-Eingabe mit Hinweis, URL bereinigt", async () => {
    await start("/j/12ab56");
    expect(q("code-input")).not.toBeNull();
    expect(q("join-error")!.textContent).toContain("keinen gültigen Raumcode");
    expect(location.pathname).toBe("/");
  });

  it("Auto-Join abbrechen → Name/Avatar-Seite", async () => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ name: "Anna", avatar: "eule" }));
    await start("/j/042137");
    await act(() => q("auto-join-cancel")!.click());
    expect((q("name-input") as HTMLInputElement).value).toBe("Anna");
  });
});

describe("Profil in der Lobby ändern", () => {
  async function inLobby() {
    const app = await start("/j/042137");
    await act(() => app.join("Anna", "fuchs"));
    const ws = MockSocket.last();
    await act(() => {
      ws.open();
      ws.receive({ t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN });
      ws.receive({ t: "room.state", room: room({ players: [player("p1", { name: "Anna", isHost: true }), player("p2")] }) });
    });
    return ws;
  }
  const typeName = (v: string) => {
    const el = q("profile-name-input") as HTMLInputElement;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  it("Tap auf eigenen Eintrag → Sheet → player.update; schließt nach Bestätigung, Profil gespeichert", async () => {
    const ws = await inLobby();
    await act(() => q("edit-profile")!.click());
    expect(q("profile-sheet")).not.toBeNull();
    await act(() => typeName("Anni"));
    await act(() => q("profile-avatar-krake")!.click());
    await act(() => q("profile-save")!.click());
    expect(ws.lastSent()).toEqual({ t: "player.update", name: "Anni", avatar: "krake" });
    expect(q("profile-sheet")).not.toBeNull(); // wartet auf den Server
    await act(() => ws.receive({ t: "room.state", room: room({ players: [player("p1", { name: "Anni", avatar: "krake", isHost: true }), player("p2")] }) }));
    expect(q("profile-sheet")).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.profile)!)).toEqual({ name: "Anni", avatar: "krake" });
  });

  it("Name vergeben → Fehler im Sheet, bleibt offen", async () => {
    const ws = await inLobby();
    await act(() => q("edit-profile")!.click());
    await act(() => typeName("P2"));
    await act(() => q("profile-save")!.click());
    expect(ws.lastSent()).toEqual({ t: "player.update", name: "P2" });
    await act(() => ws.receive({ t: "error", code: "NAME_TAKEN", message: "x" }));
    expect(q("profile-sheet")).not.toBeNull();
    expect(q("profile-error")!.textContent).toContain("Name schon vergeben");
  });
});
