// Startseite: Code-Eingabe → Name + Avatar → room.join.
import { AVATAR_IDS, NAME_MAX_LENGTH, type AvatarId } from "@couchplay/protocol/constants";
import { normalizeName } from "@couchplay/protocol/util";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AVATAR_EMOJI } from "../avatars.js";
import { Brand } from "../components/common.js";
import { InstallHint } from "../components/InstallHint.js";
import { useApp, useAppState } from "../hooks.js";
import { errorText, t } from "../i18n/index.js";
import { activeCell, codeCells, isCodeComplete, nextCode } from "../lib/codeInput.js";
import { loadProfile } from "../lib/storage.js";
import type { EndReason } from "../net/connection.js";

export function JoinFlow() {
  const s = useAppState();
  return s.step === "profile" && isCodeComplete(s.code) ? <ProfileStep /> : <CodeStep />;
}

function Notice({ reason }: { reason: EndReason }) {
  const app = useApp();
  return (
    <div class="notice" role="alert" data-testid="closed-notice">
      <p>{t.closed[reason]}</p>
      {reason === "version" ? (
        <button type="button" class="btn btn--small" onClick={() => location.reload()}>
          {t.closed.reload}
        </button>
      ) : (
        <button type="button" class="notice__x" aria-label={t.closed.dismiss} onClick={() => app.dismissNotice()}>
          ×
        </button>
      )}
    </div>
  );
}

function CodeStep() {
  const app = useApp();
  const s = useAppState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const cells = codeCells(s.code);
  const cursor = activeCell(s.code);
  const complete = isCodeComplete(s.code);
  const error = s.joinError && s.joinError !== "connect" ? errorText(s.joinError) : s.joinError ? t.connectError : null;

  // Fokus nur ohne Meldung setzen, sonst springt iOS sofort in die Tastatur und verdeckt sie.
  useEffect(() => {
    if (!s.notice) inputRef.current?.focus({ preventScroll: true });
  }, []);

  const onInput = (e: Event): void => {
    const el = e.currentTarget as HTMLInputElement;
    const step = nextCode(s.code, el.value);
    if (el.value !== step.code) el.value = step.code;
    app.setCode(step.code);
    if (step.completed) {
      el.blur();
      app.goToProfile();
    }
  };

  return (
    <main class="screen screen--join">
      <Brand />
      {s.notice && <Notice reason={s.notice} />}
      <section class="join">
        <h1 class="title">{t.join.title}</h1>
        <p class="lead">{t.join.lead}</p>
        <label class="code" onClick={() => inputRef.current?.focus()}>
          <span class="sr-only">{t.join.codeLabel}</span>
          <input
            ref={inputRef}
            class="code__input"
            data-testid="code-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellcheck={false}
            enterKeyHint="next"
            aria-describedby="code-hint"
            value={s.code}
            onInput={onInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && complete) app.goToProfile();
            }}
          />
          <span class="code__cells" aria-hidden="true">
            {cells.map((d, i) => (
              <span
                key={i}
                class={`code__cell${d ? " code__cell--filled" : ""}${focused && i === cursor && !complete ? " code__cell--cursor" : ""}${i === 2 ? " code__cell--gap" : ""}`}
              >
                {d}
              </span>
            ))}
          </span>
        </label>
        <p id="code-hint" class={`hint${error ? " hint--error" : ""}`} data-testid="join-error" role={error ? "alert" : undefined}>
          {error ?? t.join.codeHint}
        </p>
      </section>
      <footer class="actions">
        <InstallHint />
        <button type="button" class="btn btn--primary" data-testid="code-next" disabled={!complete} onClick={() => app.goToProfile()}>
          {t.join.next}
        </button>
      </footer>
    </main>
  );
}

function ProfileStep() {
  const app = useApp();
  const s = useAppState();
  const saved = useMemo(loadProfile, []);
  const [name, setName] = useState(saved.name ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(saved.avatar ?? AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!);
  const [touched, setTouched] = useState(false);
  const normalized = normalizeName(name);
  const length = [...name.trim()].length;
  const localError = !touched ? null : normalized.ok ? null : normalized.reason === "empty" ? t.join.nameEmpty : t.join.nameTooLong(NAME_MAX_LENGTH);
  const serverError = s.joinError ? (s.joinError === "connect" ? t.connectError : errorText(s.joinError)) : null;
  const error = localError ?? serverError;

  const submit = (e: Event): void => {
    e.preventDefault();
    setTouched(true);
    if (!normalized.ok || s.joinPending) return;
    (document.activeElement as HTMLElement | null)?.blur();
    app.join(normalized.name, avatar);
  };

  return (
    <main class="screen screen--profile">
      <Brand />
      <form class="profile" onSubmit={submit} noValidate>
        <div class="profile__head">
          <h1 class="title">{t.join.profileTitle}</h1>
          <p class="profile__room">
            <span class="chip" data-testid="profile-room">{t.join.roomLabel(s.code)}</span>
            <button type="button" class="link" data-testid="change-code" onClick={() => app.goToCode()}>
              {t.join.back}
            </button>
          </p>
        </div>

        <label class="field">
          <span class="field__label">
            {t.join.nameLabel}
            <span class={`field__count${length > NAME_MAX_LENGTH ? " field__count--over" : ""}`}>{t.join.nameCounter(length, NAME_MAX_LENGTH)}</span>
          </span>
          <input
            class="input"
            data-testid="name-input"
            type="text"
            name="nickname"
            autoComplete="nickname"
            autoCapitalize="words"
            autoCorrect="off"
            spellcheck={false}
            enterKeyHint="go"
            placeholder={t.join.namePlaceholder}
            maxLength={NAME_MAX_LENGTH * 2}
            value={name}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
            onBlur={() => name && setTouched(true)}
          />
        </label>

        <fieldset class="field">
          <legend class="field__label">{t.join.avatarLabel}</legend>
          <div class="avatars" role="radiogroup" aria-label={t.join.avatarLabel}>
            {AVATAR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={avatar === id}
                aria-label={t.avatars[id]}
                class={`avatars__opt${avatar === id ? " avatars__opt--on" : ""}`}
                data-testid={`avatar-option-${id}`}
                onClick={() => setAvatar(id)}
              >
                {AVATAR_EMOJI[id]}
              </button>
            ))}
          </div>
        </fieldset>

        <p class={`hint${error ? " hint--error" : ""}`} data-testid="join-error" role={error ? "alert" : undefined}>
          {error ?? " "}
        </p>

        <footer class="actions actions--sticky">
          <button type="submit" class="btn btn--primary" data-testid="join-button" disabled={s.joinPending}>
            {s.joinPending ? t.join.joining : t.join.submit}
          </button>
        </footer>
      </form>
    </main>
  );
}
