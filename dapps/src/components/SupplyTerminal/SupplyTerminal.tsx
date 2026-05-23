import { useCallback, useMemo, useRef, useState } from "react";
import { useSmartObject, useConnection, isOwner } from "@evefrontier/dapp-kit";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { buildSupplyTerminalSlots } from "./slots";
import { SupplyTerminalView } from "./SupplyTerminalView";
import type { ExchangeEvent, SupplyTerminalSlot } from "./types";
import { SUPPLY_TERMINAL_CONFIG } from "./config";
import { useSupplyTerminalStorage } from "./storage";
import "./SupplyTerminal.css";

export function SupplyTerminal() {
    const { assembly, loading, error: smartObjectError } = useSmartObject();
    const { isConnected } = useConnection();
    const account = useCurrentAccount();
    const dAppKit = useDAppKit();
    const {
        storage,
        loading: storageLoading,
        error: storageError,
    } = useSupplyTerminalStorage();

    const [events, setEvents] = useState<ExchangeEvent[]>([
        {
            type: "local",
            message: "Terminal inventory synchronized",
            timestamp: Date.now(),
        },
    ]);
    const [selectedTradeSlot, setSelectedTradeSlot] =
        useState<SupplyTerminalSlot | null>(null);
    const [tradeSubmitting, setTradeSubmitting] = useState(false);
    const [tradeError, setTradeError] = useState<string | null>(null);
    const [slotSold, setSlotSold] = useState(false);
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [extensionAuthorized, setExtensionAuthorized] = useState(true);
    const tradeInFlightRef = useRef(false);

    const walletConnected = isConnected && Boolean(account);
    const playerPaymentQuantity = 100;
    const machineStockQuantity = slotSold ? 0 : 1;
    const listingEnabled = true;
    const storageExtensionAuthorized = Boolean(
        storage?.extension.includes("::config::SupplyTerminalAuth"),
    );
    const supplyTerminalAuthorized =
        extensionAuthorized && storageExtensionAuthorized;
    const owner = walletConnected ? isOwner(assembly, account?.address) : false;

    const addEvent = useCallback((event: Omit<ExchangeEvent, "timestamp">) => {
        setEvents((previousEvents) => [
            ...previousEvents,
            { ...event, timestamp: Date.now() },
        ]);
    }, []);

    const slots = useMemo(
        () =>
            buildSupplyTerminalSlots({
                paymentAvailable:
                    playerPaymentQuantity >=
                    SUPPLY_TERMINAL_CONFIG.payment.quantity,
                machineStockAvailable:
                    machineStockQuantity >=
                    SUPPLY_TERMINAL_CONFIG.product.quantity,
                listingEnabled,
                extensionAuthorized: supplyTerminalAuthorized,
                submitting: tradeSubmitting,
                sold: slotSold,
                walletConnected,
            }),
        [
            listingEnabled,
            machineStockQuantity,
            playerPaymentQuantity,
            slotSold,
            supplyTerminalAuthorized,
            tradeSubmitting,
            walletConnected,
        ],
    );
    const currentSelectedTradeSlot = useMemo(
        () =>
            selectedTradeSlot
                ? (slots.find((slot) => slot.id === selectedTradeSlot.id) ??
                  null)
                : null,
        [selectedTradeSlot, slots],
    );

    const handleOpenTrade = useCallback(
        (slot: SupplyTerminalSlot) => {
            setSelectedTradeSlot(slot);
            setTradeError(null);
            addEvent({
                type: "local",
                message: `${slot.label} trade confirmation opened`,
            });
        },
        [addEvent],
    );

    const handleCancelTrade = useCallback(() => {
        setSelectedTradeSlot(null);
        setTradeError(null);
        addEvent({
            type: "local",
            message: "Trade confirmation cancelled",
        });
    }, [addEvent]);

    const handleConfirmTrade = useCallback(
        async (slot: SupplyTerminalSlot) => {
            if (tradeInFlightRef.current || tradeSubmitting) {
                return;
            }

            const currentSlot = slots.find(
                (candidate) =>
                    candidate.id === slot.id && candidate.index === slot.index,
            );

            if (!currentSlot?.canTrade) {
                const message =
                    "Selected slot is no longer available for trade";

                setTradeError(message);
                addEvent({
                    type: "local",
                    message: `Exchange blocked: ${message}`,
                });
                return;
            }

            if (!assembly || !account || !walletConnected) return;

            tradeInFlightRef.current = true;
            setTradeSubmitting(true);
            setTradeError(null);
            addEvent({
                type: "local",
                message: "Awaiting wallet confirmation",
            });

            try {
                const tx = new Transaction();
                tx.setSender(account.address);

                const result = await dAppKit.signAndExecuteTransaction({
                    transaction: tx,
                });
                const digest = (result as Record<string, unknown>).digest;

                setSlotSold(true);
                setSelectedTradeSlot(null);
                addEvent({
                    type: "chain",
                    message: "Exchange submitted",
                    ...(typeof digest === "string" ? { digest } : {}),
                });
                addEvent({
                    type: "chain",
                    message: "Exchange complete",
                    ...(typeof digest === "string" ? { digest } : {}),
                });
                addEvent({
                    type: "local",
                    message: `${slot.label} empty`,
                });
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err);

                setTradeError(message);
                addEvent({
                    type: "local",
                    message: `Exchange failed: ${message}`,
                });
            } finally {
                tradeInFlightRef.current = false;
                setTradeSubmitting(false);
            }
        },
        [
            account,
            addEvent,
            assembly,
            dAppKit,
            slots,
            tradeSubmitting,
            walletConnected,
        ],
    );

    const handleAuthorize = useCallback(async () => {
        if (!assembly || !account || !walletConnected) return;

        setIsAuthorizing(true);

        try {
            const tx = new Transaction();
            tx.setSender(account.address);

            const result = await dAppKit.signAndExecuteTransaction({
                transaction: tx,
            });
            const digest = (result as Record<string, unknown>).digest;

            setExtensionAuthorized(true);
            addEvent({
                type: "chain",
                message: "Extension authorized",
                ...(typeof digest === "string" ? { digest } : {}),
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            addEvent({
                type: "local",
                message: `Authorization failed: ${message}`,
            });
        } finally {
            setIsAuthorizing(false);
        }
    }, [account, addEvent, assembly, dAppKit, walletConnected]);

    const handleConfigure = useCallback(() => {
        addEvent({
            type: "local",
            message: "Configure entry selected",
        });
    }, [addEvent]);

    if (storageLoading) {
        return <div className="st-screen-message">Loading storage...</div>;
    }

    if (storageError) {
        return <div className="st-screen-message">Error: {storageError}</div>;
    }

    if (!storage) {
        return <div className="st-screen-message">No storage found</div>;
    }

    if (walletConnected && loading) {
        return <div className="st-screen-message">Loading assembly...</div>;
    }

    if (walletConnected && smartObjectError) {
        return (
            <div className="st-screen-message">Error: {smartObjectError}</div>
        );
    }

    if (walletConnected && !assembly) {
        return <div className="st-screen-message">No assembly found</div>;
    }

    return (
        <SupplyTerminalView
            isOwner={owner}
            extensionAuthorized={supplyTerminalAuthorized}
            isAuthorizing={isAuthorizing}
            storageStatus={storage.status}
            walletAddress={account?.address ?? null}
            slots={slots}
            events={events}
            selectedTradeSlot={currentSelectedTradeSlot}
            tradeSubmitting={tradeSubmitting}
            tradeError={tradeError}
            onAuthorize={handleAuthorize}
            onConfigure={handleConfigure}
            onOpenTrade={handleOpenTrade}
            onCancelTrade={handleCancelTrade}
            onConfirmTrade={handleConfirmTrade}
        />
    );
}
