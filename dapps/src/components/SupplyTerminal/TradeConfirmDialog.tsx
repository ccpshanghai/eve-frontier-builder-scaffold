import type { SupplyTerminalSlot } from "./types";

interface TradeConfirmDialogProps {
    slot: SupplyTerminalSlot | null;
    submitting: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: (slot: SupplyTerminalSlot) => void;
}

function formatSlotLabel(label: string): string {
    return label.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatItem(item: { name: string; quantity: number }): string {
    return `${item.name} x${item.quantity}`;
}

export function TradeConfirmDialog({
    slot,
    submitting,
    error,
    onCancel,
    onConfirm,
}: TradeConfirmDialogProps) {
    if (!slot?.reward || !slot.price) {
        return null;
    }

    const slotLabel = formatSlotLabel(slot.label);
    const confirmLabel = submitting ? "SUBMITTING" : "CONFIRM TRADE";

    function handleConfirm() {
        if (!slot || submitting) {
            return;
        }

        onConfirm(slot);
    }

    return (
        <div className="st-modal-backdrop">
            <div
                className="st-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Confirm trade"
            >
                <div className="st-modal__head">
                    <div>
                        <div className="st-eyebrow">CONFIRM TRADE</div>
                        <div className="st-modal__title">{slotLabel}</div>
                    </div>
                    <div className="st-chip st-chip--hot">READY</div>
                </div>

                <div className="st-modal__body">
                    <div className="st-modal__row">
                        <span>RECEIVE</span>
                        <span>{formatItem(slot.reward)}</span>
                    </div>
                    <div className="st-modal__row">
                        <span>PAY</span>
                        <span>{formatItem(slot.price)}</span>
                    </div>
                    <div className="st-modal__row">
                        <span>PRICE CHECK</span>
                        <span className="st-ok">AVAILABLE</span>
                    </div>
                    <div className="st-modal__row">
                        <span>ON SUCCESS</span>
                        <span>{slotLabel} becomes EMPTY</span>
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
                            onClick={handleConfirm}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
