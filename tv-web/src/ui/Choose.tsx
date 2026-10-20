// Teilnehmerauswahl, wenn mehr Spieler verbunden sind als das Spiel erlaubt (lobby.start.playerIds).
import { useState } from "preact/hooks";
import type { RoomState } from "@couchplay/protocol";
import { t } from "../i18n/index.js";
import { avatarEmoji, fill, playerColorVar } from "../lib/format.js";
import { connectedPlayers, defaultSelection, toggleSelection } from "../state/selectors.js";
import { Overlay } from "./common.js";
import { useApi } from "./context.js";

export function ChooseOverlay(props: { room: RoomState; min: number; max: number; onClose: () => void }) {
  const { room, min, max, onClose } = props;
  const api = useApi();
  const [selection, setSelection] = useState(() => defaultSelection(room, max));
  // Getrennte Spieler fallen aus der Auswahl heraus.
  const connected = connectedPlayers(room);
  const valid = selection.filter((id) => connected.some((p) => p.id === id));
  const ok = valid.length >= min && valid.length <= max;

  return (
    <Overlay onClose={onClose} class="choose" testId="choose-players">
      <h2>{t.choose.heading}</h2>
      <p class="muted">{min === max ? fill(t.choose.hintExact, { max }) : fill(t.choose.hint, { min, max })}</p>
      <div class="picker-list picker-grid">
        {connected.map((p, i) => {
          const checked = valid.includes(p.id);
          const full = !checked && valid.length >= max;
          return (
            <button
              key={p.id}
              class={`pick pick-player ${checked ? "is-checked" : ""}`}
              style={{ "--pc": playerColorVar(p.color) }}
              data-nav="choose"
              data-nav-autofocus={i === 0 ? true : undefined}
              data-testid="choose-player"
              data-player-id={p.id}
              role="checkbox"
              aria-checked={checked}
              aria-disabled={full ? "true" : undefined}
              onClick={() => setSelection(toggleSelection(room, valid, p.id, max))}
            >
              <span class="check" aria-hidden="true" />
              <span class="avatar avatar-small" aria-hidden="true">
                {avatarEmoji(p.avatar)}
              </span>
              {p.name}
            </button>
          );
        })}
      </div>
      <p class="choose-count">{fill(t.choose.count, { n: valid.length })}</p>
      <div class="button-row">
        <button
          class={`btn btn-primary ${ok ? "" : "is-disabled"}`}
          data-nav="choose-actions"
          data-testid="choose-start"
          aria-disabled={ok ? undefined : "true"}
          onClick={() => {
            if (!ok) return;
            api.send({ t: "lobby.start", playerIds: valid });
            onClose();
          }}
        >
          {t.choose.start}
        </button>
        <button class="btn" data-nav="choose-actions" onClick={onClose}>
          {t.choose.cancel}
        </button>
      </div>
    </Overlay>
  );
}
