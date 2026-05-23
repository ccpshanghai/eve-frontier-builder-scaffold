import { EventLog } from "./EventLog";
import { OwnerControls } from "./OwnerControls";
import { TradeConfirmDialog } from "./TradeConfirmDialog";
import { VendingGrid } from "./VendingGrid";
import type { ExchangeEvent, SupplyTerminalSlot } from "./types";

export interface SupplyTerminalViewProps {
    isOwner: boolean;
    extensionAuthorized: boolean;
    isAuthorizing: boolean;
    storageStatus: string;
    walletAddress: string | null;
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
    storageStatus,
    walletAddress,
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
                        <div className="st-terminal__title">
                            SUPPLY TERMINAL
                        </div>
                    </div>
                </div>

                <div
                    className="st-terminal__status"
                    aria-label="Terminal status"
                >
                    <span className="st-chip">
                        STORAGE <span className="st-ok">{storageStatus}</span>
                    </span>
                    <span className="st-chip st-chip--hot">
                        {formatWalletAddress(walletAddress)}
                    </span>
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

function formatWalletAddress(address: string | null): string {
    if (!address) return "WALLET --";
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
