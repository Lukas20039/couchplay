// Bottom-Sheet: eigenen Namen/Avatar in der Lobby ändern (player.update).
// Bleibt offen, bis der Server die Änderung in room.state bestätigt oder ablehnt.
import type { Player } from "@couchplay/protocol";
import { NAME_MAX_LENGTH, type AvatarId } from "@couchplay/protocol/constants";
import type { ErrorCode } from "@couchplay/protocol/errors";
import { normalizeName } from "@couchplay/protocol/util";
import { useEffect, useState } from "preact/hooks";
import { useApp, useAppState } from "../hooks.js";
import { errorText, t } from "../i18n/index.js";
import { saveProfile } from "../lib/storage.js";
import { AvatarGrid } from "./AvatarGrid.js";

/** Fehler, die zu einer Profiländerung gehören (kommen ohne rid-Zuordnung als Toast). */
const PROFILE_ERRORS: readonly ErrorCode[] = ["NAME_TAKEN", "NAME_INVALID", "RATE_LIMITED", "INVALID_PHASE"];

export function ProfileSheet({ me, onClose }: { me: Player; onClose(): void }) {
  const app = useApp();
  const s = useAppState();
  const [name, setName] = useState(me.name);
  const [avatar, setAvatar] = useState<AvatarId>(me.avatar);
  const [pending, setPending] = useState<{ name: string; avatar: AvatarId; toastId: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeName(name);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Bestätigung: room.state zeigt die neuen Werte.
  useEffect(() => {
    if (pending && me.name === pending.name && me.avatar === pending.avatar) {
      saveProfile({ name: pending.name, avatar: pending.avatar });
      onClose();
    }
  }, [me.name, me.avatar, pending]);

  // Ablehnung: neuer Fehler nach dem Absenden.
  const toast = s.toast;
  useEffect(() => {
    if (pending && toast && toast.id > pending.toastId && PROFILE_ERRORS.includes(toast.code)) {
      setError(errorText(toast.code));
      setPending(null);
    }
  }, [toast?.id]);

  const submit = (e: Event): void => {
    e.preventDefault();
    if (!normalized.ok) {
      setError(normalized.reason === "empty" ? t.join.nameEmpty : t.join.nameTooLong(NAME_MAX_LENGTH));
      return;
    }
    setError(null);
    const target = { name: normalized.name, avatar };
    if (target.name === me.name && target.avatar === me.avatar) {
      onClose();
      return;
    }
    if (!app.updateProfile(target.name, target.avatar)) {
      setError(t.connection.reconnecting);
      return;
    }
    setPending({ ...target, toastId: s.toast?.id ?? 0 });
  };

  return (
    <div class="dialog" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form class="dialog__box sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" data-testid="profile-sheet" onSubmit={submit} noValidate>
        <h2 id="sheet-title" class="subtitle">
          {t.lobby.sheetTitle}
        </h2>
        <label class="field field--tight">
          <span class="field__label">
            {t.join.nameLabel}
            <span class="field__count">{t.join.nameCounter([...name.trim()].length, NAME_MAX_LENGTH)}</span>
          </span>
          <input
            class="input"
            data-testid="profile-name-input"
            type="text"
            autoComplete="nickname"
            autoCapitalize="words"
            autoCorrect="off"
            spellcheck={false}
            enterKeyHint="done"
            maxLength={NAME_MAX_LENGTH * 2}
            value={name}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <fieldset class="field field--tight">
          <legend class="field__label">{t.join.avatarLabel}</legend>
          <AvatarGrid value={avatar} onChange={setAvatar} testIdPrefix="profile-avatar" />
        </fieldset>
        <p class={`hint${error ? " hint--error" : ""}`} data-testid="profile-error" role={error ? "alert" : undefined}>
          {error ?? " "}
        </p>
        <div class="dialog__actions">
          <button type="submit" class="btn btn--primary" data-testid="profile-save" disabled={!!pending}>
            {pending ? t.lobby.saving : t.lobby.save}
          </button>
          <button type="button" class="btn btn--ghost" data-testid="profile-cancel" onClick={onClose}>
            {t.dialog.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
