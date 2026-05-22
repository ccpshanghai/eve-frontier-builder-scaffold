import { EventLog } from "./EventLog";
import { OwnerControls } from "./OwnerControls";
import { TradeConfirmDialog } from "./TradeConfirmDialog";
import { VendingGrid } from "./VendingGrid";
import type { ExchangeEvent, SupplyTerminalSlot } from "./types";

export interface SupplyTerminalViewProps {
    isOwner: boolean;
    extensionAuthorized: boolean;
    isAuthorizing: boolean;
    slots: SupplyTerminalSlot[];
    events: ExchangeEvent[];
    selectedTradeSlot: SupplyTerminalSlot | null;
    tradeSubmitting: boolean;
    tradeError: string | null;
    onAuthorize: () => void;
    onConfigure: () => void;
    onOpenTrade: (slot: SupplyTerminalSlot) => void;
    onCancelTrade: () => void;
    onConfirmTrade: (slot: SupplyTerminalSlot) => void;
}

export function SupplyTerminalView({
    isOwner,
    extensionAuthorized,
    isAuthorizing,
    slots,
    events,
    selectedTradeSlot,
    tradeSubmitting,
    tradeError,
    onAuthorize,
    onConfigure,
    onOpenTrade,
    onCancelTrade,
    onConfirmTrade,
}: SupplyTerminalViewProps) {
    return (
        <div className="st-terminal-shell">
            <header className="st-terminal__topbar">
                <div className="st-terminal__brand">
                    <div className="st-terminal__mark">ST</div>
                    <div>
                        <div className="st-eyebrow">EVE FRONTIER DAPP</div>
                        <div className="st-terminal__title">SUPPLY TERMINAL</div>
                    </div>
                </div>

                <div className="st-terminal__status" aria-label="Terminal status">
                    <span className="st-chip st-ok">STORAGE ONLINE</span>
                    <span className="st-chip st-chip--hot">ONE ACTIVE SLOT</span>
                </div>
            </header>

            <OwnerControls
                isOwner={isOwner}
                extensionAuthorized={extensionAuthorized}
                onAuthorize={onAuthorize}
                isAuthorizing={isAuthorizing}
                onConfigure={onConfigure}
            />

            <div className="st-terminal__content">
                <VendingGrid slots={slots} onTrade={onOpenTrade} />
                <EventLog events={events} />
            </div>

            <TradeConfirmDialog
                slot={selectedTradeSlot}
                submitting={tradeSubmitting}
                error={tradeError}
                onCancel={onCancelTrade}
                onConfirm={onConfirmTrade}
            />
        </div>
    );
}
