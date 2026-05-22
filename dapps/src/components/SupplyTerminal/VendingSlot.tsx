import type { SupplyTerminalSlot, SupplyTerminalSlotStatus } from "./types";

interface VendingSlotProps {
    slot: SupplyTerminalSlot;
    onTrade: (slot: SupplyTerminalSlot) => void;
}

const STATUS_LABELS: Record<SupplyTerminalSlotStatus, string> = {
    ready: "READY",
    insufficient_payment: "NO PAYMENT",
    extension_not_authorized: "NO AUTH",
    out_of_stock: "NO STOCK",
    listing_disabled: "DISABLED",
    submitting: "SUBMITTING",
    empty: "EMPTY",
    sold: "EMPTY",
};

function getStatusLabel(status: SupplyTerminalSlotStatus): string {
    return STATUS_LABELS[status] ?? status.toUpperCase();
}

function isEmptyAffordance(slot: SupplyTerminalSlot): boolean {
    return slot.status === "empty" || slot.status === "sold";
}

export function VendingSlot({ slot, onTrade }: VendingSlotProps) {
    const isEmpty = isEmptyAffordance(slot);
    const statusLabel = getStatusLabel(slot.status);
    const actionLabel = isEmpty ? "EMPTY" : "TRADE";
    const actionAriaLabel = isEmpty ? `Empty ${slot.label}` : `Trade ${slot.label}`;

    function handleTrade() {
        if (!slot.canTrade) {
            return;
        }

        onTrade(slot);
    }

    return (
        <article className={`st-slot st-slot--${slot.status}`}>
            <div className="st-slot__meta">
                <span>{slot.label}</span>
                <span className="st-slot__status">{statusLabel}</span>
            </div>

            <div className="st-slot__body">
                {isEmpty ? (
                    <div className="st-slot__empty-icon" aria-hidden="true">
                        --
                    </div>
                ) : (
                    <div className="st-slot__item-icon" aria-hidden="true" />
                )}

                <div className="st-slot__content">
                    <div className="st-slot__name">
                        {isEmpty ? "No Item" : slot.reward?.name}
                    </div>
                    <div className="st-slot__detail">
                        {isEmpty
                            ? "--"
                            : `x${slot.reward?.quantity ?? 0} / ID ${slot.reward?.sandboxItemId ?? "--"}`}
                    </div>

                    <div className="st-slot__separator" />

                    <div className="st-slot__kv">
                        <span>PRICE</span>
                        <span>
                            {isEmpty
                                ? "--"
                                : `${slot.price?.name ?? "--"} x${slot.price?.quantity ?? 0}`}
                        </span>
                    </div>
                    <div className="st-slot__kv">
                        <span>CHECK</span>
                        <span>
                            {slot.canTrade ? "AVAILABLE" : slot.disabledReason ?? statusLabel}
                        </span>
                    </div>
                </div>
            </div>

            <div className="st-slot__action">
                <button
                    type="button"
                    className="st-button"
                    disabled={!slot.canTrade}
                    onClick={handleTrade}
                    aria-label={actionAriaLabel}
                >
                    {actionLabel}
                </button>
            </div>
        </article>
    );
}
