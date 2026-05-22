import { VendingSlot } from "./VendingSlot";
import type { SupplyTerminalSlot } from "./types";

interface VendingGridProps {
    slots: SupplyTerminalSlot[];
    onTrade: (slot: SupplyTerminalSlot) => void;
}

function isEmptySlot(slot: SupplyTerminalSlot): boolean {
    return slot.status === "empty" || slot.status === "sold";
}

export function VendingGrid({ slots, onTrade }: VendingGridProps) {
    const readyCount = slots.filter((slot) => slot.status === "ready").length;
    const emptyCount = slots.filter(isEmptySlot).length;

    return (
        <section className="st-panel" aria-labelledby="supply-terminal-sale-slots">
            <div className="st-panel__head">
                <div>
                    <div id="supply-terminal-sale-slots" className="st-eyebrow">
                        SALE SLOTS
                    </div>
                    <div className="st-panel__note">
                        Payment check uses player StorageUnit-owned inventory. Empty slots
                        are future vending bays.
                    </div>
                </div>

                <div className="st-counter" aria-label="Sale slot counts">
                    <span className="st-counter__ready">{readyCount} READY</span>
                    <span>{emptyCount} EMPTY</span>
                </div>
            </div>

            <div className="st-slot-grid">
                {slots.map((slot) => (
                    <VendingSlot key={slot.id} slot={slot} onTrade={onTrade} />
                ))}
            </div>
        </section>
    );
}
