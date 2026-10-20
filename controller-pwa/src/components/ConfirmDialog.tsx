// In-App-Bestätigung statt window.confirm(): blockiert nicht den JS-Thread (Nachrichten
// laufen weiter) und verschwindet mit dem Screen, wenn sich die Phase ändert.
import { useEffect, useRef } from "preact/hooks";

export interface ConfirmDialogProps {
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({ text, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div class="dialog" role="presentation" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div class="dialog__box" role="alertdialog" aria-modal="true" aria-labelledby="dialog-text" data-testid="confirm-dialog">
        <p id="dialog-text" class="dialog__text">
          {text}
        </p>
        <div class="dialog__actions">
          <button type="button" class="btn btn--danger" data-testid="confirm-yes" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button ref={cancelRef} type="button" class="btn btn--ghost" data-testid="confirm-no" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
