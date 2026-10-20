// Avatar-Auswahl (Emoji-Raster) – Join-Seite und Profil-Sheet in der Lobby.
import { AVATAR_EMOJI, AVATAR_IDS, type AvatarId } from "@couchplay/protocol/constants";
import { t } from "../i18n/index.js";

export function AvatarGrid({ value, onChange, testIdPrefix = "avatar-option" }: { value: AvatarId; onChange(id: AvatarId): void; testIdPrefix?: string }) {
  return (
    <div class="avatars" role="radiogroup" aria-label={t.join.avatarLabel}>
      {AVATAR_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={t.avatars[id]}
          class={`avatars__opt${value === id ? " avatars__opt--on" : ""}`}
          data-testid={`${testIdPrefix}-${id}`}
          onClick={() => onChange(id)}
        >
          {AVATAR_EMOJI[id]}
        </button>
      ))}
    </div>
  );
}
