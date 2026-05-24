import { useEffect, useRef, type KeyboardEvent } from "react";
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

function getEnabledActions(
    cancelButton: HTMLButtonElement | null,
    confirmButton: HTMLButtonElement | null,
): HTMLButtonElement[] {
    return [cancelButton, confirmButton].filter(
        (button): button is HTMLButtonElement => Boolean(button && !button.disabled),
    );
}

export function TradeConfirmDialog({
    slot,
    submitting,
    error,
    onCancel,
    onConfirm,
}: TradeConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const isOpen = Boolean(slot?.reward && slot.price);
    const canConfirm = Boolean(slot?.canTrade) && !submitting;

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        const focusTarget =
            getEnabledActions(cancelButtonRef.current, confirmButtonRef.current)[0] ??
            dialogRef.current;
        focusTarget?.focus();

        return () => {
            previousFocusRef.current?.focus();
            previousFocusRef.current = null;
        };
    }, [isOpen]);

    if (!slot?.reward || !slot.price) {
        return null;
    }

    const slotLabel = formatSlotLabel(slot.label);
    const confirmLabel = submitting ? "SUBMITTING" : "CONFIRM TRADE";

    function handleConfirm() {
        if (!slot || !slot.canTrade || submitting) {
            return;
        }

        onConfirm(slot);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Escape") {
            if (!submitting) {
                event.preventDefault();
                onCancel();
            }
            return;
        }

        if (event.key !== "Tab") {
            return;
        }

        const enabledActions = getEnabledActions(
            cancelButtonRef.current,
            confirmButtonRef.current,
        );

        event.preventDefault();

        if (enabledActions.length === 0) {
            dialogRef.current?.focus();
            return;
        }

        const activeElement = document.activeElement;
        const activeIndex =
            activeElement instanceof HTMLButtonElement
                ? enabledActions.indexOf(activeElement)
                : -1;
        const nextIndex = event.shiftKey
            ? activeIndex <= 0
                ? enabledActions.length - 1
                : activeIndex - 1
            : activeIndex === -1 || activeIndex === enabledActions.length - 1
              ? 0
              : activeIndex + 1;

        enabledActions[nextIndex]?.focus();
    }

    return (
        <div className="st-modal-backdrop">
            <div
                ref={dialogRef}
                className="st-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Confirm trade"
                tabIndex={-1}
                onKeyDown={handleKeyDown}
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
                        <span>
                            {slot.machineStockQuantity != null &&
                            slot.machineStockQuantity - slot.reward.quantity > 0
                                ? `Stock: ${slot.machineStockQuantity - slot.reward.quantity}`
                                : `${slotLabel} becomes EMPTY`}
                        </span>
                    </div>

                    {error ? <div className="st-modal__error">{error}</div> : null}

                    <div className="st-modal__actions">
                        <button
                            ref={cancelButtonRef}
                            type="button"
                            className="st-button st-button--secondary"
                            disabled={submitting}
                            onClick={onCancel}
                        >
                            CANCEL
                        </button>
                        <button
                            ref={confirmButtonRef}
                            type="button"
                            className="st-button"
                            disabled={!canConfirm}
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
