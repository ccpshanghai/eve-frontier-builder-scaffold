import type { SupplyTerminalSlot, SupplyTerminalSlotStatus } from "./types";

interface VendingSlotProps {
    slot: SupplyTerminalSlot;
    onTrade: (slot: SupplyTerminalSlot) => void;
}

const STATUS_LABELS: Record<SupplyTerminalSlotStatus, string> = {
    ready: "READY",
    wallet_disconnected: "NO WALLET",
    insufficient_payment: "NO PAYMENT",
    extension_not_authorized: "NO AUTH",
    out_of_stock: "NO STOCK",
    listing_disabled: "DISABLED",
    submitting: "SUBMITTING",
    empty: "EMPTY",
    sold: "EMPTY",
};

const BUTTON_LABELS: Record<SupplyTerminalSlotStatus, string> = {
    ready: "TRADE",
    wallet_disconnected: "Connect Wallet",
    insufficient_payment: "Insufficient Payment",
    extension_not_authorized: "Extension Unavailable",
    out_of_stock: "Out of Stock",
    listing_disabled: "Disabled",
    submitting: "Pending...",
    empty: "Empty",
    sold: "Empty",
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
    const actionLabel = BUTTON_LABELS[slot.status] ?? "TRADE";

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

                    <div className="st-slot__separator" />

                    {!isEmpty && (
                        <div className="st-slot__detail">
                            Stock: {slot.reward?.quantity ?? 0}{slot.machineStockQuantity != null ? ` / ${slot.machineStockQuantity}` : ""}
                        </div>
                    )}
                    {!isEmpty && (
                        <div className="st-slot__detail">
                            Price: {slot.price?.name ?? "--"} x{slot.price?.quantity ?? 0}
                        </div>
                    )}
                </div>
            </div>

            <div className="st-slot__action">
                <button
                    type="button"
                    className="st-button"
                    disabled={!slot.canTrade}
                    onClick={handleTrade}
                >
                    {actionLabel}
                </button>
            </div>
        </article>
    );
}
