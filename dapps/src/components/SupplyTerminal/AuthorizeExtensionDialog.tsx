interface AuthorizeExtensionDialogProps {
  open: boolean;
  submitting: boolean;
  error: string | null;
  storageId?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function formatObjectId(id: string | undefined): string {
  if (!id) return "UNKNOWN";
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}...${id.slice(-6)}`;
}

export function AuthorizeExtensionDialog({
  open,
  submitting,
  error,
  storageId,
  onCancel,
  onConfirm,
}: AuthorizeExtensionDialogProps) {
  if (!open) return null;

  return (
    <div className="st-modal-backdrop">
      <div
        className="st-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Authorize extension"
      >
        <div className="st-modal__head">
          <div>
            <div className="st-eyebrow">AUTHORIZE EXTENSION</div>
            <div className="st-modal__title">
              Bind Supply Terminal Extension
            </div>
          </div>
          <div className="st-chip st-chip--hot">OWNER</div>
        </div>

        <div className="st-modal__body">
          <div className="st-modal__row">
            <span>STORAGE UNIT</span>
            <span>{formatObjectId(storageId)}</span>
          </div>
          <div className="st-modal__row">
            <span>EXTENSION</span>
            <span>SupplyTerminalAuth</span>
          </div>
          <div className="st-modal__row">
            <span>ON SUCCESS</span>
            <span>Supply Terminal authorized</span>
          </div>

          {error ? <div className="st-modal__error">{error}</div> : null}

          <div className="st-modal__actions">
            <button
              type="button"
              className="st-button st-button--secondary"
              disabled={submitting}
              onClick={onCancel}
            >
              CANCEL
            </button>
            <button
              type="button"
              className="st-button"
              disabled={submitting}
              onClick={onConfirm}
            >
              {submitting ? "AUTHORIZING" : "AUTHORIZE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
